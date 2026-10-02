---
name: valence-canon
description: Distilled Valence protocol canon with section citations. Load before any spec work, RFC drafting or review, registry edits, wire-format questions, or conformance discussion in this repo.
---

# Valence canon (distilled; every claim carries its SPEC.md citation)

Freeze state: NOT pinned, zero tags, v1.0-candidate. Pin by commit sha, never
by document version (§0). On any conflict between spec text and
`spec/registry/registry.yaml`, the registry wins (§5.7).

## Channel classes (§9, registry `channel_classes`)

- STATE (0): idempotent full snapshots, no deltas. Must fit
  `min_transport_payload` (242 B) unfragmented, a catalog-design constraint
  (§9.1). Hub retains latest and pushes on grant/reconnect. Depth-1 queue per
  subscriber, newest replaces queued-unsent. First push after grant is never
  shed (§10.4).
- STREAM (1): timestamped sample bundles, either direction. `stream_kind`
  governs shedding: `samples` (0) interpolable and decimable; `segments` (1)
  are timed COMMANDS, never decimated, shed whole-source-or-nothing
  (§9.2, §10.4). Span cap (§5.4): 20 ms for `samples` and every h2c
  bundle; a c2h `segments` bundle spans up to its grant's
  `schedule_horizon_ms` (250 default, 500 or 1000; CBOR 50) with `t_off` in
  100 µs units. A c2h `samples` stamp is an arrival time (RFC-084, RFC-087).
- INTENT (2): the only way a client changes anything. Absolute values only,
  never relative ops (that is what makes reconnect-reconcile sound, §6.8).
  Answered by ECHO or NACK, always. Idempotency ring depth 32 (§9.3).
- EVENT (3): edges not levels; best-effort, conflated, bounded. Safety rule:
  any event a client cannot afford to miss MUST have a latched STATE twin
  (e-stop is the canonical pair). No safety behavior may depend on EVENT
  delivery (§9.4).
- STORE (4): blob-store descriptors (presets, trust ledger); items move over
  BLOB_REQ/BLOB_CHUNK; declared as ordinary catalog entries (§8.7).

User space (§8.10, RFC-076/077): `0x8000`-`0xBFFF` holds accessory channels,
512 slices of `0x20` ids, grouped by `id & 0xFFE0`. It is the only part of a
catalog that changes at runtime (§8.6); a user-space change re-announces the
etag on `catalog` 0x0001 (every client MUST subscribe) and does NOT revoke
readiness. Core and device entries stay byte-identical across it.

## Session lifecycle (§2.2, §6)

Client: CLOSED -> CONNECTING -> HELLO_SENT -> SYNCING -> READY -> LIVE, ESTOP
orthogonal to all states. A client MUST NOT act on user input needing hub
state before LIVE and MUST visually distinguish SYNCING/READY from LIVE.
Readiness is the dual-plane gate (§6.4): not-ready sessions get no
STATE/STREAM and their INTENTs bounce with NACK NOT_READY. Etag match at
HELLO means ready at WELCOME; otherwise catalog rides blob namespace 0,
client verifies SHA-256, sends CATALOG_READY (idempotent).

Liveness: any frame is proof of life (§6.6). Deadman (source-owning sessions,
default 600 ms, clamp 250..5000) vs idle reaping (everyone else). Staleness
(RFC-042) parks a session STALE with slot/grants retained, no GOODBYE; only
slot pressure reclaims it. Teardown is one path with five doors, all
behaviorally identical: ownership released unconditionally, latching nothing
(§6.9, RFC-045). Reconnect: fresh HELLO, snapshot adoption mandatory, intent
ids reset, control ownership never silently reacquired (§6.8).

## Safety (§11, RFC-085)

- Two levels: ESTOP and PAUSE (STOP and HOLD retired pre-tag). Safety word
  bit0 ESTOP, bit3 PAUSE; modes bit0 `override`, bit1 `home_required`
  (§11.1).
- Three op pairs, each ONE control with two states (RENDERING law 14):
  pause/resume, override/return, estop/release. No separate clear button.
- PAUSE suspends every source (bundles dropped and counted, never NACKed);
  only `resume` (control) clears it. `pause` and `estop` are role-exempt.
- ESTOP cuts motor power where the hub declares `estop_cuts_power`
  (WELCOME identity key 6), else a max-decel halt; the label follows the
  declaration, E-Stop vs Halt, absent = Halt (law 15). `release` lands in
  PAUSE; after a power cut `resume` is refused `NOT_HOMED` until a home.
- Override carries PAUSE, hands the rail to the operator, lifts the limits,
  enables jog (`limit.jog.*`); `return` moves back to the paused position.
  A jog never takes the rail from a source: `SOURCE_CONFLICT` unless
  override is latched (§11.4).

## Trust model (§11, §12)

- Tiers (wire 0/1/2): watch / control / configure. `pause` and `estop` are
  role-exempt: safety outranks authorization (§11.1, §11.2). OTA rights never derive
  from any tier. Serial/in-process transports are implicitly configure;
  possession is the credential (§12.3, §12.9).
- Ownership: one owning session per motion source, published via
  `control-owner` STATE; second activator gets NACK SOURCE_CONFLICT; takeover
  transfers if requester tier >= owner tier and is always visible (§11.4).
- Motion plane is identity-blind: a hub MUST NOT branch on client identity
  when planning motion; authorization is the named carve-out (§9.6).
- Pairing: one ceremony, three association modes (knock-and-approve primary,
  PIN proof, push-to-pair); role is an attribute of the grant, never the
  ceremony. Factory-fresh: first knock gets configure (§12.3). Config mode
  (boot with the pairing control held, §13.4.1): BLE and USB serial up, no
  WiFi, no softAP ever; the window's grant is configure whatever tokens
  exist.
- Hub MUST NOT be exposed to the wider internet (§12.1).

## Wire format (§5)

8-byte header (type, flags, channel:u16, seq:u16, len:u16). Control plane is
a deterministic CBOR subset: definite lengths, sorted keys, binary32 floats,
depth cap 4 (§5.3). Data plane is packed little-endian structs whose layout
IS the catalog entry; released layouts grow tail-only (§5.4). ESTOP is a
fixed 12-byte frame recognizable by raw byte scan without deframing, CRC-32
over the first 8 bytes (§5.5); serial binding is COBS with 0x00 delimiter and
the unsynced-receiver raw-scan duty (§13.5). Parser totality binds every
profile: any byte string maps to accept-or-reject, no OOB, no unbounded
allocation, constant-time compares for secrets (§5.8).

## Honesty clauses (H1..H13, indexed at §1.5)

Normative statements of what the protocol does NOT protect; presenting a
protected-sounding UI over one is non-conformant. Highest-traffic ones:
H1 protocol ESTOP is convenience atop hardware e-stop; H4 v1 transports are
cleartext; H10 relay reliability is hop-by-hop; H13 the ESP-NOW accessory
spoke is unencrypted and unauthenticated. Adjacent obligations: ECHO
reports applied post-clamp values and is key-complete over what was applied
(§9.3, §1.2); `cfg_gen` advances iff an applied value actually changed, both
directions (§4.2); advertised ranges are never lied past (§8.8); every
refusal is answered on the wire (§4.5); secret-flagged values never appear in
STATE, and their ECHO carries the key as `true` (§8.8).

## Generated views and registry (§5.7)

Appendices A (frame types), B (CBOR keys), G (limits) are generated from
registry.yaml; regenerate with `python tools/gen_registry_header.py`, never
hand-edit. Registry authority covers values, not prose location; a stale
`ref:` pointer is editorial, never a wire conflict. Allocation by PR; numbers
never reused or renumbered after a tagged release, binding from the v1.0 tag
forward. Reserved ranges exist per table (frames 0x40-0x7F future,
0x80-0xDF experimental). `status:` fields mark registered-but-unimplemented
entries machine-checkably.

## Conformance (§17.1, §13.1)

Profiles: hub, client-watch, client-control, client-configure,
constrained-client, relay, accessory, plus the accessory-host duty set
(§17.1.1); parser totality binds all. Conformance binds duties, never
topology: a hub MAY span several processors (§13.0, RFC-056). Transport
floor (§13.1, RFC-043/056): base profile conforms with any one binding;
hardware hub profile makes BLE GATT SHOULD, and MUST where config mode is
offered, and WebSocket SHOULD. Discovery (§13.7, §13.8): no mDNS service
record (RFC-072 retired it); WS-side clients use the UDP probe, BLE
advertising stays primary, and a hub serving a page SHOULD answer mDNS
hostname queries. The 242 B `min_transport_payload` is the
normative floor derived from ESP-NOW; every mandatory control message and
every STATE payload fits it.

## Traps for spec authors

- Appendix D example channel ids are from the reserved range; never cite
  them as real allocations.
- Do not trust `ref:` pointers over section content; v1.0 shifted several.
- "32D" is not a spec concept (it is the ESP32-WROOM-32D, a parked port idea
  in the machine repo). Do not invent a conformance floor by that name.
