// test_valence_capacity -- RFC-077 item 8: the catalog capacities and the
// catalog scratch buffer are build-time parameters of the hub. This TU stands
// in for a hub build that sets them (the rfc-7n1 example: 128 entries, 1024
// fields, 128 KiB scratch); the overrides must reach every type.

#define VALENCE_CATALOG_ENTRIES 128
#define VALENCE_CATALOG_LAYOUT_FIELDS 1024
#define VALENCE_CATALOG_SCHEMA_FIELDS 1024
#define VALENCE_CATALOG_LABELS 256
#define VALENCE_CATALOG_STORES 6
#define VALENCE_CATALOG_SCRATCH_BYTES 131072
#define VALENCE_CATALOG_SAFE_SLOTS 128
#define VALENCE_RETAINED_STATES 120

#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>

#include "valence/channel/catalog.hpp"
#include "valence/conformance/catalog_check.hpp"
#include "valence/core/clock.hpp"
#include "valence/core/rng.hpp"
#include "valence/hub/hub.hpp"
#include "valence/wire/catalog_codec.hpp"
#include "valence/wire/catalog_etag.hpp"

#include <array>
#include <cstdio>
#include <string_view>

using namespace valence;

static_assert(Catalog32::kEntryCapacity == 128);
static_assert(Catalog32::kLayoutCapacity == 1024);
static_assert(Catalog32::kSchemaCapacity == 1024);
static_assert(Catalog32::kLabelCapacity == 256);
static_assert(Catalog32::kStoreCapacity == 6);
static_assert(Hub::catalogScratchCapacity() == 131072);
static_assert(Catalog32::kSafeCapacity == 128);
static_assert(Hub::retainedStateCapacity() == 120);

// rfc-bhd: RFC-076 `safe` is a side pool. A field carries only a 2-byte index,
// and the pool is the only cost that scales with SafeSlots: 0 -> 32 slots
// adds 32 SettingDefaults, within one alignment unit (an empty std::array
// still occupies one).
static_assert(sizeof(LayoutField::safeSlot) == 2);
static_assert(sizeof(SchemaField::safeSlot) == 2);
using CapNoSafe = BasicCatalog<48, 200, 160, 192, 4, 0>;
using CapSafe32 = BasicCatalog<48, 200, 160, 192, 4, 32>;
static_assert(sizeof(CapSafe32) - sizeof(CapNoSafe) + alignof(SettingDefault) >= 32 * sizeof(SettingDefault));
static_assert(sizeof(CapSafe32) - sizeof(CapNoSafe) <= 32 * sizeof(SettingDefault) + alignof(SettingDefault));

TEST_CASE("CAP-01 an overridden Catalog32 holds more entries than the default 48") {
    static Catalog32 cat;
    for (uint16_t i = 0; i < 60; ++i) {
        CHECK(cat.addEntry({.id = uint16_t(0x0100 + i), .name = "c"}) != nullptr);
    }
    CHECK(cat.ok());
    CHECK(cat.count == 60);
}

namespace {

class NullDelegate final : public HubDelegate {
public:
    Result<IntentValueMap, NackCode> applyIntent(uint16_t, const IntentValueMap& requested, AccessLevel,
                                                 bool&) override {
        return Result<IntentValueMap, NackCode>::ok(requested);
    }
    void onEstop(uint8_t, uint8_t) override {}
};

// SPEC §8.10: slice k's channels are 0x8000 + 0x20*k + r; r 2..31 are the
// accessory's own, 30 at most (registry limits.accessory_slice_ids).
constexpr size_t kSlices = 4;
constexpr size_t kChannelsPerSlice = 30;
constexpr size_t kFieldsPerChannel = 8;
std::array<std::array<char, 16>, kSlices * kChannelsPerSlice> gNames{};

void buildSlicedCatalog(Catalog32& c) {
    static constexpr std::array<std::string_view, kFieldsPerChannel> kField = {
        "level", "target", "rate", "min_seen", "max_seen", "temp", "volts", "flags"};
    static constexpr std::string_view kDesc =
        "Synthetic accessory reading, sized to push the encoding past the default scratch.";
    c.clear();
    size_t n = 0;
    for (size_t k = 0; k < kSlices; ++k) {
        for (size_t r = 2; r < 2 + kChannelsPerSlice; ++r, ++n) {
            const uint16_t id = uint16_t(0x8000 + 0x20 * k + r);
            std::snprintf(gNames[n].data(), gNames[n].size(), "acc%zu-ch%02zu", k, r);
            REQUIRE(c.addEntry({.id = id, .name = std::string_view(gNames[n].data()), .cls = ChannelClass::STATE,
                                .dir = Direction::h2c, .access = AccessLevel::watch, .maxRateHz = 10.0f}) != nullptr);
            for (std::string_view f : kField) {
                c.addLayoutField({.name = f, .type = PackedFieldType::f32, .unit = "", .scale = 1.0f,
                                  .desc = kDesc});
            }
            c.setFieldSafe(SettingDefault::ofInt(0));   // one safe value per channel
        }
    }
}

}  // namespace

TEST_CASE("CAP-02 a 128-entry build encodes a hub catalog with four 30-channel accessory slices") {
    static Catalog32 cat;
    buildSlicedCatalog(cat);
    REQUIRE(cat.ok());
    CHECK(cat.count == kSlices * kChannelsPerSlice);   // 120 of 128
    CHECK(cat.layoutUsed > Catalog32::kLayoutCapacity / 2);
    CHECK(cat.safeUsed == kSlices * kChannelsPerSlice);   // 120 of 128

    static ManualClock clock;
    static XorShift32 rng(77);
    static NullDelegate del;
    static Hub hub(cat, clock, rng, del);

    // The encoding exceeds the library's default 32 KiB scratch, so only the
    // build-time parameter lets this hub serve it.
    const size_t encoded = hub.catalogEncodedBytes();
    CHECK(encoded > 32768);
    CHECK(encoded <= Hub::catalogScratchCapacity());

    // Round trip through the codec, and the hub's etag is the catalog's.
    static std::array<std::byte, Hub::catalogScratchCapacity()> buf{};
    const size_t n = encodeCatalog(cat, buf);
    REQUIRE(n == encoded);
    static Catalog32 back;
    REQUIRE(decodeCatalog(std::span<const std::byte>(buf).first(n), back).isOk());
    CHECK(back.count == cat.count);
    const auto etag = catalogEtag(cat, buf);
    CHECK(std::equal(etag.begin(), etag.end(), hub.catalogEtag().begin()));

    static std::array<std::byte, limits::catalog_max_entry_bytes + 64> entryScratch{};
    CHECK(conformance::checkCatalog(cat, entryScratch).ok());

    // Every accessory STATE holds a retained value: the default 32 slots would
    // refuse the 33rd publish.
    const std::array<std::byte, kFieldsPerChannel * 4> value{};
    size_t published = 0;
    for (uint16_t i = 0; i < cat.count; ++i) {
        if (hub.publishState(cat.entries[i].id, std::span<const std::byte>(value))) ++published;
    }
    CHECK(published == cat.count);
}
