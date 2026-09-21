# Valence Channel-Space Grid

*Companion to [SPEC.md](SPEC.md) §4.4 (channel id ranges) and
[registry/registry.yaml](registry/registry.yaml)'s `channel_id_ranges` /
`core_channels` (the wire-number source of truth — see [RFC-047](RFC-QUEUE.md#rfc-047--the-0xcdss-channel-allocation-grid-structure-over-arrival-order-history)
for the change history this grid landed in).*

This document is the protocol-side half of channel numbering: the
**convention** every Valence hub's device-defined channel space (`0x0080`
–`0x7FFF`) is RECOMMENDED to follow, plus the fixed core channel list
(`0x0001`–`0x000E`) that every hub shares. It does not enumerate any single
hub's actual device channels — that allocation is each hub's own, documented
in its own repository. Valence Drive's `CHANNEL-MAP.md` is the worked example
of a real hub applying this convention.

## Why a grid, not arrival order

A device channel space that grows by simply taking the next free number
encodes nothing but history: two related channels can land on opposite ends
of the id space, there is no reserved room for a new member of an existing
concept, and nobody can hold the map in their head. The grid fixes all
three by making every hex digit answer a specific question.

## The 0xCDFM grid

A device-defined channel id reads, digit by digit, as **class / domain /
family / member**:

| Digit | Name | Meaning |
|---|---|---|
| `C` | class | which of the five channel classes, encoded as class id + 1: `1`=STATE, `2`=STREAM, `3`=INTENT, `4`=EVENT, `5`=STORE |
| `D` | domain | the device-chosen subsystem this channel belongs to (motion, machine, pattern, etc.), declared via catalog groups |
| `F` | family | a related cluster of channels within that domain (see below) |
| `M` | member | a specific channel within that family |

So `0x2101` reads as **STREAM, domain 1, family 0, member 1** — a specific,
nameable slot, not an arbitrary number. This is the RECOMMENDED shape for
device space; it is not enforced by the wire (the registry's
`channel_id_ranges` entry for `0x0080`-`0x7FFF` just says "hub firmware
allocates; described by catalog" — a hub could ignore the grid and still be
wire-conformant), but a hub that follows it gets collision-free growth room
for free.

## The mirror rule

A channel and its paired writer/twin across class bands share
**domain+family+member exactly**. A STATE channel at `0x1120` and its
INTENT counterpart at `0x3120` are the same domain/family/member pair, just
read/write twins in different class bands — the class digit is the only
thing that changes. This is what makes "find the writer for this readout"
a lookup, not a search.

## Sub-slot convention: family and member

The flat "slot" byte a class+domain id leaves is itself split into a
**family nibble** and a **member nibble**:

- **Member 0 is always the family's master** — its own STATE/roster
  channel, or the sole INTENT verb for a single-writer family.
- Every non-zero member is a related channel within that family: a tuning
  card, a modifier lane, a preset-store twin.
- Every family reserves 15 unused member slots, and every domain reserves
  unused families — a new member of an existing concept always has a
  numeric home without disturbing its neighbors.

## Family `0xF`: admin/meta

Family `0xF` is reserved as the admin/meta family **in every domain**. A
domain's `0x_F0` slot is that domain's admin surface — clear-fault,
save-config, scan, and similar out-of-band operations that act on the
domain as a whole rather than on one of its channels.

## Reserved domains and the experimental range

- Domains `3` (auxiliary), `4` (playback), and `5` (automation) are held
  for future subsystem categories, unallocated by convention until a hub
  needs them.
- Domains `8`-`F` are parked for a future multi-axis convention (more than
  one instance of the same subsystem on one hub).
- `0x7000`-`0x7FFF` is reserved EXPERIMENTAL/VENDOR play space. A channel id
  in this range MUST NEVER appear in a shipped catalog (registry.yaml,
  `channel_id_ranges`). It exists so a vendor prototyping a new channel has
  somewhere collision-safe to work before requesting a real allocation.

## Core channels (`0x0001`-`0x000E`)

Fixed, spec-governed, identical on every conforming hub — never
device-allocated. `0x0000` is reserved for session-scoped frames (never
subscribable). Full field-level detail lives in `registry/registry.yaml`'s
`core_channels`; this is the map:

| Id | Name | Class | Status |
|---|---|---|---|
| `0x0001` | catalog | STATE | active |
| `0x0002` | session-roster | STATE | reserved (allocated + specified, not implemented by any reference hub) |
| `0x0003` | safety | STATE | active |
| `0x0004` | control-owner | STATE | active |
| `0x0005` | safety-intents | INTENT | active |
| `0x0006` | hub-status | STATE | active |
| `0x0007` | session-events | EVENT | active |
| `0x0008` | log | EVENT | active |
| `0x0009` | session-admin | INTENT | active |
| `0x000A` | pending-pairing | STATE | active |
| `0x000B` | pairing-events | EVENT | active |
| `0x000C` | paired-devices | STORE | active |
| `0x000D` | paired-devices-roster | STATE | active |
| `0x000E` | safety-events | EVENT | active |

`0x000F`-`0x007F` are reserved spec-core headroom for future core channels.

## Worked example

Each hub documents its own device-range allocations; this repository does
not carry any single hub's channel map, on purpose — the whole point of the
grid is that a device catalog is self-describing over the wire (SPEC.md
§8), so a generic client never needs a static map to work. Valence Drive (the
reference hub implementation) publishes its own `CHANNEL-MAP.md` in its own
repository as the worked example of a real device applying this convention.
