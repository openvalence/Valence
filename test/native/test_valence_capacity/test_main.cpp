// test_valence_capacity -- RFC-077 item 8: the catalog capacities and the
// catalog scratch buffer are build-time parameters of the hub. This TU stands
// in for a hub build that sets them; the overrides must reach every type.

#define VALENCE_CATALOG_ENTRIES 96
#define VALENCE_CATALOG_LAYOUT_FIELDS 400
#define VALENCE_CATALOG_SCHEMA_FIELDS 320
#define VALENCE_CATALOG_LABELS 256
#define VALENCE_CATALOG_STORES 6
#define VALENCE_CATALOG_SCRATCH_BYTES 65536

#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include <doctest/doctest.h>

#include "valence/channel/catalog.hpp"
#include "valence/hub/hub.hpp"

using namespace valence;

static_assert(Catalog32::kEntryCapacity == 96);
static_assert(Catalog32::kLayoutCapacity == 400);
static_assert(Catalog32::kSchemaCapacity == 320);
static_assert(Catalog32::kLabelCapacity == 256);
static_assert(Catalog32::kStoreCapacity == 6);
static_assert(Hub::catalogScratchCapacity() == 65536);

TEST_CASE("CAP-01 an overridden Catalog32 holds more entries than the default 48") {
    static Catalog32 cat;
    for (uint16_t i = 0; i < 60; ++i) {
        CHECK(cat.addEntry({.id = uint16_t(0x0100 + i), .name = "c"}) != nullptr);
    }
    CHECK(cat.ok());
    CHECK(cat.count == 60);
}
