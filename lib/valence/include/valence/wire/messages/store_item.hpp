// valence-core -- store item, SPEC §8.7 / RFC-073 (CDDL `store-item`): the
// self-contained CBOR document a BLOB_CHUNK stream for blob ns 1 reassembles
// into, and a full-item `save` import. Keys are the registry `blob_keys`:
// slot 3, name 5, kind 6, payload 7 required; digest 11 optional. The
// "trust.ledger" store keeps its own grammar (§12.6) and never comes here.
//
// The payload stays OPAQUE: decode returns a view, never inspects it. Size
// bounds are per store (`name_max`, `per_item_max`), so the caller checks
// them against the declaring STORE entry.
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <span>
#include <string_view>

#include "valence/core/result.hpp"
#include "valence/generated/registry_constants.hpp"
#include "valence/wire/cbor/cbor_reader.hpp"
#include "valence/wire/cbor/cbor_writer.hpp"
#include "valence/wire/raw/blob_done.hpp"
#include "valence/wire/sha256.hpp"

namespace valence {

struct StoreItem {
    uint8_t slot = 0;
    std::string_view name{};
    std::string_view kind{};                  // "<domain>.<variant>", advisory
    std::span<const std::byte> payload{};
    // key 11. Encode: when set, emits SHA-256 over `payload` (the `digest`
    // member is ignored, so an encoded digest is right by construction).
    // Decode: set iff the key was present, with its 32 bytes in `digest`.
    bool has_digest = false;
    std::array<std::byte, Sha256::kDigestBytes> digest{};
};

// Returns bytes written, or 0 if `out` is too small.
inline size_t encodeStoreItem(const StoreItem& m, std::span<std::byte> out) {
    CborWriter w(out);
    w.mapHeader(4 + uint32_t(m.has_digest));
    w.key(uint64_t(blob::slot)).uintVal(m.slot);
    w.key(uint64_t(blob::name)).tstrVal(m.name);
    w.key(uint64_t(blob::kind)).tstrVal(m.kind);
    w.key(uint64_t(blob::payload)).bstrVal(m.payload);
    if (m.has_digest) {
        const auto d = Sha256::hash(m.payload);
        w.key(uint64_t(blob::digest)).bstrVal(std::span<const std::byte>(d));
    }
    return w.size();
}

// Views point into `in`. Unknown keys are skipped (§4.3); a missing required
// key or a digest that is not 32 bytes is Malformed.
inline Result<StoreItem, DecodeError> decodeStoreItem(std::span<const std::byte> in) {
    using Ret = Result<StoreItem, DecodeError>;
    CborReader r(in);
    auto mR = r.readMapHeader();
    if (!mR) return Ret::err(mR.error());

    StoreItem m{};
    bool gotSlot = false, gotName = false, gotKind = false, gotPayload = false;
    for (uint32_t i = 0; i < mR.value(); ++i) {
        auto kR = r.readKey();
        if (!kR) return Ret::err(kR.error());
        switch (kR.value()) {
            case uint64_t(blob::slot): {
                auto v = r.readUint();
                if (!v) return Ret::err(v.error());
                if (v.value() > 0xFF) return Ret::err(DecodeError::Malformed);
                m.slot = uint8_t(v.value());
                gotSlot = true;
                break;
            }
            case uint64_t(blob::name): {
                auto v = r.readTstr();
                if (!v) return Ret::err(v.error());
                m.name = v.value();
                gotName = true;
                break;
            }
            case uint64_t(blob::kind): {
                auto v = r.readTstr();
                if (!v) return Ret::err(v.error());
                m.kind = v.value();
                gotKind = true;
                break;
            }
            case uint64_t(blob::payload): {
                auto v = r.readBstr();
                if (!v) return Ret::err(v.error());
                m.payload = v.value();
                gotPayload = true;
                break;
            }
            case uint64_t(blob::digest): {
                auto v = r.readBstr();
                if (!v) return Ret::err(v.error());
                if (v.value().size() != Sha256::kDigestBytes) return Ret::err(DecodeError::Malformed);
                for (size_t b = 0; b < Sha256::kDigestBytes; ++b) m.digest[b] = v.value()[b];
                m.has_digest = true;
                break;
            }
            default: {
                auto sv = r.skipValue();
                if (!sv) return Ret::err(sv.error());
                break;
            }
        }
    }
    if (!(gotSlot && gotName && gotKind && gotPayload)) return Ret::err(DecodeError::Malformed);
    return Ret::ok(m);
}

// §8.4/§8.7: the BLOB_DONE status a receiver reports for a decoded store item.
// HashMismatch iff a digest is present and disagrees with the payload; an item
// without one has nothing to check and reports VerifiedComplete.
inline BlobDoneStatus storeItemDoneStatus(const StoreItem& m) {
    if (!m.has_digest) return BlobDoneStatus::VerifiedComplete;
    return Sha256::hash(m.payload) == m.digest ? BlobDoneStatus::VerifiedComplete : BlobDoneStatus::HashMismatch;
}

}  // namespace valence
