// test_valence_discover -- the §13.8 DISCOVER_PROBE / DISCOVER_REPLY codec
// (wire/messages/discover.hpp) against its own golden vectors U-01..U-03.
//
// Native, hardware-free, doctest's bundled main(). The vector bytes live in
// the header; clients/js/test/valence-discover.test.mjs pins the JS codec to
// the same arrays, so the two languages cannot drift apart.

#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>

#include <array>
#include <cstddef>
#include <span>
#include <vector>

#include "valence/wire/messages/discover.hpp"

using namespace valence;

namespace {

template <size_t N>
std::vector<std::byte> bytesOf(const std::array<uint8_t, N>& a) {
    std::vector<std::byte> v(N);
    for (size_t i = 0; i < N; ++i) v[i] = std::byte(a[i]);
    return v;
}

DiscoverReply u02Inputs() {
    DiscoverReply r;
    r.nonce = 0xA1A2A3A4u;
    setDiscoverString(r.hub_name, "valence-fixture");
    r.hub_instance_id = 0x0102030405060708ull;
    r.proto_ver = 1;
    r.ws_port = 82;
    setDiscoverString(r.fw_version, "1.0.0");
    r.catalog_etag = {std::byte{0x8C}, std::byte{0x5D}, std::byte{0x68}, std::byte{0xF4},
                      std::byte{0x1A}, std::byte{0xD0}, std::byte{0x32}, std::byte{0x5E}};
    r.flags = kDiscoverFlagPairingWindowOpen;
    return r;
}

}  // namespace

TEST_CASE("U-01: probe encodes to the pinned 9 bytes and decodes back") {
    const auto want = bytesOf(discover_vectors::kU01Probe);
    std::array<std::byte, kDiscoverProbeBytes> out{};
    const DiscoverProbe p{1, 0xA1A2A3A4u};
    REQUIRE(encodeDiscoverProbe(p, out) == kDiscoverProbeBytes);
    CHECK(std::vector<std::byte>(out.begin(), out.end()) == want);

    const auto got = decodeDiscoverProbe(want);
    REQUIRE(got.isOk());
    CHECK(got.value() == p);
}

TEST_CASE("U-02: reply encodes to the pinned 76 bytes and decodes back") {
    const auto want = bytesOf(discover_vectors::kU02Reply);
    std::array<std::byte, kDiscoverReplyBytes> out{};
    REQUIRE(encodeDiscoverReply(u02Inputs(), out) == kDiscoverReplyBytes);
    CHECK(std::vector<std::byte>(out.begin(), out.end()) == want);

    const auto got = decodeDiscoverReply(want);
    REQUIRE(got.isOk());
    CHECK(got.value() == u02Inputs());
    CHECK(discoverString(got.value().hub_name) == "valence-fixture");
    CHECK(discoverString(got.value().fw_version) == "1.0.0");
}

TEST_CASE("U-03: short, long and wrong-magic probes are rejected") {
    auto v = bytesOf(discover_vectors::kU01Probe);
    CHECK(decodeDiscoverProbe(std::span(v).first(kDiscoverProbeBytes - 1)).error() == DecodeError::Truncated);
    v.push_back(std::byte{0});
    CHECK(decodeDiscoverProbe(v).error() == DecodeError::Malformed);
    v.pop_back();
    v[0] = std::byte{0};
    CHECK(decodeDiscoverProbe(v).error() == DecodeError::Malformed);
    CHECK_FALSE(decodeDiscoverProbe(std::span<const std::byte>{}).isOk());
}

TEST_CASE("reply rejects every length but 76 and a foreign magic") {
    auto v = bytesOf(discover_vectors::kU02Reply);
    CHECK(decodeDiscoverReply(std::span(v).first(75)).error() == DecodeError::Truncated);
    v.push_back(std::byte{0});
    CHECK(decodeDiscoverReply(v).error() == DecodeError::Malformed);
    v.pop_back();
    v[3] = std::byte{'X'};
    CHECK(decodeDiscoverReply(v).error() == DecodeError::Malformed);
}

TEST_CASE("encoders refuse a short buffer") {
    std::array<std::byte, kDiscoverReplyBytes - 1> small{};
    CHECK(encodeDiscoverReply(u02Inputs(), small) == 0);
    CHECK(encodeDiscoverProbe(DiscoverProbe{}, std::span(small).first(kDiscoverProbeBytes - 1)) == 0);
}

TEST_CASE("fixed-width strings truncate byte-wise and a full field has no NUL") {
    std::array<std::byte, kDiscoverFwVersionBytes> f{};
    setDiscoverString(f, "0123456789abcdefXYZ");
    CHECK(discoverString(f) == "0123456789abcdef");
    setDiscoverString(f, "ab");
    CHECK(discoverString(f) == "ab");
    CHECK(f[2] == std::byte{0});
    CHECK(f[15] == std::byte{0});
}
