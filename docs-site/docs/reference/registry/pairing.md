---
title: Pairing modes
description: Generated table of the Valence pairing mode bitmask advertised in WELCOME.
generated: true
---

<!-- ==========================================================
     GENERATED FILE. DO NOT EDIT.
     Source of truth: spec/registry/registry.yaml
     Generator:       docs-site/tools/gen_docs_tables.py
     Regenerate:      python docs-site/tools/gen_docs_tables.py
     CI gate:         python docs-site/tools/gen_docs_tables.py --check
     Hand edits are overwritten and fail the docs build.
     ========================================================== -->

# Pairing modes

A hub advertises the modes it currently offers as a bitmask in the
WELCOME `trust` sub-map. The trust ledger records the single bit a paired
device used.

All three modes end in the same `PAIR_GRANT {token, role}`. **The role is
an attribute of the grant, never of the ceremony.** A hub has zero or one
PIN, never one secret per tier.

| Mask | Bit | Name | Notes |
|---|---|---|---|
| `0x01` | `bit 0` | `knock_approve` | PRIMARY and capability-agnostic: bare PAIR_REQ with no proof -> bounded pending list (pairing_pending_max) exposed as protocol state (0x000A/0x000B) -> ANY `configure` session approves {instance_id, role}. The joiner needs one button and no display; the trusted surface is any configure client, which kills the circular 'the WebUI is trusted because it's the WebUI' dependency. RECOMMENDED partly because its approval surface shows the knocker's identity on hardware the attacker does not control. |
| `0x02` | `bit 1` | `pin_proof` | the HMAC-PIN flow, for keyboard-bearing joiners when no configure session exists. HONESTY CLAUSE (normative): 4 digits = 10^4 offline HMACs, so a passive observer of the exchange can brute-force it. Acceptable for the v1 threat model (casual/drive-by prevention) and MUST be stated plainly. SPAKE2 is the reserved v2 upgrade: not v1, because WebCrypto has no PAKE and mandating it would exile the browser client. |
| `0x04` | `bit 2` | `push_to_pair` | PHYSICAL-PRESENCE proof opens a short SINGLE-GRANT window. The spec requires the PROOF, not a GPIO; minimum hardware is NONE, because the power cord is the button: factory-fresh (zero configure tokens) boots claimable and the first knock gets `configure` (possession is root); later, N=3 consecutive boots with uptime <10 s opens the window (NVS counter only; cannot collide with a session, since any power loss already stops motion and forces re-home). A hub with a real button MAY bind it: a UX upgrade, never required. FACTORY RESET MUST BE A HARDER GESTURE than opening pairing. |


## Administration operations

These are the `value` map key 1 of the [`session-admin` channel](channels.md#spec-core-channels) (`0x0009`). The channel requires `configure`.

**The trusted surface is a tier, not an app.** Any `configure` session
reaches every operation here. Nothing in the protocol knows or cares
whether that session is the machine's own web page, a phone, or a
command line.

A `configure` session may grant up to its own tier, `configure`
included. The paired-device roster is the audit trail, rather than a
ceiling that would leave the first administrator unable to appoint a
second.

| Op | Name | Meaning |
|---|---|---|
| `1` | `evict` | RFC-018: GOODBYE the session named by `session_id` with SESSION_EVICTED. Runs the full §6.8/RFC-005 teardown: the evicted session's source ownership is released under its §11.3 loss policy exactly as if it had crashed, because 'no unmonitored path to motion' does not get an exception for admin actions. Evicting your OWN session is legal and is just a rude GOODBYE to yourself. |
| `2` | `pair_approve` | RFC-027(a): approve the pending knock named by `instance_id` at `role`, issuing PAIR_GRANT {token, role} to the knocker. ALSO the RFC-029 item-2 RE-APPROVAL verb: applied to a device in `recognized_pending` it re-records the observed version and restores the suspended role: approving a knock and re-trusting a changed device are the same decision ('this identity may do this'), so they are the same op rather than two that could drift. |
| `3` | `pair_deny` | RFC-027(a): drop the pending knock named by `instance_id` without issuing a token; emits pairing_events `denied`. On a `recognized_pending` device this is a REVOKE (op 4) in effect: deny means 'no', and leaving a suspended entry in the ledger after an operator said no would be a lie the roster tells forever. |
| `4` | `revoke` | RFC-027(4)/029: delete `instance_id` from the trust ledger. Revocation is PROTOCOL, not a WebUI feature: that is the entire point of putting it here. Takes effect at the next HELLO (an already-live session keeps the role it was admitted with until it reconnects or is evicted; use evict to end it now). Emits pairing_events `revoked`. |

## Trust ledger states

This is the `state` field of a paired-devices item. A revoked device
has no entry at all, so revocation is an absence and never a third
state.

| Value | State | Meaning |
|---|---|---|
| `0` | `trusted` | paired, and the version observed at the last HELLO matches the version recorded when the role was approved. The granted role applies in full. |
| `1` | `recognized_pending` | RFC-029 item 2's tripwire fired: this device presented a DIFFERENT `client_ver` than the ledger recorded. The session is admitted at `watch`, the granted role is SUSPENDED (not revoked), and a re-approval is surfaced to configure sessions via 0x000A/0x000B. HONESTY CLAUSE, normative: the version is SELF-REPORTED, so this catches an honest update and nothing else: a deliberately malicious update lies about its version and keeps its token. The real bounds on a hostile client are role scoping, instant revocation, roster visibility and the role-exempt safety ops. Do not let a UI imply this is attestation. |


## Token presentation modes

This is the `trust` sub-map's `presentation_mode`. The ledger records
it per device, so an operator can see the security posture.

`bearer` is the floor and the default. `proof` is recommended for any
client that already has SHA-256, and is never required of anyone.

| Value | Mode | Meaning |
|---|---|---|
| `0` | `bearer` | raw 16-byte token in HELLO. LEGAL, DEFAULT, and the potato floor: a coin-cell client does exactly this and nothing more. v1 transports are cleartext, so a passive LAN observer who captures one HELLO owns the credential until it is revoked; §12.1 excludes that attacker, and this mode accepts that ceiling knowingly. |
| `1` | `proof` | HMAC-SHA256(key = token, message = the WELCOME nonce) truncated to 16 B, presented in an AUTH (0x1C) frame after WELCOME. The token itself NEVER crosses the wire, so a sniffer captures a one-time proof and not the credential. Costs exactly one extra round trip per connect (HELLO -> WELCOME -> AUTH -> GRANT); the client is at `watch` in between, which is the correct posture for a client that has not yet proved anything. The 'reuse the previous session's nonce to skip the round trip' shortcut was DROPPED as replay-unsafe: see trust_keys.token_proof. |

A reported client version is a tripwire, not an attestation. It catches
an honest update. A deliberately malicious one reports whatever version
it likes and keeps its token. What bounds a hostile client is role
scoping, immediate revocation, its visibility in the roster, and the
fact that safety operations are role-exempt for everyone.

# Accessories

Accessories join a hub over the ESP-NOW spoke (SPEC §13.3.1, §13.3.2) and
their channels live in the user space (SPEC §8.10).

## Join results

The `result` byte of JOIN_REPLY (`0x22`).

| Value | Name | Notes |
|---|---|---|
| `0` | `accepted` | joined (or rejoined); the accessory waits in its safe state for a command |
| `1` | `window_closed` | unknown accessory and no association window open |
| `2` | `capacity` | no free slice, no peer entry, or the declaration exceeds the host's advertised capacity |
| `3` | `unsupported` | proto_ver not servable |
| `4` | `declaration_invalid` | the declaration failed §8.10 validation; nothing stored |
| `5` | `not_paired` | a rejoin from an accessory this host has forgotten; the accessory MAY clear its stored hub |

## Accessory admin ops

The `action.accessory` op select on core channel `0x0012`. Index 0 is op-select filler.

| Value | Name | Notes |
|---|---|---|
| `1` | `window_open` | open the §12.3 association window for an accessory join: the in-band twin of the pairing button. One accepted join closes it. |
| `2` | `forget` | GOODBYE the accessory, delete its record and every relationship targeting it, retire its slice, remove its channels. Destructive (§8.8 destructive_options on the reference op select). |
| `3` | `rename` | set the hub-authored name of the accessory named by accessory_id |

## Accessory record keys

The registered item grammar of the `accessories` store (`0x0010`).

| Value | Name | Notes |
|---|---|---|
| `1` | `accessory_id` | bstr 8: the accessory's durable identity (§8.10), the record's primary key |
| `2` | `slice` | uint: slice index k; the accessory's channels are 0x8000 + 0x20*k + r |
| `3` | `name` | tstr: the hub-authored name (renamed via accessory-admin rename) |
| `4` | `product` | tstr: the JOIN_REQ product string (<= 16 B) |
| `5` | `fw_version` | tstr: the JOIN_REQ fw_version string (<= 16 B) |
| `6` | `declaration_etag` | bstr 8: etag of the stored declaration (§8.3) |

## Accessory status

Relative id `0x01` of every slice: state u8 (accessory_states) + fault u8 (device-defined, 0 none) + beacon_seq u16 (header seq of the last accepted BEACON) = 4 B; pushed on change and at least every spoke_beacon_interval_ms.

## Accessory states

The accessory-status `state` byte (SPEC §17.1.1).

| Value | Name | Notes |
|---|---|---|
| `0` | `live` | commanded and running normally |
| `1` | `safe_joined` | joined, holding safe values, awaiting its first command |
| `2` | `safe_deadman` | safe: no matching BEACON for its deadman window (§13.3.1) |
| `3` | `safe_goodbye` | safe: a GOODBYE arrived from its hub |
| `4` | `safe_estop` | safe: an ESTOP frame or a BEACON with estop_latched; the host's acknowledgment that the e-stop reached it |
| `5` | `safe_fault` | safe: a local fault (see `fault`) |

## Relationship maps

A relationship item's `map` (SPEC §8.11). Every output is clamped into the target's declared range.

| Value | Name | Notes |
|---|---|---|
| `1` | `linear_clamp` | out = L(in) = out_min + (clamp(in, in_min, in_max) - in_min) * (out_max - out_min) / (in_max - in_min), in_min != in_max |
| `2` | `invert` | out = out_max + out_min - L(in): in_min maps to out_max |
| `3` | `threshold_hysteresis` | params on_above, off_below (source units, off_below <= on_above): out_max once the source rises to on_above, out_min once it falls to off_below, unchanged between; starts at out_min when armed |
| `4` | `slew_limit` | L(in) with its rate of change bounded by params rise_per_s, fall_per_s (target units/s; one value serves both when the second is absent) |
| `5` | `lowpass` | L(in) through a first-order low-pass, param tau_s (seconds) |
| `6` | `gate` | out = L(in) while in_min <= in <= in_max, else the target's `safe` value |
| `7` | `piecewise_table` | params: up to 8 (in, out) points flattened, in strictly ascending; linear between, held at the end values outside; the four bounds unused |

## Relationship keys

The registered item grammar of the `relationships` store (`0x0013`).

| Value | Name | Notes |
|---|---|---|
| `1` | `rel_id` | uint: 0..relationships_max-1; bit index in the roster masks |
| `2` | `name` | tstr: client-authored label |
| `3` | `source_channel` | uint: absolute id of an h2c STATE or STREAM channel |
| `4` | `source_field` | uint: layout index of a numeric field on source_channel |
| `5` | `target_channel` | uint: absolute id of an accessory INTENT or c2h STREAM channel |
| `6` | `target_field` | uint: schema key (INTENT) or layout index (STREAM) of a value-bearing field |
| `7` | `map` | uint: a `relationship_maps` value |
| `8` | `in_min` | float: source physical units |
| `9` | `in_max` | float: source physical units |
| `10` | `out_min` | float: target physical units |
| `11` | `out_max` | float: target physical units |
| `12` | `params` | array of up to 16 floats, in the order the map lists them |
| `13` | `enabled` | bool: persisted. `armed` is volatile, never stored, false at boot (§11.6) |

