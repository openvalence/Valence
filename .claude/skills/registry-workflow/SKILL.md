---
name: registry-workflow
description: Registry number allocation, codegen regeneration, and tagging workflow for spec/registry/registry.yaml. Load when allocating wire numbers, landing an accepted RFC, regenerating headers, or asking about freeze/tag state.
---

# Registry workflow

`spec/registry/registry.yaml` is the single source of truth for every wire
number. SPEC.md quotes it; Appendices A/B/G are generated from it; on any
numeric conflict the registry wins (SPEC §5.7).

## Allocating a number

1. The need arrives as an RFC in spec/RFC-QUEUE.md and gets an operator
   ruling. No number exists before acceptance.
2. Pick from the correct reserved range (each table's comment names its
   ranges; frames: 0x02 and 0x21-0x3F spec/core, 0x40-0x7F future spec,
   0x80-0xDF experimental never-in-tagged-releases, 0xE0-0xFF reserved
   except 0xE5).
3. Numbers are never reused or renumbered once released in a tagged spec
   version. Retired numbers stay burned with a comment (see 0x09/0x0A) so a
   stale peer fails loudly. The rule binds from the v1.0 tag forward; there
   are zero tags today.
4. Entries carry `ref:` (section pointer), a rationale note where the story
   is not obvious, and `status: reserved` when allocated but unimplemented.

## Regenerating (same commit as the registry edit, always)

```
python tools/gen_registry_header.py          # writes both outputs
python tools/gen_registry_header.py --check  # CI staleness gate, exit 1 on drift
```

Outputs: `lib/slopsync/include/slopsync/generated/registry_constants.hpp`
and `clients/js/generated/registry_vocab.js`. Both are committed; both are
hook-protected against hand edits.

Known codegen gaps (real, verified 2026-08-03): `ble_adv_flags` is emitted to
JS but not C++; `udp_discovery` and `ble_identity` are emitted to neither.
The machine repo hand-transcribes those (its TRAPS T20 class); its
`tools/spec-drift.sh` watches them. Closing the gap with a third codegen
target is an open intent, not done.

## Landing an accepted RFC (one commit)

SPEC.md text + registry.yaml numbers + regenerated codegen + golden vectors
(`spec/vectors/`, regenerate only when bytes changed; frozen means frozen
once tagged) + the RFC's Status line flipped in spec/RFC-QUEUE.md + the
Beads board mirror (`bd`).

## Tagging / freeze state

The freeze is written but NOT ARMED: zero git tags exist, spec status is
v1.0-candidate. Nothing is pinned until the operator tags v1.0; the
never-renumber rule arms at that tag. Do not claim anything is frozen before
then, and do not renumber casually after it.
