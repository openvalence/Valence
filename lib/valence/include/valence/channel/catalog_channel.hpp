// valence-core — the spec-core CATALOG channel (0x0001): the hub's own
// announcement of the catalog it serves (SPEC §4.2 rule 3, §6.4, §8.6).
// Every client MUST subscribe to it (RFC-077); a live change re-publishes it
// carrying the new etag.
//
// Layout, the registry note's "etag, chunk count, entry count" in that order:
//
//   offset  type  field        meaning
//   0       u32   etag_lo      etag bytes 0..3, read as a little-endian u32
//   4       u32   etag_hi      etag bytes 4..7
//   8       u16   chunk_count  BLOB_CHUNKs a full catalog transfer takes (§8.4)
//   10      u16   entry_count  entries in the catalog
//
// The first 8 payload bytes ARE the etag in wire order. `packed_field_types`
// has no 8-byte type, so the etag rides two u32 halves, the precedent the
// pending-pairing instance id set (trust_channels.hpp). The registry pins the
// content, not these types: addCatalogChannel() and encodeCatalogMeta() below
// must agree, and the hub publishes only through the latter.
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <span>

#include "valence/channel/catalog.hpp"
#include "valence/generated/registry_constants.hpp"
#include "valence/util/byte_io.hpp"

namespace valence {

inline constexpr size_t kCatalogMetaBytes = 12;

// 0x0001 catalog (STATE, `watch`, on-change). Declare it in id order, first
// among the core channels.
inline bool addCatalogChannel(Catalog32& cat) {
    CatalogEntry* e = cat.addEntry({.id = channels::catalog,
                                    .name = "catalog",
                                    .cls = ChannelClass::STATE,
                                    .dir = Direction::h2c,
                                    .access = AccessLevel::watch,
                                    .maxRateHz = 0.0f,
                                    .defaultPriority = Priority::normal});
    if (e == nullptr) return false;
    cat.addLayoutField({.name = "etag_lo", .type = PackedFieldType::u32, .unit = "", .scale = 1.0f});
    cat.addLayoutField({.name = "etag_hi", .type = PackedFieldType::u32, .unit = "", .scale = 1.0f});
    cat.addLayoutField({.name = "chunk_count", .type = PackedFieldType::u16, .unit = "count", .scale = 1.0f});
    cat.addLayoutField({.name = "entry_count", .type = PackedFieldType::u16, .unit = "count", .scale = 1.0f});
    return !cat.overflow;
}

// Writes the 0x0001 snapshot. Returns kCatalogMetaBytes, or 0 when `etag` is
// not etag_bytes long or `out` is too small.
inline size_t encodeCatalogMeta(std::span<const std::byte> etag, uint16_t chunkCount, uint16_t entryCount,
                                std::span<std::byte> out) {
    if (etag.size() != limits::etag_bytes || out.size() < kCatalogMetaBytes) return 0;
    std::memcpy(out.data(), etag.data(), limits::etag_bytes);
    putU16(out.subspan(8, 2), chunkCount);
    putU16(out.subspan(10, 2), entryCount);
    return kCatalogMetaBytes;
}

// The etag a 0x0001 snapshot announces. False when the payload is shorter
// than the etag (a hub whose 0x0001 layout is not this one).
inline bool catalogMetaEtag(std::span<const std::byte> payload, std::array<std::byte, limits::etag_bytes>& out) {
    if (payload.size() < limits::etag_bytes) return false;
    std::memcpy(out.data(), payload.data(), limits::etag_bytes);
    return true;
}

}  // namespace valence
