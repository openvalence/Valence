// gen_growth_transcript -- records the transcript valence-growth.test.mjs replays:
// a lib/valence Hub through live catalog growth (RFC-077, SPEC §6.4, §8.6),
// talking to a scripted client that sends what valence-js sends.
// Constraints: every hub frame comes from the library Hub; every client frame
//   from the library encoders; nothing here is hand-assembled wire.
// Output: `CATALOG <hex>` (the first catalog's bytes, for the client's cache),
//   then per step `STEP <name>`, `H2C <frame hex>` for each frame the hub sent
//   and `C2H <frame hex>` for each frame the client answered with.
// Build and run from the repo root:
//   g++ -std=gnu++2b -I lib/valence/include clients/js/test/fixtures/gen_growth_transcript.cpp -o gen.exe
//   ./gen.exe > clients/js/test/fixtures/growth-transcript.txt
#include <array>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <span>
#include <vector>

#include "valence/channel/catalog_channel.hpp"
#include "valence/conformance/mini_catalog.hpp"
#include "valence/core/clock.hpp"
#include "valence/core/rng.hpp"
#include "valence/hub/hub.hpp"
#include "valence/transport/inprocess_binding.hpp"
#include "valence/wire/blob_chunks.hpp"
#include "valence/wire/catalog_codec.hpp"
#include "valence/wire/frame_header.hpp"
#include "valence/wire/messages/blob_req.hpp"
#include "valence/wire/messages/hello.hpp"
#include "valence/wire/raw/blob_done.hpp"
#include "valence/wire/raw/catalog_ready.hpp"

using namespace valence;

namespace {

using Bytes = std::vector<std::byte>;

void need(bool ok, const char* what) {
    if (ok) return;
    std::fprintf(stderr, "gen_growth_transcript: %s\n", what);
    std::exit(1);
}

void hexLine(const char* tag, std::span<const std::byte> b) {
    std::printf("%s ", tag);
    for (std::byte x : b) std::printf("%02X", unsigned(x));
    std::printf("\n");
}

constexpr uint16_t sliceId(uint16_t k, uint16_t r) {
    return uint16_t(0x8000 + limits::accessory_slice_ids * k + r);
}

// `catalog` (0x0001), the mini catalog, an optional extra device entry (a
// change outside the user space), the user-space mark, then each accessory in
// `slices`: a status STATE r=1 and a level STATE r=2.
void build(Catalog32& c, std::initializer_list<uint16_t> slices, bool extraDevice = false) {
    static Catalog32 mini;
    static const bool built = conformance::buildMiniCatalog(mini);
    need(built, "mini catalog");
    c.clear();
    need(addCatalogChannel(c), "catalog channel");
    for (uint16_t i = 0; i < mini.count; ++i) need(c.addEntryFrom(mini, mini.entries[i]), "mini entry");
    if (extraDevice) {
        c.addEntry({.id = 0x00A0, .name = "fan", .cls = ChannelClass::STATE, .dir = Direction::h2c,
                    .access = AccessLevel::watch, .maxRateHz = 0.0f, .defaultPriority = Priority::normal});
        c.addLayoutField({.name = "rpm", .type = PackedFieldType::u16, .unit = "rpm", .scale = 1.0f});
    }
    c.markUserSpace();
    static constexpr std::string_view kStatus[] = {"acc0-status", "acc1-status", "acc2-status"};
    static constexpr std::string_view kLevel[] = {"acc0-level", "acc1-level", "acc2-level"};
    for (uint16_t k : slices) {
        c.addEntry({.id = sliceId(k, 1), .name = kStatus[k], .cls = ChannelClass::STATE, .dir = Direction::h2c,
                    .access = AccessLevel::watch, .maxRateHz = 0.0f, .defaultPriority = Priority::normal});
        c.addLayoutField({.name = "state", .type = PackedFieldType::u8, .unit = "", .scale = 1.0f});
        c.addLayoutField({.name = "fault", .type = PackedFieldType::u8, .unit = "", .scale = 1.0f});
        c.addLayoutField({.name = "beacon_seq", .type = PackedFieldType::u16, .unit = "count", .scale = 1.0f});
        c.addEntry({.id = sliceId(k, 2), .name = kLevel[k], .cls = ChannelClass::STATE, .dir = Direction::h2c,
                    .access = AccessLevel::watch, .maxRateHz = 10.0f, .defaultPriority = Priority::normal});
        c.addLayoutField({.name = "level", .type = PackedFieldType::u8, .unit = "%", .scale = 1.0f});
    }
    need(c.ok(), "catalog overflow");
}

Bytes encoded(const Catalog32& c) {
    Bytes buf(Hub::catalogScratchCapacity());
    const size_t n = encodeCatalog(c, std::span<std::byte>(buf));
    need(n > 0, "catalog encode");
    buf.resize(n);
    return buf;
}

std::array<std::byte, limits::etag_bytes> etagOf(std::span<const std::byte> bytes) {
    const auto d = Sha256::hash(bytes);
    std::array<std::byte, limits::etag_bytes> e{};
    std::copy_n(d.begin(), e.size(), e.begin());
    return e;
}

class Delegate final : public HubDelegate {
public:
    Result<IntentValueMap, NackCode> applyIntent(uint16_t, const IntentValueMap& requested, AccessLevel,
                                                  bool& cfgChanged) override {
        cfgChanged = false;
        return Result<IntentValueMap, NackCode>::ok(requested);
    }
    void onEstop(uint8_t, uint8_t) override {}
};

Hub* g_hub = nullptr;
ManualClock* g_clock = nullptr;
ITransport* g_ep = nullptr;

// Every frame the hub has sent so far, as H2C lines.
int drainToTranscript(ITransport& ep, uint16_t* chunkCountOut = nullptr) {
    int chunks = 0;
    while (auto fb = ep.read()) {
        hexLine("H2C", fb->bytes());
        const auto h = fb->header();
        if (h && h->type == uint8_t(FrameType::BLOB_CHUNK)) {
            ++chunks;
            BlobChunkHeader bh{};
            if (chunkCountOut && getBlobChunkHeader(fb->payload(), bh)) *chunkCountOut = bh.chunk_count;
        }
    }
    return chunks;
}

int tick(int n = 1, uint16_t* chunkCountOut = nullptr) {
    int chunks = 0;
    for (int i = 0; i < n; ++i) {
        g_clock->advanceUs(1000);
        g_hub->update(g_clock->nowUs());
        chunks += drainToTranscript(*g_ep, chunkCountOut);
    }
    return chunks;
}

// The client's frame: written to the hub and recorded as a C2H line.
void send(FrameType type, std::span<const std::byte> payload) {
    std::array<std::byte, 600> buf{};
    FrameHeader h;
    h.type = uint8_t(type);
    h.len = uint16_t(payload.size());
    const size_t pos = encodeFrameHeader(h, std::span<std::byte>(buf));
    need(pos > 0, "frame header");
    if (!payload.empty()) std::memcpy(buf.data() + pos, payload.data(), payload.size());
    const std::span<const std::byte> frame(buf.data(), pos + payload.size());
    hexLine("C2H", frame);
    need(g_ep->write(frame), "client write");
}

void sendCatalogRequest() {
    BlobReqMsg m{};
    m.full = true;
    std::array<std::byte, 16> buf{};
    const size_t n = encodeBlobReq(m, std::span<std::byte>(buf));
    need(n > 0, "BLOB_REQ");
    send(FrameType::BLOB_REQ, std::span<const std::byte>(buf.data(), n));
}

// What valence-js answers a verified catalog with: BLOB_DONE, then CATALOG_READY.
void sendAdopted(const Bytes& catalog) {
    BlobDoneMsg d{};
    d.status = BlobDoneStatus::VerifiedComplete;
    std::array<std::byte, kBlobDoneBytes> done{};
    need(encodeBlobDone(d, std::span<std::byte>(done)) == kBlobDoneBytes, "BLOB_DONE");
    send(FrameType::BLOB_DONE, std::span<const std::byte>(done));
    const auto etag = etagOf(std::span<const std::byte>(catalog));
    send(FrameType::CATALOG_READY, std::span<const std::byte>(etag));
}

// Ticks until every chunk of the transfer has arrived.
void finishTransfer() {
    int already = 0;
    uint16_t expected = 0;
    for (int i = 0; i < 64 && (expected == 0 || already < expected); ++i) already += tick(1, &expected);
    need(expected > 0 && already == expected, "transfer did not complete");
}

}  // namespace

int main() {
    Catalog32 cat;
    build(cat, {0});
    ManualClock clock;
    XorShift32 rng(7731);
    Delegate del;
    Hub hub(cat, clock, rng, del);
    InProcessLink link(clock, rng);
    g_hub = &hub;
    g_clock = &clock;
    g_ep = &link.endpointB();
    const std::array<std::byte, 1> level{std::byte{42}};
    need(hub.publishState(sliceId(0, 2), std::span<const std::byte>(level)), "level publish");
    need(hub.attachTransport(link.endpointA()), "attach");
    need(link.endpointB().open(), "open");

    const Bytes v1 = encoded(cat);
    hexLine("CATALOG", std::span<const std::byte>(v1));

    // valence-js HELLO with the v1 etag cached and wishes for safety (critical)
    // and acc0-level, plus the `catalog` wish every client carries (RFC-077).
    std::printf("STEP hello\n");
    HelloMsg h{};
    h.proto_ver = kProtocolVersion;
    h.client_kind = "test";
    h.client_name = "growth";
    for (int i = 0; i < 8; ++i) h.instance_id[i] = std::byte(0x40 + i);
    h.has_catalog_etag = true;
    h.catalog_etag = etagOf(std::span<const std::byte>(v1));
    h.subscriptions_count = 3;
    h.subscriptions[0] = SubscriptionWish{.channel_id = channels::safety, .rate_hz = 0.0f, .priority = 3};
    h.subscriptions[1] = SubscriptionWish{.channel_id = sliceId(0, 2), .rate_hz = 10.0f, .priority = 1};
    h.subscriptions[2] = SubscriptionWish{.channel_id = channels::catalog, .rate_hz = 0.0f, .priority = 1};
    std::array<std::byte, 400> hb{};
    const size_t hn = encodeHello(h, std::span<std::byte>(hb));
    need(hn > 0, "HELLO");
    send(FrameType::HELLO, std::span<const std::byte>(hb.data(), hn));

    std::printf("STEP welcome\n");  // etag matched: ready at WELCOME, retained pushes follow
    tick(3);

    std::printf("STEP join-announce\n");  // acc1 joins: 0x0001 announces v2
    build(cat, {0, 1});
    need(hub.catalogChanged() == Hub::CatalogChange::UserSpace, "join is a user-space change");
    drainToTranscript(*g_ep);
    tick();
    sendCatalogRequest();

    std::printf("STEP join-transfer\n");
    finishTransfer();
    sendAdopted(encoded(cat));
    tick();

    std::printf("STEP forget-announce\n");  // acc0 forgotten: its granted level is withdrawn
    build(cat, {1});
    need(hub.catalogChanged() == Hub::CatalogChange::UserSpace, "forget is a user-space change");
    drainToTranscript(*g_ep);
    tick();
    sendCatalogRequest();

    std::printf("STEP forget-partial\n");  // the first chunks only
    uint16_t forgetChunks = 0;
    const int partial = tick(1, &forgetChunks);
    need(partial > 0 && partial < forgetChunks, "the forget transfer must span ticks");

    std::printf("STEP abort\n");  // acc2 joins mid-transfer: one CHUNK_UNAVAILABLE ends it
    build(cat, {1, 2});
    need(hub.catalogChanged() == Hub::CatalogChange::UserSpace, "second join is a user-space change");
    drainToTranscript(*g_ep);
    sendCatalogRequest();

    std::printf("STEP abort-transfer\n");  // the announcement and the restarted transfer
    finishTransfer();
    sendAdopted(encoded(cat));
    tick();

    std::printf("STEP resync-announce\n");  // a device entry appears: outside the user space
    build(cat, {1, 2}, /*extraDevice=*/true);
    need(hub.catalogChanged() == Hub::CatalogChange::Resync, "a fixed change re-syncs");
    drainToTranscript(*g_ep);
    tick();
    sendCatalogRequest();

    std::printf("STEP resync-transfer\n");
    finishTransfer();
    sendAdopted(encoded(cat));

    std::printf("STEP resync-ready\n");  // readiness back: every grant re-pushes
    tick(3);
    return 0;
}
