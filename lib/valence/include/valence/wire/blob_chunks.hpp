// valence-core — NAMESPACED blob transfer chunking, SPEC §8.4 / RFC-021.
//
// BLOB_CHUNK (raw plane) carries a fixed 14-byte identity header followed by
// up to limits::catalog_chunk_payload (192) bytes of the blob being moved:
//
//   offset  size  field         `blob_keys` name
//   0       1     ns            ns           (blob_namespaces: 0 catalog, 1 store)
//   1       1     store_id      store_id     (0 in the catalog namespace)
//   2       1     slot          slot         (0 in the catalog namespace)
//   3       1     reserved      —            (MUST be written 0, MUST be ignored)
//   4       2     generation    generation   (roster generation; 0 for the catalog)
//   6       2     chunk_index   chunk_index
//   8       2     chunk_count   chunk_count
//   10      4     total_bytes   total_bytes  (RFC-028: size before you allocate)
//
// The header is BINARY, not CBOR — BLOB_CHUNK is raw plane and a potato
// receiver must be able to demultiplex it with four getU16 calls. Its fields
// are NAMED from `blob_keys` on purpose (registry note: "raw plane, but its
// fixed header carries the SAME identity fields, named here so the two stay
// aligned"), so BLOB_REQ's CBOR map and this header describe one vocabulary.
//
// 14 + 192 = 206 bytes of payload, +8 frame header = 214, inside §13.1's
// 242-byte transport floor unfragmented on every binding. WS MAY carry
// multiple chunks back-to-back in one message.
//
// Receiver-side reassembly (§8.4): reassemble by index; request missing
// indices after a gap timeout (`catalog_chunk_gap_timeout_ms`, 500ms
// default); abandon after `frag_reassembly_timeout_ms` (5s) total, then
// either retry from scratch or fall back to the static profile (§8.5,
// static_profile.hpp). This file only measures elapsed time against those
// two thresholds — it does not itself send BLOB_REQ or drive a clock;
// callers own the transport and the actual timer (hence plain uint32_t
// `nowMs` parameters throughout, not an IClock&: this header has nothing to
// poll on its own, so there is nothing purity gains by injecting the whole
// clock interface just to read one value each call).
#pragma once

#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <span>
#include <utility>

#include "valence/core/allocator.hpp"
#include "valence/generated/registry_constants.hpp"
#include "valence/util/byte_io.hpp"
#include "valence/util/serial_arithmetic.hpp"
#include "valence/wire/messages/blob_req.hpp"  // BlobId — one identity vocabulary

namespace valence {

inline constexpr size_t kBlobChunkHeaderBytes = 14;

struct BlobChunkHeader {
    BlobId id{};
    uint16_t chunk_index = 0;
    uint16_t chunk_count = 0;
    uint32_t total_bytes = 0;
};

// Number of BLOB_CHUNK frames needed to carry `totalBytes` of encoded blob, at
// limits::catalog_chunk_payload bytes per chunk. 0 iff totalBytes == 0
// (nothing to send). Namespace-agnostic: a preset item chunks exactly the way
// the catalog does.
inline constexpr size_t chunkCount(size_t totalBytes) {
    if (totalBytes == 0) return 0;
    return (totalBytes + limits::catalog_chunk_payload - 1) / limits::catalog_chunk_payload;
}

// Writes the 14-byte identity header into `out`. Returns kBlobChunkHeaderBytes
// or 0 if `out` is too small.
inline size_t putBlobChunkHeader(std::span<std::byte> out, const BlobChunkHeader& h) {
    if (out.size() < kBlobChunkHeaderBytes) return 0;
    putU8(out.subspan(0, 1), h.id.ns);
    putU8(out.subspan(1, 1), h.id.store_id);
    putU8(out.subspan(2, 1), h.id.slot);
    putU8(out.subspan(3, 1), 0);  // reserved
    putU16(out.subspan(4, 2), h.id.generation);
    putU16(out.subspan(6, 2), h.chunk_index);
    putU16(out.subspan(8, 2), h.chunk_count);
    putU32(out.subspan(10, 4), h.total_bytes);
    return kBlobChunkHeaderBytes;
}

// Parses the identity header from a BLOB_CHUNK raw payload. Returns false when
// `in` is shorter than the header. The reserved byte is IGNORED, never
// validated — that is what makes it usable later without a break.
inline bool getBlobChunkHeader(std::span<const std::byte> in, BlobChunkHeader& h) {
    if (in.size() < kBlobChunkHeaderBytes) return false;
    h.id.ns = getU8(in.subspan(0, 1));
    h.id.store_id = getU8(in.subspan(1, 1));
    h.id.slot = getU8(in.subspan(2, 1));
    h.id.has_store_id = !h.id.isCatalog();
    h.id.has_slot = !h.id.isCatalog();
    h.id.generation = getU16(in.subspan(4, 2));
    h.id.has_generation = h.id.generation != 0;
    h.chunk_index = getU16(in.subspan(6, 2));
    h.chunk_count = getU16(in.subspan(8, 2));
    h.total_bytes = getU32(in.subspan(10, 4));
    return true;
}

// Fills `out` with one BLOB_CHUNK raw payload — [14-byte identity header]
// [payload bytes] — for `index` into `encoded` (the full byte string being
// transferred: the deterministic catalog encoding for namespace 0, a store
// item's opaque document for namespace 1). Returns total bytes written
// (14 + this chunk's payload length), or 0 if `index` is out of range for
// `encoded`'s size or `out` is too small to hold it.
inline size_t fillBlobChunk(const BlobId& id, std::span<const std::byte> encoded, uint16_t index,
                            std::span<std::byte> out) {
    size_t cc = chunkCount(encoded.size());
    if (cc == 0 || index >= cc) return 0;

    size_t offset = size_t(index) * limits::catalog_chunk_payload;
    size_t payloadLen = encoded.size() - offset;
    if (payloadLen > limits::catalog_chunk_payload) payloadLen = limits::catalog_chunk_payload;

    size_t total = kBlobChunkHeaderBytes + payloadLen;
    if (out.size() < total) return 0;

    BlobChunkHeader h{};
    h.id = id;
    h.chunk_index = index;
    h.chunk_count = uint16_t(cc);
    h.total_bytes = uint32_t(encoded.size());
    putBlobChunkHeader(out, h);
    std::memcpy(out.data() + kBlobChunkHeaderBytes, encoded.data() + offset, payloadLen);
    return total;
}

// Reassembler storage, inline: MaxChunks chunks held in the object. No heap.
template <size_t MaxChunks>
class InlineChunkStorage {
public:
    static constexpr size_t kMaxChunks = MaxChunks;
    bool acquire(size_t, size_t) { return true; }
    void release() {}
    std::span<std::byte> bytes() { return _buf; }
    std::span<const std::byte> bytes() const { return _buf; }
    std::byte* received() { return _received.data(); }
    const std::byte* received() const { return _received.data(); }

private:
    std::array<std::byte, MaxChunks * limits::catalog_chunk_payload> _buf{};
    std::array<std::byte, MaxChunks> _received{};
};

// Reassembler storage, out of line: one block per transfer from an IAllocator,
// sized to the declared transfer (never to MaxChunks), freed by release().
// Constraint: not copyable or movable; the block belongs to this object.
template <size_t MaxChunks>
class AllocatedChunkStorage {
public:
    static constexpr size_t kMaxChunks = MaxChunks;
    explicit AllocatedChunkStorage(IAllocator& alloc) : _alloc(&alloc) {}
    AllocatedChunkStorage(const AllocatedChunkStorage&) = delete;
    AllocatedChunkStorage& operator=(const AllocatedChunkStorage&) = delete;
    ~AllocatedChunkStorage() { release(); }

    // Caller bounds chunkCount and totalBytes first. False when the allocator
    // has no block of that size.
    bool acquire(size_t chunkCount, size_t totalBytes) {
        const size_t data = std::max<size_t>(chunkCount * limits::catalog_chunk_payload, totalBytes);
        const size_t need = data + chunkCount;
        if (need > _blockBytes) {
            release();
            _block = static_cast<std::byte*>(_alloc->allocate(need));
            if (_block == nullptr) return false;
            _blockBytes = need;
        }
        _dataBytes = data;
        return true;
    }
    void release() {
        if (_block != nullptr) _alloc->deallocate(_block, _blockBytes);
        _block = nullptr;
        _blockBytes = 0;
        _dataBytes = 0;
    }
    std::span<std::byte> bytes() { return {_block, _dataBytes}; }
    std::span<const std::byte> bytes() const { return {_block, _dataBytes}; }
    std::byte* received() { return _block + _dataBytes; }
    const std::byte* received() const { return _block + _dataBytes; }

private:
    IAllocator* _alloc;
    std::byte* _block = nullptr;
    size_t _blockBytes = 0;
    size_t _dataBytes = 0;
};

// Receiver-side reassembler over a storage (above). MaxChunks bounds the chunk
// count and the total (MaxChunks * catalog_chunk_payload bytes); callers with
// larger blobs pick a bigger MaxChunks.
//
// Namespace-agnostic by construction: it assembles whatever identity it was
// begun for and REJECTS chunks belonging to a different one, which is what
// lets a client have a catalog transfer and a preset fetch in flight without
// either corrupting the other (one reassembler each).
template <class Storage>
class BasicChunkReassembler {
public:
    static constexpr size_t kMaxChunks = Storage::kMaxChunks;
    static constexpr size_t kMaxTotalBytes = kMaxChunks * limits::catalog_chunk_payload;

    BasicChunkReassembler() = default;
    explicit BasicChunkReassembler(IAllocator& alloc) : _store(alloc) {}

    // Starts (or restarts) a reassembly of `id` spanning `chunkCount` chunks
    // totaling `totalBytes`. A transfer whose declared total exceeds this
    // instance's capacity is refused up front (active() stays false) rather
    // than overflowing later — RFC-028's know-the-size-before-you-allocate
    // rule, which is exactly what `total_bytes` rides the header for. A
    // storage that cannot supply the block refuses the same way.
    void begin(const BlobId& id, uint16_t chunkCount, size_t totalBytes, uint32_t nowMs) {
        _active = (chunkCount > 0) && (chunkCount <= kMaxChunks) && (totalBytes <= kMaxTotalBytes) &&
                  _store.acquire(chunkCount, totalBytes);
        _id = id;
        // RFC-028 (found by test/fuzz/fuzz_blob): a REFUSED transfer must not
        // leave its attacker-chosen sizes behind. This used to store
        // chunkCount/totalBytes unconditionally and rely on every reader
        // checking active() first — but missingIndices() walks _received[i]
        // for i < _chunkCount and assembled() spans _totalBytes, so a
        // 65535-chunk / 4 GB header that begin() correctly refused still
        // dictated an out-of-bounds walk one call later. Refusing means
        // refusing the NUMBERS too.
        _chunkCount = _active ? chunkCount : 0;
        _totalBytes = _active ? totalBytes : 0;
        _receivedCount = 0;
        if (_active) std::fill_n(_store.received(), _chunkCount, std::byte{0});
        _startMs = nowMs;
        _lastProgressMs = nowMs;
    }

    // Convenience: begin from a received chunk's own header (the usual client
    // flow — the first chunk to arrive tells you everything you need).
    void begin(const BlobChunkHeader& h, uint32_t nowMs) {
        begin(h.id, h.chunk_count, h.total_bytes, nowMs);
    }

    // Abandons whatever was in flight, so the next chunk begins a new transfer,
    // and returns an allocated storage's block. In place: assigning a fresh
    // inline ChunkReassembler puts its whole buffer on the caller's stack.
    void reset() {
        _store.release();
        _active = false;
        _chunkCount = 0;
        _totalBytes = 0;
        _receivedCount = 0;
    }

    bool active() const { return _active; }
    const BlobId& target() const { return _id; }

    // Accepts one BLOB_CHUNK raw payload (as produced by fillBlobChunk).
    // Returns true iff it was structurally valid, addressed to THIS transfer,
    // consistent with its chunk_count, and copied in (duplicates are accepted
    // idempotently and still return true). False on any mismatch/overflow —
    // the caller decides whether that's worth logging; it is never fatal.
    bool insert(std::span<const std::byte> chunkPayload, uint32_t nowMs) {
        if (!_active) return false;
        BlobChunkHeader h{};
        if (!getBlobChunkHeader(chunkPayload, h)) return false;
        if (!h.id.sameTarget(_id)) return false;  // a different blob's chunk
        if (h.chunk_count != _chunkCount || h.chunk_index >= _chunkCount) return false;

        size_t payloadLen = chunkPayload.size() - kBlobChunkHeaderBytes;
        size_t offset = size_t(h.chunk_index) * limits::catalog_chunk_payload;
        const std::span<std::byte> buf = _store.bytes();
        if (offset + payloadLen > buf.size()) return false;

        std::memcpy(buf.data() + offset, chunkPayload.data() + kBlobChunkHeaderBytes, payloadLen);
        std::byte& seen = _store.received()[h.chunk_index];
        if (seen == std::byte{0}) {
            seen = std::byte{1};
            ++_receivedCount;
        }
        _lastProgressMs = nowMs;
        return true;
    }

    bool complete() const { return _active && _receivedCount == _chunkCount; }

    // Writes the ascending list of not-yet-received chunk indices into
    // `out` (capped at out.size()), returning how many were written — the
    // exact shape BLOB_REQ{chunks: [...], blob: {...}} needs for repair.
    size_t missingIndices(std::span<uint16_t> out) const {
        if (!_active) return 0;  // nothing in flight: nothing is missing
        size_t n = 0;
        const std::byte* received = _store.received();
        for (uint16_t i = 0; i < _chunkCount && i < kMaxChunks && n < out.size(); ++i) {
            if (received[i] == std::byte{0}) out[n++] = i;
        }
        return n;
    }

    // §8.4: total-abandon threshold since the transfer began — callers
    // check this and, on true, give up and either restart from scratch or
    // fall back to the static profile (§8.5).
    bool timedOut(uint32_t nowMs) const {
        return _active && timeReached(nowMs, _startMs + limits::frag_reassembly_timeout_ms);
    }

    // §8.4: gap threshold since the last accepted chunk, while still
    // incomplete — callers check this and, on true, emit
    // BLOB_REQ{chunks: missingIndices(), blob: target()} to request the holes.
    bool gapElapsed(uint32_t nowMs) const {
        return _active && !complete() &&
               timeReached(nowMs, _lastProgressMs + limits::catalog_chunk_gap_timeout_ms);
    }

    // Valid once complete(); the reassembled bytes are exactly `totalBytes`
    // from begin(), regardless of the storage's larger backing capacity.
    std::span<const std::byte> assembled() const {
        // Belt-and-braces with begin()'s refusal clamp: _totalBytes can only
        // be non-zero while active, and never above capacity — say so here
        // too, so a future change to begin() cannot resurrect an OOB span.
        const std::span<const std::byte> buf = std::as_const(_store).bytes();
        if (!_active || _totalBytes > buf.size()) return {};
        return buf.first(_totalBytes);
    }

private:
    Storage _store;
    BlobId _id{};
    uint16_t _chunkCount = 0;
    uint32_t _receivedCount = 0;
    size_t _totalBytes = 0;
    uint32_t _startMs = 0;
    uint32_t _lastProgressMs = 0;
    bool _active = false;
};

template <size_t MaxChunks = 64>
using ChunkReassembler = BasicChunkReassembler<InlineChunkStorage<MaxChunks>>;

}  // namespace valence
