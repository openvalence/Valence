// valence-core -- DISCOVER_PROBE (0x1E) and DISCOVER_REPLY (0x1F), SPEC §13.8.
//
// Constraints:
// - On UDP the datagram IS the raw payload: magic at offset 0, no §5.1
//   header (the ESTOP convention §13.8 cites). On the ESP-NOW spoke the probe
//   rides a §5.1 frame with this payload unchanged (§13.3.1).
// - Both layouts are FIXED: a probe is exactly kDiscoverProbeBytes and a reply
//   exactly kDiscoverReplyBytes. Any other length or a wrong magic is
//   rejected; registry frame_types marks neither tail-extensible.
// - Every multi-byte integer is little-endian. str32/str16 are the RFC-026
//   fixed-width NUL-padded UTF-8 types: encode truncates BYTE-wise (the
//   packStringField rule), decode stops at the first NUL.
// - Read-only identity: nothing here can command a hub (§13.8).
// - The vectors at the end are the cross-language pins. Their identity and
//   etag inputs reuse spec/vectors/manifest.yaml's frozen fixtures.
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>
#include <span>
#include <string_view>

#include "valence/core/result.hpp"
#include "valence/generated/registry_constants.hpp"
#include "valence/util/byte_io.hpp"

namespace valence {

inline constexpr size_t kDiscoverMagicBytes = 4;
inline constexpr size_t kDiscoverHubNameBytes = 32;    // str32
inline constexpr size_t kDiscoverFwVersionBytes = 16;  // str16
inline constexpr size_t kDiscoverProbeBytes = kDiscoverMagicBytes + 1 + 4;
inline constexpr size_t kDiscoverReplyBytes = kDiscoverMagicBytes + 4 + kDiscoverHubNameBytes + 8 + 1 + 2 +
                                              kDiscoverFwVersionBytes + size_t(limits::etag_bytes) + 1;
static_assert(udp_discovery::magic.size() == kDiscoverMagicBytes);
static_assert(kDiscoverProbeBytes == 9, "SPEC §13.8: magic + proto_ver:u8 + nonce:u32");
static_assert(kDiscoverReplyBytes == 76, "registry frame_types 0x1F: 76 B since the RFC-048 correction");

// DISCOVER_REPLY flags: registry discover_reply_flags. Unassigned bits MUST be zero.
inline constexpr uint8_t kDiscoverFlagPairingWindowOpen = discover_reply_flags::pairing_window_open;

struct DiscoverProbe {
    uint8_t proto_ver = kProtocolVersion;
    uint32_t nonce = 0;  // client entropy, echoed by the reply

    bool operator==(const DiscoverProbe&) const = default;
};

// Owns its bytes: the strings are held in wire form, so a decoded reply never
// aliases the datagram it came from.
struct DiscoverReply {
    uint32_t nonce = 0;
    std::array<std::byte, kDiscoverHubNameBytes> hub_name{};
    uint64_t hub_instance_id = 0;  // durable identity (identity_keys 5); 0 = the hub has none
    uint8_t proto_ver = kProtocolVersion;
    uint16_t ws_port = 0;
    std::array<std::byte, kDiscoverFwVersionBytes> fw_version{};
    std::array<std::byte, limits::etag_bytes> catalog_etag{};
    uint8_t flags = 0;

    bool operator==(const DiscoverReply&) const = default;
};

// ---- fixed-width strings ----------------------------------------------------

template <size_t N>
inline void setDiscoverString(std::array<std::byte, N>& field, std::string_view text) {
    const size_t n = text.size() < N ? text.size() : N;
    if (n > 0) std::memcpy(field.data(), text.data(), n);
    if (n < N) std::memset(field.data() + n, 0, N - n);
}

// The view aliases `field`: valid exactly as long as the struct holding it.
template <size_t N>
inline std::string_view discoverString(const std::array<std::byte, N>& field) {
    const char* p = reinterpret_cast<const char*>(field.data());
    size_t n = 0;
    while (n < N && p[n] != '\0') ++n;
    return std::string_view(p, n);
}

namespace detail {
inline void putDiscoverMagic(std::span<std::byte> out) {
    std::memcpy(out.data(), udp_discovery::magic.data(), kDiscoverMagicBytes);
}
inline bool hasDiscoverMagic(std::span<const std::byte> in) {
    return std::memcmp(in.data(), udp_discovery::magic.data(), kDiscoverMagicBytes) == 0;
}
inline void putDiscoverU64(std::span<std::byte> out, uint64_t v) {
    putU32(out.subspan(0, 4), uint32_t(v));
    putU32(out.subspan(4, 4), uint32_t(v >> 32));
}
inline uint64_t getDiscoverU64(std::span<const std::byte> in) {
    return uint64_t(getU32(in.subspan(0, 4))) | (uint64_t(getU32(in.subspan(4, 4))) << 32);
}
}  // namespace detail

// ---- DISCOVER_PROBE: magic(4) @0 | proto_ver:u8 @4 | nonce:u32 @5 -------------

inline size_t encodeDiscoverProbe(const DiscoverProbe& p, std::span<std::byte> out) {
    if (out.size() < kDiscoverProbeBytes) return 0;
    detail::putDiscoverMagic(out);
    putU8(out.subspan(4, 1), p.proto_ver);
    putU32(out.subspan(5, 4), p.nonce);
    return kDiscoverProbeBytes;
}

inline Result<DiscoverProbe, DecodeError> decodeDiscoverProbe(std::span<const std::byte> in) {
    using Ret = Result<DiscoverProbe, DecodeError>;
    if (in.size() < kDiscoverProbeBytes) return Ret::err(DecodeError::Truncated);
    if (in.size() != kDiscoverProbeBytes || !detail::hasDiscoverMagic(in)) return Ret::err(DecodeError::Malformed);
    DiscoverProbe p;
    p.proto_ver = getU8(in.subspan(4, 1));
    p.nonce = getU32(in.subspan(5, 4));
    return Ret::ok(p);
}

// ---- DISCOVER_REPLY -------------------------------------------------------------
// magic(4) @0 | nonce:u32 @4 | hub_name:str32 @8 | hub_instance_id:u64 @40 |
// proto_ver:u8 @48 | ws_port:u16 @49 | fw_version:str16 @51 |
// catalog_etag:8B @67 | flags:u8 @75

inline size_t encodeDiscoverReply(const DiscoverReply& r, std::span<std::byte> out) {
    if (out.size() < kDiscoverReplyBytes) return 0;
    detail::putDiscoverMagic(out);
    putU32(out.subspan(4, 4), r.nonce);
    std::memcpy(out.data() + 8, r.hub_name.data(), r.hub_name.size());
    detail::putDiscoverU64(out.subspan(40, 8), r.hub_instance_id);
    putU8(out.subspan(48, 1), r.proto_ver);
    putU16(out.subspan(49, 2), r.ws_port);
    std::memcpy(out.data() + 51, r.fw_version.data(), r.fw_version.size());
    std::memcpy(out.data() + 67, r.catalog_etag.data(), r.catalog_etag.size());
    putU8(out.subspan(75, 1), r.flags);
    return kDiscoverReplyBytes;
}

inline Result<DiscoverReply, DecodeError> decodeDiscoverReply(std::span<const std::byte> in) {
    using Ret = Result<DiscoverReply, DecodeError>;
    if (in.size() < kDiscoverReplyBytes) return Ret::err(DecodeError::Truncated);
    if (in.size() != kDiscoverReplyBytes || !detail::hasDiscoverMagic(in)) return Ret::err(DecodeError::Malformed);
    DiscoverReply r;
    r.nonce = getU32(in.subspan(4, 4));
    std::memcpy(r.hub_name.data(), in.data() + 8, r.hub_name.size());
    r.hub_instance_id = detail::getDiscoverU64(in.subspan(40, 8));
    r.proto_ver = getU8(in.subspan(48, 1));
    r.ws_port = getU16(in.subspan(49, 2));
    std::memcpy(r.fw_version.data(), in.data() + 51, r.fw_version.size());
    std::memcpy(r.catalog_etag.data(), in.data() + 67, r.catalog_etag.size());
    r.flags = getU8(in.subspan(75, 1));
    return Ret::ok(r);
}

// ---- golden vectors (manifest style) --------------------------------------------
// U-01  probe: proto_ver 1, nonce 0xA1A2A3A4.
// U-02  reply: nonce 0xA1A2A3A4, hub_name "valence-fixture",
//       hub_instance_id 0x0102030405060708 (the manifest `instance_id`
//       fixture), proto_ver 1, ws_port 82, fw_version "1.0.0",
//       catalog_etag 8C5D68F41AD0325E (the manifest `catalog_etag` fixture),
//       flags 0x01 (pairing window open).
// U-03  rejects: U-01 one byte short (Truncated), one byte long (Malformed),
//       magic byte 0 cleared (Malformed).
// One byte per entry in `0x` hex: clients/js/test/valence-discover.test.mjs
// parses both arrays out of this file.
namespace discover_vectors {
inline constexpr std::array<uint8_t, kDiscoverProbeBytes> kU01Probe = {
    0x56, 0x4C, 0x4E, 0x43, 0x01, 0xA4, 0xA3, 0xA2, 0xA1,
};
inline constexpr std::array<uint8_t, kDiscoverReplyBytes> kU02Reply = {
    0x56, 0x4C, 0x4E, 0x43, 0xA4, 0xA3, 0xA2, 0xA1,
    0x76, 0x61, 0x6C, 0x65, 0x6E, 0x63, 0x65, 0x2D, 0x66, 0x69, 0x78, 0x74, 0x75, 0x72, 0x65, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x08, 0x07, 0x06, 0x05, 0x04, 0x03, 0x02, 0x01,
    0x01,
    0x52, 0x00,
    0x31, 0x2E, 0x30, 0x2E, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x8C, 0x5D, 0x68, 0xF4, 0x1A, 0xD0, 0x32, 0x5E,
    0x01,
};
}  // namespace discover_vectors

}  // namespace valence
