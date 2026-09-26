// gen_blob_golden -- emits the golden bytes valence-blob.test.mjs checks.
// Constraints: every byte comes from lib/valence's own encoders (encodeBlobReq,
//   encodeBlobDone, fillBlobChunk, encodeFrameHeader); nothing here is
//   hand-assembled wire. The store item is 400 bytes of i*7+3, which the test
//   regenerates, so three chunks (192 + 192 + 16) cover a partial last chunk.
// Build and run from the repo root:
//   g++ -std=c++20 -I lib/valence/include clients/js/test/fixtures/gen_blob_golden.cpp -o gen.exe && ./gen.exe
#include <array>
#include <cstdio>
#include <span>
#include <vector>

#include "valence/wire/blob_chunks.hpp"
#include "valence/wire/frame_header.hpp"
#include "valence/wire/messages/blob_req.hpp"
#include "valence/wire/raw/blob_done.hpp"

using namespace valence;

static void dump(const char* name, std::span<const std::byte> b) {
    std::printf("%s ", name);
    for (std::byte x : b) std::printf("%02X", unsigned(x));
    std::printf("\n");
}

static std::vector<std::byte> frame(FrameType t, uint16_t ch, uint16_t seq, std::span<const std::byte> p) {
    std::vector<std::byte> out(kHeaderBytes + p.size());
    FrameHeader h;
    h.type = uint8_t(t);
    h.channel = ch;
    h.seq = seq;
    h.len = uint16_t(p.size());
    encodeFrameHeader(h, std::span<std::byte>(out));
    for (size_t i = 0; i < p.size(); ++i) out[kHeaderBytes + i] = p[i];
    return out;
}

int main() {
    std::array<std::byte, 512> buf{};

    // Full store-item request: ns 1, store 2, slot 3, sent with header seq 1.
    BlobReqMsg req;
    req.blob.ns = blob_ns::store;
    req.blob.has_store_id = true;
    req.blob.store_id = 2;
    req.blob.has_slot = true;
    req.blob.slot = 3;
    size_t n = encodeBlobReq(req, buf);
    dump("BLOB_REQ_STORE_FRAME", frame(FrameType::BLOB_REQ, 0, 1, std::span(buf.data(), n)));

    // Selective repair of the same item: chunk 1 only, header seq 2.
    req.full = false;
    req.chunks_count = 1;
    req.chunks[0] = 1;
    n = encodeBlobReq(req, buf);
    dump("BLOB_REQ_STORE_REPAIR_FRAME", frame(FrameType::BLOB_REQ, 0, 2, std::span(buf.data(), n)));

    // The item as the hub chunks it, at roster generation 7.
    std::array<std::byte, 400> item{};
    for (size_t i = 0; i < item.size(); ++i) item[i] = std::byte((i * 7 + 3) & 0xFF);
    BlobId id = req.blob;
    id.has_generation = true;
    id.generation = 7;
    for (uint16_t i = 0; i < 3; ++i) {
        n = fillBlobChunk(id, item, i, buf);
        char name[32];
        std::snprintf(name, sizeof name, "BLOB_CHUNK_%u", unsigned(i));
        dump(name, std::span(buf.data(), n));
    }

    // BLOB_DONE for that item, one per status, channel 0 seq 0 as the client sends it.
    const BlobDoneStatus statuses[] = {BlobDoneStatus::VerifiedComplete, BlobDoneStatus::HashMismatch,
                                       BlobDoneStatus::Aborted};
    for (BlobDoneStatus s : statuses) {
        BlobDoneMsg d;
        d.id = id;
        d.status = s;
        n = encodeBlobDone(d, buf);
        char name[32];
        std::snprintf(name, sizeof name, "BLOB_DONE_STORE_%u_FRAME", unsigned(s));
        dump(name, frame(FrameType::BLOB_DONE, 0, 0, std::span(buf.data(), n)));
    }
    return 0;
}
