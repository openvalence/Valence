// test_slopsync_blobdone -- RFC-050: the §8.4 backpressure decision table and
// the BLOB_DONE completion signal.
//
// The field symptom this suite exists for (SlopDrive-32 sd-3qu): a watch
// session's catalog transfer lost 1 of 133 chunks and the receiver aborted in
// silence. Nothing on either side could tell "the transfer completed" from
// "the transfer stopped", because the protocol had no positive completion
// report and the hub's only reaction to a refusal was to keep going.
//
// Harness: InProcessLink + ManualClock + XorShift32 + conformance::miniCatalog(),
// the same shape as test_slopsync_session / test_slopsync_readygate. The one
// addition is ChunkFaultTransport, a DECORATOR around the hub's endpoint that
// can refuse, swallow or corrupt BLOB_CHUNK frames specifically -- the faults
// the InProcessLink's own FaultProfile applies uniformly cannot single out one
// frame type, and every row of the table is about that one type.
//
// Suite ids: BD-xx.

#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>

#include "slopsync/client/client.hpp"
#include "slopsync/conformance/mini_catalog.hpp"
#include "slopsync/core/clock.hpp"
#include "slopsync/core/rng.hpp"
#include "slopsync/hub/hub.hpp"
#include "slopsync/transport/inprocess_binding.hpp"
#include "slopsync/wire/catalog_etag.hpp"
#include "slopsync/wire/frame_header.hpp"
#include "slopsync/wire/raw/blob_done.hpp"

#include <array>
#include <cstring>
#include <optional>
#include <vector>

using namespace slopsync;

namespace {

// ---- fault decorator --------------------------------------------------------
// Wraps the hub's endpoint and interferes with BLOB_CHUNK writes only.
// `refuseEveryNth` returns false (the §13.1 "not accepted right now" the hub
// MUST retry on), `swallowIndex` accepts and silently discards (a lost chunk
// on the wire), `corruptIndex` flips a payload byte (bytes arrive, hash does
// not). Everything that is not a BLOB_CHUNK passes through untouched, so the
// handshake is never the thing under test.
class ChunkFaultTransport final : public ITransport {
public:
    explicit ChunkFaultTransport(ITransport& inner) : _inner(inner) {}

    uint32_t refuseEveryNth = 0;  // 0 = never
    bool refuseAllChunks = false;
    int swallowIndex = -1;
    int corruptIndex = -1;
    uint32_t chunksSeen = 0;
    uint32_t chunksRefused = 0;

    bool open() override { return _inner.open(); }
    void close() override { _inner.close(); }
    std::optional<FrameBuffer> read() override { return _inner.read(); }
    TransportProperties properties() const override { return _inner.properties(); }

    bool write(std::span<const std::byte> frame) override {
        auto h = decodeFrameHeader(frame);
        if (!h || FrameType(h->type) != FrameType::BLOB_CHUNK) return _inner.write(frame);

        const int idx = chunkIndexOf(frame);
        ++chunksSeen;

        if (refuseAllChunks || (refuseEveryNth > 0 && (chunksSeen % refuseEveryNth) == 0)) {
            ++chunksRefused;
            return false;
        }
        if (idx >= 0 && idx == swallowIndex) return true;  // accepted, never delivered
        if (idx >= 0 && idx == corruptIndex) {
            std::array<std::byte, 512> copy{};
            if (frame.size() > copy.size()) return _inner.write(frame);
            std::memcpy(copy.data(), frame.data(), frame.size());
            // First payload byte after the 14-byte identity header.
            const size_t at = kHeaderBytes + kBlobChunkHeaderBytes;
            if (at < frame.size()) copy[at] = copy[at] ^ std::byte{0xFF};
            return _inner.write(std::span<const std::byte>(copy.data(), frame.size()));
        }
        return _inner.write(frame);
    }

private:
    static int chunkIndexOf(std::span<const std::byte> frame) {
        if (frame.size() < kHeaderBytes + kBlobChunkHeaderBytes) return -1;
        BlobChunkHeader bh{};
        if (!getBlobChunkHeader(frame.subspan(kHeaderBytes), bh)) return -1;
        return int(bh.chunk_index);
    }
    ITransport& _inner;
};

// ---- delegates --------------------------------------------------------------

struct RecordedDone {
    uint32_t session_id;
    uint8_t ns;
    BlobDoneStatus status;
};

class BlobHubDelegate final : public HubDelegate {
public:
    std::vector<RecordedDone> dones;

    AccessLevel validateToken(std::span<const std::byte>, std::span<const std::byte>, bool hasToken) override {
        return hasToken ? AccessLevel::control : AccessLevel::watch;
    }
    Result<IntentValueMap, NackCode> applyIntent(uint16_t, const IntentValueMap&, AccessLevel, bool&) override {
        return Result<IntentValueMap, NackCode>::err(NackCode::UNKNOWN_CHANNEL);
    }
    void onEstop(uint8_t, uint8_t) override {}
    void onSessionLeft(uint32_t) override {}
    void onBlobDone(uint32_t session_id, const BlobId& id, BlobDoneStatus status) override {
        dones.push_back(RecordedDone{session_id, id.ns, status});
    }
};

class QuietClientDelegate final : public ClientDelegate {
public:
    std::vector<NackMsg> nacks;
    void onStateChange(ClientSessionState) override {}
    void onState(uint16_t, uint16_t, std::span<const std::byte>) override {}
    void onEcho(uint16_t, const IntentValueMap&, uint16_t) override {}
    void onNack(const NackMsg& n) override { nacks.push_back(n); }
    void onPendingDropped(uint16_t) override {}
};

ClientIdentity makeIdentity(uint8_t idByte) {
    ClientIdentity id;
    id.instance_id.fill(std::byte{0});
    id.instance_id[0] = std::byte{idByte};
    id.hasToken = false;
    id.client_kind = "sim";
    id.client_name = "blobdone";
    return id;
}

void pump(Hub& hub, ManualClock& clock, Client* client, int rounds, uint32_t stepUs = 1000) {
    for (int i = 0; i < rounds; ++i) {
        clock.advanceUs(stepUs);
        hub.update(clock.nowUs());
        if (client != nullptr) client->update(clock.nowUs());
    }
}

std::array<std::byte, limits::etag_bytes> miniEtag() {
    static Catalog32 cat;  // built once; a Catalog32 is tens of KiB and is never copied
    static const bool built = conformance::buildMiniCatalog(cat);
    (void)built;
    std::array<std::byte, 8192> scratch{};
    return catalogEtag(cat, std::span<std::byte>(scratch));
}

}  // namespace

// ---- BD-01 ------------------------------------------------------------------
TEST_CASE("BD-01: BLOB_DONE round-trips, drops a wrong-length payload, preserves an unknown status") {
    BlobDoneMsg m{};
    m.id.ns = 1;
    m.id.store_id = 7;
    m.id.slot = 3;
    m.id.generation = 0x1234;
    m.status = BlobDoneStatus::HashMismatch;

    std::array<std::byte, 16> buf{};
    const size_t n = encodeBlobDone(m, std::span<std::byte>(buf));
    REQUIRE(n == kBlobDoneBytes);
    CHECK(n == 7);

    // The first 6 bytes ARE BLOB_CHUNK's identity prefix -- one vocabulary,
    // asserted rather than assumed, because the two headers drifting apart is
    // exactly the T20 class of bug.
    BlobChunkHeader ch{};
    ch.id = m.id;
    std::array<std::byte, 32> chunkHdr{};
    REQUIRE(putBlobChunkHeader(std::span<std::byte>(chunkHdr), ch) == kBlobChunkHeaderBytes);
    for (size_t i = 0; i < 6; ++i) CHECK(buf[i] == chunkHdr[i]);

    auto back = decodeBlobDone(std::span<const std::byte>(buf.data(), n));
    REQUIRE(back.has_value());
    CHECK(back->id.ns == 1);
    CHECK(back->id.store_id == 7);
    CHECK(back->id.slot == 3);
    CHECK(back->id.generation == 0x1234);
    CHECK(back->status == BlobDoneStatus::HashMismatch);

    // Wrong length: dropped, never an error object (raw-plane rule).
    CHECK_FALSE(decodeBlobDone(std::span<const std::byte>(buf.data(), n - 1)).has_value());
    CHECK_FALSE(decodeBlobDone(std::span<const std::byte>(buf.data(), n + 1)).has_value());
    CHECK_FALSE(decodeBlobDone(std::span<const std::byte>()).has_value());

    // §4.3: an unrecognized status is still a peer saying the transfer ended.
    buf[6] = std::byte{99};
    auto unknown = decodeBlobDone(std::span<const std::byte>(buf.data(), n));
    REQUIRE(unknown.has_value());
    CHECK(uint8_t(unknown->status) == 99);
}

// ---- BD-02 ------------------------------------------------------------------
// §8.4: a refusal is retried from the refused index, never treated as an error.
TEST_CASE("BD-02: a transport refusing every 3rd chunk still completes; BLOB_DONE status 0") {
    Catalog32 cat;
    REQUIRE(conformance::buildMiniCatalog(cat));
    ManualClock clock;
    XorShift32 rng(9001);
    BlobHubDelegate hubDel;
    Hub hub(cat, clock, rng, hubDel);

    InProcessLink link(clock, rng);
    ChunkFaultTransport fault(link.endpointA());
    fault.refuseEveryNth = 3;
    REQUIRE(hub.attachTransport(fault));

    QuietClientDelegate cliDel;
    XorShift32 cliRng(9002);
    ClientIdentity id = makeIdentity(1);
    Client client(id, link.endpointB(), clock, cliRng, cliDel);

    REQUIRE(client.connect());
    pump(hub, clock, &client, 40);

    CHECK(fault.chunksRefused > 0);  // the fault actually fired (T30 item 6)
    REQUIRE(hubDel.dones.size() >= 1);
    CHECK(hubDel.dones[0].ns == 0);  // catalog namespace
    CHECK(hubDel.dones[0].status == BlobDoneStatus::VerifiedComplete);
    CHECK(hubDel.dones[0].session_id != 0);

    // The transfer verified: the client adopted the hub's real etag.
    auto etag = miniEtag();
    auto got = client.hubEtag();
    REQUIRE(got.size() == etag.size());
    for (size_t i = 0; i < etag.size(); ++i) CHECK(got[i] == etag[i]);
    CHECK(client.state() == ClientSessionState::LIVE);

    // No NACK anywhere: a refusal is backpressure, not a failure.
    CHECK(cliDel.nacks.empty());
}

// ---- BD-03 ------------------------------------------------------------------
TEST_CASE("BD-03: a corrupted chunk reassembles whole and reports BLOB_DONE status 1") {
    Catalog32 cat;
    REQUIRE(conformance::buildMiniCatalog(cat));
    ManualClock clock;
    XorShift32 rng(9101);
    BlobHubDelegate hubDel;
    Hub hub(cat, clock, rng, hubDel);

    InProcessLink link(clock, rng);
    ChunkFaultTransport fault(link.endpointA());
    fault.corruptIndex = 1;
    REQUIRE(hub.attachTransport(fault));

    QuietClientDelegate cliDel;
    XorShift32 cliRng(9102);
    ClientIdentity id = makeIdentity(2);
    Client client(id, link.endpointB(), clock, cliRng, cliDel);

    REQUIRE(client.connect());
    pump(hub, clock, &client, 40);

    REQUIRE(hubDel.dones.size() >= 1);
    CHECK(hubDel.dones[0].status == BlobDoneStatus::HashMismatch);
    // The hub takes NO action on a nonzero status (§8.4: retry policy is the
    // sender's, and this hub's policy is to wait to be asked again).
    CHECK(cliDel.nacks.empty());
}

// ---- BD-04 ------------------------------------------------------------------
// sd-3qu's exact shape: one chunk lost, reassembly never completes. Before
// RFC-050 the transfer just stopped; now the receiver says so.
TEST_CASE("BD-04: a chunk lost forever reports BLOB_DONE status 2 at frag_reassembly_timeout_ms") {
    Catalog32 cat;
    REQUIRE(conformance::buildMiniCatalog(cat));
    ManualClock clock;
    XorShift32 rng(9201);
    BlobHubDelegate hubDel;
    Hub hub(cat, clock, rng, hubDel);

    InProcessLink link(clock, rng);
    ChunkFaultTransport fault(link.endpointA());
    fault.swallowIndex = 2;
    REQUIRE(hub.attachTransport(fault));

    QuietClientDelegate cliDel;
    XorShift32 cliRng(9202);
    ClientIdentity id = makeIdentity(3);
    Client client(id, link.endpointB(), clock, cliRng, cliDel);

    REQUIRE(client.connect());
    pump(hub, clock, &client, 20);
    CHECK(hubDel.dones.empty());  // still hoping, correctly: the window has not closed

    // Past frag_reassembly_timeout_ms (5 s) in 10 ms steps.
    pump(hub, clock, &client, 600, 10000);

    REQUIRE(hubDel.dones.size() >= 1);
    CHECK(hubDel.dones[0].status == BlobDoneStatus::Aborted);
    // Idempotent by contract, but the abandon path must not become a repeater:
    // one concluded reassembly, one report.
    CHECK(hubDel.dones.size() == 1);
}

// ---- BD-05 ------------------------------------------------------------------
// §8.4 row 4: sustained no-progress ends the transfer with ONE NACK BUSY.
TEST_CASE("BD-05: a permanently refusing link aborts the transfer with one NACK BUSY + retry_after_ms") {
    Catalog32 cat;
    REQUIRE(conformance::buildMiniCatalog(cat));
    ManualClock clock;
    XorShift32 rng(9301);
    BlobHubDelegate hubDel;
    Hub hub(cat, clock, rng, hubDel);

    InProcessLink link(clock, rng);
    ChunkFaultTransport fault(link.endpointA());
    // Wedged from the start, and ONLY for BLOB_CHUNK: the handshake and the
    // BLOB_REQ still cross, so the hub arms a cursor it can never drain. Set
    // before connect() on purpose -- the mini catalog is 5 chunks and finishes
    // inside 3 ticks, so a fault armed after the handshake arrives too late to
    // refuse anything (the first draft of this test proved exactly that).
    fault.refuseAllChunks = true;
    REQUIRE(hub.attachTransport(fault));

    QuietClientDelegate cliDel;
    XorShift32 cliRng(9302);
    ClientIdentity id = makeIdentity(4);
    Client client(id, link.endpointB(), clock, cliRng, cliDel);

    REQUIRE(client.connect());
    pump(hub, clock, &client, 30);
    CHECK(fault.chunksRefused > 0);  // the fault actually fired (T30 item 6)
    CHECK(cliDel.nacks.empty());     // holding, not failing: row 2/3 regime

    pump(hub, clock, &client, 700, 10000);  // well past the 5 s window

    int busy = 0;
    for (const auto& n : cliDel.nacks) {
        if (n.code == NackCode::BUSY) {
            ++busy;
            CHECK(n.has_retry_after_ms);
            CHECK(n.retry_after_ms == limits::busy_retry_after_default_ms);
        }
    }
    CHECK(busy == 1);  // one NACK answers one BLOB_REQ -- never one per chunk
}

// ---- BD-06 ------------------------------------------------------------------
// §8.4 rows 2 and 3: congested holds at the in-flight budget, recovery resumes
// from the held index rather than restarting or skipping.
TEST_CASE("BD-06: congestion holds emission at blob_chunks_in_flight, then resumes and completes") {
    Catalog32 cat;
    REQUIRE(conformance::buildMiniCatalog(cat));
    ManualClock clock;
    XorShift32 rng(9401);
    BlobHubDelegate hubDel;
    Hub hub(cat, clock, rng, hubDel);

    InProcessLink link(clock, rng);
    ChunkFaultTransport fault(link.endpointA());
    REQUIRE(hub.attachTransport(fault));

    QuietClientDelegate cliDel;
    XorShift32 cliRng(9402);
    ClientIdentity id = makeIdentity(5);
    Client client(id, link.endpointB(), clock, cliRng, cliDel);

    REQUIRE(client.connect());
    // Two ticks: HELLO -> WELCOME -> BLOB_REQ. Congest before the cursor drains
    // so the whole transfer runs under row 2 from its very first chunk.
    pump(hub, clock, &client, 2);
    hub.setCongestionLevel(fault, 1);

    pump(hub, clock, &client, 60);
    CHECK(fault.chunksSeen <= limits::blob_chunks_in_flight);
    CHECK(hubDel.dones.empty());  // held, not finished, and not aborted

    hub.setCongestionLevel(fault, 0);
    pump(hub, clock, &client, 60);

    REQUIRE(hubDel.dones.size() == 1);
    CHECK(hubDel.dones[0].status == BlobDoneStatus::VerifiedComplete);
    CHECK(cliDel.nacks.empty());  // recovery inside the window is never an abort
}
