// valence-core -- the spec-core SETTINGS-TRIAL channel (0x0016, RFC-099).
//
// Constraints:
// - Declaring this entry is how a hub says it accepts the `trial` key
//   (cbor_keys 51). A hub that cannot keep a write unpersisted MUST NOT
//   declare it: under §4.3 a client's trial would be ignored and persisted.
// - The hub handles every op itself (Hub::handleTrialOpIntent); a delegate
//   never sees this channel in applyIntent().
// - Each op acts only on the sender's own trial set, so the floor is the
//   tier that can open a trial at all: `control`.
// See: SPEC §9.3, registry `trial_ops`
#pragma once

#include "valence/channel/catalog.hpp"
#include "valence/generated/registry_constants.hpp"

namespace valence {

namespace trial_value {
inline constexpr uint8_t op = 1;  // a `trial_ops` value
}  // namespace trial_value

// Index 0 is op-select filler (§8.9), kept at the strict side like every op.
inline bool addSettingsTrialChannel(Catalog32& cat, float maxRateHz = 5.0f) {
    CatalogEntry* e = cat.addEntry({.id = channels::settings_trial,
                                    .name = "settings-trial",
                                    .cls = ChannelClass::INTENT,
                                    .dir = Direction::c2h,
                                    .access = AccessLevel::control,
                                    .maxRateHz = maxRateHz,
                                    .defaultPriority = Priority::normal});
    if (e == nullptr) return false;
    cat.addSelectSchemaField({.key = trial_value::op, .name = "op", .type = CborFieldType::uint_t, .unit = "",
                              .desc = "Keep or undo this client's trial values",
                              .role = "action.trial"},
                             {"reserved", "commit", "revert"},
                             {AccessLevel::control, AccessLevel::control, AccessLevel::control});
    return !cat.overflow;
}

}  // namespace valence
