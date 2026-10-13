// test_valence_savednets -- RFC-116: the saved-network list (save, replace,
// remove, move, the persisted form) and the join rule; RFC-118: the visible
// networks a scan heard.
// Suite ids: SN-xx.

#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>

#include <array>
#include <string>
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

TEST_CASE("SN-05 SSIDs stay unique; wifi_join always has a target, never the live entry") {
    SavedNetworks l = abcd();
    CHECK(l.save(std::size_t(0), "b", "password1").error == SavedNetworks::Error::duplicate);
    CHECK(l.save(std::size_t(1), "b", "password2").ok);   // the entry's own SSID
    CHECK(l.joinTarget(std::nullopt, "c", std::nullopt) == std::size_t(2));
    CHECK(l.joinTarget(std::size_t(1), "new", std::nullopt) == std::size_t(1));
    // full, no slot, a new SSID: the last entry, or the one before it when the last is live
    CHECK(l.joinTarget(std::nullopt, "new", std::nullopt) == std::size_t(3));
    CHECK(l.joinTarget(std::nullopt, "new", std::size_t(1)) == std::size_t(3));
    CHECK(l.joinTarget(std::nullopt, "new", std::size_t(3)) == std::size_t(2));
    REQUIRE(l.remove(3));
    CHECK_FALSE(l.joinTarget(std::nullopt, "new", std::size_t(2)).has_value());   // room: append
}

TEST_CASE("SN-06 visible networks: one row per SSID at its strongest BSSID, hidden left out, strongest first") {
    VisibleNetworks v;
    CHECK(v.scan() == 0);
    const std::vector<Sighting> heard{{"b", -70, true}, {"", -30, true}, {"a", -60, false}, {"b", -50, false},
                                      {"c", -60, true}, {std::string_view("x\0y", 3), -20, true}};
    v.take(heard);
    REQUIRE(v.count() == 3);
    CHECK(v.ssid(0) == "b");   // its strongest BSSID: -50, and that one is open
    CHECK(v.rssi(0) == -50);
    CHECK_FALSE(v.secured(0));
    CHECK(v.ssid(1) == "a");   // a tie at -60 goes by SSID bytes
    CHECK(v.ssid(2) == "c");
    CHECK(v.scan() == 1);
    v.take({});
    CHECK(v.count() == 0);
    CHECK(v.scan() == 2);
}

TEST_CASE("SN-07 visible networks keep the strongest 14 and split 7 and 7 across the two channels") {
    std::vector<std::string> names;
    std::vector<Sighting> heard;
    for (int i = 0; i < 20; ++i) names.push_back("net" + std::to_string(i));
    // weakest first, so the cap has to evict
    for (int i = 0; i < 20; ++i) heard.push_back({names[i], int8_t(-90 + i), i % 2 == 0});
    VisibleNetworks v;
    v.take(heard);
    REQUIRE(v.count() == VisibleNetworks::kRows);
    CHECK(v.ssid(0) == "net19");
    CHECK(v.ssid(13) == "net6");

    SavedNetworks saved;
    REQUIRE(saved.save(std::nullopt, "net18", "password1").ok);
    REQUIRE(saved.save(std::nullopt, "net7", "").ok);
    std::array<std::byte, VisibleNetworks::kChannelBytes> a{}, b{};
    static_assert(VisibleNetworks::kChannelBytes == 235);
    v.pack(0, saved, a);
    v.pack(1, saved, b);
    CHECK(uint8_t(a[0]) == 1);
    CHECK(uint8_t(b[0]) == 1);
    CHECK(uint8_t(a[1]) == 7);
    CHECK(uint8_t(b[1]) == 7);
    CHECK(uint8_t(a[2]) == 0b0101010);   // net19 odd: open; net18 even: secured
    CHECK(uint8_t(a[3]) == 0b0000010);   // net18 is row 1
    CHECK(uint8_t(b[3]) == 0b0100000);   // net7 is row 12, the second channel's row 5
    CHECK(int8_t(a[4]) == -71);
    CHECK(std::string_view(reinterpret_cast<const char*>(a.data() + 11), 5) == "net19");
    CHECK(std::string_view(reinterpret_cast<const char*>(b.data() + 11 + 6 * 32), 4) == "net6");
}

TEST_CASE("SN-08 a short scan leaves the second channel empty; rows past count read -128; scan skips 0 on wrap") {
    VisibleNetworks v;
    v.take(std::vector<Sighting>{{"only", -40}});
    std::array<std::byte, VisibleNetworks::kChannelBytes> a{}, b{};
    v.pack(0, SavedNetworks{}, a);
    v.pack(1, SavedNetworks{}, b);
    CHECK(uint8_t(a[1]) == 1);
    CHECK(int8_t(a[5]) == kRssiUnseen);
    CHECK(uint8_t(b[1]) == 0);
    CHECK(uint8_t(b[0]) == 1);
    CHECK(int8_t(b[4]) == kRssiUnseen);
    for (int i = 0; i < 255; ++i) v.take({});
    CHECK(v.scan() == 1);
}

TEST_CASE("SN-09 SSIDs that are not valid UTF-8 are left out; valid multibyte ones stay") {
    CHECK(validUtf8("caf\xC3\xA9"));
    CHECK(validUtf8("\xF0\x9F\x93\xB6 wifi"));
    CHECK_FALSE(validUtf8("\xC3"));                // truncated
    CHECK_FALSE(validUtf8("\xC0\xAF"));            // overlong
    CHECK_FALSE(validUtf8("\xED\xA0\x80"));        // surrogate
    CHECK_FALSE(validUtf8("\xF4\x90\x80\x80"));    // past U+10FFFF
    CHECK_FALSE(validUtf8("\xFF"));
    VisibleNetworks v;
    v.take(std::vector<Sighting>{{"caf\xC3\xA9", -50}, {"bad\xFF", -40}, {"\xC3", -30}});
    REQUIRE(v.count() == 1);
    CHECK(v.ssid(0) == "caf\xC3\xA9");
}
