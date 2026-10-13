// test_valence_savednets -- RFC-116: the saved-network list (save, replace,
// remove, move, the persisted form) and the join rule.
// Suite ids: SN-xx.

#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>

#include <array>
#include <vector>

#include "valence/net/saved_networks.hpp"

using namespace valence::net;

namespace {

std::vector<uint8_t> order(const SavedNetworks& l, std::vector<Sighting> heard) {
    std::array<uint8_t, SavedNetworks::kCapacity> o{};
    std::array<int8_t, SavedNetworks::kCapacity> r{};
    const size_t n = joinOrder(l, heard, o, r);
    return {o.begin(), o.begin() + n};
}

SavedNetworks abcd() {
    SavedNetworks l;
    for (const char* s : {"a", "b", "c", "d"}) REQUIRE(l.save(std::nullopt, s, "password1").ok);
    return l;
}

}  // namespace

TEST_CASE("SN-01 save appends, replaces by SSID or slot, refuses when full") {
    SavedNetworks l;
    auto r = l.save(std::nullopt, "home", "password1");
    CHECK(r.ok);
    CHECK(r.saved.slot == 0);
    CHECK_FALSE(r.saved.replaced);
    const uint8_t firstId = l.id(0);
    r = l.save(std::nullopt, "home", "password2");
    CHECK(r.saved.slot == 0);
    CHECK(r.saved.replaced);
    CHECK(l.count() == 1);
    CHECK(l.passphrase(0) == "password2");
    CHECK(l.id(0) != firstId);
    CHECK(l.save(std::size_t(3), "x", "").error == SavedNetworks::Error::no_such_slot);
    CHECK(l.save(std::nullopt, "", "").error == SavedNetworks::Error::credentials);
    CHECK(l.save(std::nullopt, "x", "short").error == SavedNetworks::Error::credentials);
    l = abcd();
    CHECK(l.save(std::nullopt, "e", "").error == SavedNetworks::Error::full);
    r = l.save(std::size_t(2), "e", "");
    CHECK(r.ok);
    CHECK(l.ssid(2) == "e");
    CHECK(l.open(2));
}

TEST_CASE("SN-02 remove closes the gap; move reinserts; ids follow their entry") {
    SavedNetworks l = abcd();
    const uint8_t idC = l.id(2);
    CHECK(l.remove(1));
    CHECK(l.count() == 3);
    CHECK(l.ssid(1) == "c");
    CHECK(l.id(1) == idC);
    CHECK_FALSE(l.remove(3));
    CHECK(l.move(2, 0));
    CHECK(l.ssid(0) == "d");
    CHECK(l.ssid(1) == "a");
    CHECK(l.ssid(2) == "c");
    CHECK(l.findId(idC) == std::size_t(2));
    CHECK(l.move(0, 2));
    CHECK(l.ssid(2) == "d");
    CHECK_FALSE(l.move(0, 3));
}

TEST_CASE("SN-03 the persisted form round-trips and refuses damage") {
    SavedNetworks l = abcd();
    l.save(std::size_t(1), "open", "");
    std::array<uint8_t, SavedNetworks::kBlobBytes> blob{};
    REQUIRE(l.encode(blob) == blob.size());
    SavedNetworks back;
    REQUIRE(back.decode(blob));
    CHECK(back.count() == 4);
    for (size_t i = 0; i < 4; ++i) {
        CHECK(back.ssid(i) == l.ssid(i));
        CHECK(back.passphrase(i) == l.passphrase(i));
    }
    blob[2] = 9;
    CHECK_FALSE(back.decode(blob));
    CHECK(back.count() == 0);
    blob[2] = 1;
    blob[4 + 1] = 65;   // entry 0 passLen past the field
    CHECK_FALSE(back.decode(blob));
    CHECK_FALSE(back.decode(std::span<const uint8_t>(blob.data(), blob.size() - 1)));
}

TEST_CASE("SN-04 the join rule: strongest visible, near tie to the earlier entry, unseen after in list order") {
    SavedNetworks l = abcd();
    // b strongest by 10 dB; c not heard; d below the floor
    CHECK(order(l, {{"a", -70}, {"b", -60}, {"d", -90}}) == std::vector<uint8_t>{1, 0, 2, 3});
    // a within 3 dB of b: the earlier entry wins
    CHECK(order(l, {{"a", -63}, {"b", -60}}) == std::vector<uint8_t>{0, 1, 2, 3});
    // 4 dB is not a tie
    CHECK(order(l, {{"a", -64}, {"b", -60}}) == std::vector<uint8_t>{1, 0, 2, 3});
    // an entry's signal is its strongest BSSID; unknown SSIDs are ignored
    CHECK(order(l, {{"c", -80}, {"c", -50}, {"zz", -20}, {"a", -55}}) == std::vector<uint8_t>{2, 0, 1, 3});
    // nothing heard: list order
    CHECK(order(l, {}) == std::vector<uint8_t>{0, 1, 2, 3});
    std::array<uint8_t, 4> o{};
    std::array<int8_t, 4> r{};
    const std::vector<Sighting> heard{{"b", -60}, {"d", -90}};
    joinOrder(l, heard, o, r);
    CHECK(r[0] == kRssiUnseen);
    CHECK(r[1] == -60);
    CHECK(r[3] == -90);
}
