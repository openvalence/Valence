// test_valence_growth — live catalog growth (SPEC §6.4, §8.6, §8.10; RFC-077).
//
// The catalog changes at runtime only behind the user-space mark: an accessory
// join, a declaration replacement, a forget. Every fixed (core and device)
// entry a session decoded stays byte-identical, readiness survives, `catalog`
// (0x0001) announces the new etag, vanished or changed channels are withdrawn
// with one CHANNEL_WITHDRAWN per grant, and a catalog transfer in flight ends
// with one CHUNK_UNAVAILABLE. A change to a fixed entry re-syncs instead.
//
// Native harness as test_valence_readygate: InProcessLink + ManualClock +
// XorShift32, raw hand-built frames where the exact wire matters, the library
// Client where the client half is under test.
//
// Suite ids: GR-xx.

#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>

#include "valence/channel/catalog_channel.hpp"
#include "valence/client/client.hpp"
#include "valence/conformance/catalog_check.hpp"
#include "valence/conformance/mini_catalog.hpp"
#include "valence/core/clock.hpp"
#include "valence/core/rng.hpp"
#include "valence/hub/hub.hpp"
#include "valence/transport/inprocess_binding.hpp"
#include "valence/util/byte_io.hpp"
#include "valence/wire/blob_chunks.hpp"
#include "valence/wire/catalog_codec.hpp"
#include "valence/wire/frame_header.hpp"
#include "valence/wire/messages/blob_req.hpp"
#include "valence/wire/messages/grant.hpp"
#include "valence/wire/messages/hello.hpp"
#include "valence/wire/messages/intent.hpp"
#include "valence/wire/messages/nack.hpp"
#include "valence/wire/messages/subscribe.hpp"
#include "valence/wire/messages/welcome.hpp"
#include "valence/wire/raw/catalog_ready.hpp"
#include "valence/wire/sha256.hpp"
#include "valence/wire/stream_bundle.hpp"

#include <algorithm>
#include <array>
#include <cstring>
#include <optional>
#include <utility>
#include <vector>

using namespace valence;

namespace {

using Etag = std::array<std::byte, limits::etag_bytes>;
using Bytes = std::vector<std::byte>;

constexpr uint16_t kSafetyCh = 0x0003;  // mini: STATE, critical, retained by the hub
constexpr uint16_t kStatusCh = 0x0082;  // mini: STATE, 10 Hz
constexpr uint16_t kConfigCh = 0x0084;  // mini: INTENT, control

// SPEC §8.10: slice k's channels are 0x8000 + accessory_slice_ids * k + r.
constexpr uint16_t sliceId(uint16_t k, uint16_t r) {
    return uint16_t(0x8000 + limits::accessory_slice_ids * k + r);
}

const Catalog32& mini() {
    static Catalog32 c;
    static const bool built = conformance::buildMiniCatalog(c);
    (void)built;
    return c;
}

// The hub's own channels: `catalog` (0x0001), the frozen mini catalog, then
// the user-space mark.
void buildFixed(Catalog32& c) {
    c.clear();
    REQUIRE(addCatalogChannel(c));
    const Catalog32& m = mini();
    for (uint16_t i = 0; i < m.count; ++i) REQUIRE(c.addEntryFrom(m, m.entries[i]));
    c.markUserSpace();
    REQUIRE(c.ok());
}

// One small accessory in slice k: status r=1 (the registry's accessory-status
// layout), a level STATE r=2, its writer r=3 and a c2h drive STREAM r=4, with
// `safe` on every value-bearing c2h field (§8.10). `wide` re-declares r=2
// with a second field: the id survives, the entry does not.
void addAccessory(Catalog32& c, uint16_t k, bool wide = false) {
    static constexpr std::string_view kStatus[] = {"acc0-status", "acc1-status", "acc2-status"};
    static constexpr std::string_view kLevel[] = {"acc0-level", "acc1-level", "acc2-level"};
    static constexpr std::string_view kSet[] = {"acc0-set-level", "acc1-set-level", "acc2-set-level"};
    static constexpr std::string_view kDrive[] = {"acc0-drive", "acc1-drive", "acc2-drive"};
    REQUIRE(k < 3);
    c.addEntry({.id = sliceId(k, 1), .name = kStatus[k], .cls = ChannelClass::STATE, .dir = Direction::h2c,
                .access = AccessLevel::watch, .maxRateHz = 0.0f, .defaultPriority = Priority::normal});
    c.addLayoutField({.name = "state", .type = PackedFieldType::u8, .unit = "", .scale = 1.0f});
    c.addLayoutField({.name = "fault", .type = PackedFieldType::u8, .unit = "", .scale = 1.0f});
    c.addLayoutField({.name = "beacon_seq", .type = PackedFieldType::u16, .unit = "count", .scale = 1.0f});
    c.addEntry({.id = sliceId(k, 2), .name = kLevel[k], .cls = ChannelClass::STATE, .dir = Direction::h2c,
                .access = AccessLevel::watch, .maxRateHz = 10.0f, .defaultPriority = Priority::normal});
    c.addLayoutField({.name = "level", .type = PackedFieldType::u8, .unit = "%", .scale = 1.0f});
    if (wide) c.addLayoutField({.name = "temp", .type = PackedFieldType::i8, .unit = "degC", .scale = 1.0f});
    c.addEntry({.id = sliceId(k, 3), .name = kSet[k], .cls = ChannelClass::INTENT, .dir = Direction::c2h,
                .access = AccessLevel::control, .maxRateHz = 10.0f, .defaultPriority = Priority::critical});
    c.addSchemaField({.key = 1, .name = "level", .type = CborFieldType::uint_t, .unit = "%",
                      .hasMin = true, .hasMax = true, .min = 0.0f, .max = 100.0f});
    c.setFieldSafe(SettingDefault::ofInt(0));
    c.addEntry({.id = sliceId(k, 4), .name = kDrive[k], .cls = ChannelClass::STREAM, .dir = Direction::c2h,
                .access = AccessLevel::control, .maxRateHz = 50.0f, .defaultPriority = Priority::elevated});
    c.addLayoutField({.name = "power", .type = PackedFieldType::u8, .unit = "%", .scale = 1.0f});
    c.setFieldSafe(SettingDefault::ofInt(0));
    REQUIRE(c.ok());
}

// An accessory whose declaration alone outgrows the library Client's
// reassembly budget (ChunkReassembler<64>): ten STATE entries of ten fields,
// each field carrying a long tooltip.
void addBulkyAccessory(Catalog32& c, uint16_t k) {
    static constexpr std::string_view kNames[] = {"bulk-a", "bulk-b", "bulk-c", "bulk-d", "bulk-e",
                                                  "bulk-f", "bulk-g", "bulk-h", "bulk-i", "bulk-j"};
    static constexpr std::string_view kFields[] = {"f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9"};
    static constexpr std::string_view kDesc =
        "A deliberately long tooltip so that one accessory declaration outgrows a small client's "
        "reassembly budget.";
    for (uint16_t e = 0; e < 10; ++e) {
        c.addEntry({.id = sliceId(k, uint16_t(2 + e)), .name = kNames[e], .cls = ChannelClass::STATE,
                    .dir = Direction::h2c, .access = AccessLevel::watch, .maxRateHz = 0.0f,
                    .defaultPriority = Priority::background});
        for (const auto f : kFields) {
            c.addLayoutField({.name = f, .type = PackedFieldType::u8, .unit = "", .scale = 1.0f, .desc = kDesc});
        }
    }
    REQUIRE(c.ok());
}

Etag toEtag(std::span<const std::byte> s) {
    Etag e{};
    REQUIRE(s.size() == e.size());
    std::copy(s.begin(), s.end(), e.begin());
    return e;
}

Etag sha8(std::span<const std::byte> bytes) {
    const auto d = Sha256::hash(bytes);
    Etag e{};
    std::copy_n(d.begin(), e.size(), e.begin());
    return e;
}

// ---- hub delegate -----------------------------------------------------------
class GrowthHubDelegate final : public HubDelegate {
public:
    int applied = 0;
    int bundles = 0;
    int blobDoneAborted = 0;

    AccessLevel validateToken(std::span<const std::byte>, std::span<const std::byte>, bool hasToken) override {
        return hasToken ? AccessLevel::control : AccessLevel::watch;
    }
    Result<IntentValueMap, NackCode> applyIntent(uint16_t, const IntentValueMap& requested, AccessLevel,
                                                  bool& cfgChanged) override {
        ++applied;
        cfgChanged = false;
        return Result<IntentValueMap, NackCode>::ok(requested);
    }
    void onEstop(uint8_t, uint8_t) override {}
    void onStreamBundle(uint16_t, uint32_t, const BundleView&) override { ++bundles; }
    void onBlobDone(uint32_t, const BlobId&, BlobDoneStatus status) override {
        if (status == BlobDoneStatus::Aborted) ++blobDoneAborted;
    }
};

// ---- raw frames -------------------------------------------------------------
void writeFrame(ITransport& ep, FrameType type, uint16_t channel, std::span<const std::byte> payload,
                uint16_t seq = 0) {
    std::array<std::byte, 400> buf{};
    FrameHeader h;
    h.type = uint8_t(type);
    h.flags = 0;
    h.channel = channel;
    h.seq = seq;
    h.len = uint16_t(payload.size());
    const size_t pos = encodeFrameHeader(h, std::span<std::byte>(buf));
    REQUIRE(pos > 0);
    if (!payload.empty()) std::memcpy(buf.data() + pos, payload.data(), payload.size());
    REQUIRE(ep.write(std::span<const std::byte>(buf.data(), pos + payload.size())));
}

struct HelloOpts {
    uint8_t id = 1;
    bool token = true;
    std::vector<uint16_t> subs;
    std::vector<uint16_t> pubs;
    std::optional<Etag> etag;
};
void writeHello(ITransport& ep, const HelloOpts& o) {
    HelloMsg m{};
    m.proto_ver = kProtocolVersion;
    m.client_kind = "sim";
    m.client_name = "growth";
    m.instance_id.fill(std::byte{0});
    m.instance_id[0] = std::byte{o.id};
    if (o.token) {
        m.has_token = true;
        m.token.fill(std::byte{0xAA});
    }
    if (o.etag) {
        m.has_catalog_etag = true;
        m.catalog_etag = *o.etag;
    }
    m.subscriptions_count = uint32_t(o.subs.size());
    for (size_t i = 0; i < o.subs.size(); ++i) {
        m.subscriptions[i].channel_id = o.subs[i];
        m.subscriptions[i].rate_hz = 10.0f;
        m.subscriptions[i].priority = uint8_t(Priority::normal);
    }
    m.publishes_count = uint32_t(o.pubs.size());
    for (size_t i = 0; i < o.pubs.size(); ++i) {
        m.publishes[i].channel_id = o.pubs[i];
        m.publishes[i].rate_hz = 20.0f;
    }
    std::array<std::byte, 400> buf{};
    const size_t n = encodeHello(m, std::span<std::byte>(buf));
    REQUIRE(n > 0);
    writeFrame(ep, FrameType::HELLO, 0, std::span<const std::byte>(buf.data(), n));
}

void writeCatalogReady(ITransport& ep, const Etag& etag) {
    writeFrame(ep, FrameType::CATALOG_READY, 0, std::span<const std::byte>(etag));
}

void writeIntent(ITransport& ep, uint16_t channel_id, uint16_t intent_id, uint64_t level) {
    IntentMsg m{};
    m.channel_id = channel_id;
    m.intent_id = intent_id;
    m.value_count = 1;
    m.value[0] = IntentValueField{1, IntentValue::ofU64(level)};
    std::array<std::byte, 200> buf{};
    const size_t n = encodeIntent(m, std::span<std::byte>(buf));
    REQUIRE(n > 0);
    writeFrame(ep, FrameType::INTENT, channel_id, std::span<const std::byte>(buf.data(), n));
}

void writeSubscribe(ITransport& ep, uint16_t channel_id) {
    SubscribeMsg m{};
    m.subscriptions_count = 1;
    m.subscriptions[0].channel_id = channel_id;
    m.subscriptions[0].rate_hz = 10.0f;
    m.subscriptions[0].priority = uint8_t(Priority::normal);
    std::array<std::byte, 64> buf{};
    const size_t n = encodeSubscribe(m, std::span<std::byte>(buf));
    REQUIRE(n > 0);
    writeFrame(ep, FrameType::SUBSCRIBE, 0, std::span<const std::byte>(buf.data(), n));
}

void writeCatalogRequest(ITransport& ep, uint16_t seq = 0) {
    BlobReqMsg m{};
    m.full = true;
    std::array<std::byte, 16> buf{};
    const size_t n = encodeBlobReq(m, std::span<std::byte>(buf));
    REQUIRE(n > 0);
    writeFrame(ep, FrameType::BLOB_REQ, 0, std::span<const std::byte>(buf.data(), n), seq);
}

void writeDriveBundle(ITransport& ep, uint16_t channel_id, uint32_t tBaseUs) {
    std::array<std::byte, 32> buf{};
    BundleWriter w(std::span<std::byte>(buf), tBaseUs, 1);
    const std::array<std::byte, 1> sample{std::byte{40}};
    REQUIRE(w.addSample(0, std::span<const std::byte>(sample)));
    writeFrame(ep, FrameType::STREAM, channel_id, std::span<const std::byte>(buf.data(), w.finalize()));
}

struct Reply {
    FrameType type;
    uint16_t channel;
    Bytes payload;
};
std::vector<Reply> drain(ITransport& ep) {
    std::vector<Reply> out;
    while (auto fb = ep.read()) {
        const auto h = fb->header();
        if (!h) continue;
        const auto pl = fb->payload();
        out.push_back(Reply{FrameType(h->type), h->channel, Bytes(pl.begin(), pl.end())});
    }
    return out;
}
std::vector<Reply> tick(Hub& hub, ManualClock& clock, ITransport& ep, uint32_t stepUs = 1000) {
    clock.advanceUs(stepUs);
    hub.update(clock.nowUs());
    return drain(ep);
}

int countType(const std::vector<Reply>& rs, FrameType t, std::optional<uint16_t> channel = std::nullopt) {
    int n = 0;
    for (const auto& r : rs) {
        if (r.type == t && (!channel || r.channel == *channel)) ++n;
    }
    return n;
}
std::vector<NackMsg> nacks(const std::vector<Reply>& rs) {
    std::vector<NackMsg> out;
    for (const auto& r : rs) {
        if (r.type != FrameType::NACK) continue;
        auto n = decodeNack(std::span<const std::byte>(r.payload));
        if (n) out.push_back(n.value());
    }
    return out;
}
int countWithdrawn(const std::vector<NackMsg>& ns, uint16_t channel_id) {
    int n = 0;
    for (const auto& m : ns) {
        if (m.code == NackCode::CHANNEL_WITHDRAWN && m.has_channel_id && m.channel_id == channel_id) ++n;
    }
    return n;
}
std::optional<WelcomeMsg> welcomeOf(const std::vector<Reply>& rs) {
    for (const auto& r : rs) {
        if (r.type != FrameType::WELCOME) continue;
        auto w = decodeWelcome(std::span<const std::byte>(r.payload));
        if (w) return w.value();
    }
    return std::nullopt;
}
// The etag of the newest `catalog` (0x0001) snapshot among `rs`.
std::optional<Etag> announcedEtag(const std::vector<Reply>& rs) {
    std::optional<Etag> out;
    for (const auto& r : rs) {
        if (r.type != FrameType::STATE || r.channel != channels::catalog) continue;
        Etag e{};
        if (catalogMetaEtag(std::span<const std::byte>(r.payload), e)) out = e;
    }
    return out;
}
bool granted(const WelcomeMsg& w, uint16_t channel_id) {
    for (uint32_t i = 0; i < w.grants_count; ++i) {
        if (w.grants[i].channel_id == channel_id) return true;
    }
    return false;
}

// Fetches the whole catalog over a raw session (BLOB namespace 0, §8.4), the
// way a client refetching in the background does. Returns the reassembled bytes.
Bytes fetchCatalog(Hub& hub, ManualClock& clock, ITransport& ep, std::vector<Reply>* others = nullptr) {
    writeCatalogRequest(ep);
    Bytes bytes;
    std::vector<bool> have;
    size_t got = 0;
    for (int i = 0; i < 400; ++i) {
        for (auto& r : tick(hub, clock, ep)) {
            if (r.type != FrameType::BLOB_CHUNK) {
                if (others) others->push_back(std::move(r));
                continue;
            }
            BlobChunkHeader h{};
            REQUIRE(getBlobChunkHeader(std::span<const std::byte>(r.payload), h));
            if (have.empty()) {
                bytes.assign(h.total_bytes, std::byte{0});
                have.assign(h.chunk_count, false);
            }
            REQUIRE(h.chunk_index < have.size());
            const size_t off = size_t(h.chunk_index) * limits::catalog_chunk_payload;
            std::copy(r.payload.begin() + kBlobChunkHeaderBytes, r.payload.end(), bytes.begin() + long(off));
            if (!have[h.chunk_index]) {
                have[h.chunk_index] = true;
                ++got;
            }
        }
        if (!have.empty() && got == have.size()) return bytes;
    }
    FAIL("catalog transfer did not complete");
    return bytes;
}

// ---- library Client harness -------------------------------------------------
class GrowthClientDelegate final : public ClientDelegate {
public:
    std::vector<ClientSessionState> states;
    std::vector<NackMsg> nackLog;
    std::vector<std::pair<uint16_t, uint16_t>> stateLog;  // (channel, seq)

    void onStateChange(ClientSessionState s) override { states.push_back(s); }
    void onState(uint16_t channel_id, uint16_t seq, std::span<const std::byte>) override {
        stateLog.emplace_back(channel_id, seq);
    }
    void onEcho(uint16_t, const IntentValueMap&, uint16_t) override {}
    void onNack(const NackMsg& n) override { nackLog.push_back(n); }
    void onPendingDropped(uint16_t) override {}

    // True when LIVE was reached and never left afterwards.
    bool liveThroughout() const {
        auto first = std::find(states.begin(), states.end(), ClientSessionState::LIVE);
        if (first == states.end()) return false;
        return std::all_of(first, states.end(), [](ClientSessionState s) { return s == ClientSessionState::LIVE; });
    }
    int statesFor(uint16_t channel_id) const {
        return int(std::count_if(stateLog.begin(), stateLog.end(),
                                 [&](const auto& p) { return p.first == channel_id; }));
    }
};

ClientIdentity clientId(uint8_t idByte) {
    ClientIdentity id;
    id.instance_id.fill(std::byte{0});
    id.instance_id[0] = std::byte{idByte};
    id.hasToken = true;
    id.token.fill(std::byte{0xAA});
    id.client_kind = "sim";
    id.client_name = "growth-client";
    return id;
}

void pump(Hub& hub, ManualClock& clock, std::initializer_list<Client*> clients, int rounds) {
    for (int i = 0; i < rounds; ++i) {
        clock.advanceUs(1000);
        hub.update(clock.nowUs());
        for (auto* c : clients) c->update(clock.nowUs());
    }
}

bool sameEtag(std::span<const std::byte> a, std::span<const std::byte> b) {
    return a.size() == b.size() && std::equal(a.begin(), a.end(), b.begin());
}

}  // namespace

// ---- GR-01 ------------------------------------------------------------------
// §8.6's byte-identical rule at the codec: every fixed entry's own document is
// the same bytes whatever the user space holds, through a join, a declaration
// replacement and a forget. The etag moves each time; the fixed entries never.
TEST_CASE("GR-01: the codec keeps every fixed entry byte-identical across user-space changes") {
    Catalog32 cat;
    buildFixed(cat);
    const uint16_t fixed = cat.userSpaceStart();
    REQUIRE(fixed == mini().count + 1);

    using Docs = std::vector<std::pair<uint16_t, Bytes>>;
    std::vector<std::byte> buf(Hub::catalogScratchCapacity());
    auto encodeDocs = [&](Docs& docs) {
        docs.clear();
        const size_t n = encodeCatalog(cat, std::span<std::byte>(buf), [&](const CatalogEntry& e, std::span<const std::byte> b) {
            docs.emplace_back(e.id, Bytes(b.begin(), b.end()));
        });
        REQUIRE(n > 0);
        // §8.1: the encoding is the array header followed by each entry document.
        size_t sum = 0;
        for (const auto& d : docs) sum += d.second.size();
        CHECK(n - sum <= 3);
        return sha8(std::span<const std::byte>(buf.data(), n));
    };

    Docs base, joined, replaced, forgotten;
    const Etag e0 = encodeDocs(base);
    addAccessory(cat, 0);
    const Etag e1 = encodeDocs(joined);
    cat.clearUserSpace();
    addAccessory(cat, 0, /*wide=*/true);
    addAccessory(cat, 1);
    const Etag e2 = encodeDocs(replaced);
    cat.clearUserSpace();
    const Etag e3 = encodeDocs(forgotten);

    CHECK(e0 != e1);
    CHECK(e1 != e2);
    CHECK(e3 == e0);  // the user space gone, the catalog is the original one again
    REQUIRE(base.size() == fixed);
    CHECK(joined.size() == size_t(fixed + 4));
    CHECK(replaced.size() == size_t(fixed + 8));
    for (const Docs* d : {&joined, &replaced, &forgotten}) {
        REQUIRE(d->size() >= fixed);
        for (uint16_t i = 0; i < fixed; ++i) {
            CHECK((*d)[i].first == base[i].first);
            CHECK((*d)[i].second == base[i].second);
        }
    }
    // The replaced entry is the one user entry whose bytes moved.
    CHECK(joined[fixed + 1].first == replaced[fixed + 1].first);
    CHECK(joined[fixed + 1].second != replaced[fixed + 1].second);
    CHECK(joined[fixed].second == replaced[fixed].second);

    // The fixture is a conformant catalog in every state.
    CHECK(conformance::checkCatalog(cat).ok());
}

// ---- GR-02 ------------------------------------------------------------------
// conformance (1)+(2): a join on a LIVE session. 0x0001 carries the new etag;
// the session stays ready, safety pushes keep coming, INTENTs are never
// refused NOT_READY, survivors are not re-pushed; the client refetches over
// BLOB ns 0 in the background and its CATALOG_READY brings it current.
TEST_CASE("GR-02: a join re-announces on 0x0001, keeps the session ready, and the refetch declares the new etag") {
    Catalog32 cat;
    buildFixed(cat);
    addAccessory(cat, 0);
    ManualClock clock;
    XorShift32 rng(7701);
    GrowthHubDelegate del;
    Hub hub(cat, clock, rng, del);
    const std::array<std::byte, 1> level{std::byte{42}};
    REQUIRE(hub.publishState(sliceId(0, 2), std::span<const std::byte>(level)));

    InProcessLink link(clock, rng);
    REQUIRE(hub.attachTransport(link.endpointA()));
    REQUIRE(link.endpointB().open());
    ITransport& ep = link.endpointB();

    const Etag e0 = toEtag(hub.catalogEtag());
    writeHello(ep, {.subs = {channels::catalog, kSafetyCh, sliceId(0, 2)}, .etag = e0});
    auto replies = tick(hub, clock, ep);
    auto w = welcomeOf(replies);
    REQUIRE(w.has_value());
    CHECK(w->limits_info.retained_pending == 3);
    REQUIRE(hub.sessionBySlot(0)->ready);
    CHECK(announcedEtag(replies) == e0);  // the hub seeds 0x0001 at construction
    CHECK(countType(replies, FrameType::STATE) == 3);

    cat.clearUserSpace();
    addAccessory(cat, 0);
    addAccessory(cat, 1);
    CHECK(hub.catalogChanged() == Hub::CatalogChange::UserSpace);
    const Etag e1 = toEtag(hub.catalogEtag());
    CHECK(e1 != e0);
    CHECK(drain(ep).empty());  // nothing withdrawn, nothing in flight

    replies = tick(hub, clock, ep);
    CHECK(countType(replies, FrameType::NACK) == 0);
    REQUIRE(countType(replies, FrameType::STATE) == 1);  // the announcement, and no survivor re-push
    CHECK(announcedEtag(replies) == e1);
    for (const auto& r : replies) {
        if (r.type != FrameType::STATE) continue;
        REQUIRE(r.payload.size() == kCatalogMetaBytes);
        CHECK(getU16(std::span<const std::byte>(r.payload).subspan(8, 2)) ==
              chunkCount(hub.catalogEncodedBytes()));
        CHECK(getU16(std::span<const std::byte>(r.payload).subspan(10, 2)) == cat.count);
    }
    const HubSession* s = hub.sessionBySlot(0);
    CHECK(s->ready);
    CHECK(s->readyEtagMismatch);  // still on e0 until it declares e1
    CHECK(sameEtag(s->readyEtag, e0));

    // The safety latch keeps flowing with no gap, and INTENTs keep applying.
    hub.latchEstop(safety_causes::user, 0);
    replies = tick(hub, clock, ep);
    CHECK(countType(replies, FrameType::STATE, kSafetyCh) == 1);
    writeIntent(ep, kConfigCh, 9, 50);
    replies = tick(hub, clock, ep);
    CHECK(countType(replies, FrameType::ECHO) == 1);
    CHECK(nacks(replies).empty());

    // The background refetch: the transfer verifies against the announced etag.
    std::vector<Reply> during;
    const Bytes fresh = fetchCatalog(hub, clock, ep, &during);
    CHECK(sha8(std::span<const std::byte>(fresh)) == e1);
    CHECK(nacks(during).empty());
    writeCatalogReady(ep, e1);
    replies = tick(hub, clock, ep);
    CHECK(s->ready);
    CHECK_FALSE(s->readyEtagMismatch);
    CHECK(sameEtag(s->readyEtag, e1));
    CHECK(countType(replies, FrameType::STATE) == 0);  // declaring is a flag-set, not a re-push
}

// ---- GR-03 ------------------------------------------------------------------
// The library Client half: it subscribes to 0x0001 on its own, refetches in
// the background when the etag moves, declares the new one, and never leaves
// LIVE. Survivors are not re-wished: no grant churn and no re-push.
TEST_CASE("GR-03: the library Client refetches in the background and stays LIVE") {
    Catalog32 cat;
    buildFixed(cat);
    addAccessory(cat, 0);
    ManualClock clock;
    XorShift32 rng(7702);
    GrowthHubDelegate del;
    Hub hub(cat, clock, rng, del);
    const std::array<std::byte, 1> level{std::byte{7}};
    REQUIRE(hub.publishState(sliceId(0, 2), std::span<const std::byte>(level)));

    InProcessLink link(clock, rng);
    REQUIRE(hub.attachTransport(link.endpointA()));
    XorShift32 crng(8802);
    GrowthClientDelegate cd;
    Client client(clientId(3), link.endpointB(), clock, crng, cd);
    REQUIRE(client.addSubscriptionWish(kSafetyCh, 0.0f, Priority::critical));
    REQUIRE(client.addSubscriptionWish(sliceId(0, 2), 10.0f, Priority::normal));
    REQUIRE(client.connect());
    pump(hub, clock, {&client}, 20);
    REQUIRE(client.state() == ClientSessionState::LIVE);
    REQUIRE(hub.sessionBySlot(0) != nullptr);
    CHECK(hub.sessionBySlot(0)->subs.find(channels::catalog) != nullptr);  // the MUST, unasked
    CHECK(client.catalogReqCount() == 1);
    const Etag e0 = toEtag(hub.catalogEtag());
    CHECK(sameEtag(client.readyEtag(), e0));
    const size_t subsBefore = hub.sessionBySlot(0)->subs.size();
    const int levelPushes = cd.statesFor(sliceId(0, 2));

    cat.clearUserSpace();
    addAccessory(cat, 0);
    addAccessory(cat, 1);
    REQUIRE(hub.catalogChanged() == Hub::CatalogChange::UserSpace);
    const Etag e1 = toEtag(hub.catalogEtag());
    pump(hub, clock, {&client}, 40);

    CHECK(cd.liveThroughout());
    CHECK(client.catalogReqCount() == 2);
    CHECK(sameEtag(client.hubEtag(), e1));
    CHECK(sameEtag(client.readyEtag(), e1));
    const HubSession* s = hub.sessionBySlot(0);
    CHECK(s->ready);
    CHECK_FALSE(s->readyEtagMismatch);
    CHECK(sameEtag(s->readyEtag, e1));
    CHECK(s->subs.size() == subsBefore);                    // nothing re-wished, nothing added
    CHECK(cd.statesFor(sliceId(0, 2)) == levelPushes);       // the survivor was not re-pushed
    CHECK(cd.nackLog.empty());
}

// ---- GR-04 ------------------------------------------------------------------
// conformance (3): a forget. One CHANNEL_WITHDRAWN per withdrawn grant (two
// subscriptions and one publication), sent once; the next INTENT on a removed
// id is UNKNOWN_CHANNEL; a bundle on the withdrawn publish is dropped and
// counted. A call with nothing changed sends nothing.
TEST_CASE("GR-04: a forget withdraws each grant once; later INTENTs get UNKNOWN_CHANNEL; bundles drop") {
    Catalog32 cat;
    buildFixed(cat);
    addAccessory(cat, 0);
    addAccessory(cat, 1);
    ManualClock clock;
    XorShift32 rng(7703);
    GrowthHubDelegate del;
    Hub hub(cat, clock, rng, del);

    InProcessLink link(clock, rng);
    REQUIRE(hub.attachTransport(link.endpointA()));
    REQUIRE(link.endpointB().open());
    ITransport& ep = link.endpointB();
    writeHello(ep, {.subs = {channels::catalog, sliceId(1, 1), sliceId(1, 2)},
                    .pubs = {sliceId(1, 4)},
                    .etag = toEtag(hub.catalogEtag())});
    auto w = welcomeOf(tick(hub, clock, ep));
    REQUIRE(w.has_value());
    REQUIRE(granted(*w, sliceId(1, 1)));
    REQUIRE(granted(*w, sliceId(1, 2)));
    REQUIRE(w->granted_publishes_count == 1);
    writeDriveBundle(ep, sliceId(1, 4), clock.nowUs());
    tick(hub, clock, ep);
    REQUIRE(del.bundles == 1);

    cat.clearUserSpace();
    addAccessory(cat, 0);
    REQUIRE(hub.catalogChanged() == Hub::CatalogChange::UserSpace);
    const auto immediate = nacks(drain(ep));
    CHECK(immediate.size() == 3);
    CHECK(countWithdrawn(immediate, sliceId(1, 1)) == 1);
    CHECK(countWithdrawn(immediate, sliceId(1, 2)) == 1);
    CHECK(countWithdrawn(immediate, sliceId(1, 4)) == 1);
    for (const auto& n : immediate) CHECK_FALSE(n.has_intent_seq);  // unsolicited

    auto replies = tick(hub, clock, ep);
    CHECK(nacks(replies).empty());  // once, never again
    CHECK(announcedEtag(replies) == toEtag(hub.catalogEtag()));
    CHECK(hub.sessionBySlot(0)->ready);
    CHECK(hub.catalogChanged() == Hub::CatalogChange::Unchanged);
    CHECK(drain(ep).empty());

    writeIntent(ep, sliceId(1, 3), 11, 5);
    const auto refused = nacks(tick(hub, clock, ep));
    REQUIRE(refused.size() == 1);
    CHECK(refused[0].code == NackCode::UNKNOWN_CHANNEL);
    CHECK(refused[0].channel_id == sliceId(1, 3));

    const auto droppedBefore = hub.streamIngressCounters(0).dropped;
    writeDriveBundle(ep, sliceId(1, 4), clock.nowUs());
    replies = tick(hub, clock, ep);
    CHECK(hub.streamIngressCounters(0).dropped == droppedBefore + 1);
    CHECK(del.bundles == 1);
    CHECK(nacks(replies).empty());  // §9.2: a bundle is dropped and counted, never NACKed
}

// ---- GR-05 ------------------------------------------------------------------
// §8.6 "channels that appear": nothing is delivered until a session
// subscribes, even when its HELLO wish-list named the id.
TEST_CASE("GR-05: an appeared channel delivers nothing until it is subscribed") {
    Catalog32 cat;
    buildFixed(cat);
    ManualClock clock;
    XorShift32 rng(7704);
    GrowthHubDelegate del;
    Hub hub(cat, clock, rng, del);

    InProcessLink link(clock, rng);
    REQUIRE(hub.attachTransport(link.endpointA()));
    REQUIRE(link.endpointB().open());
    ITransport& ep = link.endpointB();
    writeHello(ep, {.subs = {channels::catalog, sliceId(0, 2)}, .etag = toEtag(hub.catalogEtag())});
    auto w = welcomeOf(tick(hub, clock, ep));
    REQUIRE(w.has_value());
    CHECK_FALSE(granted(*w, sliceId(0, 2)));  // not in the catalog yet: omitted (§6.2)

    addAccessory(cat, 0);
    REQUIRE(hub.catalogChanged() == Hub::CatalogChange::UserSpace);
    const std::array<std::byte, 1> level{std::byte{9}};
    REQUIRE(hub.publishState(sliceId(0, 2), std::span<const std::byte>(level)));
    std::vector<Reply> replies;
    for (int i = 0; i < 5; ++i) {
        for (auto& r : tick(hub, clock, ep)) replies.push_back(std::move(r));
    }
    CHECK(countType(replies, FrameType::STATE, sliceId(0, 2)) == 0);
    CHECK(countType(replies, FrameType::GRANT) == 0);
    CHECK(countType(replies, FrameType::STATE, channels::catalog) == 1);

    writeSubscribe(ep, sliceId(0, 2));
    replies = tick(hub, clock, ep);
    CHECK(countType(replies, FrameType::GRANT) == 1);
    CHECK(countType(replies, FrameType::STATE, sliceId(0, 2)) == 1);
}

// ---- GR-06 ------------------------------------------------------------------
// A declaration replacement: the replaced channel keeps its id but not its
// entry, so its grant is withdrawn and its retained value discarded; the other
// accessory's channels are survivors and see nothing at all.
TEST_CASE("GR-06: a replaced declaration withdraws the changed channel and leaves survivors alone") {
    Catalog32 cat;
    buildFixed(cat);
    addAccessory(cat, 0);
    addAccessory(cat, 1);
    ManualClock clock;
    XorShift32 rng(7705);
    GrowthHubDelegate del;
    Hub hub(cat, clock, rng, del);
    const std::array<std::byte, 1> a{std::byte{1}};
    const std::array<std::byte, 1> b{std::byte{2}};
    REQUIRE(hub.publishState(sliceId(0, 2), std::span<const std::byte>(a)));
    REQUIRE(hub.publishState(sliceId(1, 2), std::span<const std::byte>(b)));

    InProcessLink link(clock, rng);
    REQUIRE(hub.attachTransport(link.endpointA()));
    REQUIRE(link.endpointB().open());
    ITransport& ep = link.endpointB();
    writeHello(ep, {.subs = {channels::catalog, sliceId(0, 1), sliceId(0, 2), sliceId(1, 2)},
                    .etag = toEtag(hub.catalogEtag())});
    REQUIRE(welcomeOf(tick(hub, clock, ep)).has_value());

    cat.clearUserSpace();
    addAccessory(cat, 0, /*wide=*/true);
    addAccessory(cat, 1);
    REQUIRE(hub.catalogChanged() == Hub::CatalogChange::UserSpace);
    const auto withdrawn = nacks(drain(ep));
    REQUIRE(withdrawn.size() == 1);
    CHECK(countWithdrawn(withdrawn, sliceId(0, 2)) == 1);

    auto replies = tick(hub, clock, ep);
    CHECK(countType(replies, FrameType::STATE) == 1);  // 0x0001 only: no survivor re-push
    CHECK(countType(replies, FrameType::STATE, channels::catalog) == 1);
    CHECK(hub.sessionBySlot(0)->subs.find(sliceId(1, 2)) != nullptr);
    CHECK(hub.sessionBySlot(0)->subs.find(sliceId(0, 1)) != nullptr);

    // Re-subscribed under the new layout: no retained push until the host
    // publishes a value that layout describes.
    writeSubscribe(ep, sliceId(0, 2));
    replies = tick(hub, clock, ep);
    CHECK(countType(replies, FrameType::GRANT) == 1);
    CHECK(countType(replies, FrameType::STATE, sliceId(0, 2)) == 0);
    const std::array<std::byte, 2> wide{std::byte{3}, std::byte{20}};
    REQUIRE(hub.publishState(sliceId(0, 2), std::span<const std::byte>(wide)));
    replies = tick(hub, clock, ep);
    CHECK(countType(replies, FrameType::STATE, sliceId(0, 2)) == 1);
}

// ---- GR-07 ------------------------------------------------------------------
// conformance (4): a catalog transfer in flight across a join ends with ONE
// NACK CHUNK_UNAVAILABLE, correlated to its BLOB_REQ (§8.4), and no further
// chunk; a fresh request then delivers the grown catalog.
TEST_CASE("GR-07: a catalog transfer in flight across a join is aborted by one NACK") {
    Catalog32 cat;
    buildFixed(cat);
    addAccessory(cat, 0);
    ManualClock clock;
    XorShift32 rng(7706);
    GrowthHubDelegate del;
    Hub hub(cat, clock, rng, del);
    REQUIRE(chunkCount(hub.catalogEncodedBytes()) > 4);

    InProcessLink link(clock, rng);
    REQUIRE(hub.attachTransport(link.endpointA()));
    REQUIRE(link.endpointB().open());
    ITransport& ep = link.endpointB();
    writeHello(ep, {.subs = {channels::catalog}});  // no etag: SYNCING
    REQUIRE(welcomeOf(tick(hub, clock, ep)).has_value());
    writeCatalogRequest(ep, /*seq=*/77);
    REQUIRE(countType(tick(hub, clock, ep), FrameType::BLOB_CHUNK) > 0);

    addAccessory(cat, 1);
    REQUIRE(hub.catalogChanged() == Hub::CatalogChange::UserSpace);
    const auto aborted = nacks(drain(ep));
    REQUIRE(aborted.size() == 1);
    CHECK(aborted[0].code == NackCode::CHUNK_UNAVAILABLE);
    CHECK(aborted[0].has_intent_seq);
    CHECK(aborted[0].intent_seq == 77);
    for (int i = 0; i < 5; ++i) {
        const auto later = tick(hub, clock, ep);
        CHECK(countType(later, FrameType::BLOB_CHUNK) == 0);
        CHECK(countType(later, FrameType::NACK) == 0);
    }

    const Bytes fresh = fetchCatalog(hub, clock, ep);
    CHECK(sha8(std::span<const std::byte>(fresh)) == toEtag(hub.catalogEtag()));
}

// ---- GR-08 ------------------------------------------------------------------
// conformance (7): a LIVE client whose reassembly budget the grown catalog
// exceeds stays LIVE on its old etag, degraded (§8.5(a)), and says so with
// BLOB_DONE aborted instead of leaving (§8.6). The data plane keeps flowing.
TEST_CASE("GR-08: a client over its reassembly budget stays LIVE, degraded") {
    Catalog32 cat;
    buildFixed(cat);
    addAccessory(cat, 0);
    ManualClock clock;
    XorShift32 rng(7707);
    GrowthHubDelegate del;
    Hub hub(cat, clock, rng, del);

    InProcessLink link(clock, rng);
    REQUIRE(hub.attachTransport(link.endpointA()));
    XorShift32 crng(8807);
    GrowthClientDelegate cd;
    Client client(clientId(4), link.endpointB(), clock, crng, cd);
    REQUIRE(client.addSubscriptionWish(kSafetyCh, 0.0f, Priority::critical));
    REQUIRE(client.connect());
    pump(hub, clock, {&client}, 20);
    REQUIRE(client.state() == ClientSessionState::LIVE);
    const Etag e0 = toEtag(hub.catalogEtag());

    addBulkyAccessory(cat, 1);
    REQUIRE(hub.catalogChanged() == Hub::CatalogChange::UserSpace);
    REQUIRE(hub.catalogEncodedBytes() > ChunkReassembler<64>::kMaxTotalBytes);
    const Etag e1 = toEtag(hub.catalogEtag());
    pump(hub, clock, {&client}, 120);

    CHECK(cd.liveThroughout());
    CHECK(client.catalogReqCount() == 2);  // asked once, refused once, never again
    CHECK(sameEtag(client.hubEtag(), e1));
    CHECK(sameEtag(client.readyEtag(), e0));
    CHECK(del.blobDoneAborted == 1);
    const HubSession* s = hub.sessionBySlot(0);
    REQUIRE(s != nullptr);
    CHECK(s->ready);
    CHECK(s->readyEtagMismatch);

    hub.latchEstop(safety_causes::user, 0);
    pump(hub, clock, {&client}, 3);
    REQUIRE(client.safetyWord().has_value());
    CHECK((*client.safetyWord() & safety_bits::ESTOP) != 0);
}

// ---- GR-09 ------------------------------------------------------------------
// §4.2 rule 3: a change to a FIXED entry is not a user-space change. The hub
// announces on 0x0001 first, then revokes readiness: INTENTs get NOT_READY
// until the new etag is declared, and the retained snapshot then re-flows.
// The library Client re-enters SYNCING on that NOT_READY and returns to LIVE.
TEST_CASE("GR-09: a change outside the user space re-syncs every session") {
    Catalog32 cat;
    buildFixed(cat);
    addAccessory(cat, 0);
    ManualClock clock;
    XorShift32 rng(7708);
    GrowthHubDelegate del;
    Hub hub(cat, clock, rng, del);

    InProcessLink rawLink(clock, rng);
    REQUIRE(hub.attachTransport(rawLink.endpointA()));
    REQUIRE(rawLink.endpointB().open());
    ITransport& ep = rawLink.endpointB();
    writeHello(ep, {.id = 1, .subs = {channels::catalog, kSafetyCh}, .etag = toEtag(hub.catalogEtag())});
    REQUIRE(welcomeOf(tick(hub, clock, ep)).has_value());

    InProcessLink clientLink(clock, rng);
    REQUIRE(hub.attachTransport(clientLink.endpointA()));
    XorShift32 crng(8808);
    GrowthClientDelegate cd;
    Client client(clientId(5), clientLink.endpointB(), clock, crng, cd);
    REQUIRE(client.addSubscriptionWish(kSafetyCh, 0.0f, Priority::critical));
    REQUIRE(client.connect());
    pump(hub, clock, {&client}, 20);
    REQUIRE(client.state() == ClientSessionState::LIVE);
    drain(ep);

    // A device entry moves: its rate ceiling, the kind of edit a simulator
    // or host hub can make without a reboot.
    CatalogEntry* status = nullptr;
    for (uint16_t i = 0; i < cat.count; ++i) {
        if (cat.entries[i].id == kStatusCh) status = &cat.entries[i];
    }
    REQUIRE(status != nullptr);
    status->maxRateHz = 5.0f;
    REQUIRE(hub.catalogChanged() == Hub::CatalogChange::Resync);
    const Etag e1 = toEtag(hub.catalogEtag());

    const auto announced = drain(ep);  // sent before the gate shut
    CHECK(announcedEtag(announced) == e1);
    for (uint8_t i = 0; i < 2; ++i) CHECK_FALSE(hub.sessionBySlot(i)->ready);

    writeIntent(ep, kConfigCh, 21, 10);
    auto refused = nacks(tick(hub, clock, ep));
    REQUIRE(refused.size() == 1);
    CHECK(refused[0].code == NackCode::NOT_READY);
    CHECK(del.applied == 0);

    const Bytes fresh = fetchCatalog(hub, clock, ep);
    CHECK(sha8(std::span<const std::byte>(fresh)) == e1);
    writeCatalogReady(ep, e1);
    auto replies = tick(hub, clock, ep);
    CHECK(countType(replies, FrameType::STATE, kSafetyCh) == 1);  // the snapshot re-flows
    CHECK(countType(replies, FrameType::STATE, channels::catalog) == 1);
    writeIntent(ep, kConfigCh, 22, 10);
    CHECK(countType(tick(hub, clock, ep), FrameType::ECHO) == 1);

    // The library Client: an intent sent into the gap is refused, the client
    // re-enters SYNCING, refetches, declares, and comes back LIVE.
    IntentValueMap v{};
    v.count = 1;
    v.fields[0] = IntentValueField{1, IntentValue::ofF32(12.0f)};
    REQUIRE(client.sendIntent(kConfigCh, v).has_value());
    pump(hub, clock, {&client}, 40);
    CHECK(std::find(cd.states.begin(), cd.states.end(), ClientSessionState::SYNCING) != cd.states.end());
    CHECK(client.state() == ClientSessionState::LIVE);
    CHECK(sameEtag(client.readyEtag(), e1));
    CHECK(hub.sessionBySlot(1)->ready);
    CHECK_FALSE(hub.sessionBySlot(1)->readyEtagMismatch);
}

// ---- GR-10 ------------------------------------------------------------------
// The bead's proof: grow and shrink the user space with two sessions live;
// both refetch both times and neither loses readiness.
TEST_CASE("GR-10: two live clients refetch through a join and a forget without losing readiness") {
    Catalog32 cat;
    buildFixed(cat);
    ManualClock clock;
    XorShift32 rng(7709);
    GrowthHubDelegate del;
    Hub hub(cat, clock, rng, del);

    InProcessLink linkA(clock, rng);
    InProcessLink linkB(clock, rng);
    REQUIRE(hub.attachTransport(linkA.endpointA()));
    REQUIRE(hub.attachTransport(linkB.endpointA()));
    XorShift32 rngA(8810);
    XorShift32 rngB(8811);
    GrowthClientDelegate da;
    GrowthClientDelegate db;
    Client a(clientId(6), linkA.endpointB(), clock, rngA, da);
    Client b(clientId(7), linkB.endpointB(), clock, rngB, db);
    REQUIRE(a.addSubscriptionWish(kSafetyCh, 0.0f, Priority::critical));
    REQUIRE(b.addSubscriptionWish(kSafetyCh, 0.0f, Priority::critical));
    REQUIRE(a.connect());
    REQUIRE(b.connect());
    pump(hub, clock, {&a, &b}, 20);
    REQUIRE(a.state() == ClientSessionState::LIVE);
    REQUIRE(b.state() == ClientSessionState::LIVE);
    const Etag e0 = toEtag(hub.catalogEtag());

    addAccessory(cat, 0);
    REQUIRE(hub.catalogChanged() == Hub::CatalogChange::UserSpace);
    const Etag grown = toEtag(hub.catalogEtag());
    pump(hub, clock, {&a, &b}, 40);
    for (Client* c : {&a, &b}) {
        CHECK(c->catalogReqCount() == 2);
        CHECK(sameEtag(c->readyEtag(), grown));
    }

    cat.clearUserSpace();
    REQUIRE(hub.catalogChanged() == Hub::CatalogChange::UserSpace);
    CHECK(toEtag(hub.catalogEtag()) == e0);
    pump(hub, clock, {&a, &b}, 40);
    for (Client* c : {&a, &b}) {
        CHECK(c->catalogReqCount() == 3);
        CHECK(sameEtag(c->readyEtag(), e0));
    }

    CHECK(da.liveThroughout());
    CHECK(db.liveThroughout());
    for (const auto* d : {&da, &db}) {
        for (const auto& n : d->nackLog) CHECK(n.code != NackCode::NOT_READY);
    }
    for (uint8_t i = 0; i < 2; ++i) {
        CHECK(hub.sessionBySlot(i)->ready);
        CHECK_FALSE(hub.sessionBySlot(i)->readyEtagMismatch);
    }
}

// ---- GR-11 ------------------------------------------------------------------
// A change the hub cannot serve: an overflowed catalog is refused untouched;
// a catalog that no longer encodes keeps the old etag and every session as
// they were, refuses catalog transfers, and recovers when restored.
TEST_CASE("GR-11: an unencodable change keeps the etag, refuses transfers, and recovers") {
    Catalog32 cat;
    buildFixed(cat);
    addAccessory(cat, 0);
    ManualClock clock;
    XorShift32 rng(7710);
    GrowthHubDelegate del;
    Hub hub(cat, clock, rng, del);
    const Etag e0 = toEtag(hub.catalogEtag());
    const size_t len0 = hub.catalogEncodedBytes();

    InProcessLink link(clock, rng);
    REQUIRE(hub.attachTransport(link.endpointA()));
    REQUIRE(link.endpointB().open());
    ITransport& ep = link.endpointB();
    writeHello(ep, {.subs = {channels::catalog}, .etag = e0});
    REQUIRE(welcomeOf(tick(hub, clock, ep)).has_value());

    cat.overflow = true;
    CHECK(hub.catalogChanged() == Hub::CatalogChange::EncodeFailed);
    CHECK(toEtag(hub.catalogEtag()) == e0);
    CHECK(hub.catalogEncodedBytes() == len0);
    cat.overflow = false;

    // One entry over catalog_max_entry_bytes: the encoder refuses the catalog.
    cat.clearUserSpace();
    cat.addEntry({.id = sliceId(2, 2), .name = "oversize", .cls = ChannelClass::STATE, .dir = Direction::h2c,
                  .access = AccessLevel::watch, .maxRateHz = 0.0f, .defaultPriority = Priority::normal});
    static constexpr std::string_view kDesc =
        "A tooltip long enough that forty of them push one entry past the per-entry byte cap of the catalog.";
    for (int i = 0; i < 40; ++i) {
        cat.addLayoutField({.name = "f", .type = PackedFieldType::u8, .unit = "", .scale = 1.0f, .desc = kDesc});
    }
    REQUIRE(cat.ok());
    CHECK(hub.catalogChanged() == Hub::CatalogChange::EncodeFailed);
    CHECK(toEtag(hub.catalogEtag()) == e0);
    CHECK(hub.catalogEncodedBytes() == 0);
    CHECK(drain(ep).empty());
    CHECK(hub.sessionBySlot(0)->ready);
    writeCatalogRequest(ep, 5);
    auto refused = nacks(tick(hub, clock, ep));
    REQUIRE(refused.size() == 1);
    CHECK(refused[0].code == NackCode::CHUNK_UNAVAILABLE);

    cat.clearUserSpace();
    addAccessory(cat, 0);
    CHECK(hub.catalogChanged() == Hub::CatalogChange::Unchanged);
    CHECK(hub.catalogEncodedBytes() == len0);
    const Bytes back = fetchCatalog(hub, clock, ep);
    CHECK(sha8(std::span<const std::byte>(back)) == e0);
}
