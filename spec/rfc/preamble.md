# Valence RFC Queue — proposals targeting PUBLIC v1.0

> Channel ids herein are historical (pre-C4); current map: Valence Drive's
> CHANNEL-MAP.md (lives in the machine repo, not here — see this repo's
> CHANNEL-GRID.md for the grid convention itself). Each entry keeps the ids
> it had when written — that is the record, not a bug.

*Companion to [SPEC.md](SPEC.md). This file is the accumulation buffer: when
implementation or field use surfaces something the spec got wrong, left
ambiguous, or never said, it gets an RFC entry here instead of an ad-hoc
patch. When enough have piled up, we review the queue in one sitting and
batch the accepted ones into the spec + registry.yaml (codegen + golden
vectors updated in the same commit, per Valence Drive's DOCTRINE.md §9's
registry discipline).*

**RETARGET RULING (operator, 2026-07-25):** the current spec (v1-draft) was
the feasibility test — and it is feasible. The batch release this queue
feeds is therefore **public v1.0**, not v1.1. Entries written earlier that
say "v1.1" mean this same batch release. The base pass is the ENTIRE queue
(written as "001–026"; the queue had grown to **001–029** by the time it
landed): after it lands, RFCs should be few, small, flip-a-flag affairs —
never "rethink the core." **The batch landed 2026-07-26** — see the disposition
table below.

**Standing rulings recorded the same day:**
- **Breaking is allowed.** v1-draft was never public v1; the base pass MAY
  break existing Valence wire/code where a clean design beats a compat
  shim. The "frozen" conformance fixtures (mini-catalog, golden byte
  arrays) are regenerated once at the v1.0 tag and re-frozen THERE; the
  never-renumber rule binds from the v1.0 tag forward, not before it.
- **HTTP has exactly TWO permanent escapees: OTA and `/uitoken`**
  (amended 2026-07-25 after the feasibility pass surfaced the conflict).
  Goal state: "HTTP = static assets + OTA + uitoken, nothing else, ever."
  - **OTA** keeps its own token plane; OTA rights are NEVER derivable
    from Valence roles.
  - **`/uitoken`** ([RFC-029](#rfc-029) §4) escapes because its entire security
    property IS browser same-origin policy, which exists only over HTTP —
    it cannot be moved in-band without ceasing to work. Operator
    rationale: *it is a SIDEBAND, not a secondary cost* — a convenience
    for devices that happen to host a WebUI. A hub with no WebUI never
    implements it and loses nothing; no non-WebUI client ever needs it to
    connect; Valence's own surface is identical with or without it.
  - The distinction that makes these two different from `/api/log` and
    `/api/capabilities` (which are demoted to shims and deleted): those
    were carrying PROTOCOL DUTIES that belong in-band. These two carry
    duties Valence structurally cannot own.
- **Strings are required** (machine name and other info must be visible to
  clients). Identity/product strings ride the CBOR control plane where
  strings are already legal ([RFC-016](#rfc-016)); string VALUES in packed STATE get
  fixed-width `str<N>` field types ([RFC-026](#rfc-026), resolving [RFC-009](#rfc-009)'s sub-
  decision 7 to option (a)). STREAM sample layouts stay string-free.
- The WebUI is the readiness yardstick — see
  [V1-READINESS.md](V1-READINESS.md) for the coverage ledger. Readiness is
  proven by coverage, not by migrating the UI now.

**Rules of the queue**
- Nothing here is normative. SPEC.md + registry.yaml remain the only wire
  truth until an RFC lands.
- Entries are append-only and numbered once — a rejected RFC keeps its
  number with Status: Rejected (so "why didn't we…" has a findable answer).
- Every entry names its origin (fw version / probe run / client) — proposals
  born from measured behavior outrank aesthetic ones.
- Statuses: **Draft** → **Accepted** / **Rejected** → **Landed (v1.0)**.
  Two honest qualifiers were needed at the v1.0 batch and are now part of the
  vocabulary: **Partially landed** (some sub-items shipped, others named and
  deferred) and **Deferred** (accepted in principle, deliberately not built).
  Nothing is marked Landed that is not actually in the tree.

---

## v1.0 BATCH DISPOSITION (2026-07-26)

*The whole queue was reviewed against `registry.yaml` AND against
`lib/valence/` while rewriting SPEC.md into public v1.0. This is the summary;
each entry's own Status line carries the receipts.*

| Disposition | RFCs |
|---|---|
| **Landed (v1.0)** — fully | 001, 002, 004, 005, 008\*, 009, 010, 011, 012, 013, 014, 015, 016\*, 017, 021\*, 022\*, 023\*, 024, 025, 026, 027, 028\*, 029\* |
| **Partially landed** — named halves deferred | **018** (`0x0002` session-roster channel), **019** (reset action intent), **020** (spec + registry only; nothing emits it) |
| **Deferred** — accepted need, deliberately not built | **007** (planner-shape advert) |
| **Rejected** — superseded by [RFC-009](#rfc-009)'s mechanism, numbers retained | **003**, **006** |

\* carries a named deferred sub-item or an honest scope caveat inside its own
Status line — 008 (TCode passthrough mode), 016 (`info` key 4 device-defined
extras sub-map still codec-less), 021 (device preset backends), 022 (item 6
is unrepresentable rather than enforced), 023 (reference hub sheds STATE
only), 028/029 (default crypto stubs sign/verify).

**The deferred ledger, one line each — nothing here is marked landed:**

1. **[RFC-007](#rfc-007)** — no planner-shape/ratio advert exists. [RFC-008](#rfc-008) resolved the
   same problem the other way (work moved to the hub), leaving an advisory
   field with no required consumer.
2. **[RFC-018](#rfc-018) roster** — `0x0002 session-roster` is allocated and specified but
   **no catalog builder declares it**. The registry note claiming
   "IMPLEMENTED at v1.0" is drift.
3. **[RFC-019](#rfc-019) reset verb** — `action.*` and `meta.reset_gen` shipped; no hub
   exposes a reset as an INTENT.
4. **[RFC-020](#rfc-020) procedures** — pattern, `procedure_phases`, `reboot_in_ms` (43)
   and `REBOOTING` all specified; **zero** implementations, and key 43 appears
   nowhere outside registry comments.
5. **[RFC-021](#rfc-021) device stores** — the blob/STORE mechanism ships (the trust ledger
   uses it); no `pattern.*` preset backend exists.
6. **[RFC-008](#rfc-008) TCode passthrough** — one of the three sanctioned motion modes, not
   implemented on the reference firmware.
7. **Real ECDSA** ([RFC-028](#rfc-028)/029) — `ICrypto` is a working seam with a null-object
   default whose `signP256`/`verifyP256` are stubs. Hub authenticity exists only
   where an application injects a real primitive.

All seven are also recorded in SPEC §18 "Known limitations at v1.0", which is
the copy a third-party implementer reads.

## FEASIBILITY PASS (2026-07-25) — amendments bound into the base pass

*Two bounded audits before green light: protocol consistency (38 findings,
10 blockers) and on-target feasibility (S3/32D/toolchain). Every amendment
below is part of its parent RFC as if written there. One item needs an
operator ruling — it is at the bottom, alone.*

### Wire grammar & number space
- **Frame assignments:** PUBLISH=0x18 (013), CATALOG_READY=0x19 (015),
  BLOB_REQ=0x1A / BLOB_CHUNK=0x1B (021, retiring 0x09/0x0A), AUTH=0x1C
  (029, below). 36 core slots remain free.
- **CBOR key conservation:** per-feature keys nest in scoped sub-maps the
  way `limits`(22)/`probe_result`(26) already do — one `identity` key
  (016), one `blob` key (021), one `trust` key (029). Global core demand
  drops from ~18 keys to ~8 of the 27 remaining; the 1–63 space survives
  the protocol's stated lifetime.
- **EVENT bodies get scoped (grammar fix, rides 022):** kind-specific
  fields move into a `body` sub-map whose integer keys come from the
  channel's catalog `schema` — mirroring INTENT's `value`. Without this,
  every device-authored EVENT channel (the anomaly channel!) would need a
  registry PR for its field keys — the exact coupling the catalog exists
  to prevent.
- **GOODBYE codes: single space.** GOODBYE draws from `nack_codes` (one
  normative sentence); `REBOOTING = 0x0109`. A separate space would break
  §4.3's unknown-code range fallback.
- **Preset stores are catalog entries of new `class: STORE(4)`** — keeps
  the catalog root shape, id sort, etag computation, and per-entry-
  document depth rules intact (a parallel top-level array would break all
  four).

### Payload & catalog math
- **018 roster slots gain `name: str16`** → 8 × 22 B + 4 = 180 B ✓ (the
  exact sweet spot at `default_max_clients_ws` 8). Names longer than 16 B
  truncate in the roster; the full name arrives via 0x0007 while the
  session lives. This is also the FIX for the blocker that join-events
  are never replayed (§9.4) — without it a late joiner could never learn
  existing sessions' names.
- **009 capacity restated honestly:** ≈58 f32 or ≈115 u16 settings per
  242 B snapshot, INCLUSIVE of enabled_mask bytes (the old "~60" ignored
  the mask).
- **New registry limit `catalog_max_entry_bytes` (4096):** a 50-field
  fully-annotated entry encodes to ~8–10 KB, which violates 028's
  no-unbounded-allocation rule for per-entry decode buffers. Oversize
  entries are a catalog-authoring error caught by conformance tooling —
  the ap_* channel splits or trims descs to fit.
- **027/029's paired-device / trust ledger is a BLOB store** (021
  machinery: tiny `{generation,count,capacity}` STATE + chunked
  enumeration) — NEVER a packed STATE roster; the math fails at 2–7
  entries per snapshot depending on field set.
- **026 note:** secret string settings SHOULD be `str16` or write-only
  with a presence bit — a `secret str32` burns 13% of a snapshot to say
  one bit.
- **020:** one procedure STATE channel per concurrently-runnable
  procedure (full-snapshot semantics can represent exactly one).

### Cross-RFC reconciliations (the blockers)
- **015 READY gates BOTH planes.** Pre-READY INTENTs are NACK'd —
  otherwise a client could act before adopting the safety latch,
  breaking §11.5(2). §6.3's "immediately push" and §10.1's never-shed
  wording are amended to make READY the precondition of both directions.
  New registry limit `catalog_ready_timeout_ms` (15000): a session that
  PINGs but never READYs is GOODBYE'd (liveness reaping alone never
  fires on a pinging client). 015 and 021 land TOGETHER: transfer verbs
  become BLOB_*, only the catalog namespace has a READY concept.
- **029 signature replay fix:** HELLO gains `client_nonce` (inside the
  `trust` sub-map); the hub signs `client_nonce ‖ session_id ‖ boot_id`.
  Without client entropy the signature was replayable from one captured
  WELCOME — evil twin passes verification. BLOCKER, now dead.
- **029 proof mode gets a home:** new AUTH frame (c2h, 0x1C) carries the
  token proof after WELCOME and re-issues `roles` — the session grammar
  had no "upgrade role mid-session" path (a second HELLO would
  self-evict via §6.3's duplicate rule). **The "previous-session nonce"
  reconnect shortcut is DROPPED** — it was replay-unsafe (undefined
  rotation point; §6.3 makes a successful replay EVICT the real client;
  honest retransmits vs single-use nonces are irreconcilable on lossy
  bindings). Proof mode costs one extra round trip per connect. That is
  the honest price; bearer mode remains the potato path.
- **025/010 per-op access is now expressible:** catalog `schema-field`
  gains optional `access` (per-op minimum role); channel `access` is the
  floor, per-op overrides. Without it, role-exempt estop/stop forced
  0x0005 to viewer-access and a generic 009 renderer would show
  hold/pause/takeover to every viewer — discovering otherwise only by
  NACK, violating gray-never-hide. Exempt ops ARE §9.3-rate-limited
  (viewer loop-stop spam is a named, limited, accepted risk in §12.1 —
  the person in the room stopping the machine outranks it).
- **014/023 segments are NON-DECIMABLE.** §9.2's shedding rationale
  ("dropped samples recoverable by interpolation") is TRUE for dense
  position samples and FALSE for timed segments — a shed segment is a
  permanently lost command. Segment-class STREAM channels shed
  whole-source or not at all; 023's normative table carries the
  exception.
- **008.3 scoped, not violated:** "no per-client case logic" now reads
  "the hub MUST NOT branch on client identity when planning or executing
  MOTION"; authorization is identity-branching by definition and is the
  named carve-out. (027/029's ledger, tiers, and own-UI trust are
  authorization; the motion plane stays identity-blind.)
- **016/027 capability split:** session-layer capabilities (pairing
  modes) live in WELCOME; CHANNEL capabilities are catalog
  introspection. `fw version` is struck from 0x0006's registry note —
  identity lives in WELCOME, one home, no drift.
- **012:** §9.2's "never NACKed" gains the explicit SOURCE_CONFLICT
  carve-out (same precedent as §10.5's RATE_LIMITED NACK).
- **013:** new registry `max_burst_multiple` (4); `burst` is clamped and
  echoed like every wish — an unbounded client-declared burst would
  reintroduce the flood the limiter exists to stop.
- **021:** preset payloads are `bstr` the protocol layer NEVER decodes —
  028's depth/allocation budget explicitly does not extend inside them;
  a client that decodes one does so above the protocol boundary. Imports
  larger than `max_frame` ride BLOB chunks, never fragmented INTENTs.
  Registry gains per-binding `max_frame` defaults (it never had any).
- **019/011 reset classification:** an action that restores
  configuration values bumps `cfg_gen` AND `reset_gen` (`ap_reset` is
  this); an action that clears counters bumps `reset_gen` only
  (`reset_stats`/`reset_peaks`/kinetic).
- **022.10 scoped:** applied-within-advertised-range applies to ECHO
  `applied` maps and `setting_key`-bearing fields; effective/read-only
  fields lawfully exceed a paired setting's range and declare their own
  display bounds (this was colliding head-on with [RFC-003](#rfc-003)'s origin
  case).
- **022.5 vs 028.2 reconciled:** SENDERS truncate diagnostic strings to
  the registered cap; RECEIVERS reject over-cap strings in structural
  payloads. NACK `detail` is diagnostic.
- **017 vs §9.4:** the no-replay rule gains "except where a channel's
  catalog entry declares a replay depth"; the log channel declares one.
- **027 vs §12.2 (was a blocker nobody wrote down):** §12.2's "admin
  granted only via the hub's own UI" sentence is STRUCK in the 027
  landing commit — configure is obtainable by ceremony now, which means
  **018's evict power is reachable through pairing**; 018's gate is
  restated against the new configure definition, deliberately.
- **At batch time:** 003 and 006(b) are marked *Rejected — superseded by
  009* (numbers kept, per queue rules) so the registry never grows two
  ways to express one thing.

### On-target reality (measured, not assumed)
- **ECDSA P-256: feasible, with placement rules.** mbedtls is compiled
  into the pinned framework with ECDSA enabled — and it is DETERMINISTIC
  ECDSA (RFC 6979), removing RNG quality from signing. The S3 has NO ECC
  accelerator (that peripheral is C3/C6/H2): sign ≈30–80 ms, keygen
  ≈40–100 ms, software with hardware-bignum assist, one uninterruptible
  call. Rules: keygen at first boot only; sign on a low-priority task;
  NEVER inline in an HTTP/WS handler; signature is ON-REQUEST (a HELLO
  `trust` flag) so potato handshakes stay instant.
- **HMAC costs nothing:** the library already ships self-contained,
  test-vectored `hmacSha256` (the PIN proof path). Token proofs reuse
  it; `ICrypto` shrinks to sign/verify only, added as a 5th Hub ctor
  param with a null-object default, mirroring IClock/IRandom exactly
  (pattern confirmed present, lib confirmed crypto-include-free).
- **THE CATALOG RAM CATCH (the pass's biggest find):** uniform
  `Catalog<48,50>` = **320 KiB** (entry = 24 + 136·F bytes; every entry
  carries BOTH layout and schema arrays though only one is ever
  populated; the bitfield-names array is 64 of LayoutField's 100 bytes).
  Mandated fixes: (1) `buildValenceDriveCatalog()` becomes an OUT-PARAM —
  the current by-value return at F=50 is a 320 KiB stack temporary, the
  HubSession stack bomb, act two; (2) layout/schema become a
  union/variant; (3) field capacity is PER-ENTRY (exactly one entry —
  the flattened ap_* — needs ~50 fields) → whole catalog ≈59 KiB; (4)
  `static_assert` on total catalog size + documented PSRAM residency
  (the service is already placement-new'd into the 8 MB PSRAM; the
  catalog must stay a by-value member of it).
- **Fuzz gate:** no clang on this host, no CI exists at all. The honest
  setup: one GitHub Actions workflow (ubuntu, system clang,
  `-fsanitize=fuzzer,address,undefined`) compiling the header-only
  decode surfaces DIRECTLY — no PlatformIO — targeting the catalog
  codec, the CBOR reader, and fragmentation/frame-header parsing; 60 s
  per target on PR + nightly with a checked-in corpus. Local substitute:
  deterministic random-input doctest loop over the same surfaces
  (coverage-blind, zero new toolchain).
- **NVS:** 20 KiB partition, ~16 KiB usable; ledger + keypair ≈1.1 KiB
  fits. Rules: the trust ledger is ONE blob in the existing `valence`
  namespace, kept under ~1900 B (single-page), written only on change,
  and gated on `ota_active` exactly like `savePairing()` (flash-cache
  writes during OTA reset the chip). Correction: `kMaxPaired` is 8
  today, not 16.

### IMPLEMENTATION DECISIONS (recorded during the base-pass build)
- **CONFIRMED (orchestrator ruling, asked for by the M6 spec rewrite): the
  hub's hardcoded floor on `estop_clear` is CORRECT and stays.** The hub
  resolves per-op access generically from `option_access`, and then ALSO
  applies a hardcoded minimum role to `estop_clear` specifically. That looks
  like the channel-id special-casing [RFC-025](#rfc-025) forbids. It is not, and the
  distinction matters:
  * `option_access` is CATALOG DATA, authored by a human. If someone
    mis-authors channel 0x0005 — omits the vector, or marks `estop_clear`
    as `watch` — then clearing an e-stop latch becomes reachable by any
    anonymous LAN client. A safety-critical authorization would be derived
    from a data file with no floor under it.
  * The prohibitions this appears to violate are both about something else:
    [RFC-008](#rfc-008).3 forbids branching on WHO is talking when PLANNING MOTION;
    [RFC-025](#rfc-025) forbids per-channel logic that duplicates what the catalog
    already expresses. A hardcoded FLOOR under a safety op branches on
    neither identity nor client behavior — it bounds the damage a bad
    catalog can do.
  Promoted to normative text by M6 as: *a hub MUST NOT let a catalog
  authoring error widen safety authorization* (SPEC §11.2). The general
  principle for future review: generic resolution handles the general case;
  safety operations additionally get a floor that data cannot lower.
- **`option_access` is SCHEMA-FIELD ONLY; layout fields do not get it.**
  Raised during M2b: a layout select (e.g. a motion-backend dropdown) might
  seem to want per-option gating. Ruling: no. A layout field is the READ
  side — a STATE snapshot value — and ALL write authorization flows through
  the paired INTENT channel named by `settingChannel` + `setting_key`. A
  client needing per-option access resolves that join (which it must do
  anyway to encode a write) and reads `option_access` on the schema field
  there. This also keeps the field map inside the §5.3 depth-4 cap, which
  is already at its limit. If a genuine layout-side case appears
  post-v1.0, it is an additive catalog key at the ENTRY level (not the
  field level, which has no depth budget left) — normal additive
  evolution, not a break.
- **`replay_depth` (catalog entry key 13, [RFC-017](#rfc-017))** exists in
  `catalog.cddl` but is NOT yet in the data model — the one remaining
  CDDL↔struct gap after M2b. It lands with the log channel work, since
  that is its only consumer.
- **Deferred cleanups, recorded so they are not lost:** (a) `CborWriter`
  wants a MEASURING mode (count bytes, no buffer) — it would remove
  `checkCatalog`'s scratch-overload wart and serve [RFC-028](#rfc-028)'s
  know-the-size-before-you-allocate rule generally; (b) `BasicCatalog`'s
  five positional capacity parameters should become a single
  `CatalogCaps` class-type NTTP if a sixth pool ever appears; (c)
  `estop_frame.hpp` hand-rolls an `EstopCause` enum that the registry now
  owns as `safety_causes` — **DONE (M4a): the enum is deleted; callers use
  `valence::safety_causes::`.**

### OPERATOR DECISION — RESOLVED 2026-07-25
- **`/uitoken` is the SECOND sanctioned HTTP escapee.** Ruling: it is a
  sideband, not a secondary cost — a convenience for devices that host a
  WebUI, never a requirement, never a connection prerequisite for any
  other client, and it does not break Valence for a hub with no WebUI.
  The standing ruling at the head of this file is amended accordingly
  (static assets + OTA + uitoken, nothing else, ever). No RFC text
  changes: 029 §4 stands as written.
- **This pass has no remaining open questions.**

## RFC-030–050 index (post-v1.0, landed piecemeal)

*The base pass ends at [RFC-029](#rfc-029). Everything below is a later, smaller RFC —
mostly single operator rulings from 2026-07-27/28, batched through Phase
B/C/D. Status column matches each entry's own line; cross-check against
`docs/canon/LEDGER.md` before citing a status from here.*

| RFC | Scope | Status |
|---|---|---|
| [030](#rfc-030) | Curve family on the stream | Landed |
| [031](#rfc-031) | Servo register configuration | Draft — parked, mechanism required |
| [032](#rfc-032) | `command.*` / `telemetry.target` roles | Landed |
| [033](#rfc-033) | SUBSCRIBE refusals must be answered | Landed |
| [034](#rfc-034) | Placeholder `options` entries | Landed |
| [035](#rfc-035) | Motion-plan telemetry roles | Landed |
| [036](#rfc-036) | Renderability of string settings | Landed items 1+3; item 2 (`max_len`) deferred |
| [037](#rfc-037) | Forward-decodable packed layouts | Landed: vocabulary 2026-07-27; encoder half (key 18 emission, K-01/K-02 re-pin to 805 B) 968d0ae, option (a) |
| [038](#rfc-038) | Client-negotiated deadman window | Landed |
| [039](#rfc-039) | Every refusal is answered | Landed |
| [040](#rfc-040) | Spec-says-what-the-reference-knows (editorial) | Landed |
| [041](#rfc-041) | Physical travel extent roles | Draft — mechanism shipped, RFC not yet batch-reviewed |
| [042](#rfc-042) | Session staleness / reattach | Landed |
| [043](#rfc-043) | Transport conformance profiles | Landed |
| [044](#rfc-044) | Client onramp doctrine (TCode passthrough) | Draft — deprioritized, not near-term |
| [045](#rfc-045) | Retire deadman-as-safety | Landed |
| [046](#rfc-046) | BLE-primary discovery + UDP probe | Landed |
| [047](#rfc-047) | The 0xCDSS channel allocation grid | Landed |
| [048](#rfc-048) | The rendering constitution | Landed |
| [049](#rfc-049) | Fresh-eyes panel omnibus (7 fixes) | Landed spec/registry; hub behavior Phase D; (c)'s scheduling backstop evaluated and NOT landed |
| [050](#rfc-050) | Blob transfer backpressure + BLOB_DONE | Landed spec/registry; implementation deferred |

> DEMO-CANDIDATE: a live status board cross-checking every RFC's stated
> disposition above against registry.yaml/SPEC.md's actual current state,
> flagging drift the moment an entry goes stale.

## Index: RFC-051 onward

*Added 2026-10-01 after the queue run. Status column matches each entry's
own Status line as of that date; the entry wins on any disagreement.*

| RFC | Scope | Status |
|---|---|---|
| [051](#rfc-051) | Critical stall parks the session | Landed (v1.0), 2026-07-28 |
| [052](#rfc-052) | Authoring layer (tables, released markers, generated vocabularies) | Accepted 2026-07-29, phased |
| [053](#rfc-053) | ESTOP over UDP broadcast + ESP-NOW | Accepted 2026-07-29 (opt-out, default on) |
| [054](#rfc-054) | Hub discloses WiFi credentials over BLE | Withdrawn 2026-10-01 (RFC-069 covers provisioning) |
| [055](#rfc-055) | Admission control: a hub that cannot serve you says so | Landed 16266af |
| [056](#rfc-056) | Modular conformance: duties, not a chip | Landed 99584a6 (BLE: SHOULD, MUST where config mode is offered) |
| [057](#rfc-057) | The two HTTP escapees are hub duties | Landed 99584a6 (with 056) |
| [058](#rfc-058) | End-velocity `unspecified`, rest-before-hold, dwell rule | Landed a48c03a |
| [059](#rfc-059) | Hub-advertised scheduling latency | Landed 876ca7c (with 084) |
| [060](#rfc-060) | Rename: SlopSync becomes Valence | Landed 2026-09-21 |
| [061](#rfc-061) | TCode adapter conventions | Accepted 2026-10-01; lands with RFC-044 |
| [062](#rfc-062) | Live renderer-class selection | Landed 0342526 |
| [063](#rfc-063) | Wire carrier for `destructive` | Landed 778d534 |
| [064](#rfc-064) | Index-0 filler on op selects only | Landed fe50cc4 |
| [065](#rfc-065) | Event-channel purpose roles, event-kind labels | Landed b46c2d9 |
| [066](#rfc-066) | Modulators (`mod.*`, `mod_target`) | Landed b75e482 + affa61a (accepted as amended) |
| [067](#rfc-067) | Store verbs: one op select | Landed 1a50ff8 |
| [068](#rfc-068) | Substituted-widget conformance | Landed 23a8b9d |
| [069](#rfc-069) | Client-pushed WiFi provisioning (BLE + serial) | Landed 4f98e6b |
| [070](#rfc-070) | Store-to-roster-to-writer linkage | Landed a7c9295 |
| [071](#rfc-071) | Motion-input field roles | Landed 4ea91d8 |
| [072](#rfc-072) | Discovery identity: mDNS record retired, MSD id pinned | Landed d2348d9 (accepted as rescoped); client moves owed |
| [073](#rfc-073) | Store item encoding + digest | Landed 1b4a1af |
| [074](#rfc-074) | Streams under a latched stop | Landed: clauses 1, 2, 4 ef003e3; clause 3 1ddf8af (with RFC-085) |
| [075](#rfc-075) | ESP-NOW spoke binding | Landed 8484552 |
| [076](#rfc-076) | Accessory join and declaration | Landed b18fac1 |
| [077](#rfc-077) | Live catalog growth; capacity | Landed 4c0ede7 |
| [078](#rfc-078) | Accessory profile + relationship engine | Landed ede1f46 |
| [079](#rfc-079) | Config mode and the setup category | Landed 4d267b0 (BLE sentence awaits RFC-056) |
| [080](#rfc-080) | User-authored surfaces | Landed efb23fc |
| [081](#rfc-081) | Advanced-generator master roles | Landed 3725a6b |
| [082](#rfc-082) | One home for the rendering wiring state | Landed d12403e |
| [083](#rfc-083) | Archetype hint struck; color/datetime by role | Landed e22bd8e (option B) |
| [084](#rfc-084) | Future-anchored samples are arrival times | Landed 876ca7c (with 059) |
| [085](#rfc-085) | Three safety pairs (pause, override, estop) | Landed 1ddf8af + test f144928 |
| [086](#rfc-086) | Units `deg`, `us`, `hub_s` | Landed 20b2da5 |
| [087](#rfc-087) | Segments bundles span the schedule horizon | Landed 1dbdc3e |
| [088](#rfc-088) | Flip: rail-bound direction flip | Landed a7415b0 |
| [089](#rfc-089) | Store writer field roles (`store.slot`, `store.name`, `store.item`) | Draft, ruling pending (rfc-hen) |
| [090](#rfc-090) | SPEC 5.4 rule 3 repair: segments span relative to `t_base` (editorial) | Draft, ruling pending (rfc-0wp) |
| [093](#rfc-093) | Classic and Advanced generators are two rail sources (`advgen.running`; `advgen.mode` retired) | Landed 4ca8592 |
| [094](#rfc-094) | Navigation tiers; `control` -> `generator`; `tuning`/`library` fold | Landed 0c33da4 |
| [095](#rfc-095) | Advanced generator dwell roles (crest, trough) | Landed 20f968e |
| [096](#rfc-096) | ` / ` in a `group` string names a section (presentation convention) | Draft, ruling pending (rfc-4ed) |
| [097](#rfc-097) | Pin the 0x0001 catalog STATE layout (12 B) | Draft 2026-10-02 |
| [098](#rfc-098) | Quiet release of rail ownership; source kind on control-owner | Accepted 2026-10-03 |
| [099](#rfc-099) | Trial writes: apply live without persisting, commit or revert | Landed a0f3fcb + 28ba317 (accepted 2026-10-03, rfc-2s0) |
| [100](#rfc-100) | Plan feasibility flags (`plan.flags`, `plan_flags`) | Landed abe752e + 8d67b4b (accepted 2026-10-03, rfc-6qf) |
