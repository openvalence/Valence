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
  - **`/uitoken`** ([RFC-029](#rfc-029--trust-lifecycle-hub-authenticity-change-tripwires-own-ui-trust) §4) escapes because its entire security
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
  strings are already legal ([RFC-016](#rfc-016--in-band-hub-identity-capabilities--catalog-introspection)); string VALUES in packed STATE get
  fixed-width `str<N>` field types ([RFC-026](#rfc-026--strings-on-the-wire-operator-ordered), resolving [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis)'s sub-
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
| **Rejected** — superseded by [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis)'s mechanism, numbers retained | **003**, **006** |

\* carries a named deferred sub-item or an honest scope caveat inside its own
Status line — 008 (TCode passthrough mode), 016 (`info` key 4 device-defined
extras sub-map still codec-less), 021 (device preset backends), 022 (item 6
is unrepresentable rather than enforced), 023 (reference hub sheds STATE
only), 028/029 (default crypto stubs sign/verify).

**The deferred ledger, one line each — nothing here is marked landed:**

1. **[RFC-007](#rfc-007--feasibility-cannot-be-predicted-without-the-hubs-planner-shape)** — no planner-shape/ratio advert exists. [RFC-008](#rfc-008--doctrine-the-machine-owns-motion-processing-not-the-client) resolved the
   same problem the other way (work moved to the hub), leaving an advisory
   field with no required consumer.
2. **[RFC-018](#rfc-018--session-roster--admin-eviction) roster** — `0x0002 session-roster` is allocated and specified but
   **no catalog builder declares it**. The registry note claiming
   "IMPLEMENTED at v1.0" is drift.
3. **[RFC-019](#rfc-019--action-intents--observable-resets) reset verb** — `action.*` and `meta.reset_gen` shipped; no hub
   exposes a reset as an INTENT.
4. **[RFC-020](#rfc-020--procedures-long-running-guarded-operations--reboot-commit) procedures** — pattern, `procedure_phases`, `reboot_in_ms` (43)
   and `REBOOTING` all specified; **zero** implementations, and key 43 appears
   nowhere outside registry comments.
5. **[RFC-021](#rfc-021--valence-presets-operator-ordered) device stores** — the blob/STORE mechanism ships (the trust ledger
   uses it); no `pattern.*` preset backend exists.
6. **[RFC-008](#rfc-008--doctrine-the-machine-owns-motion-processing-not-the-client) TCode passthrough** — one of the three sanctioned motion modes, not
   implemented on the reference firmware.
7. **Real ECDSA** ([RFC-028](#rfc-028--parser-robustness--fuzz-conformance-gate-anti-cve)/029) — `ICrypto` is a working seam with a null-object
   default whose `signP256`/`verifyP256` are stubs. Hub authenticity exists only
   where an application injects a real primitive.

All seven are also recorded in SPEC §18 "Known limitations at v1.0", which is
the copy a third-party implementer reads.

---

## RFC-001 — NACK cannot be correlated to a specific in-flight intent

- **Status:** **Landed (v1.0).** `intent_seq` is CBOR key 41 (SPEC §16.1).
  Implemented MORE broadly than proposed: the reference hub stamps it centrally
  in `sendNack`/`sendNackTracked` from the seq of whatever frame is being
  dispatched, so essentially every NACK it emits carries one — not only
  intent-provoked NACKs. The "clients MUST tolerate its absence" half stands and
  is now covered by §4.3 tolerance.
- **Origin:** valence-js core build (fw 2.1.45, 2026-07-24). Found while
  implementing browser-side intent promises.
- **Problem:** The NACK payload carries `code`, `channel_id`, `detail`,
  `retry_after_ms`, `precondition` — but no intent id. A client with more
  than one intent in flight on the SAME channel cannot know which one was
  rejected. valence-js works around it by rejecting the oldest pending
  intent on the NACK's channel; correct for one-at-a-time UIs, wrong the
  moment anyone pipelines.
- **Proposed change:** Add an optional CBOR key `intent_seq` (the seq of the
  frame being NACK'd) to the NACK payload. Hubs SHOULD populate it whenever
  the NACK was provoked by a specific inbound frame. Clients MUST tolerate
  its absence (v1.0 hubs).
- **Compatibility:** Additive (new optional key from the registry's NACK key
  space). No renumbering. Golden vectors gain one NACK-with-seq fixture.

## RFC-002 — `cfg_gen` bumps on value-identical config-sets

- **Status:** **Landed (v1.0).** SPEC §4.2-2. Reference hub bumps only when an
  applied value actually changed; an accepted but value-identical write still
  gets its post-clamp ECHO and does not bump, and does not re-arm on-change
  republish. Landed jointly with [RFC-011](#rfc-011--hub-side-cfg_gen-advancement-rfc-002s-mirror-twin) as ONE two-directional rule, because
  either half alone leaves `precondition` CAS lying.
- **Origin:** The 2026-07-24 dual-plane config storm (fw 2.1.45,
  docs/webui-legacy-diagnosis.md layers 1–3). The wire-side accomplice: an
  accepted config-set bumps `cfg_gen` even when every applied value is
  unchanged, which re-arms on-change publications and legacy resync cycles.
  The browser-side loop is fixed, but the spec let the wire amplify it.
- **Problem:** SPEC does not say whether `cfg_gen` advances on *accepted
  writes* or on *effective state changes*. The reference hub does the
  former; every observer treating `cfg_gen` as "config changed, go resync"
  does redundant work for no-op writes.
- **Proposed change:** Specify: `cfg_gen` MUST advance only when at least
  one applied configuration value actually changed. A value-identical
  accepted intent still gets its post-clamp ECHO (ground truth is
  unaffected) but MUST NOT bump `cfg_gen` nor trigger on-change STATE
  republish.
- **Compatibility:** Behavioral tightening, no wire-format change. Client
  code that tolerates spurious bumps keeps working. Hub change + new SI test
  (set same value twice → one bump).

## RFC-003 — STATE channels must declare stored-config vs effective-state semantics

- **Status:** **REJECTED — superseded by [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis)** (number retained per the
  queue's own rule, so "why didn't we add a stored/effective flag?" has a
  findable answer). The DISTINCTION is real and is now normative (SPEC §8.8);
  the MECHANISM is `setting_key` PRESENCE, not a separate flag. A layout field
  carrying `setting_key` is stored config; a field without one is
  effective/telemetry and MUST NOT be adopted into a setting's shadow. What was
  worth rejecting is the registry growing two ways to express one thing.
- **Origin:** Live write-plane verification (fw 2.1.45): on an unhomed
  machine, config-set window ECHO returns the STORED config (e.g. [5,495])
  while machine-config 0x0081 STATE publishes the EFFECTIVE window
  ([0,max_rail]) — legitimately different values, both true. valence-js
  initially misadopted effective as stored and stomped fresh operator input
  (diagnosis doc, layer "window doesn't stick").
- **Problem:** The spec has no vocabulary for this distinction. A client
  reading a STATE channel cannot know whether a field is a setting (adopt
  into controls) or a derived effective value (display as machine truth,
  never write back into the setting's shadow).
- **Proposed change:** Add a per-field (or per-channel) semantic flag to the
  catalog layout entry — `stored` vs `effective` — and one normative
  paragraph: ECHO always confirms stored config; STATE fields marked
  effective may lawfully differ; clients MUST NOT adopt effective fields as
  setting values.
- **Compatibility:** Catalog schema addition (catalog.cddl + etag bump on
  devices that adopt it — fine; the FROZEN conformance mini-catalog is
  untouched until the flag is versioned in properly at 1.1).

## RFC-004 — Appendix D sketch collides with real device allocations

- **Status:** **Landed (v1.0)** — editorial, done in the v1.0 rewrite. SPEC
  Appendix D is rebuilt on ids from the RESERVED range `0x8000-0xFFFF`
  (`0xEE00+`), which no conforming hub may ever allocate, under an explicit
  "EXAMPLE ONLY — NEVER ALLOCATE THESE IDS" banner that records this RFC's own
  origin as the reason. `examples/session-traces.md` E1-E5 moved to the same
  ids. Spec-core ids in the traces are deliberately unchanged: those ARE real
  allocations and using them is correct.
- **Origin:** fw 2.1.42 authoring of motion-input: Appendix D sketches
  0x0081 as "motion-input", but this device had already spent 0x0081 on
  machine-config; the real allocation is 0x0084. The catalog is
  self-describing and authoritative (Appendix D's own disclaimer), but the
  sketch reads like an assignment and has now misled once.
- **Proposed change:** Rework Appendix D examples to use ids from a clearly
  fictitious range (or an explicit "EXAMPLE ONLY, never allocate these"
  banner), so no sketch id can be mistaken for a registry assignment.
- **Compatibility:** Editorial only. No wire impact.

## RFC-005 — Specify hub teardown equivalence for all session-end paths

- **Status:** **Landed (v1.0).** Promoted to a numbered normative rule: SPEC
  §6.9 "Teardown: one path, six doors" — every session-end path (GOODBYE,
  transport loss, slow-consumer eviction, admin eviction, slot reuse, idle
  reaping, READY timeout, deadman) runs the same §11.3 loss policy,
  unconditionally and independently of HOW the end was detected.
  `safety_causes::session_loss` (4) now distinguishes a closed browser tab from
  a deadman TIMEOUT, which was previously misreported to every subscriber.
  SI-11/12/13 are the behavioral vectors, and SPEC §17.3 makes back-to-back
  sessions with no restart between them a REQUIRED test pattern.
- **Origin:** Field bug #3 (source-ownership teardown leak): ownership was
  released only by the deadman pump; GOODBYE, rude detach, evictions and
  same-slot re-HELLO leaked a dead session's ownership until reboot.
- **Problem:** v1.0 describes the deadman's loss policy but only §6.8 now
  gestures at the other five teardown paths. The invariant deserves
  normative statement: *every* way a session can end runs the same §11.3
  loss policy ("no unmonitored path to motion").
- **Proposed change:** Promote to a numbered normative rule: session
  teardown (GOODBYE, transport loss, either eviction, slot reuse, deadman)
  MUST be behaviorally identical w.r.t. source ownership and safety
  latching. Reference implementation: `teardownSession()`; conformance:
  SI-11/12/13 become spec-cited test vectors.
- **Compatibility:** Normative clarification of already-shipped behavior.

## RFC-006 — Motion-producing clients have no portable way to learn the machine's kinematic limits

- **Status:** **REJECTED — superseded by [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis)** (number retained per the
  queue's own rule). The NEED is met; this entry as a separate change is not
  taken. Option (a) — a reserved `machine-limits` channel id — was never
  adopted, because a fixed channel number is exactly the coupling the
  self-describing catalog exists to prevent. Option (b)'s MECHANISM landed
  INSIDE [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis) as the registry's `field_roles` vocabulary (`limit.user.*`,
  `limit.input.*`, `window.min|max`, `telemetry.*`), so a client locates limits
  on ANY hub by role rather than by id. The framing correction from [RFC-008](#rfc-008--doctrine-the-machine-owns-motion-processing-not-the-client) is
  normative in SPEC §9.6: limits discovery exists for DISPLAY and OPTIONAL
  pre-adaptation, and the word is MAY, never SHOULD.
- **Origin:** MFP plugin v0.2.1–v0.2.3 (2026-07-25), measured against valencesim
  with the real engine. A funscript axis using MFP's default **Makima**
  interpolation produced a handoff velocity of **1.816 norm/s into a span
  whose own mean velocity is 0.050 norm/s — 36×**. VMotion's legality scan
  rejected the quintic, the Ruckig guard took it, and a "slow, simple" script
  rendered as straight-line strokes with flat-topped velocity. The plugin was
  computing a *mathematically correct* spline tangent and shipping it to a
  machine that could not possibly honor it.
- **Problem:** A client that PUBLISHES motion (0x0084 motion-input, 0x0085
  motion-segment) is flying blind. Three distinct gaps:
  1. **No normative obligation.** SPEC tells a client how to send samples and
     segments but never says a motion producer SHOULD learn what the machine
     can do, so the reference client (this plugin) shipped publish-only wishes
     in HELLO and never subscribed to anything.
  2. **No portable discovery.** This device advertises geometry and ceilings
     on `0x0081 machine-config` (window min/max, user + input speed/accel,
     max_rail, and input_jerk since fw 2.1.47) — but 0x0081 is in the
     **device's own ≥0x0080 allocation**, not the registry's reserved range.
     A generic client cannot find "the kinematic limits" on an arbitrary hub;
     it would have to hardcode this device's catalog, which is exactly the
     coupling the self-describing catalog exists to prevent.
  3. **Limits are window-relative.** The ceilings that matter to a stream are
     normalized by the stroke window (`vmax_norm = input_speed / span`), so
     they change whenever the window changes. A one-shot value in WELCOME
     would go stale; this genuinely wants a STATE channel.
- **Proposed change:** Make kinematic limits portably discoverable, either by
  (a) a reserved registry channel id for `machine-limits` that any hub driving
  a physical actuator SHOULD publish, or preferably (b) **catalog field
  roles** — an optional per-field semantic tag in the layout entry (e.g.
  `role: limit.speed | limit.accel | limit.jerk | window.min | window.max`)
  so a client can locate the limits on *any* device's catalog without knowing
  its channel numbering. (b) composes with [RFC-003](#rfc-003--state-channels-must-declare-stored-config-vs-effective-state-semantics)'s stored/effective flag —
  both are per-field semantics the catalog currently cannot express.
  **Framing corrected by [RFC-008](#rfc-008--doctrine-the-machine-owns-motion-processing-not-the-client):** limits discovery exists for DISPLAY and
  OPTIONAL pre-adaptation. A client MUST NOT be required to reason about
  feasibility in order to produce good motion — the hub owns that. Normative
  language here is MAY, never SHOULD.
- **Compatibility:** Additive. Option (b) is a catalog schema addition
  (catalog.cddl + etag bump on adopting devices; the FROZEN conformance
  mini-catalog stays untouched until 1.1 versions it in). Clients that ignore
  the tags behave exactly as today. Note for implementers: adding a
  `subscribes` wish to a client's HELLO changes its HELLO bytes, so
  `tools/valence_probe.py` and any golden-byte mirror (the MFP plugin's
  `WireSelfTest.cs`) must move in lockstep — that coupling is why the plugin
  fixed its own tangent geometrically (Fritsch–Carlson bound, k = 1.5) rather
  than reaching for limits it could not portably obtain.

## RFC-007 — Feasibility cannot be predicted without the hub's planner shape

- **Status:** **DEFERRED — not implemented, not registered.** No planner-shape
  advert (a `min_jerk_quintic` enum, or the `(kv, ka, kj)` peak/mean ratios)
  exists in registry.yaml or in any implementation. Reason, recorded honestly:
  [RFC-008](#rfc-008--doctrine-the-machine-owns-motion-processing-not-the-client) landed the opposite resolution of the same problem. Once feasibility
  reasoning is explicitly OPTIONAL for clients (SPEC §9.6-4) and the concrete
  pathology is bounded machine-side by the handoff guard, an advisory advert has
  no required consumer — and a wire field nobody must read is how a registry
  accumulates dead weight. The MATH is preserved as prose in SPEC §9.6 (a
  min-jerk quintic peaks at 1.875·d/T) precisely so an implementer understands
  why the naive `d/T <= vmax` test is wrong, without the protocol growing a
  field for it. Revisit if a real client wants to pre-adapt and demonstrably
  cannot.
- **Origin:** Same investigation. Even a fully limits-aware client could not
  have predicted the failure in [RFC-006](#rfc-006--motion-producing-clients-have-no-portable-way-to-learn-the-machines-kinematic-limits).
- **Problem:** Knowing `vmax/amax/jmax` is not sufficient to decide whether a
  `{target, duration}` segment is executable, because that depends on the
  *shape* the hub plans. VMotion renders timed segments as a C2 min-jerk
  quintic, whose peak velocity is `1.875·d/T`, peak accel `5.7735·d/T²` and
  peak jerk `60·d/T³`. A client applying the naive `d/T ≤ vmax` test concludes
  a stroke is fine when the actual profile needs **1.875×** that — measured
  live: a 140 mm stroke in 167 ms needs a mean of 838 mm/s (comfortably under
  a 1000 mm/s machine) but a quintic peak of 1572 mm/s (57 % over). The hub
  handles it correctly, but the client cannot warn, adapt, or choose a
  friendlier duration, and the operator sees unexplained shape changes.
- **Proposed change:** Let a hub advertise its waveform profile cost — either
  a named profile enum (`min_jerk_quintic`, `double_s`, `trapezoid`, `linear`)
  or, more robustly, the three dimensionless peak/mean ratios `(kv, ka, kj)`
  so a client can evaluate `d ≤ min(vmax·T/kv, amax·T²/ka, jmax·T³/kj)`
  without hardcoding any planner's internals. Ratios are preferable: they stay
  meaningful if a hub changes planners, and they are what a client actually
  needs to compute. Place alongside the [RFC-006](#rfc-006--motion-producing-clients-have-no-portable-way-to-learn-the-machines-kinematic-limits) limits.
- **Compatibility:** Additive and purely advisory — the hub remains the sole
  authority on what it will execute, and a client that ignores the hint gets
  today's behavior (hub clamps/reshapes and reports the anomaly). Encourages
  senders to pre-adapt rather than relying on machine-side rescue, which is
  strictly better for feel: a client that shortens its own stroke keeps its
  authored timing, whereas machine-side rescue has to guess.

## RFC-008 — DOCTRINE: the machine owns motion processing, not the client

- **Status:** **Landed (v1.0)** as normative doctrine — SPEC §9.6 "The motion
  input surface": the CLOSED three-mode list, the write-once rule, the
  identity-blind motion plane (scoped by the feasibility pass so authorization
  remains the named carve-out), the MAY-never-SHOULD framing of limits
  discovery, and the machine-side handoff sanity guard with honesty clause H11.
  **One named sub-item stays DEFERRED:** TCode passthrough is one of the three
  sanctioned modes but is NOT implemented on the reference firmware (TCodeParser
  cross-task race, no consumer value at the time). It is specified as a mode,
  not shipped as one.
- **Origin:** Operator ruling, 2026-07-25, after the MFP plugin needed a
  Fritsch–Carlson handoff limiter (v0.2.3) to stop Makima tangents driving
  the engine infeasible: *"I intend the machine to handle all of this, bare
  minimum motion processing on the streamer plugin side. I want a dev to WANT
  to implement this, not dread it."*
- **Problem:** The natural pull when a client sends bad motion is to make the
  client smarter. That is a trap for an ecosystem protocol. Every kinematic
  rule pushed into clients is (a) re-implemented, subtly differently, by every
  integrator, (b) unverifiable by the device, (c) a reason not to adopt
  Valence at all. It also cannot be right in general: a client cannot know
  the hub's planner shape, its live limit set, or its window — and those
  change at runtime. Today the MFP plugin carries a spline-tangent limiter
  that is really the *machine's* job.
- **Proposed change:** State a normative doctrine in SPEC:
  1. **The motion input surface is CLOSED and small.** A hub accepts motion in
     exactly three modes: **native samples** (0x2100 dense points), **native
     segments** (0x2101 timed `{target, duration, end_vel}`), and **TCode
     passthrough** (v4, with v3 covered by v4's backwards compatibility).
     Everything a client does is adapting ITS source material into one of
     those three. Adding a fourth mode is a deliberate spec act, not something
     that accretes.
  2. **Write-once rule.** If EVERY conforming client would otherwise have to
     implement a given piece of kinematic work, that work belongs on the
     machine — written once, verifiable, and identical for all clients. A
     client SHALL be able to send its content **as authored** within one of
     the three modes and receive good motion, with no feasibility analysis of
     its own.
  3. **No per-client case logic on the hub — this is the hard line.** The hub
     MUST NOT branch on who is talking or on a client's quirks. If a hub ever
     needs such a branch, the specification is underspecified and the fix is a
     spec rule, not a device-side special case. (Corollary: the hub cannot be
     expected to know a client's spline type, source format, or scaling — so
     the wire must carry the client's *intent* in spec units, and the client
     is responsible for that translation and nothing more.)
  4. Client-side feasibility adaptation is always OPTIONAL
     (quality-of-implementation), never required for correctness. No
     conformance test may demand it.
  5. Corollary for wire design: prefer carrying the sender's INTENT
     (`{target, duration, end_vel}` as authored) over pre-chewed motion. The
     hub can always degrade intent; it can never recover information the
     client threw away.
- **Concrete first consequence — machine-side handoff sanity:** the
  pathological input that motivated this (an end velocity 36× the next span's
  mean speed) is catchable *on the hub*. The pacing ring already holds segments
  scheduled up to ~120 ms ahead, so the engine can look one segment forward and
  bound an accepted `end_vel` against the FOLLOWING segment's chord — the same
  Fritsch–Carlson bound the plugin now applies, applied where it belongs.
  (`end_vel` bounding against the *current* segment's chord alone is NOT
  sufficient: the measured pathology was sane relative to its own span and only
  absurd relative to the next one.)
  **LANDED — milestone M4d, fw 2.1.53 / kinetic 0.7.0.**
  `kinetic::boundHandoffVelocity` is the bound; `Command::next_chord` /
  `has_next_chord` is the lookahead; `ValenceHubService::drainMotionStream`
  supplies it from `PacingRing::peekOldest()` at the latest possible moment
  before the command crosses to Core 1. `chord_in` is measured from the
  machine's ACTUAL position (`|target − p| / T`), which is better ground truth
  than any sender's script geometry. Every bounded handoff is a
  `HandoffBounded` (kind 8) anomaly: VLog `motion` tag via the existing
  Core-1 drain, a per-kind counter on 0x0088 `anom_handoff_bounded` and in
  `GET /api/kinetic`, and an EVENT on 0x0089 — so a client can SEE that its
  content is being reshaped. `handoff_k` (POST /api/kinetic, 0 = off) is the
  live A/B switch. Verified: 561,599 new property-sweep assertions, all six
  `kinetic_traces` scenarios byte-identical (the guard cannot fire without a
  lookahead, so no existing motion changed), and an end-to-end run against
  valencesim producing `event_kind=8 target=0.900 detail=0.0083`.
  **Two honest limits of the landed guard**, recorded so nobody re-discovers
  them: (a) the TAIL CASE — a segment with no successor in the ring is accepted
  unchanged, deliberately, because guessing a chord we do not have would trim
  well-behaved senders and the segment is already DUE; the legality scan +
  Ruckig guard remain the backstop they always were. (b) COVERAGE is bounded by
  how far ahead the client schedules: the successor must already be in the ring
  when its predecessor comes due, i.e. the current segment must be shorter than
  the client's scheduling lookahead (MFP: 120 ms; the wire's own `t_off` clamp
  allows up to 250 ms). That correlates usefully with the pathology — an
  oversized Akima tangent implies a STEEP current chord, and a steep chord over
  a bounded displacement is a SHORT segment — but it is a correlation, not a
  guarantee, and raising the client's lookahead widens it.
- **Compatibility:** Doctrine + hub-side behavior; no wire change. Existing
  clients get strictly better motion. The MFP plugin's v0.2.3 limiter stays
  for now as a bench-testing stopgap and is flagged in-code for removal once
  the hub-side guard lands.
- **Test of the doctrine (use this when reviewing any future proposal):** ask
  *"would every conforming client have to write this?"* If yes → machine. Ask
  *"does this depend on which client, or on that client's source format?"* If
  yes → client, and if the hub seems to need it, the spec is missing a rule.
  The handoff-sanity guard above passes both tests: any client emitting
  segments can produce an unreachable handoff, and bounding it needs nothing
  about who sent it.
- **Known open mode:** TCode passthrough is currently DEFERRED on this
  firmware (TCodeParser cross-task race, no MFP value at the time). It is
  named here as one of the three so it is understood as a planned part of the
  closed surface rather than a future fourth mode.

## RFC-009 — Settings metamodel: per-field catalog annotations for generic, self-building UIs

- **Status:** **Landed (v1.0).** The whole metamodel: SPEC §8.8 (annotation
  block, roles, categories, `meta.enabled_mask`, the secrets rule, hub-side
  validation with no client regex requirement, applied-within-advertised-range)
  and §8.9 (the normative rendering checklist, including gray-never-hide and
  mandatory generic fallback). `catalog.cddl` carries the annotation keys on
  both `layout-field` and `schema-field`; the registry gained
  `setting_categories`, `setting_flags`, `field_roles`, `desc_max_bytes`,
  `option_label_max_bytes` and `catalog_max_entry_bytes`. Sub-decision 7
  resolved to option (a) by [RFC-026](#rfc-026--strings-on-the-wire-operator-ordered). Its own out-of-scope note became
  [RFC-021](#rfc-021--valence-presets-operator-ordered).
- **Origin:** Design sessions 2026-07-25 (fw 2.1.47 era), operator goal
  statement: Valence is the machine's SOLE communication surface (HTTP serves
  static web assets, nothing else), and any client — WebUI, phone app, desktop
  app, hardware controller, streaming-client side panel — must build its entire
  settings/control surface from what the hub transmits. One-and-done clients:
  a control added in firmware populates on every client's next connect, with
  the label, grouping, and explanation coming from the hub. The user learns
  what a setting does from the hub's own description, not from the client
  developer. Receipts for the gap: valence-js adopting the effective window
  as stored config and stomping operator input ([RFC-003](#rfc-003--state-channels-must-declare-stored-config-vs-effective-state-semantics)'s origin), and the MFP
  plugin flying blind on limits ([RFC-006](#rfc-006--motion-producing-clients-have-no-portable-way-to-learn-the-machines-kinematic-limits)'s origin) — both are instances of
  "the catalog describes values, not meaning."
- **Problem:** Five gaps block a generic settings renderer:
  1. **No STATE↔INTENT linkage.** Nothing machine-readable says "STATE field
     `user_speed` (0x1000) is written via INTENT key 3 (0x3000)" — the pairing
     lives only in the WebUI's hand-written JS.
  2. **No defaults.** min/max exist; the factory value does not.
  3. **No option labels.** A u8-backed single-select cannot name its choices.
     (Multi-select already works: `bitfield8` with catalog-enumerated bits.)
  4. **No categories or groups.** Nothing organizes channels/fields into a
     navigable settings surface.
  5. **No dynamic enabled state.** "Grayed out right now" depends on live
     machine state, so it cannot live in static metadata at all.
  Plus two second-order gaps: strings (packed layouts ban variable-length
  fields) and secrets (a WiFi password must NEVER ride a retained STATE
  snapshot that open-access viewers receive).
- **Doctrine line (binding for review of this and future proposals):** Valence
  describes what things ARE, never how they LOOK. No widget hints, no layout,
  no ordering metadata, no styling, ever. A phone renders a range as a slider,
  an OLED remote as a click-wheel value, a streaming plugin as a numeric box —
  same bytes, three honest UIs. Corollary: **nothing is hardcoded as a
  requirement; roles are hardcoded as opportunities** — a client that
  recognizes a spec-registered role MAY upgrade to a bespoke widget (position
  scope, dual-limit editor); a client that doesn't MUST fall back to generic
  rendering. Fallback is mandatory, upgrades are optional.
- **Proposed change:**
  1. **Per-field annotation block** (all keys optional; exact CBOR keys
     assigned in registry.yaml + catalog.cddl at landing, per the spec-gap
     ritual) on catalog layout fields:
     - `setting_key: u8` — the CBOR key in the paired INTENT channel that
       writes this field. **Present = setting (stored); absent = read-only
       (effective/telemetry).** [RFC-003](#rfc-003--state-channels-must-declare-stored-config-vs-effective-state-semantics)'s stored/effective distinction falls
       out with no separate flag — 0x1000 `max_rail` (no config-set key) is
       the live worked example.
     - `default` — factory value, same type as the field.
     - `options: [tstr]` — labels for single-select (wire value = u8 index).
     - `group: tstr` — free-form card heading within the category tab.
     - `desc: tstr` — user-facing description/tooltip, cap 128 B/field
       (registry limit). Flash-resident on the hub; travels once, etag-cached.
     - `role` — [RFC-006](#rfc-006--motion-producing-clients-have-no-portable-way-to-learn-the-machines-kinematic-limits)'s semantic vocabulary, registry-governed, grown to
       include `telemetry.*`; the `<role>` + `<role>.peak` suffix convention
       pairs current/peak stats (client MAY render as one tile).
     - `step` — range granularity hint.
     - `flags` — `advanced`, `restart_required`, `secret`.
  2. **Two-tier categories, mirroring the channel-id range split:** per-entry
     `category: u8`. **0–127 spec-registered** in registry.yaml with name and
     canonical order (initial: `device`, `user`, `limits`, `tuning`,
     `diagnostics`) — consistent placement/iconography/translation across all
     clients. **128–255 device-defined**, hub MUST supply a `category_label`
     string; clients render these as additional tabs after the spec set. A
     category spans channels (`user` + `user-2` merge into one tab — the
     answer to a category outgrowing one 242 B snapshot).
  3. **Presentation order = authoring order.** Tabs: registry order, then
     device categories by id. Within a tab: channels ascending by id, fields
     in layout order. No ordering metadata on the wire.
  4. **Dynamic enabled:** a settings STATE channel carries `enabled_mask`
     bitfield8 field(s) in its own snapshot; bit i gates the i-th
     setting-annotated field of that layout. On-change push, retained,
     conflated — every client grays from the same ground truth.
  5. **Secrets rule (normative):** a `secret`-flagged field's value NEVER
     appears in STATE; the snapshot carries only a set/unset presence bit.
     Writes ride the paired INTENT normally; ECHO confirms application
     without echoing the value.
  6. **Validation is hub-side.** Constraints (min/max/step, `max_len`) are UI
     hints; the hub is the referee (NACK `INVALID_VALUE`). NO regex
     requirement on clients — an optional pattern hint MAY be included and
     MAY be ignored (a C5-class client must never need a regex engine).
  7. **Strings (sub-decision; preferred option first):** (a) new fixed-width
     padded `str<N>` packed field type(s) — register-map style, offsets
     static, append-only evolution preserved — for non-secret strings
     (device name, SSID); (b) secret strings use the presence-bit rule
     regardless. Rejecting (a) leaves string settings write-only with a
     presence flag, which lies to the UI about non-secret current values.
  8. **Normative rendering checklist** (what "compliant client library"
     means; spec text, not wire):
     - tabs = spec categories present (registry order) + device categories
       (hub labels);
     - cards = `group` strings in authoring order; ungrouped → default card;
     - widget chosen by type + constraints, never by hint (there is no
       widget field, deliberately): bool-u8→toggle, u8+options→select,
       bitfield8→checkbox group, numeric+min/max→slider, str→text,
       no setting_key→read-only display with unit;
     - disabled bit → **gray, never hide**;
     - `desc` → discoverable help affordance appropriate to the form factor;
     - writes show pending until ECHO; controls display APPLIED values only
       (ground-truth doctrine restated for settings);
     - unknown role/flag/annotation key → render generically (fallback
       mandatory, upgrade optional).
  9. **Settings are fixed per firmware** — enumerated at connect, never
     created or destroyed at runtime. This is catalog invariance (§8.6)
     verbatim: the set changes only with the etag, which is already the
     client resync trigger.
- **Limits & footprint (measured/derived, informing the numbers we tag):**
  - The three limit tiers MUST stay distinguished when tagging v1.1:
    **wire-frozen** (u16 channel ids ⇒ 32,640 device channels; 242 B STATE;
    bundle caps), **registry policy** (`catalog_max_entries` 256 is a
    conformance floor, not a wire cap — raisable by PR), **library knobs**
    (`Catalog32`'s 32 entries / 8 fields per entry are compile-time RAM
    constants; action item: make them template parameters `Catalog<N, F>` so
    a Wroom32D hub and an S3 pick their own sizes from identical code).
  - ~60 numeric settings fit one category snapshot (242 B); more = second
    channel, same category (see 2).
  - A lavish catalog (150 settings, full tooltips) ≈ 15–25 KB: flash-resident
    (rodata) on the hub, ~50–100 ms transfer over WS, ~0.5–2 s over BLE with
    MTU 247 + DLE, one time per firmware version per client, then etag-cached
    forever. Steady-state traffic and RAM are UNCHANGED by this entire RFC.
  - Consequence for §13 (BLE binding): SHOULD mandate MTU exchange + data
    length extension before catalog transfer; a client stuck at the legacy
    23 B MTU pays ~6–12 s once (acceptable, visibly SYNCING) or ships the
    §8.5 static profile like any other potato.
  - Targets ruling (operator, 2026-07-25): S3 is the standard and trivially
    fine; Wroom32D is a big goal (fits: catalog costs flash, which 32D has;
    its RAM squeeze is session-count/ring knobs, which are per-hub Tier-3);
    C5 is client/relay and uses the static profile — never downloads the
    catalog at all.
- **Compatibility:** Additive catalog schema change (catalog.cddl + etag bump
  on adopting devices; the FROZEN conformance mini-catalog untouched until
  versioned in at 1.1 — same posture as [RFC-003](#rfc-003--state-channels-must-declare-stored-config-vs-effective-state-semantics)/006). Registry additions:
  `setting_categories` table (+ device range rule), annotation keys, flag
  bits, `field_roles` growth, `desc` cap, optional `str<N>` packed types.
  Clients ignoring every annotation behave exactly as today. Depth check:
  entry map → layout array → field map → options array = 4, inside §5.3.
- **Out of scope, named so it isn't forgotten:** preset/saved-pattern
  management (list/save/load/delete named parameter sets) does NOT fit any
  existing channel class — a roster is a variable-length list of names
  (fights the 242 B full-snapshot rule) and enumeration isn't INTENT's shape.
  It wants its own small mechanism (compact roster STATE with count +
  generation, chunked fetch like the catalog, save/load/delete intents, a
  registry per-preset byte cap) and its own RFC. Sizing note from the same
  session: 32 pattern presets ≈ 1.5 KB NVS — the mechanism should not blink
  at 256.

## RFC-010 — Client-assertable E-STOP over Valence

- **Status:** **Landed (v1.0).** `safety_ops::estop` (6) on 0x0005, dispatched
  THROUGH the same handler as a valid 0xE5 frame, so "exactly as" is true by
  construction rather than by a parallel implementation. Wire-proven: latch +
  cause=user + estop_seq + critical-priority 0x0003 push. **The open sub-item is
  now CLOSED:** the "EVENT twin" that §5.5/§11.2 ask for has a registry home —
  spec-core channel `0x000E safety-events` with its own `safety_event_kinds`
  table (estop_latched / estop_cleared / stop_latched / stop_cleared),
  `critical` priority and `watch` access matching its STATE twin exactly, and
  emitted on TRANSITIONS ONLY. Because the op routes through the one function,
  registering the kinds fixed both paths at once, as predicted.
- **Origin:** 2026-07-25 coverage audit. `webui/src/main.js:239-243`: *"No
  valence 'assert e-stop' op exists … a hard e-stop stays on the legacy
  op."* `safety_ops` = clear/stop/hold/pause/resume — no assert; Valence
  `stop` maps to HALT (stays homed, `ValenceHubService.cpp:221-223`); the
  raw 0xE5 frame's WS binding + repeat-until-latch obligation is implemented
  by no client. Under sole-surface doctrine the red button silently degrades
  to a decel-stop.
- **Proposed change:** registry `safety_ops: 6 = estop` on 0x0005 — hub
  treats it exactly as a valid 0xE5 (latch, cause=user, publish, EVENT
  twin). Role-exempt together with `stop` (see [RFC-025](#rfc-025--safety-semantics-completion-incl-overridebypass-ruling)). The raw 0xE5 frame
  remains the deframed-path/relay guarantee; the op is the trivially-
  implementable client path.
- **Compatibility:** additive registry op + one normative paragraph.

## RFC-011 — Hub-side `cfg_gen` advancement (RFC-002's mirror twin)

- **Status:** **Landed (v1.0).** `Hub::bumpConfigGeneration()` exists and the
  firmware calls it for machine-originated changes. The unified rule is SPEC
  §4.2-2 and is deliberately stated in BOTH directions: no bump on a
  value-identical accepted write, and a MANDATORY bump on a change no client
  asked for.
- **Origin:** valencesim's own spec-gap ledger (`sim/valencesim/README.md:455-460`,
  `MachineSim.h:221-223`): `valence::Hub` has no bump API — `cfg_gen` moves
  only via intents. Same asymmetry in firmware. A machine-side config change
  (physical control, boot adoption, internal recalc) leaves the generation
  stale, so a client's `precondition` CAS passes against config that already
  changed.
- **Proposed change:** Hub gains `bumpConfigGeneration()`; unified normative
  rule combining with [RFC-002](#rfc-002--cfg_gen-bumps-on-value-identical-config-sets): **`cfg_gen` advances iff at least one applied
  configuration value actually changed, regardless of who changed it.**
- **Compatibility:** behavioral + library API; no wire change.

## RFC-012 — Ownership signaling for c2h STREAM producers

- **Status:** **Landed (v1.0).** SPEC §9.2 gives "STREAM is never NACKed" an
  explicit `SOURCE_CONFLICT` carve-out, throttled like §10.5's RATE_LIMITED,
  once per (session, source). Takeover remains intent-only, deliberately —
  data-plane bundles carry no takeover flag and are not going to grow one.
  Producers SHOULD also subscribe `control-owner` for the full picture.
- **Origin:** `hub_impl.hpp:793-801`: data-plane bundles carry no takeover
  flag (§11.4) and are never NACKed (§9.2), so a producer whose source is
  owned by another LIVE session is silently dead — every bundle dropped,
  zero wire signal. (The stale-owner case is fixed by [RFC-005](#rfc-005--specify-hub-teardown-equivalence-for-all-session-end-paths)/teardown; the
  two-live-clients collision is not.)
- **Proposed change:** hub sends NACK `SOURCE_CONFLICT` (carrying
  `channel_id`) on the FIRST dropped-for-ownership bundle per (session,
  source), throttled like §10.5's RATE_LIMITED NACK. Takeover remains
  intent-only, deliberately. Producers SHOULD subscribe `control-owner`
  0x0004 for the full picture.
- **Compatibility:** additive hub behavior; reuses existing code + key.

## RFC-013 — Publish grants: burst capacity + mid-session renegotiation

- **Status:** **Landed (v1.0).** Both halves. (a) `burst` is CBOR key 42 on
  `publishes` / `granted_publishes` ENTRY maps, defaulting to the granted rate,
  clamped into `[rate, rate x max_burst_multiple(4)]` and echoed like every
  other wish (SPEC §10.5) — so a sparse-but-bursty segment sender stops having
  to misrepresent its rate to admission control. (b) PUBLISH is frame `0x18`,
  sharing the grant path verbatim with HELLO so the two cannot drift; it answers
  with a GRANT even when nothing was granted, because an empty result IS the
  answer.
- **Origin:** MFP plugin measured (`Valence.cs:187-196, 341-355, 613-617`):
  §10.5 makes granted rate double as bucket depth, so a sparse-but-bursty
  segment sender (2–4/s mean, ~25/s peak) declares 30 Hz to buy burst budget
  — misrepresenting itself to admission control — and mirrors the hub's
  entire token bucket client-side (fails [RFC-008](#rfc-008--doctrine-the-machine-owns-motion-processing-not-the-client)'s write-once test). Also
  `session.hpp:59-61`: no c2h counterpart to SUBSCRIBE — adding a publish
  wish mid-session requires a full reconnect.
- **Proposed change:** (a) `publishes` wish and `granted_publishes` echo
  gain optional `burst` (bucket capacity; default = granted rate, today's
  behavior). (b) New control frame PUBLISH (c2h, from the reserved type
  range) carrying a `publishes` array — mid-session add/change/drop,
  answered with grant results like SUBSCRIBE/GRANT.
- **Compatibility:** additive key + one new frame type. Break-allowed
  ruling permits assigning it a clean number now.

## RFC-014 — Timed-segment scheduling contract

- **Status:** **Landed (v1.0).** SPEC §5.4: for `segments`-kind STREAM channels
  `t_base + t_off[i]` IS the intended execution start of sample i, resolved
  through §7.2's nearest-window rule; registry limit `max_future_schedule_ms`
  (250), enforced by the reference hub as a CLAMP rather than a rejection;
  recommended client lookahead <= half of it. Interop by folklore is over.
  Landed together with the `stream_kinds` property [RFC-023](#rfc-023--congestion-shedding-table-becomes-normative) needed anyway.
- **Origin:** `Valence.cs:624-630, 1056-1078` — the plugin schedules
  segment starts on `t_base` (§5.4 pins `t_off[0]`=0 and caps span at
  20 ms, so scheduling cannot ride `t_off`) against a hub future-clamp of
  250 ms that is registered NOWHERE, with a private `SegLookaheadMs = 120`
  constant. Interop by folklore.
- **Proposed change:** normative: for segment-class STREAM channels, bundle
  `t_base + t_off[i]` IS the intended execution start of sample i (resolved
  via §7.2 nearest-window). Registry limit `max_future_schedule_ms` (250);
  recommended client lookahead ≤ half of it.
- **Compatibility:** codifies shipped fw 2.1.45+ behavior.

## RFC-015 — SYNCING order: catalog completes before retained STATE

- **Status:** **Landed (v1.0).** CATALOG_READY is frame `0x19` (raw, c2h,
  payload = the 8-byte etag). SPEC §6.4 is the dual-plane gate: not ready means
  no STATE, no STREAM, no retained push — and inbound INTENTs are NACK'd
  `NOT_READY` (0x010B), never queued, so a client cannot act before adopting the
  retained safety latch (§11.5-2). `READY_TIMEOUT` (0x010A) plus
  `catalog_ready_timeout_ms` (15000) close the "PINGs happily, never adopts"
  hole that liveness reaping structurally cannot see. Both sides implemented,
  including the client's idempotent re-send at `catalog_chunk_gap_timeout_ms`
  terminating on the first STATE frame. Landed together with [RFC-021](#rfc-021--valence-presets-operator-ordered): the
  transfer verbs are BLOB_*, and only the catalog namespace has a READY concept.
  `FALLBACK_LAYOUTS` can go.
- **Origin:** `webui/src/core/valence/catalog.js:11-13, 269-335` — nothing
  orders the retained-STATE push (§6.3) against catalog transfer (§8.4), so
  valence-js ships `FALLBACK_LAYOUTS`, a hand-copied table of THIS device's
  layouts, to decode state that arrives before the decoder ring — precisely
  the coupling the self-describing catalog exists to prevent.
- **Proposed change (operator-directed 2026-07-25: "ready tag" — reliable,
  non-blocking, no buffers, built into the LIBRARY, not client/firmware):**
  **CATALOG_READY.** The etag already makes the transfer self-verifying
  (SHA-256 over the exact bytes) — so the hash IS the acknowledgment:
  1. Per-session `ready` bit gates the ENTIRE data plane to that session
     (retained push + all STATE/STREAM emission). Not ready = nothing
     emitted. Nothing is queued or buffered anywhere — retained values
     already live once in the channel table; the gate is one flag, zero
     RAM, never blocks.
  2. HELLO with a MATCHING etag = proof of possession = ready immediately.
     The 99% reconnect case keeps today's zero-latency push.
  3. Absent/mismatched etag: WELCOME advertises the current etag; catalog
     chunks flow (and get the whole pipe — no telemetry competing, a free
     win on BLE/ESP-NOW); the client assembles, verifies the hash LOCALLY
     (zero round trips), then sends new raw c2h frame **CATALOG_READY**
     (core-reserved type from 0x18–0x3F; payload = the 8-byte etag it now
     operates against). Hub flips the bit; retained state flows; client
     reaches LIVE.
  4. Loss-proofing: READY is idempotent — the client re-sends every ~500 ms
     (chunk-repair cadence) until the first retained STATE arrives. No
     handshake state machine, no hub timer; a session that never sends
     READY just idles out under normal reaping ([RFC-024](#rfc-024--idle-session-reaping-for-non-owning-sessions)).
  5. Degraded static clients (§8.5) send READY with their stale etag —
     append-only layouts make their prefix-parse safe; the hub serves them
     and MAY log the session as degraded.
  Rationale vs alternatives: hub-side "defer until transfer complete" is
  ambiguous (the hub knows it SENT chunks, not that they arrived — true on
  TCP, false on ESP-NOW); client-side "discard undecodable frames" wastes
  airtime shipping frames into a bin. The gate means undecodable state is
  never transmitted at all.
- **Compatibility:** one new raw frame type + session-layer behavior in
  hub AND client cores (firmware/JS/C# inherit it). Deletes
  `FALLBACK_LAYOUTS`. Break-allowed ruling: clean frame number now,
  re-frozen at the v1.0 tag.

## RFC-016 — In-band hub identity; capabilities = catalog introspection

- **Status:** **LANDED IN FULL (a+b+c; (a) closed 2026-07-27).** (b) LANDED and
  normative: capability discovery IS catalog introspection (SPEC §6.3) — a
  feature exists iff its channels exist, and there is no parallel capability
  list to drift. (c) LANDED: `fw version` is struck from 0x0006's registry
  note, so identity has exactly one home. **(a) LANDED with the [RFC-030](#rfc-030--curve-family-on-the-stream-say-which-spline-the-segments-describe)..040
  batch, promoted off the deferred ledger by the operator's HTTP ruling** ("a
  device does not need to support HTTP at all" — and fw_version had NO in-band
  answer, the poster child for a feature stranded in HTTP-land):
  `welcome.hpp` gained the `IdentityInfo` codec on key 37
  (product/fw_version/hub_name, emit-only-when-set so an identity-less
  WELCOME stays byte-identical), `Hub::setIdentity()` is the additive API
  (caller-owned rodata strings, no heap), and the firmware populates
  `("valence-drive", FIRMWARE_VERSION, "")`. Test SI-24. Honest remainder: the
  `info` (key 4) device-defined extras sub-map is still codec-less — decoders
  skip it per §4.3; register interest before building it.
- **Origin:** valencesim spec-gap ledger (`README.md:465-467`);
  `Valence.cs:395-397` labels devices `"boot 0x…"` because fw version
  exists only in mDNS TXT; `/api/capabilities` audit — feature gates and
  `fw_version` are HTTP-only.
- **Proposed change:** (a) WELCOME gains identity keys (CBOR — strings
  already legal): `product`, `fw_version`, `hub_name`, optional
  device-defined info map. (b) Normative sentence: **capability discovery
  is catalog introspection** — a feature exists iff its channels exist
  (`has_rs485` ⇔ servo channels present; ceilings ⇔ [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis) role-tagged
  limit fields). No parallel capability list to drift. (c)
  `/api/capabilities` demoted to legacy shim, deleted with the API plane;
  "where is Valence" bootstrap = mDNS / default port / same-host.
- **Compatibility:** additive WELCOME keys; shim removal is post-migration.

## RFC-017 — Device log channel

- **Status:** **Landed (v1.0).** Spec-core EVENT channel `0x0008 log`, fields on
  the `body` (40) sub-map, `log_levels` mirroring the firmware logger
  number-for-number (so the bridge is a cast, not a translation table),
  `background` priority, `watch` access, bounded drop-oldest with the §9.4
  visible counter. The backfill got a real rule instead of a MAY-shaped hole:
  `replay_depth` is a catalog ENTRY key and its PRESENCE is THE named exception
  to §9.4's no-replay rule (`log_replay_depth_default` 32). The serial-quiet
  handoff re-binds from "first HTTP GET" to "first log grant" (SPEC §16.2).
  Honest scope note: the reference hub keeps exactly ONE replay ring and gates
  it on the log channel id, so a device declaring `replay_depth` on another
  EVENT channel must wire its own — SPEC §18-6.
- **Origin:** valencesim ledger (`README.md:462-464`); `/api/log` audit
  including its side effect (first fetch triggers `applogSerialQuiet()`).
- **Proposed change:** spec-core EVENT channel `log` (reserved id, e.g.
  0x0008): `{level u8, tag, hub-ms, message ≤128 B}`, bounded drop-oldest
  with the §9.4 visible counter, `background` priority, viewer access.
  Backfill: on grant the hub MAY replay its ring tail (count declared in the
  grant). The serial-quiet handoff re-binds from "first HTTP GET" to "first
  log grant." `/api/log` lingers as a dev shim, then dies with the API
  plane.
- **Compatibility:** new spec-core channel id + registry entry.

## RFC-018 — Session roster + admin eviction

- **Status:** **PARTIALLY LANDED (v1.0) — the roster is DEFERRED.** LANDED:
  spec-core INTENT `0x0009 session-admin` carrying the whole admin verb space
  (`evict`, `pair_approve`, `pair_deny`, `revoke`) at `configure` access, with
  `evict` running the full §6.9 teardown because "no unmonitored path to motion"
  does not get an exception for admin actions, and with the operator ceiling
  ruling recorded (a configure session may grant up to its own tier; the audit
  trail is the paired-device roster, not a hard ceiling that would stop the
  first admin making a second). **DEFERRED: the `0x0002 session-roster` STATE
  channel is allocated and specified but NOT implemented** — no reference
  catalog builder declares it. The registry note on 0x0002 says "IMPLEMENTED at
  v1.0"; that is DRIFT, and the note overstates reality. Consequence: the
  property that offsets §9.4's no-replay rule — a late joiner learning existing
  sessions' names from a snapshot rather than from join events it missed — is
  specification, not shipped behavior. SPEC §18-17.
  *(Receipt 2026-10-01, rfc-5qo: the registry drift is gone. `core_channels`
  0x0002 carries `status: reserved` and a note saying "NOT implemented",
  and has since this repo's first commit, so the "IMPLEMENTED at v1.0"
  sentence above describes the pre-split registry. The undeclared channel
  is still true: no catalog declares 0x0002, Nucleus
  `flagship_p4/src/hub/ValenceCatalog.h` included. Building it is Nucleus
  dev-board work; retiring 0x0002 instead before the tag would be a new
  RFC.)*
- **Origin:** `/api/clients` audit: the Health-tab roster/kick enumerates
  legacy :81 slots; spec reserves `session-roster` 0x0002 but this device
  never implemented it, and no evict intent exists anywhere
  (`SESSION_EVICTED` is hub-initiated only).
- **Proposed change:** implement 0x0002 as packed STATE: generation +
  fixed-size slots `{session_id u32, role u8, flags u8}` (8 slots fits
  242 B with room); names resolve via 0x0007 join events (CBOR, carries
  `client_name`) so the roster stays string-free. New spec-core INTENT
  `session-admin` (admin role): `{op: evict, session_id}` → hub GOODBYEs
  the target with `SESSION_EVICTED`.
- **Compatibility:** implements a reserved id; one new spec-core intent
  channel. Admin remains hub-UI-granted only (§12.2 unchanged).

## RFC-019 — Action intents + observable resets

- **Status:** **PARTIALLY LANDED (v1.0) — the reset ACTION INTENT is
  DEFERRED.** LANDED: the op-style intent is a first-class catalog pattern,
  `action.<name>` is a registered `field_roles` CONVENTION carrying a
  device-chosen suffix (which is exactly why `role` is a tstr and not an enum),
  `meta.reset_gen` is a registered role, and the observable-reset rule plus the
  [RFC-011](#rfc-011--hub-side-cfg_gen-advancement-rfc-002s-mirror-twin) classification (an action that restores CONFIGURATION bumps cfg_gen
  AND reset_gen; one that only clears COUNTERS bumps reset_gen alone) are
  normative in SPEC §9.3. **DEFERRED: no reference hub exposes a reset as an
  INTENT** — the reference device's counter resets still ride their legacy HTTP
  keys and feed `reset_gen` from there. The vocabulary shipped; the verb did
  not. SPEC §18-18.
- **Origin:** coverage audit: `reset_stats`, `reset_peaks`, kinetic
  `reset_stats`, `ap_reset` are ACTIONS, not values — [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis) is explicitly
  a value metamodel, and today three different reset verbs ride bespoke
  HTTP keys.
- **Proposed change:** formalize the op-style intent as a first-class
  catalog pattern (it already exists: `home`, `safety-intents`): an action
  is an INTENT schema field role-tagged `action.<name>`; ECHO echoes the
  op. Normative reset rule (ground truth for resets): a resettable counter
  group's twin STATE carries a `reset_gen` field that increments on every
  applied reset, so ALL subscribers observe the reset, not just the sender.
- **Compatibility:** additive; role vocabulary rides [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis)'s table.

## RFC-020 — Procedures: long-running guarded operations + reboot-commit

- **Status:** **Landed (v1.0) AS SPECIFICATION AND REGISTRY ONLY —
  implementation DEFERRED; nothing anywhere emits it.** LANDED on paper: the
  procedure PATTERN is normative (SPEC §9.3 — an action intent starts it, ECHO
  means ACCEPTED and not complete, a twin STATE channel carries
  `{procedure, phase, progress, result}` whose full-snapshot semantics make it
  reconnect-safe by construction, completion also EVENTs, and there is one
  channel per CONCURRENTLY-RUNNABLE procedure); `procedure_phases` is registered
  with the two-tier device range; `reboot_in_ms` is cbor key 43 and `REBOOTING`
  is GOODBYE code 0x0109. **DEFERRED:** key 43 appears NOWHERE outside registry
  comments — `encodeEcho` writes a fixed three-key map, no hub path emits a
  `REBOOTING` GOODBYE, and no procedure channel exists in any catalog. Treat as
  a specified extension point, NOT as field-tested behavior. SPEC §18-4.
- **Origin:** servo programming (`WebUI.cpp:1060-1225`: modbus-enable →
  output off → write ×3 → save → rescan-verify — a sequenced transaction
  whose real ECHO is a later readback) and the motion-backend switch
  (`WebUI.cpp:1576-1620`: sole writer of `machcfg` NVS + deferred reboot).
  Intent+ECHO cannot express either; deadman/teardown semantics assume the
  hub survives its own accepted intent.
- **Proposed change:** no new frame types — a documented catalog PATTERN:
  a procedure is started by an action intent (ECHO = accepted); progress
  and outcome ride a twin STATE channel `{procedure u8, phase u8, progress
  u8, result u16}` (full snapshots → reconnect-safe by construction);
  completion also EVENTs. Reboot-commit: ECHO's applied map carries
  `reboot_in_ms`; the hub then GOODBYEs all sessions with new code
  `REBOOTING` before going down; `boot_id` change handles the rest.
- **Compatibility:** one new GOODBYE code + spec text; procedure channels
  are device-authored.

## RFC-021 — Valence Presets (operator-ordered)

- **Status:** **Landed (v1.0) for the MECHANISM; device preset BACKENDS
  DEFERRED.** LANDED: chunked transfer generalized into the namespaced blob verb
  BLOB_REQ (0x1A) / BLOB_CHUNK (0x1B), retiring and BURNING 0x09/0x0A so a stale
  draft-era peer meets an unknown type instead of silently misreading; the
  catalog became namespace 0; `class: STORE(4)` is an ORDINARY catalog entry
  carrying a store descriptor (a parallel top-level array would have broken the
  root shape, the id sort, the etag computation and the depth rules, all four);
  the store PAIR — static descriptor plus a tiny dynamic roster STATE — is the
  shape every store uses; payloads are opaque `bstr` the protocol never decodes;
  caps are hub-declared with generous floors. SPEC §8.7. **The first real user
  is the trust ledger** ([RFC-027](#rfc-027--capability-agnostic-pairing--tiered-access-operator-ordered)/029), which the feasibility pass ruled a blob
  store rather than a packed roster, and which carries the ONE
  registered-grammar carve-out. **DEFERRED: no device preset store backend
  exists yet** — the mechanism ships with no `pattern.*` store behind it.
  SPEC §18-15.
- **Origin:** `/api/pattern/presets` (NVS `advpreset`, 24 × `{name, def}`
  opaque blobs, 3600 B total); [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis)'s out-of-scope note; the ap-editor's
  import/export flow.
- **Proposed change — the preset STORE model:**
  1. A device declares one or more **stores** in its catalog: `{store_id,
     kind (tstr, namespaced — e.g. "pattern.frayd"), capacity, per_item_max,
     name_max}`. Multiple stores compose: saved positions, limit profiles,
     recordings — all the same machinery later, for free.
  2. **Roster:** per-store STATE `{generation u16, count u8, capacity u8}`
     — tiny, on-change. Generation bump = "re-enumerate."
  3. **Enumeration/fetch:** the catalog's chunked-transfer machinery
     generalized to a namespaced BLOB_REQ/BLOB_CHUNK (catalog becomes
     namespace 0; preset stores get their own) — one transfer verb for the
     whole protocol instead of a per-feature clone. Break-allowed ruling
     makes this clean now.
  4. **Items:** `{slot, name, kind, payload}`. Payload is a CBOR document
     the SPEC treats as OPAQUE — device-defined per kind. Fray-d fits
     natively: baseline scalars + six modifier blocks as a CBOR array of
     maps (control-plane encoding, so the repeated-group problem packed
     layouts have simply does not exist here).
  5. **CRUD intents** per store: `save` (hub captures CURRENT live state by
     default; client MAY supply a payload = import), `load` (hub applies;
     resulting truth arrives via the normal STATE broadcasts — ground
     truth, no special echo), `delete`, `rename`. Export = read the item;
     import = save-with-payload (hub validates kind + size, else
     `INVALID_VALUE`).
  6. **Caps are hub-declared, spec floors generous:** capacity ≥ 32
     conformance floor, per_item_max default 4096 B — unused is unproblem;
     small hubs declare less, the catalog says so, clients render
     accordingly.
- **Compatibility:** new frame generalization (BLOB_*), catalog store
  descriptors, per-store channels. Sized against reality: 32 fray-d presets
  ≈ 1.5 KB NVS; the mechanism doesn't blink at 256.

## RFC-022 — Registry hygiene omnibus

- **Status:** **Landed (v1.0)** — all ten, with one correction that had to be
  written down. Landed: 1 `probe_result_keys` into the registry; 2 ONE code
  space for NACK and GOODBYE (a separate space would have broken §4.3's
  range-based unknown-code fallback) plus `REBOOTING`; 3
  `safety_causes::session_loss`; 4 strictly-increasing `t_off` moved INTO the
  parser, so CLIENTS are covered and not just the device; 5
  `nack_detail_max_bytes` 48 with truncate-never-suppress; 7 the catalog field
  type authoritative over the CBOR major type; 8 encode-failure closes the
  session instead of silently dropping; 9 tracking capacity must exceed session
  capacity so the BUSY race is servable; 10 applied-within-advertised-range,
  scoped by the feasibility pass to ECHO `applied` and `setting_key`-bearing
  fields. **Item 6 needs the correction now recorded as SPEC §18-9:** "a
  BLOB_REQ carrying both a full request and `chunks` is MALFORMED" is
  UNREPRESENTABLE rather than enforced — `full` is DERIVED from the absence of
  `chunks`, so the illegal combination cannot be encoded and no decoder rejects
  it. What decoders actually reject is an EMPTY `chunks` array, and a
  catalog-namespace request carrying `store_id`/`slot`; the encoder-side refusal
  is an API guard only. The registry note on key 27 overstates it.
- **Origin:** 2026-07-25 grievance audit (file:line receipts inline).
- **Proposed changes:**
  1. `probe_result_keys` sub-key space INTO registry.yaml
     (`probe_report.hpp:8-15` allocated them in a C++ header — interop
     landmine).
  2. `goodbye_codes` gets its own space (or one normative "GOODBYE uses
     nack_codes" sentence) — today two clients hand-reuse 0x0107
     (`Valence.cs:1479`, `session.js:527`). Add `REBOOTING` ([RFC-020](#rfc-020--procedures-long-running-guarded-operations--reboot-commit)).
  3. Safety `cause` enum gains `session_loss` — deadman is currently blamed
     for GOODBYEs/evictions (`hub_impl.hpp:1342`). **LANDED (M4a):**
     `releaseSessionSources()` derives the cause from the §11.4 release
     reason (3 deadman-release -> `deadman`, everything else ->
     `session_loss`), and `wire/estop_frame.hpp`'s hand-rolled `EstopCause`
     enum is DELETED in favor of the generated `safety_causes` — one
     spelling of one wire enum, regenerable from registry.yaml.
  4. `t_off` wording: "monotonic" → **strictly increasing, t_off[0]=0**.
     **LANDED (M4a) and the receiver claim was WRONG when written:**
     `BundleView::parse` bounded only the span; the hub re-derived the
     ordering at ingress, so the DEVICE was covered and every CLIENT was not.
     The walk now lives in the parser (one pass, ≤32 u16s, does t_off[0]==0 +
     strict increase + the span cap together), the hub's duplicate is gone,
     and the fuzz corpus replays clean over the changed decoder.
  5. NACK `detail` length: registered cap (48 B) + rule that over-length is
     TRUNCATED, never suppressed (today `encodeNack` returns 0 and the NACK
     silently vanishes, `nack.hpp:24-27`).
  6. CATALOG_REQ carrying both full + `chunks`: define as MALFORMED
     (`catalog_req.hpp:34` refuses on encode; decode side is undefined).
  7. Integer signedness: **the catalog field type is authoritative over the
     CBOR major type** (I64 with non-negative value round-trips as U64 —
     `intent.hpp:16-26`'s "only send negative values" advice is not a rule).
  8. Encode-failure rule: a hub that cannot encode a mandatory response
     (WELCOME/ECHO) MUST close the session (GOODBYE if possible) — never
     silently drop it (`hub_impl.hpp:697` "nothing sane to send" black
     hole).
  9. Transport-vs-session capacity sentence: tracking capacity MUST exceed
     session capacity (≥ +1) so the §6.3 BUSY race is servable
     (`hub.hpp:238-250` inferred it).
  10. Echo-vs-advertised-range rule: applied values MUST lie within the
      catalog field's declared min/max — a hub whose internal clamp can
      exceed them (the window +5 mm rail quirk, `MachineSim.cpp:397-402`)
      must widen its advertised max, not lie past it. Generic [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis)
      renderers depend on this.
- **Compatibility:** registry additions + wording; item 5/8 change failure
  behavior (strictly better); item 10 may bump this device's advertised
  window max.

## RFC-023 — Congestion shedding table becomes normative

- **Status:** **Landed (v1.0).** The implemented decision matrix is now
  normative SPEC §10.4, written as ORDERED rows with first-match-wins so two
  conforming hubs shed identically under identical load. It carries the [RFC-014](#rfc-014--timed-segment-scheduling-contract)
  segment exception (rows 4-6: whole-source or nothing, never decimate), the
  never-shed exemption, and the first-push-after-grant exemption that keeps a
  session from being stranded mid-adoption. Honest scope note: the reference hub
  consults the table for STATE pushes only, so the STREAM decimation rows and
  the entire segment branch are specified and unit-tested rather than
  field-exercised — SPEC §18-5.
- **Origin:** `shedding.hpp:8-10` — the implemented decision matrix comes
  from the M5 milestone brief, admittedly "more prescriptive than SPEC
  §10.4's prose." Two conforming hubs would shed differently under
  identical load; clients cannot predict either.
- **Proposed change:** adopt the implemented table into §10.4 as normative
  text (it is the reference behavior, already field-tested).
- **Compatibility:** codifies shipped behavior.

## RFC-024 — Idle-session reaping for non-owning sessions

- **Status:** **Landed (v1.0).** Promoted from MAY to SHOULD with registry
  default `idle_reap_multiplier` (3) and implemented. SPEC §6.6 states the two
  liveness regimes in one table: source OWNERS get the deadman window and its
  loss policy; everyone else gets idle reaping with NO motion consequence.
  Complemented by [RFC-015](#rfc-015--syncing-order-catalog-completes-before-retained-state)'s `READY_TIMEOUT`, which covers the one case reaping
  structurally cannot see — a client that PINGs forever and never adopts.
- **Origin:** `hub_impl.hpp:1293-1300` — §11.3's deadman binds to active
  sources; §6.5's "MAY reap at 3× idle interval" was left unimplemented, so
  a viewer session that goes dark holds a slot forever (until a BUSY-range
  eviction pressure exists, which it doesn't).
- **Proposed change:** promote to SHOULD with a registry default
  (`idle_reap_multiplier: 3`); clarify the two liveness regimes in one
  table: source-owners → deadman window + loss policy; everyone else →
  idle reaping, no motion consequence.
- **Compatibility:** behavioral; frees slots on real hubs.

## RFC-025 — Safety semantics completion (incl. override/bypass ruling)

- **Status:** **Landed (v1.0)** — all three parts (recorded as landed in
  milestone M4a; re-confirmed against the v1.0 rewrite, which carries (a) as
  "the HUB latches all four levels" in SPEC §11.1, (b) as the role-exempt
  `stop`/`estop` rule in §11.2, and (c) as the safety-domain modes byte in
  §11.1).
- **Origin:** three underspecified edges found live: (a) HOLD/PAUSE have
  registry codes + wire bits but no rule on WHO latches them
  (`hub_impl.hpp:583-586`, `safety.hpp:10-12`) — a generic client cannot
  know if sending HOLD does anything on an arbitrary hub; (b) whether
  viewers may send stop-class ops is unstated — valence-js guessed
  restrictive (`bridge.js:252-257`), and the wrong guess means "the person
  in the room cannot stop the machine"; (c) override/bypass currently ride
  a legacy HTTP endpoint with no Valence home.
- **Proposed change:** (a) the HUB latches all four levels in 0x0003 —
  delegate acceptance is what triggers the latch; a hub whose delegate
  doesn't implement HOLD/PAUSE NACKs `UNSUPPORTED_OP` (discoverable,
  honest). (b) Role exemption rule: `estop` ([RFC-010](#rfc-010--client-assertable-e-stop-over-valence)) and `stop` are
  role-EXEMPT on 0x0005 — anyone may stop the machine, §11.2's "safety
  outranks authorization" generalized; `hold/pause/resume/estop_clear`
  require controller. (c) `manual_override` and `bypass_limits` become
  safety-domain state: represented in the 0x0003 snapshot (appended byte —
  append-only legal) and written via 0x0005 ops (`override_on/off`,
  `bypass_on/off`, controller role); the per-move `bypass` key on 0x3100
  stays as-is. Also fold in: `home` 0x3101 gains bench ops
  `2 = force_home {stroke}` / `3 = clear_override` (controller; noting op 2
  clears an e-stop latch, so it lives HERE under safety review, not in a
  convenience bucket).
- **Compatibility:** registry ops + one appended STATE byte + spec text.

## RFC-026 — Strings on the wire (operator-ordered)

- **Status:** **Landed (v1.0).** All three tiers. (1) identity/product strings
  ride the CBOR control plane and are REGISTERED as WELCOME `identity` — though
  see [RFC-016](#rfc-016--in-band-hub-identity-capabilities--catalog-introspection) for the deferred codec, which is the one place this RFC's promise
  is not yet cashed. (2) `str16`/`str32`/`str64` are `packed_field_types`
  8/9/10, fixed-width zero-padded UTF-8, implemented in the layout codec and
  validated by the catalog codec; a reader stops at the first NUL or the width.
  (3) STREAM sample layouts remain string-free, normatively (SPEC §5.4). The
  `secret str32` warning survived into the registry note.
- **Origin:** [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis) sub-decision 7 (now resolved to option (a) by
  ruling); the §3.1 link-status gap (BSSID/IP are strings, hence the
  WebUI's 30 s HTTP poll that exists ONLY to fetch a string); device-name
  setting.
- **Proposed change:** three tiers, each in its natural home:
  1. **Identity/product strings** → CBOR control plane (WELCOME, [RFC-016](#rfc-016--in-band-hub-identity-capabilities--catalog-introspection)).
     Already legal; zero new machinery.
  2. **String VALUES in packed STATE/settings** → new `packed_field_types`:
     `str16 / str32 / str64` — fixed-width, zero-padded UTF-8, register-map
     style. Offsets stay static; append-only evolution preserved; [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis)
     renders them as text inputs (`max_len` = width), `secret` flag
     composes (presence-bit rule unchanged).
  3. **STREAM sample layouts remain string-free** — the motion hot path
     never pays for text.
  Immediate consumers: `hub_name` as a writable setting, the link-status
  channel (BSSID/IP) that kills the WebUI's last status poll.
- **Compatibility:** new packed field types (registry + catalog.cddl +
  codegen); break-allowed ruling lets the type ids slot in cleanly.

## RFC-027 — Capability-agnostic pairing + tiered access (operator-ordered)

- **Status:** **Landed (v1.0).** Tiers renamed at UNCHANGED wire values
  (`watch`/`control`/`configure` = 0/1/2). All three association modes
  implemented: knock-and-approve with the bounded pending list exposed as
  protocol state (0x000A/0x000B) and no frame answering the knocker; PIN proof
  with constant-time compare through the injected crypto delegate and the
  three-strike window close; push-to-pair with the power-cycle presence gesture
  and the possession-is-root factory-fresh rule. `pairing_modes` is advertised
  as a bitmask in WELCOME `trust`, RE-EVALUATED PER SESSION so a transient
  window is advertised only while it is genuinely open. Revocation is protocol
  (0x0009 `revoke`), not a WebUI feature. The H3 honesty clause on offline PIN
  brute-forcing is normative TEXT (SPEC §12.3), not a footnote. **§12.2's "admin
  granted only via the hub's own UI" sentence is STRUCK**, and SPEC §12.3 states
  the deliberate consequence out loud: the admin surface, eviction included, is
  reachable through pairing.
- **Origin:** §12.2's single ceremony assumes joiner keyboard + trusted
  display — a 6-button coin-cell remote can do neither; the trusted
  surface is implicitly the WebUI (circular); no bootstrap story for the
  first admin. Prior art: BLE SSP association models (IO-capability
  adaptive), WPS-PBC, Matter commissioning.
- **Proposed change:**
  1. **Tiers renamed, wire values unchanged:** `watch(0)` / `control(1)`
     / `configure(2)`. Control includes STREAM publishing (a motion
     producer is a controller). Composes with standing rules: safety
     estop/stop role-EXEMPT ([RFC-025](#rfc-025--safety-semantics-completion-incl-overridebypass-ruling)); OTA never derivable from any tier
     (standing ruling); serial/in-process remain implicitly configure
     (physical possession, §12.3).
  2. **One ceremony, three association modes, all ending in PAIR_GRANT
     `{token, role}`.** Role is an attribute of the GRANT, never of the
     ceremony; zero-or-one PIN exists, never per-tier secrets.
     - **(a) Knock-and-approve (primary, capability-agnostic):** bare
       PAIR_REQ (no proof) → bounded pending list (≤4) exposed as
       protocol state (pending-pairing STATE + EVENT twin) → any
       configure-tier session approves `{instance_id, role}` via intent
       (or denies; window per knock, e.g. 120 s). Joiner needs one button
       and no display. Trusted surface = ANY configure client (phone,
       CLI, WebUI), killing the WebUI dependency.
     - **(b) Numeric proof (self-service):** today's HMAC-PIN flow, kept
       for keyboard-bearing joiners when no admin session exists.
     - **(c) Push-to-pair (bootstrap + potato fallback):** a PHYSICAL-
       PRESENCE PROOF opens a short SINGLE-GRANT window; first knock is
       granted without approval. The spec requires the *proof*, not a
       GPIO — **bare-minimum hardware is NONE, because the power cord is
       the button:**
       * *Factory-fresh (zero configure tokens): no gesture needed* — the
         hub boots claimable; first knock gets configure. Whoever unboxed
         and powered it possesses it (Matter/Chromecast commissioning
         semantics).
       * *Re-open later:* the **power-cycle gesture** — N (default 3)
         consecutive boots each with uptime < ~10 s → next boot opens the
         window. NVS boot-counter only; cannot collide with a session
         (any power loss already stops motion and forces re-home).
       * A hub with ANY real button MAY bind it as the pairing control —
         UX upgrade, never required. A hub with VGlow hardware SHOULD
         show a pairing glow-state; window state is also observable
         in-band by any watch session regardless.
       * Factory reset (token-store wipe) MUST be a deliberately HARDER
         gesture (longer cycle sequence or serial console, which is
         implicitly configure per §12.3) — never the same gesture as
         opening pairing.
       **Grant rule: if zero configure tokens exist, the window grants
       configure — physical possession is root.** Thereafter it grants
       the configured default (control), and knock-and-approve does the
       rest.
  3. Hub advertises available modes (WELCOME `limits`/identity map);
     registry gains a pairing-modes enum + defaults.
  4. **Revocation is protocol, not WebUI:** the paired-device roster
     (instance_id, name, role, last-seen) is readable and revocable from
     any configure session — rides [RFC-018](#rfc-018--session-roster--admin-eviction)'s admin surface.
  5. **Honesty clause (normative text):** the HMAC-PIN proof is
     offline-brute-forceable by a passive observer of the pairing
     exchange (4 digits = 10⁴ HMACs); acceptable for the v1 threat model
     (casual/drive-by prevention), MUST be stated plainly. PAKE (SPAKE2)
     remains the reserved v2 upgrade — not in v1 because WebCrypto has no
     PAKE and mandating it would exile the browser client.
- **Compatibility:** PAIR_* CBOR is already extensible; new pending-
  pairing state surface + approve intent; registry additions. Break-
  allowed ruling permits reshaping PAIR_REQ cleanly now.

## RFC-028 — Parser robustness + fuzz conformance gate (anti-CVE)

- **Status:** **Landed (v1.0)** — all five obligations, including the one
  previously open. 1/2/4/5 landed with the fuzz gate (7 libFuzzer targets,
  ASan+UBSan, committed corpus, CI workflow) and three real bugs fixed; they are
  now SPEC §5.8 (parser totality, explicitly SYMMETRIC for clients) and §17.4
  (the totality gate, with both institutional lessons written into the normative
  document — the `declared <= remaining` rule and the ASan-invisible
  intra-object overflow). **Obligation 3 is now CLOSED structurally:** `ICrypto`
  exists in `core/crypto.hpp` and is the 5th Hub constructor parameter with a
  null-object default, mirroring IClock/IRandom exactly; `hmacSha256` and a
  volatile-accumulator `constantTimeEqual` are fully implemented, and
  constant-time compare for every token/proof/signature check is a normative
  requirement (SPEC §5.8-7). **Honest caveat that belongs with it:** the DEFAULT
  `SoftwareCrypto` inherits `ICrypto`'s stub `signP256`/`verifyP256`/`publicKey`,
  which return 0/false/0. Signing is a working SEAM, not a shipped capability —
  see [RFC-029](#rfc-029--trust-lifecycle-hub-authenticity-change-tripwires-own-ui-trust) and SPEC §18-11.
- **Origin:** the wire parser is the attack surface in BOTH directions:
  the hub parses HELLO/INTENT/bundles from untrusted clients, and CLIENTS
  parse WELCOME/catalog/STATE from possibly-untrusted hubs — a client
  auto-connecting to any discovered `_valence._tcp` beacon is one
  malicious hub away from parsing hostile bytes, and the catalog (rich in
  variable-length strings, growing via [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis)/026) is the fattest
  client-side surface. Today's conformance = golden vectors only; no fuzz
  requirement exists anywhere.
- **Proposed change:**
  1. **Parser totality (normative):** every conforming parser, hub or
     client, MUST map ANY byte string to accept-or-reject — no OOB reads,
     no unbounded allocation or recursion, no UB. The deterministic CBOR
     profile + depth-4 cap + definite lengths already do the heavy
     lifting; this makes it a conformance obligation, not a style.
  2. **Length fields are never trusted past the enclosing buffer**;
     registry string caps (names 32/24/8, desc 128, NACK detail 48,
     option labels) are enforced at parse — reject, never truncate-and-
     continue, on structural payloads.
  3. **Crypto via injected delegate** (`ICrypto`: hmac_sha256, random,
     constant-time compare — same pattern as IClock/IRandom, preserving
     the zero-dependency library). Constant-time compare REQUIRED for all
     token/proof checks (the OTA plane already does this; make it
     protocol-wide).
  4. **Fuzz corpus ships with the conformance suite:** structure-aware
     seeds per frame type (valid vectors + mutations), run under
     libFuzzer/AFL on the native builds of BOTH reference cores (hub and
     client). Release gate for reference implementations: N CPU-hours,
     zero crashes/sanitizer findings. Golden vectors prove correctness;
     fuzzing proves totality.
  5. **Client obligations are symmetric** (normative sentence): a hostile
     hub MUST NOT be able to crash a conforming client. valence-js,
     the MFP plugin, and the C++ client core all carry the same totality
     duty as the hub.
- **Compatibility:** spec text + conformance tooling; zero wire change.
  Cheapest insurance in the queue.
- **STATUS — obligations 1/2/4/5 LANDED (fuzz gate built and run, 2026-07-25).**
  `test/fuzz/` (7 libFuzzer targets, ASan+UBSan, `-fno-sanitize-recover`),
  a committed encoder-generated seed corpus, and `.github/workflows/fuzz.yml`
  (the repo's FIRST CI workflow: per-target matrix, deterministic corpus
  replay + short PR budget, 30-min-per-target nightly). Built and run under
  WSL2 clang — the Windows MinGW host has no clang and no libFuzzer, so the
  README documents the exact invocation.
  **THREE REAL BUGS, all fixed, all with regression doctests:**
  1. `CborReader::readTstr/readBstr` bounded strings with `start + len >
     size()`, which OVERFLOWS: a head of `7B FF*8` (tstr claiming 2^64-1
     bytes) wrapped the sum past the check and returned a 2^64-1-byte view
     into a 9-byte buffer, while rewinding `_pos` backwards. Reachable from
     EVERY message decoder and from `skipValue()` — the §4.3 unknown-key
     path, i.e. the bytes a decoder does not understand. This was the
     CVE-shaped one. Fix: `arg > remaining`.
  2. `ChunkReassembler::begin()` correctly REFUSED an over-capacity transfer
     but still stored the attacker's `chunk_count`/`total_bytes`;
     `missingIndices()`/`assembled()` then used them without checking
     `active()`. The lesson: refusing a transfer must refuse its NUMBERS —
     a guard that leaves attacker sizes in members only moves the bug one
     call to the right.
  3. `Reassembler::accept()` had an UNBOUNDED `memcpy` into the 504-byte
     `pendingLastBytes` — the one write in the class that did not go through
     the bounds-checking `placeFragment()`.
  **The trap worth institutional memory:** #3 survived a 7.8-MILLION-execution
  fuzz run and was found by hand. Its spill lands in the very next member of
  the same struct, and an INTRA-OBJECT overflow is invisible to ASan — only a
  write long enough to leave the whole enclosing object reports. Hence
  `-max_len=8192` in CI, and hence: never conclude "the fuzzer would have
  caught it" for a bug between two arrays of one struct.
  **Obligation 3 (`ICrypto` injected delegate) is NOT done** — it is an API
  change, not a fuzzing deliverable, and remains open.
  **Honest coverage note:** the gate proves DECODER totality. It does not
  drive Hub/Client through stateful protocol sequences, does not touch the
  firmware transports in `src/comms/`, and says nothing about semantic
  correctness (that is the golden vectors' job). `test/fuzz/README.md` has
  the full not-covered list.

## RFC-029 — Trust lifecycle: hub authenticity, change tripwires, own-UI trust

- **Status:** **Landed (v1.0)** — all six items, with one capability caveat.
  (1) durable hub identity: signature material is fixed at exactly
  `client_nonce(8) || session_id(u32 LE) || boot_id(u32 LE)` = 16 bytes, the
  client nonce being the feasibility pass's replay fix; delivered inline in
  WELCOME or deferred in HUB_SIG (0x1D) with identical material and identical
  client handling, first valid answer winning, and `hub_sig_timeout_ms` (3000)
  bounding ONLY a client that pinned a key (silence from a hub with no keypair
  is conformant — honesty clause H9). (2) the version tripwire with
  `trust_states` and the RECOGNIZED-PENDING suspension, its honesty clause
  normative (SPEC §12.6, H6/H7 — including the real gap that a device reporting
  NO version can never trip it). (3) the symmetric hub-change signal. (4)
  `/uitoken` — IMPLEMENTED (`src/comms/ValenceUiToken.cpp`), sanctioned as HTTP
  escapee #2, and normatively NOT a connection prerequisite (SPEC §12.8, H8).
  (5) the phish note, as honesty clause H5. (6) token presentation modes with
  AUTH (0x1C), `auth_attempts_max` (3), and the previous-session-nonce shortcut
  staying dropped. **CAVEAT, stated because a reader will otherwise assume a
  battery where there is a socket:** real ECDSA sign/verify come from an
  INJECTED `ICrypto`; the library's default implementation stubs them, so
  evil-twin detection exists only where an application supplies the primitive.
  SPEC §18-11.
- **Origin:** the token store trusts a DEVICE identity forever regardless
  of the code behind it; nothing distinguishes the real hub from an evil
  twin replaying its identity strings; the machine's own served WebUI has
  no defined trust status.
- **Proposed change:**
  1. **Durable hub identity (the primitive everything else hangs on):**
     hub generates a P-256 keypair at first boot (NVS; P-256 chosen
     because WebCrypto can verify it — the browser participates). The
     pubkey fingerprint is the machine's durable id. PAIR_GRANT delivers
     the pubkey — trust is anchored at the pairing ceremony, the moment
     physical presence was proven (TOFU at a verified moment). On session
     establishment the hub signs the session nonce; clients verify
     against their pinned key. A clone machine copies every string but
     fails the signature → client MUST surface "not your machine" and
     withhold intents. Potato clients paired by physical ceremony MAY
     skip verification. Sign cost: once per session, off the hot path.
     Crypto rides [RFC-028](#rfc-028--parser-robustness--fuzz-conformance-gate-anti-cve)'s injected ICrypto delegate.
  2. **Client-change tripwire ("untrusted but I recognize you"):** HELLO
     gains `client_ver` (tstr). Trust-ledger entry per paired device:
     {instance_id, kind, name, version, first_seen, last_seen, role,
     state}. Observed version change ⇒ state drops trusted →
     RECOGNIZED-PENDING: session admitted at watch, granted role
     suspended, re-approval intent surfaced to configure sessions
     ("plugin 0.2.3→0.3.0 — keep trusting?"). Default policy: watch
     auto-rekeeps; control/configure require re-approval; hub-
     configurable. **Honesty clause (normative): self-reported version is
     a TRIPWIRE, not attestation** — a deliberately malicious update lies
     and keeps its token; the real bounds on a hostile client are role
     scoping, instant revocation, roster visibility ([RFC-018](#rfc-018--session-roster--admin-eviction) + version
     history), and the role-exempt safety ops ([RFC-025](#rfc-025--safety-semantics-completion-incl-overridebypass-ruling)).
  3. **Hub-change signal (symmetric):** hub fw_version change (visible
     via [RFC-016](#rfc-016--in-band-hub-identity-capabilities--catalog-introspection) WELCOME identity + etag/boot_id) SHOULD be surfaced by
     clients ("machine updated to X.Y.Z"); clients MAY gate configure-
     tier actions on user acknowledgment after a change. Hub code
     changes only via the OTA plane, which is outside Valence trust by
     standing ruling — a configure-tier compromise cannot flash firmware.
     A hostile hub's ceiling against conforming clients is well-formed
     lies, per [RFC-028](#rfc-028--parser-robustness--fuzz-conformance-gate-anti-cve) symmetric parser totality.
  4. **Own-UI default trust via SERVED-PAGE TOKENS (operator design,
     2026-07-25 — supersedes the earlier Origin-only draft), capped:**
     the hub's own served WebUI is trusted by default through a
     browser-enforced one-time token, not a forgeable header:
     * The served page does a SAME-ORIGIN `fetch('/uitoken')`; the hub
       mints a single-use token (TTL ~60 s, rate-limited, minted only —
       never templated into the static gzip); the page presents it in
       HELLO → **control tier (never configure)**.
     * The boundary is the browser's same-origin policy: the endpoint
       sets NO CORS headers, so any cross-origin page (clone UI,
       malvertising LAN scan — the mass-automatable vector) can send the
       request but cannot READ the token. Manufactured tokens fail the
       single-use server mint; a stolen-in-the-gap token makes the real
       page's HELLO fail LOUDLY (visible race, never silent compromise).
     * Beats Origin-checking on webview compatibility (absent/null
       Origin breaks legit embedded shells; a token fetch works wherever
       the page runs) and auditability (each token maps a page-serve to
       a session in the roster). Where an Origin header IS present it
       MAY still be used as a second independent filter — free.
     * Honesty clause: a NATIVE process on the LAN can curl the endpoint
       — but that attacker class already defeats the cleartext-token
       ceiling (§6), so this mechanism loses nothing to it while fully
       closing the browser-borne class. Threat-model ruling (operator):
       optimize against automatable mass vectors; accept the ceiling on
       individually-targeted LAN-resident attackers.
     * Toggleable off for shared spaces. **Configure always pairs, no
       exceptions.** Deployment commandment: the Valence port is NEVER
       exposed to WAN — LAN-first is a security property.
     * **NOT a connection prerequisite (normative).** A WebUI never
       NEEDS `/uitoken` to connect: with the endpoint absent, disabled,
       or failed it is an ordinary client — viewer by default (§12.2
       open viewing), and control/configure via any [RFC-027](#rfc-027--capability-agnostic-pairing--tiered-access-operator-ordered) association
       mode (knock-and-approve, PIN, push-to-pair), with its token
       persisted against its `instance_id` like any other client's.
       Since configure ALWAYS pairs, a WebUI already exercises the
       normal ceremony regardless. `/uitoken` only removes ceremony for
       the control tier on the machine's OWN page; it grants no
       capability that pairing cannot, and clients MUST implement the
       pairing path irrespective of it. This is precisely why it is a
       sideband and not a second plane (standing ruling).
  5. **Phish note (normative, informative tone):** clone-page attacks
     that proxy a PIN to the real hub are active MITM, excluded from the
     v1 threat model (§12.1) and stated as such; knock-and-approve is
     the RECOMMENDED ceremony partly because its approval surface shows
     the knocker's identity on hardware the attacker doesn't control.
  6. **Token presentation modes (passive-theft plug, floor unchanged):**
     v1 transports are cleartext (`ws://`), so a raw bearer token in
     HELLO is sniffable by a passive LAN observer (§12.1 excludes that
     attacker, but the plug is near-free). Two presentation modes:
     **(a) bearer** — raw 16-byte token in HELLO; remains legal (the
     potato floor stays a memcpy, zero crypto). **(b) proof** —
     `HMAC-SHA256(token, welcome-nonce)` truncated 16 B, RECOMMENDED for
     every client that has SHA-256 (browser/WebCrypto, C#, all ESP32s —
     i.e., everyone but coin cells): a sniffer captures a one-time proof,
     never the credential. Hub accepts both; roster records which mode a
     device uses (visible security posture). Note: proof mode requires
     HELLO→nonce→proof, so it rides the existing WELCOME nonce with one
     added round-trip only for proof-mode clients, or the nonce from the
     PREVIOUS session (hub keeps last-issued nonce per instance_id —
     zero extra round trips on reconnect, replay-fenced by nonce
     rotation).
- **Weight audit (recorded so the lightweight covenant is checkable):**
  mandatory client floor after 027/028/029 is UNCHANGED from v1-draft —
  same parser, zero required crypto, 24 bytes of stored identity. All
  cryptographic weight lands hub-side (mbedtls already linked for WiFi)
  or in CI (fuzzing ships zero bytes). The named residual holes, chosen
  with eyes open: the own-UI token endpoint is curl-able by NATIVE LAN
  processes (browser-borne attacks are CORS-blocked; that native class
  already defeats the cleartext ceiling, so nothing is newly lost —
  capped at control, toggleable); push-to-pair windows can be raced (single-grant, visible, revocable);
  cleartext transport bounds everything at "honest LAN" until wss/v2
  (which is why the hub signature is designed to work WITHOUT secrecy).
- **Compatibility:** new HELLO key (client_ver), PAIR_GRANT pubkey field,
  WELCOME signature field, token-proof presentation key, trust-ledger
  states + re-approval intent on the [RFC-018](#rfc-018--session-roster--admin-eviction)/027 admin surface.
  Break-allowed: fields land clean. ICrypto delegate gains sign/verify
  (hub sign: mbedtls; client verify: WebCrypto / System.Security /
  mbedtls).

---

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
  display bounds (this was colliding head-on with [RFC-003](#rfc-003--state-channels-must-declare-stored-config-vs-effective-state-semantics)'s origin
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
  like the channel-id special-casing [RFC-025](#rfc-025--safety-semantics-completion-incl-overridebypass-ruling) forbids. It is not, and the
  distinction matters:
  * `option_access` is CATALOG DATA, authored by a human. If someone
    mis-authors channel 0x0005 — omits the vector, or marks `estop_clear`
    as `watch` — then clearing an e-stop latch becomes reachable by any
    anonymous LAN client. A safety-critical authorization would be derived
    from a data file with no floor under it.
  * The prohibitions this appears to violate are both about something else:
    [RFC-008](#rfc-008--doctrine-the-machine-owns-motion-processing-not-the-client).3 forbids branching on WHO is talking when PLANNING MOTION;
    [RFC-025](#rfc-025--safety-semantics-completion-incl-overridebypass-ruling) forbids per-channel logic that duplicates what the catalog
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
- **`replay_depth` (catalog entry key 13, [RFC-017](#rfc-017--device-log-channel))** exists in
  `catalog.cddl` but is NOT yet in the data model — the one remaining
  CDDL↔struct gap after M2b. It lands with the log channel work, since
  that is its only consumer.
- **Deferred cleanups, recorded so they are not lost:** (a) `CborWriter`
  wants a MEASURING mode (count bytes, no buffer) — it would remove
  `checkCatalog`'s scratch-overload wart and serve [RFC-028](#rfc-028--parser-robustness--fuzz-conformance-gate-anti-cve)'s
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

---

## RFC-030–050 index (post-v1.0, landed piecemeal)

*The base pass ends at [RFC-029](#rfc-029--trust-lifecycle-hub-authenticity-change-tripwires-own-ui-trust). Everything below is a later, smaller RFC —
mostly single operator rulings from 2026-07-27/28, batched through Phase
B/C/D. Status column matches each entry's own line; cross-check against
`docs/canon/LEDGER.md` before citing a status from here.*

| RFC | Scope | Status |
|---|---|---|
| [030](#rfc-030--curve-family-on-the-stream-say-which-spline-the-segments-describe) | Curve family on the stream | Landed |
| [031](#rfc-031--servo-register-configuration-the-last-http-writer) | Servo register configuration | Draft — parked, mechanism required |
| [032](#rfc-032--command-and-telemetrytarget-make-commanded-motion-discoverable) | `command.*` / `telemetry.target` roles | Landed |
| [033](#rfc-033--an-unacceptable-subscribe-must-be-answered-never-silently-dropped) | SUBSCRIBE refusals must be answered | Landed |
| [034](#rfc-034--placeholder-entries-in-options-lists) | Placeholder `options` entries | Landed |
| [035](#rfc-035--a-role-vocabulary-for-motion-plan-telemetry) | Motion-plan telemetry roles | Landed |
| [036](#rfc-036--renderability-of-string-settings) | Renderability of string settings | Landed items 1+3; item 2 (`max_len`) deferred |
| [037](#rfc-037--forward-decodable-packed-layouts-explicit-per-field-width) | Forward-decodable packed layouts | Landed: vocabulary 2026-07-27; encoder half (key 18 emission, K-01/K-02 re-pin to 805 B) 968d0ae, option (a) |
| [038](#rfc-038--client-negotiated-deadman-window) | Client-negotiated deadman window | Landed |
| [039](#rfc-039--every-refusal-is-answered-rfc-033s-principle-generalized) | Every refusal is answered | Landed |
| [040](#rfc-040--spec-says-what-the-reference-implementation-knows-editorial-batch) | Spec-says-what-the-reference-knows (editorial) | Landed |
| [041](#rfc-041--a-role-vocabulary-for-the-machines-physical-travel-extent) | Physical travel extent roles | Draft — mechanism shipped, RFC not yet batch-reviewed |
| [042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops) | Session staleness / reattach | Landed |
| [043](#rfc-043--transport-conformance-profiles-which-bindings-a-hub-must-offer) | Transport conformance profiles | Landed |
| [044](#rfc-044--client-onramp-doctrine-tcode-passthrough-as-a-client-side-adapter) | Client onramp doctrine (TCode passthrough) | Draft — deprioritized, not near-term |
| [045](#rfc-045--retire-deadman-as-safety-session-liveness-is-bookkeeping-not-motion-control) | Retire deadman-as-safety | Landed |
| [046](#rfc-046--ble-primary-discovery-udp-probe-and-reply-and-cross-transport-migration) | BLE-primary discovery + UDP probe | Landed |
| [047](#rfc-047--the-0xcdss-channel-allocation-grid-structure-over-arrival-order-history) | The 0xCDSS channel allocation grid | Landed |
| [048](#rfc-048--the-rendering-constitution-catalog-vocabulary-capability-interfaces-renderer-law) | The rendering constitution | Landed |
| [049](#rfc-049--spec-fresh-eyes-panel-omnibus-small-normative-fixes) | Fresh-eyes panel omnibus (7 fixes) | Landed spec/registry; hub behavior Phase D; (c)'s scheduling backstop evaluated and NOT landed |
| [050](#rfc-050--blob-transfer-backpressure--completion-acknowledgment) | Blob transfer backpressure + BLOB_DONE | Landed spec/registry; implementation deferred |

> DEMO-CANDIDATE: a live status board cross-checking every RFC's stated
> disposition above against registry.yaml/SPEC.md's actual current state,
> flagging drift the moment an entry goes stale.


## Index: RFC-051 onward

*Added 2026-10-01 after the queue run. Status column matches each entry's
own Status line as of that date; the entry wins on any disagreement.*

| RFC | Scope | Status |
|---|---|---|
| [051](#rfc-051--critical-stall-parks-the-session-instead-of-evicting-it) | Critical stall parks the session | Landed (v1.0), 2026-07-28 |
| [052](#rfc-052--the-authoring-layer-tables-released-markers-generated-vocabularies-group-descriptions) | Authoring layer (tables, released markers, generated vocabularies) | Accepted 2026-07-29, phased |
| [053](#rfc-053--estop-over-connectionless-datagrams-udp-broadcast--esp-now-opt-in) | ESTOP over UDP broadcast + ESP-NOW | Accepted 2026-07-29 (opt-out, default on) |
| [054](#rfc-054--wifi-and-esp-now-provisioning-over-ble-the-credentials-handoff) | Hub discloses WiFi credentials over BLE | Withdrawn 2026-10-01 (RFC-069 covers provisioning) |
| [055](#rfc-055--admission-control-a-hub-that-cannot-serve-you-must-say-so) | Admission control: a hub that cannot serve you says so | Landed 16266af |
| [056](#rfc-056--modular-conformance-a-hub-is-a-set-of-duties-not-a-chip) | Modular conformance: duties, not a chip | Landed 99584a6 (BLE: SHOULD, MUST where config mode is offered) |
| [057](#rfc-057--the-two-http-escapees-are-hub-duties-not-chip-duties) | The two HTTP escapees are hub duties | Landed 99584a6 (with 056) |
| [058](#rfc-058----end-velocity-unspecified-semantics-and-the-rest-before-hold-rule) | End-velocity `unspecified`, rest-before-hold, dwell rule | Landed a48c03a |
| [059](#rfc-059----hub-advertised-scheduling-latency) | Hub-advertised scheduling latency | Landed 876ca7c (with 084) |
| [060](#rfc-060----rename-slopsync-becomes-valence) | Rename: SlopSync becomes Valence | Landed 2026-09-21 |
| [061](#rfc-061----tcode-passthrough-adapter-conventions-ingest-port-l0-mapping-loopback) | TCode adapter conventions | Accepted 2026-10-01; lands with RFC-044 |
| [062](#rfc-062----live-renderer-class-selection) | Live renderer-class selection | Landed 0342526 |
| [063](#rfc-063----a-wire-carrier-for-the-destructive-flag) | Wire carrier for `destructive` | Landed 778d534 |
| [064](#rfc-064----index-0-filler-applies-to-op-selects-only) | Index-0 filler on op selects only | Landed fe50cc4 |
| [065](#rfc-065----event-channel-purpose-roles-and-event-kind-labels) | Event-channel purpose roles, event-kind labels | Landed b46c2d9 |
| [066](#rfc-066----modulators-catalog-declared-modifiers-attached-to-the-field-they-ride) | Modulators (`mod.*`, `mod_target`) | Landed b75e482 + affa61a (accepted as amended) |
| [067](#rfc-067----store-verbs-one-registered-op-select-not-split-preset-tags) | Store verbs: one op select | Landed 1a50ff8 |
| [068](#rfc-068----substituted-widget-conformance-bindings-host-owned-regions-one-intent-path) | Substituted-widget conformance | Landed 23a8b9d |
| [069](#rfc-069----client-pushed-wifi-provisioning-over-ble) | Client-pushed WiFi provisioning (BLE + serial) | Landed 4f98e6b |
| [070](#rfc-070----store-to-roster-linkage) | Store-to-roster-to-writer linkage | Landed a7c9295 |
| [071](#rfc-071----motion-input-field-roles-find-the-stream-target-without-a-name) | Motion-input field roles | Landed 4ea91d8 |
| [072](#rfc-072----discovery-identity-the-mdns-service-record-retires-the-scan-response-company-id-is-pinned) | Discovery identity: mDNS record retired, MSD id pinned | Landed d2348d9 (accepted as rescoped); client moves owed |
| [073](#rfc-073----store-item-encoding-a-registered-cbor-map-a-kind-namespace-and-an-optional-per-item-digest) | Store item encoding + digest | Landed 1b4a1af |
| [074](#rfc-074----stop-semantics-for-streams-refused-while-latched-re-armed-only-by-an-explicit-command) | Streams under a latched stop | Landed: clauses 1, 2, 4 ef003e3; clause 3 1ddf8af (with RFC-085) |
| [075](#rfc-075----esp-now-spoke-binding-an-unencrypted-hub-and-spoke-profile-for-accessories) | ESP-NOW spoke binding | Landed 8484552 |
| [076](#rfc-076----accessory-join-and-declaration-accessory-channels-in-the-user-channel-space) | Accessory join and declaration | Landed b18fac1 |
| [077](#rfc-077----live-catalog-growth-announcing-a-new-etag-to-live-sessions) | Live catalog growth; capacity | Landed 4c0ede7 |
| [078](#rfc-078----accessory-conformance-profile-and-the-hub-relationship-engine) | Accessory profile + relationship engine | Landed ede1f46 |
| [079](#rfc-079----config-mode-and-the-setup-category) | Config mode and the setup category | Landed 4d267b0 (BLE sentence awaits RFC-056) |
| [080](#rfc-080----user-authored-surfaces-and-presentation-choice) | User-authored surfaces | Landed efb23fc |
| [081](#rfc-081----advanced-generator-master-roles) | Advanced-generator master roles | Landed 3725a6b |
| [082](#rfc-082----one-home-for-the-rendering-wiring-state) | One home for the rendering wiring state | Landed d12403e |
| [083](#rfc-083----the-archetype-hint-is-struck-color-and-datetime-bind-by-role) | Archetype hint struck; color/datetime by role | Landed e22bd8e (option B) |
| [084](#rfc-084----future-anchored-samples-points-an-arrival-time-under-the-same-lead-cap) | Future-anchored samples are arrival times | Landed 876ca7c (with 059) |
| [085](#rfc-085----three-safety-pairs-one-control-each-pause-and-resume-override-and-return-estop-and-release) | Three safety pairs (pause, override, estop) | Landed 1ddf8af + test f144928 |
| [086](#rfc-086----units-deg-us-and-a-hub-time-stamp-unit-display-autoranging-is-a-client-choice) | Units `deg`, `us`, `hub_s` | Landed 20b2da5 |
| [087](#rfc-087----segments-kind-bundles-span-the-schedule-horizon-the-horizon-is-advertised-per-grant) | Segments bundles span the schedule horizon | Landed 1dbdc3e |
| [088](#rfc-088----flip-a-rail-bound-direction-flip-home-swaps-ends) | Flip: rail-bound direction flip | Landed a7415b0 |
| [089](#rfc-089----store-writer-field-roles-find-slot-name-and-item-by-identity) | Store writer field roles (`store.slot`, `store.name`, `store.item`) | Draft, ruling pending (rfc-hen) |
| [090](#rfc-090----spec-54-rule-3-repair-the-segments-span-cap-is-relative-to-t_base) | SPEC 5.4 rule 3 repair: segments span relative to `t_base` (editorial) | Draft, ruling pending (rfc-0wp) |
| [093](#rfc-093----classic-and-advanced-generators-are-two-rail-sources-not-one-generator-with-a-mode) | Classic and Advanced generators are two rail sources (`advgen.running`; `advgen.mode` retired) | Landed 4ca8592 |
| [094](#rfc-094----navigation-tiers-machine-link-and-client-control-becomes-generator-tuning-and-library-fold-into-motion-and-system) | Navigation tiers; `control` -> `generator`; `tuning`/`library` fold | Landed 0c33da4 |
| [095](#rfc-095----advanced-generator-dwell-advgendwell_crest-and-advgendwell_trough-a-hold-at-each-end-of-the-stroke-in-stroke-periods) | Advanced generator dwell roles (crest, trough) | Landed 20f968e |
| [096](#rfc-096----a----separator-in-a-group-string-names-a-section) | ` / ` in a `group` string names a section (presentation convention) | Draft, ruling pending (rfc-4ed) |
| [097](#rfc-097----the-catalog-channels-state-layout-etag-chunk-count-entry-count-12-bytes) | Pin the 0x0001 catalog STATE layout (12 B) | Draft 2026-10-02 |
| [098](#rfc-098----rail-ownership-is-released-when-its-source-goes-quiet-control-owner-names-each-slots-source-kind) | Quiet release of rail ownership; source kind on control-owner | Draft 2026-10-03 |
| [099](#rfc-099----trial-writes-a-setting-applied-live-without-persisting-then-committed-or-reverted) | Trial writes: apply live without persisting, commit or revert | Landed a0f3fcb + 28ba317 (accepted 2026-10-03, rfc-2s0) |

---

## RFC-030 — Curve family on the stream: say WHICH spline the segments describe

- **Status:** **LANDED (2026-07-27)** — as a **publishes-wish key, not the
  stream_meta INTENT** (operator-approved variant: [RFC-013](#rfc-013--publish-grants-burst-capacity--mid-session-renegotiation)'s PUBLISH frame
  already provides mid-session renegotiation, deleting the RFC's only argument
  against the wish-key home). Shipped: registry `curve_families` table + CBOR
  key 45 on publishes/granted_publishes entries; the GRANT echoes the
  **EFFECTIVE** family via `HubDelegate::effectiveCurveFamily` (answers M-2's
  "honored vs silently downgraded" open question — a ForceC1/C2 machine
  reports the forced family, never parrots); `kinetic::Command::
  client_curve_family` resolves `CurvePolicy::FollowClient` at last (c1_cubic
  → cubic reconstruction; everything else = pre-RFC quintic); firmware stamps
  each pacing-ring segment with its session's granted family. Test SI-23.
  Honest scope notes: `step` (3) is declarable but renders as quintic (no
  step renderer exists); the MFP plugin's declaration + WireSelfTest lockstep
  needs its mandatory twice-back-to-back bench run before the plugin side
  counts as verified.
- **Origin:** Operator, 2026-07-25/27. The `main`-branch firmware treated TCode
  v4 as the gold standard because it passed an interval `I` and a slope `G`
  alongside each segment, letting the device reconstruct the sender's
  interpolation instead of inventing one. Segments mode (`0x0085`) restored the
  data but not the *declaration*, and fw 2.1.70 shipped a machine-side
  `curve_policy` override (`follow client` / `force C1` / `force C2`) with
  nothing on the wire for `follow client` to actually follow.
- **Problem:** `{target, duration_ms, end_vel}` uniquely determines a cubic
  Hermite, so a segment stream is a COMPLETE encoding of the sender's curve —
  but only if both ends agree on the curve FAMILY. Pchip and Makima differ only
  in their knot-tangent rule, so given endpoint positions and tangents they
  produce the same cubic; a C2 quintic, however, **cannot** reproduce a C1 cubic
  across a knot, because the script's acceleration genuinely STEPS there. The
  device currently estimates `af` as a backward difference of consecutive
  handoff velocities — an estimate of a quantity that is two-valued at the knot.
  When the sender is C1 (Linear/Pchip/Makima/Step in MultiFunPlayer) that
  estimate is not merely imprecise, it is estimating something that does not
  exist, and the machine smooths a corner the author put there on purpose.
  Measured: forcing C1 gives a stepped `a(t0)` with alternating sign and 3-6x
  lower in-span jerk than the quintic reconstruction of the same script.
- **Proposed change:**
  1. **A `curve_family` declaration, per stream, not per sample.** It is a
     property of the SOURCE, changes only when the user changes interpolator,
     and putting it in every 4-8 byte sample would be a per-sample tax on a
     per-session fact. Two candidate homes, and the second is preferred:
     (a) a HELLO/`publishes` wish annotation, or
     (b) **a `stream_meta` field on the GRANT-side channel descriptor**, set by
     a small c2h INTENT so it can change mid-session without a reconnect (a user
     switching Pchip -> Makima in MFP mid-scene must not drop the stream).
  2. **Registry `curve_families` enum**, small and honest about what it can
     express: `unspecified` (0, the compatible default — behave exactly as
     today), `c1_cubic` (1), `c2_quintic` (2), `step` (3). NOT a taxonomy of
     every interpolator anyone has ever written: the wire needs the SMOOTHNESS
     CLASS the reconstruction must honor, not the vendor's algorithm name.
     Pchip and Makima are both `c1_cubic` and that is the correct answer.
  3. **`unspecified` MUST behave as v1.0 does today**, so every existing client
     keeps working and this is purely additive.
  4. **The machine override outranks the declaration** (`follow client` /
     `force C1` / `force C2` on 0x1105 `curve_policy`, already shipping). A
     machine is allowed to say "I don't care what you sent, do it this way" —
     that is a safety and feel decision belonging to whoever is strapped to it.
  5. **NO CLAMPING SEMANTICS ARE IMPLIED.** Operator ruling, verbatim: *"why
     bother clamping, at that point we'd just make makima pchip again, there's 2
     settings, allow the user to pick, don't dictate how they should use it."*
     Overshoot handling stays the machine's existing window/feasibility
     machinery; this RFC only declares the family.
- **Compatibility:** Fully additive — a new registry enum, one optional
  descriptor field, one optional INTENT. Absent = `unspecified` = current
  behavior, so no existing client, catalog or golden vector changes. The
  device-side consumer already exists (`kinetic::CurvePolicy`), which is why
  this is a wire proposal and not a feature proposal.

---

## RFC-031 — Servo register configuration: the last HTTP writer

- **Status:** Draft — feature PARKED, mechanism REQUIRED. Original deferral
  (operator, M5c): *"I don't use the servo tuning at the moment, we'll
  re-introduce later as it was always broken lol."* **Amended by operator
  ruling 2026-07-27:** register read/write-STYLE communication is a shape
  Valence must support. The servo pane itself stays parked, but item 5 below
  is accepted-in-principle and waits only for a consumer.
- **Origin:** M5c (fw 2.1.72). The ruling is **"no controls outside Valence,
  HTTP is read only"**, and `POST /api/servo` was the last writer standing after
  the motion, mode, tuning and admin surfaces moved. It is retired (410 Gone)
  rather than ported, because porting a surface nobody uses and that never
  worked properly would have meant designing its protocol shape under time
  pressure, for a feature with no user.
- **Problem:** Servo config is NOT shaped like the other writers. `clear_fault`
  and `save_config` are verbs and fit an op-select exactly (0x3002). But
  `/api/servo` accepted `{"live":{"<reg>":val,...}}` and `{"program":{...}}` —
  an **arbitrary register->value map** over a Modbus device. That is not a fixed
  INTENT schema, and forcing it into one would either pin every register number
  into the catalog forever or reintroduce an untyped escape hatch, which is the
  thing Valence exists to avoid.
- **Proposed change:** Split it by what the data actually IS, rather than by
  which endpoint it used to share.
  1. **The `live` whitelist becomes real settings.** It is a bounded, known set
     of tunable registers, so it becomes a STATE+INTENT settings pair with
     [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis) annotations (`min`/`max`/`step`/`desc`/`group`). That makes it
     render generically, validate client-side, and echo post-clamp like every
     other setting — and it makes the Configure pane buildable by a third-party
     client, which the HTTP version never allowed.
  2. **`program` (the full gold-motor sequence) is a DOCUMENT, not a form**, and
     belongs on the [RFC-021](#rfc-021--valence-presets-operator-ordered) blob store: one `writeBlob` on the delegate seam
     inherits chunking, selective repair, `total_bytes` pre-sizing and
     `CHUNK_UNAVAILABLE` for free. A register dump is exactly the shape that
     seam was generalized for.
  3. **`scan` is already done** — `0x3002 machine-admin` op 3, shipping.
  4. **Gate on `has_rs485`**, per [RFC-016](#rfc-016--in-band-hub-identity-capabilities--catalog-introspection): a machine with no Modbus servo must
     not advertise these channels at all. Their ABSENCE is the honest answer to
     "can this device configure a servo?", exactly as 0x1001 power already
     works.
  5. **(Operator ruling 2026-07-27) Raw register access is a bounded
     DIAGNOSTIC plane, distinct from settings.** Item 1 covers KNOWN tunables;
     this covers the engineering case item 1 cannot: reading or poking an
     arbitrary register during bring-up or fault hunting. Shape:
     - A device INTENT channel at `configure` access: op-select
       `{read, write}` + `addr u16` + `value u16`. The catalog's `addr`
       min/max is the RENDERING hint; the hub is the referee for the real
       (possibly disjoint) whitelist ranges via NACK `INVALID_VALUE` —
       exactly [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis).6, no new mechanism. A generic client already renders
       this: op-select + two bounded numeric boxes.
     - **Results ride a paired EVENT channel `{addr, value, status}`, never
       the ECHO — structurally, not stylistically.** The hub emits ECHO the
       moment `applyIntent` returns (§9.3 path, `hub_impl.hpp`), but the bus
       transaction is QUEUED to servoBusTask (`ServoModbus::queueWrite`
       already exists) and the wire has not been touched yet when that echo
       leaves. So the ECHO honestly means "accepted and queued"; the EVENT
       carries the bus truth when the transaction completes. Making the
       delegate block on a Modbus round trip inside the hub task's 5 ms tick
       is the alternative, and it is prohibited by construction.
     - Writes report the post-READBACK value in the EVENT (write, then read
       the register back, publish what the hardware answered) — the
       ground-truth doctrine extended to a plane the settings shadow cannot
       reach.
     - No new registry vocabulary is needed; this is a spec AUTHORING PATTERN
       (an appendix worked example), not a new channel class. It is
       peripheral-agnostic by design: any register-file device a hub fronts
       (Modbus today, an I2C peripheral tomorrow) reuses the same shape.
- **Compatibility:** Additive when it lands. `POST /api/servo` is ALREADY gone
  as of fw 2.1.72 — this RFC does not remove anything, it describes what
  replaces it. Until then the servo surface is read-only (`GET /api/servo`
  survives as a diagnostic per the read-only rule), which is an accurate
  reflection of a feature the operator does not currently use.


## RFC-032 — `command.*` and `telemetry.target`: make commanded motion discoverable

- **Status:** **LANDED (2026-07-27)** as written. Registry `field_roles` gained
  `command.position` (opening the `command.<quantity>` family) and
  `telemetry.target`; the device catalog tags `position` on 0x3100 and
  `tgt_10um` on 0x1100. Client side needs zero code (`model/settings.js`
  already indexes roles). **Live-verified 2026-07-28** on the reference
  webui against the reference device: tap → INTENT → post-clamp ECHO →
  device target followed, commanded/lag numerals rendered, two taps, with
  an independent wire session confirming `tgt_10um` off-UI (the machine
  repo's `webui/test/tap-to-move-live.mjs`, ALL PASS).
- **Origin:** WebUI rebuild, 2026-07-27. The rebuilt page renders entirely from
  the catalog and is forbidden from naming a channel id. When the rail widget
  went to wire up tap-to-move it found nothing it could bind to and — correctly —
  REFUSED, rendering its input tape disabled with the text "this catalog does not
  tag a move INTENT by role, so a generic client cannot find it safely". The same
  search killed the `commanded` and `lag` hero numerals.
- **Problem:** Two related holes, both in the `field_roles` vocabulary.
  1. **No role names a value-bearing COMMAND.** `action.<name>` ([RFC-019](#rfc-019--action-intents--observable-resets)) marks
     VERBS — home, e-stop, clear-fault — and a client renders them as buttons.
     `0x3100 move`'s field is `position`: a VALUE. Tagging it `action.move` would
     be actively wrong, telling every generic client to draw a button where a
     position control belongs (the device catalog's own comment says exactly
     this, and declining to tag it was the right call). So there is no honest way
     to annotate it, and therefore no way for any client but ours to command a
     move.
  2. **No role names the COMMANDED position.** `telemetry.position` is measured
     truth; nothing names the setpoint. The device publishes `tgt_10um` directly
     beside `pos_10um` on 0x1100 and it is unannotated, so a generic client can
     show where the carriage IS but never where it was ASKED to be — and so
     cannot show lag either. Deriving "commanded" from the stroke window would be
     fabrication, which the Ground Truth Doctrine forbids.

  Net effect: the most-used control on the machine — put the carriage there — is
  reachable only by a client that hardcodes `0x3100`. That is precisely the
  privilege this project exists to delete.
- **Proposed change:** Two additive `field_roles` entries. No new frames, no new
  keys, no channel changes.
  1. **`command.position`** — an INTENT field carrying a commanded ABSOLUTE
     target position in the channel's own unit. A client that finds it MAY render
     a positional control (rail, tape, slider) and send the value on that field's
     channel. Deliberately a VALUE role, not an `action.*`, so [RFC-019](#rfc-019--action-intents--observable-resets)'s
     verb/value distinction stays intact.
  2. **`telemetry.target`** — the position the machine is currently commanded to,
     as opposed to `telemetry.position` which is where it measurably is. LAG IS
     NOT A SEPARATE ROLE: it is target − position, computed client-side.
     Registering a third field for a subtraction would invite two sources of
     truth for one number.
  3. Tag the reference device: `position` on `0x3100 move` gets
     `command.position`; `tgt_10um` on `0x1100 motion` gets `telemetry.target`.
- **Why a `command.*` family rather than a one-off:** the shape recurs the moment
  anyone adds a second commandable quantity (a commanded velocity; a commanded
  force on a machine that has one). Opening the namespace now, with
  `command.position` as its first member, costs nothing and avoids a rename
  later. Convention: `command.<quantity>` names an INTENT field whose value IS
  the setpoint, and it generally has a `telemetry.*` counterpart to pair with.
- **Compatibility:** Purely additive vocabulary. Unknown roles must already be
  ignored, so a client that does not know these is unaffected, and a machine that
  does not tag them behaves exactly as today (the rail degrades to a window
  editor with no tape — what ships now). No wire-number changes, no frozen
  artifact touched. Client support already exists: `webui/src/model/settings.js`
  indexes non-action schema-field roles into `byRole`, so both light up the
  moment a device advertises them.

---

## RFC-033 — An unacceptable SUBSCRIBE MUST be answered, never silently dropped

- **Status:** **LANDED (2026-07-27).** Root cause found in review: BOTH night
  failures were one bug — `handleSubscribe`'s silent `return` on decode
  failure, hit through the never-registered 16-wish decoder cap
  (`kSubscribeMaxWishes`); the "mixed STATE+EVENT" theory was a red herring
  (the concatenated list simply exceeded 16). Shipped: NACK
  `SUBSCRIBE_REJECTED` (0x0204) with reason in `detail`;
  `max_subscriptions_per_frame` (16) registered and advertised in WELCOME
  `limits` key 4; item 4's ruling recorded — **mixing classes is LEGAL and
  always was**; negative vector SI-21 (17 wishes → NACK, then a legal
  subscribe still grants). The probe's subscribe-everything case rides the
  tooling pass.
- **Origin:** WebUI rebuild, 2026-07-27, live against fw 2.1.73 then 2.1.74.
- **Problem:** A SUBSCRIBE the hub will not accept produces **nothing** — no
  GRANT, no NACK, no EVENT. The session completes HELLO/WELCOME, adopts the
  catalog, reaches LIVE and looks perfectly healthy, while zero STATE ever
  arrives. Every readout renders `--` and every control correctly grays out (a
  control cannot be enabled without a snapshot to gate it against). It presents
  as a CLIENT RENDERING BUG and is a protocol-etiquette failure.

  Two distinct triggers were hit, both invisible:
  1. **A frame mixing STATE and EVENT subscriptions** was dropped wholesale.
     Splitting them into separate frames fixed it.
  2. **A frame with too many entries.** After the catalog grew from 33 to 44
     entries, batches sized from the advertised `max_frame` grew with it and the
     drop returned. A fixed conservative batch of 8 fixed it.

  Note the second failure was introduced BY THE FIX FOR THE FIRST. That is how
  easy this is to get wrong when the protocol gives no feedback.

  The reference probe caught neither: it subscribes to 9 STATE channels and has
  always sat inside both limits. The simulator hid them too. **A conformance
  suite that only exercises the happy path cannot find this class of bug.**
- **Proposed change:**
  1. **Normative:** a hub that cannot honor a SUBSCRIBE MUST respond — either
     GRANT what it accepted and NACK the remainder, or NACK the frame. Silence is
     non-conformant. Partial acceptance is already the observed behavior for
     individually unauthorized channels (a `configure` channel requested at
     `control` is denied per-channel, not fatally), so this mostly makes existing
     good behavior mandatory and closes the fatal cases.
  2. **A registered NACK code** — `SUBSCRIBE_REJECTED` — with `detail` carrying
     the reason (too many entries / frame too large / mixed classes).
  3. **Register the actual constraints.** If a hub limits entries-per-frame or
     forbids mixing channel classes, that MUST be discoverable — e.g.
     `max_subscriptions_per_frame` in WELCOME `limits`, beside the existing
     `max_frame` and `max_subscriptions`. Today a client can only find the limit
     by binary-searching against a live machine.
  4. **Decide the mixed-class question.** Either mixing STATE and EVENT in one
     SUBSCRIBE is legal (and the reference hub has a bug) or it is illegal (and
     the spec must say so). Right now it is neither.
  5. **Conformance:** add a negative vector — subscribe to more channels than the
     hub allows, assert a NACK. The probe should also grow a subscribe-everything
     case, since "subscribe to every channel the catalog advertises" is the
     natural thing a generic client does and is exactly what nothing tested.
- **Compatibility:** Additive (one NACK code, one optional limits key) plus a
  behavioral requirement on hubs. Clients ignoring the new NACK are no worse off
  than today. The reference hub needs the fix; that is the point.

---

## RFC-034 — Placeholder entries in `options` lists

- **Status:** **LANDED (2026-07-27) via option 3, not option 1** — review found
  option 1's "gate at a level nobody holds" cannot deliver: `AccessLevel` tops
  out at `configure`, which real admin sessions hold, so a configure-tier
  client still saw an enabled "reserved" button on 0x0009. The normative rule
  is now: for a select field carrying an `action.*` role, wire value 0 is
  NEVER an operation unless the governing op table defines op 0; clients MUST
  NOT render index 0 as actionable. Strict `option_access` on index 0 stays as
  defense-in-depth (already shipped on every device op-select). The reference
  client's English-guessing regex is gone — replaced by the index-0 rule
  (absorbed 2026-07-28).
- **Origin:** WebUI rebuild, 2026-07-27, seen live in the safety bar.
- **Problem:** Op-select INTENT fields are index-aligned with their wire value,
  and every registry op table starts numbering at 1. Index 0 therefore exists
  only to keep the array aligned and carries a filler label — `"reserved"`. A
  generic client renders `options` faithfully and so draws a **pressable button
  labeled "reserved"** that means nothing and, if pressed, earns a NACK. The
  reference client currently filters it with a label heuristic
  (`/^(reserved|none|unused)$/i`), which is a guess about English, not protocol.
- **Proposed change:** One of, in preference order:
  1. **Gate it with `option_access`** at a level nobody holds. `0x0009
     session-admin` ALREADY does exactly this for its own index 0 — so this is an
     existing pattern the reference device applies inconsistently, not a new
     mechanism. Needs no wire change, just discipline plus a normative SHOULD so
     other implementers do it too.
  2. A registered sentinel label the spec blesses, so filtering is conformant
     rather than a guess about English.
  3. Explicitly bless index 0 as never-an-operation for op-select fields.

  (1) is preferred: it reuses shipped machinery and renders the control GRAYED
  rather than vanished, matching the "gray, never hide" doctrine.
- **Compatibility:** Fully additive. Option (1) is a catalog authoring change on
  the device with no wire-format impact at all.

---

## RFC-035 — A role vocabulary for motion-plan telemetry

- **Status:** **LANDED (2026-07-27).** Registry `plan.*` family
  (start/end/current/velocity/elapsed/duration/style) + all seven 0x1101
  fields tagged. The reference client's `/plan/i` heuristic is demoted to a
  fallback-for-roleless-hubs (absorbed; PlanStrip binds by role first).
- **Origin:** WebUI rebuild, 2026-07-27, building the plan-strip widget.
- **Problem:** `0x1101 plan-strip` publishes genuinely useful data (the segment
  in flight: start/end/current normalized position, velocity, elapsed and total
  duration, style). None of it carries a role, and no vocabulary could describe
  it. A generic widget therefore cannot find it. The reference implementation
  resorts to matching the catalog ENTRY NAME against `/plan/i` and classifying
  sub-fields by regex over their `name` and `desc` — which works, is documented
  in the source as a heuristic, and is exactly the guessing this protocol exists
  to eliminate. It will silently fail on a machine that names the concept
  differently.
- **Proposed change:** A small `plan.*` role family covering what is genuinely
  portable across jerk-limited planners — e.g. `plan.start`, `plan.end`,
  `plan.current`, `plan.velocity`, `plan.elapsed`, `plan.duration`, `plan.style`.
  Deliberately NOT a description of any one planner's internals: the test for
  inclusion is "would a different machine's motion planner have this concept?",
  the same test that kept Advanced-pattern internals out of `pattern.*`.
- **Compatibility:** Additive vocabulary; absent roles keep today's behavior
  (the widget renders nothing, which is correct for a machine with no planner).

---

## RFC-036 — Renderability of string settings

- **Status:** **LANDED items 1+3 (2026-07-27); item 2 (`max_len`) DEFERRED** —
  registering an annotation nothing emits or needs yet is exactly how [RFC-007](#rfc-007--feasibility-cannot-be-predicted-without-the-hubs-planner-shape)
  said registries accrete dead weight. The probe's `cat_renderable` now treats
  str16/32/64 as renderable by type (width = the bound); the exercised fixture
  is the SIMULATOR's divergent catalog, never the frozen mini-catalog (whose
  etag pin a string setting would break).
- **Origin:** Found by `tools/valence_probe.py` against the divergent simulator
  catalog, 2026-07-27 — the FIRST time a `str16` setting field was ever
  exercised. [RFC-026](#rfc-026--strings-on-the-wire-operator-ordered) landed the packed string types and nothing had used one.
- **Problem:** The probe's `cat_renderable` check requires every setting to carry
  either `options` or numeric `min`/`max`, and fails a string field that has
  neither. A string's bound is its fixed packed width (16/32/64 B), implied by
  its TYPE and not expressible as a numeric min/max. So a perfectly conformant
  string setting fails conformance.
- **Proposed change:**
  1. Fix the check: a `str16`/`str32`/`str64` field is renderable by virtue of
     its type; its length bound is the type's width.
  2. Consider a `max_len` annotation for a device wanting a SHORTER logical limit
     than the field's physical width — [RFC-009](#rfc-009--settings-metamodel-per-field-catalog-annotations-for-generic-self-building-uis) item 5 already mentions `max_len`
     as a UI hint, but nothing registers or emits it.
  3. Add a string setting to the conformance fixtures so this path stays
     exercised rather than being rediscovered by the next implementer.
- **Compatibility:** Tooling and optional-annotation only; no wire impact.

---

## RFC-037 — Forward-decodable packed layouts: explicit per-field width

- **Status:** **PARTIALLY LANDED (2026-07-27)** — the vocabulary half: catalog
  key 18 `size` registered (registry + catalog.cddl + SPEC), decode rule
  specified (prefer declared width; unknown type + declared size = skippable
  hole), client decode rule handed to the WebUI agent. **The named follow-up:
  the reference catalog ENCODER does not emit key 18 yet** — emission is a
  per-field byte cost the encoder should take in one deliberate pass (with the
  conformance declared==derived check landing alongside), not a rider on this
  batch. Until then the key is registered, decodable, and unexercised —
  exactly the state [RFC-036](#rfc-036--renderability-of-string-settings).3 warns about, so the follow-up carries a "add an
  emitting fixture" obligation with it.
- **Remaining half: ACCEPTED (operator, 2026-10-02; rfc-bmy), option (a).**
  LANDED 968d0ae (2026-10-02): K-01/K-02 re-pinned 775 to 805 B, etag
  `8C5D68F41AD0325E`; the C-6 amendment is recorded in SPEC §17.2 (Valence
  has no governance.md). The reference catalog encoder emits catalog key 18 `size` on
  every layout field, with the declared==derived conformance check, and the
  golden vectors K-01 and K-02 are re-pinned (775 to 805 B, new etag) with a
  Canon C-6 amendment row stating that pins may be re-pinned before the
  first tag. Options (b) author-opt-in size and (c) defer to the v1.1
  fixture pass were not chosen. Operator rationale: "nobody consumes the
  vectors yet; RFCs are internal auditing, management and good practice."
- **Origin:** Grievance sweep 2026-07-27. `webui/src/core/valence/catalog.js:470`
  (*"unknown packed type: offsets are unknowable past here"*) and
  `clients/mfp-valence/Valence.cs:2859` (*"An UNKNOWN packed type makes every
  later offset unknowable, so we stop there rather than silently mis-decoding
  the tail"*) carry the identical defensive truncation. The probe's 0x0088
  misread (80 B struct silently accepted an 84 B grown payload, every field
  after the growth point read one slot early) is the hardcoded-client face of
  the same disease.
- **Problem:** A packed field's byte width is derivable ONLY from its `type`.
  The moment the registry adds packed type 11, every existing client that meets
  it must stop decoding the layout THERE — not just the unknown field, the
  entire tail — because later offsets are unknowable. Append-only evolution is
  the protocol's own growth mechanism, and it strands exactly the conforming,
  catalog-decoding clients it was designed for.
- **Proposed change:** catalog layout fields gain an explicit `size` key
  (u8, bytes). Decoders prefer the declared size and fall back to type-derived
  width when absent; an unknown TYPE with a declared SIZE is a skippable hole
  instead of a decode wall. Conformance checks declared-vs-type width
  agreement for known types (a mismatch is an authoring error). One uint per
  field against a 4096 B entry cap is noise.
- **Compatibility:** Additive catalog key (catalog.cddl + registry). Absent =
  today's behavior. This is the single highest-leverage "works everywhere"
  change in the sweep: it makes every FUTURE registry addition non-breaking
  for every PAST client.

---

## RFC-038 — Client-negotiated deadman window

- **Status:** **LANDED (2026-07-27).** HELLO key 44 `deadman_wish_ms`; hub
  clamps into the registry bounds and applies PER SESSION
  (`HubSession::deadmanMs`, enforced by pumpDeadman); WELCOME key 24 echoes
  the applied value exactly as it always did. Test SI-22 (over-max clamps
  down, under-min clamps up, absent = default). The browser client's wish is
  on the WebUI agent (handoff item 7).
- **Origin:** Grievance sweep 2026-07-27. `webui/src/model/machine.svelte.js:341-360`
  ("The alt-tab problem"): browsers throttle background-tab timers, PINGs stop,
  the 600 ms deadman evicts the session — *"to the operator this reads as
  'alt-tabbing kills the page'"* — and the only client-side remedy is a
  `visibilitychange` reconnect hack.
- **Problem:** The deadman window is hub-dictated. WELCOME key 24 already
  echoes the APPLIED per-session deadman and the registry already bounds it
  (`deadman_min_ms` 250 / `deadman_max_ms` 5000) — but HELLO carries no wish,
  so a client that KNOWS its liveness cadence is coarse (a browser, a BLE
  client on a slow connection interval) cannot ask for the window it can
  actually honor. Every such client either hacks around eviction or floods
  PINGs.
- **Proposed change:** optional HELLO key `deadman_wish_ms`; hub clamps into
  `[deadman_min_ms, deadman_max_ms]` (a hub MAY clamp tighter) and echoes the
  applied value via the EXISTING key 24 — post-clamp echo, ground-truth
  doctrine, zero new response plumbing. §11.3's loss policy is untouched: this
  negotiates WHEN the deadman fires, never WHAT it does. A source-owning
  session's wish is still bounded by the registry max the operator already
  accepted.
- **Compatibility:** One additive HELLO key. Absent = hub default = today.

---

## RFC-039 — Every refusal is answered (RFC-033's principle, generalized)

- **Status:** **LANDED (2026-07-27), one honest asymmetry.** Codes
  `BLOB_REFUSED` (0x0503) and `IDLE_REAPED` (0x010C) registered; idle reaping
  now GOODBYEs with its own code (the hub_impl comment that argued against a
  distinct code is rewritten with the counter-argument that won: observers,
  not the client, needed the distinction). Item 3 turned out narrower than
  drafted: a wrong-shape token already fails HELLO decode, and hub_impl was
  ALREADY answering NACK MALFORMED there — the silent-demotion case is a
  well-FORMED but unrecognized token, which is [RFC-029](#rfc-029--trust-lifecycle-hub-authenticity-change-tripwires-own-ui-trust)'s deliberate
  admit-at-watch tripwire behavior and stays. The asymmetry: BLOB_REFUSED is
  a CLIENT obligation and only valence-js has a reassembler cap to refuse
  with — that emission is on the WebUI agent (handoff item 8); the C++ client
  core sizes its scratch from its own build and structurally cannot hit it.
- **Origin:** Grievance sweep 2026-07-27, three receipts:
  1. `webui/src/core/valence/catalog.js:131-137` — the client's blob
     reassembler cap refused a grown catalog's transfer header and the session
     *"then went LIVE WITH NO CATALOG… No error, no NACK, no dropped-frame
     warning: a refused blob header just stops."* ([RFC-015](#rfc-015--syncing-order-catalog-completes-before-retained-state)'s READY_TIMEOUT
     eventually kills the session 15 s later — and blames the client.)
  2. `clients/mfp-valence/Valence.cs:536` — a HELLO token of the wrong
     shape (a PIN typed where a 16 B token belongs) is silently ignored and
     the session downgraded to viewer tier: *"Under enforcement that would
     present as 'connects, plays nothing'."*
  3. `lib/valence/hub/hub_impl.hpp:3056-3058` — idle reaping ([RFC-024](#rfc-024--idle-session-reaping-for-non-owning-sessions)) has
     no GOODBYE code of its own, so a reaped VIEWER is labeled
     `DEADMAN_TIMEOUT` — the motion-safety code — in every log and client.
     The comment says *"flagged rather than invented"*; this RFC invents it
     properly.
- **Proposed change:**
  1. Normative umbrella sentence in SPEC §4: silence is never a conforming
     response to a frame or transfer an implementation cannot honor — this
     generalizes [RFC-033](#rfc-033--an-unacceptable-subscribe-must-be-answered-never-silently-dropped).1 from SUBSCRIBE to the whole surface.
  2. A client that cannot accept a declared blob (`total_bytes` over its cap)
     MUST GOODBYE with new code `BLOB_REFUSED` rather than idle in a
     half-session; hubs SHOULD log it with the declared size.
  3. A HELLO carrying a token field that is PRESENT but malformed (wrong
     length/type) is NACK'd `UNAUTHORIZED` — never silently demoted.
     Tokenless HELLO keeps its legitimate watch-tier path; only present-but-
     broken credentials become loud.
  4. New GOODBYE code `IDLE_REAPED`, distinct from `DEADMAN_TIMEOUT`, so a
     motion-safety timeout is never confused with housekeeping.
- **Compatibility:** Two additive registry codes + normative text + small hub
  behavior changes. Clients ignoring the new codes see today's behavior.

---

## RFC-040 — Spec says what the reference implementation knows (editorial batch)

- **Status:** **LANDED (2026-07-27)** — spec text for all four rules (frame-
  header channel table, WS subprotocol-echo MUST, ECHO key-completeness,
  role cardinality). Zero wire numbers, as designed.
- **Origin:** Grievance sweep 2026-07-27, receipts inline.
- **Proposed change:**
  1. **Frame-header channel table.** Which frame types carry
     `header.channel == 0` vs a target channel id is normative routing that
     exists only in the reference implementation
     (`tools/valence_probe.py:33-41`: *"confirmed against the reference C++
     impl, not spelled out explicitly in SPEC.md prose"*). SPEC §4 gains the
     per-frame-type table.
  2. **WS subprotocol selection is an obligation.** §13.2 names `valence.v1`
     but never says the server MUST perform RFC 6455 selection and echo it —
     two independent WS libraries (firmware's vendored ESP32Async patch, the
     sim's IXWebSocket patch) had to be patched because strict clients
     hard-fail without the echo. One MUST sentence.
  3. **ECHO key-completeness.** ECHO carries every key from the intent's value
     map that the hub applied; a key ABSENT from the ECHO means NOT applied,
     and clients MUST fall back to reported truth for it
     (`webui/src/model/shadow.svelte.js:114` already behaves this way —
     codify it so "silently accepted" and "silently ignored" are
     distinguishable on every hub).
  4. **Role cardinality.** A registered role SHOULD appear on at most one
     field per catalog; a client meeting duplicates binds the first in
     catalog order, deterministically (`webui/src/model/roles.js:115` already
     does; make the tiebreak conformant rather than client-local).
- **Compatibility:** Editorial + conformance notes. No wire change anywhere.

---

## RFC-041 — A role vocabulary for the machine's physical travel extent

- **Status:** Draft.
- **Origin:** WebUI grievance sweep, 2026-07-27 — building a generic rail
  widget against fw 2.1.76's `machine-config` channel. `window.min`/
  `window.max` ([RFC-032](#rfc-032--command-and-telemetrytarget-make-commanded-motion-discoverable)-era roles) were the only candidates available and
  neither is the right fact.
- **Problem:** A rail widget needs to know how long the machine's travel
  actually is, to draw a rail at the right scale and to make a successful
  home visibly change the drawn extent. The obvious candidates both fail:
  - `window.min`/`window.max` carry `hasMin`/`hasMax` catalog annotations —
    but those bound the LEGAL VALUE of the window SETTING itself (the
    operator may set the window edges anywhere in `[min.min, max.max]`), not
    the rail's physical length. On the reference device, `window.max`'s own
    `max` is a protocol-wide ceiling (2000mm) while the physical rail this
    unit ships on is ~500mm — a generic client using the window fields' own
    bounds draws a rail four times too long, and homing (which changes the
    machine's IDEA of its travel, never the window setting's legal range)
    changes nothing about that drawing. This is a real, reported symptom:
    "the window doesn't scale to the measured value after homing."
  - The device separately publishes exactly the two facts that WOULD answer
    this (`max_rail`, the configured homing-search ceiling now a real
    setting per the fw 2.1.76 operator ruling; `measured_stroke`, the
    read-only distance sensorless homing actually measured this session,
    zero until a successful home) — but neither carries a role, so a generic
    client has no portable way to find them. Hardcoding either field name is
    exactly the device-knowledge leak `test/check-device-knowledge.mjs`
    exists to catch; this RFC is the alternative to hardcoding it anyway.
- **Proposed change:** register a small `geometry.*` role family:
  - `geometry.max_travel` — the configured ceiling on physical travel (what
    this device calls `max_rail`): a length, in the tagged field's own unit,
    measured from the low end of travel. Typically a writable setting, but
    the role does not require that — a hub that hardcodes its rail length
    into a read-only field may tag it too.
  - `geometry.measured_travel` — the length the machine's own homing
    procedure most recently measured this session, read-only, 0 (or absent)
    before a valid home. Ground truth, not configuration.
  - A client resolving "how long is this rail" prefers
    `geometry.measured_travel` when it reports a positive value (a real
    measurement outranks a configured guess), falls back to
    `geometry.max_travel`, and only then to whatever static bound the
    window/position fields themselves carry. Both roles are OPTIONAL on any
    hero claim that uses them — a hub that tags neither keeps today's
    (imperfect but pre-existing) behavior exactly, per the "opportunities,
    never requirements" doctrine (`model/roles.js`).
- **Compatibility:** Additive vocabulary only, no wire change. Absent roles
  keep today's behavior (rail widget falls back to the window fields' own
  `min`/`max` catalog bounds, which is what it already does). The reference
  webui client implements the role BINDING now (`model/roles.js`,
  `ui/heroes.js`, `RailWidget.svelte`'s `hi` derivation) so it lights up the
  moment `ValenceCatalog.h` tags `max_rail`/`measured_stroke` with these
  roles.
  **UPDATE (fw 2.1.77, firmware-side agent, same day):** the firmware-side
  tagging described above as "not yet done" is done — `registry.yaml`
  gained both roles verbatim (names match this entry exactly, discovered
  independently rather than coordinated), `max_rail` and `measured_stroke`
  on 0x1000 carry `roles::geometry_max_travel` /
  `roles::geometry_measured_travel`, and `test_valence_devicecatalog`
  covers the tags (registered-role allowlist, discoverable-and-unique,
  round-trip). Status line left at Draft — landing the RFC itself is a
  batch-review call, not this agent's to make — but both halves of the
  ecosystem now agree on the wire vocabulary.

---

## RFC-042 — Session staleness: separate "the session ends" from "motion stops"

- **Status:** **Landed (v1.0), 2026-07-27 (Phase D).** `HubSessionState` gains
  `STALE` (library-internal, `session.hpp`). Silence past either liveness
  regime (§6.6) — the deadman for a source-owning session, idle reaping
  otherwise — now marks the session STALE via a shared `Hub::markStale()`
  (releases every owned source unconditionally, latching nothing per
  [RFC-045](#rfc-045--retire-deadman-as-safety-session-liveness-is-bookkeeping-not-motion-control)) instead of calling `teardownSession()`; the slot, `session_id`,
  subs, publish grants, intent ring, and readiness are all RETAINED. A THIRD
  trigger from this RFC's own design table is also implemented: `detachTransport()`
  (an out-of-band transport loss) now marks STALE too, additionally resetting
  the per-slot mid-flight state (pending knock, AUTH nonce, sign job, blob
  cursor) that [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops)'s own "kept while stale" table scopes to "if the
  transport itself is still attached" — which it plainly is not on a confirmed
  transport loss. `DEADMAN_TIMEOUT`/`IDLE_REAPED` stay registered but the
  reference hub no longer emits either for silence. Two new `session_event_kinds`
  (4 `session_stale`, 5 `session_resumed`) and one new `nack_codes` entry
  (`0x010D SLOT_RECLAIMED`) were added to `registry.yaml` and regenerated
  per the spec-gap ritual before implementation, exactly as this RFC's own
  wire-additions list named them.
  **Reattach (path B):** `Hub::handleReattach()` — a fresh HELLO naming a
  STALE session's `instance_id` (`handleHello`'s duplicate-identity branch)
  migrates identity + grants verbatim onto the new transport's slot (a
  member-wise copy from an existing object, never `*this = T{}` — TRAPS T1),
  re-derives role from the presented token exactly as any HELLO, and answers
  with a WELCOME carrying the SAME `session_id` and the RETAINED grants
  (re-armed for push purposes only, per this RFC's §4) — never a
  renegotiation from the reattaching HELLO's own wishes. The vacated slot is
  freed WITHOUT running teardown's ownership-release/`onSessionLeft` (a
  migration is not a session loss). A duplicate HELLO against a LIVE session
  is unchanged (still evicts). **Path A** (same-transport revival) is
  `Hub::reviveIfStale()`, called from `pumpSlot()` before dispatch on every
  frame — a PING is enough.
  **Slot-pressure eviction (item 5):** `Hub::findEvictableStale()` (lowest
  access tier first, tie-break longest continuously stale via `staleSinceMs`
  and `util/serial_arithmetic.hpp`'s `timeDelta`) runs inside `handleHello`'s
  BUSY check before NACKing; a reclaimed session gets a best-effort GOODBYE
  `SLOT_RECLAIMED` then a genuine `teardownSession()` (this really is an
  ending). A LIVE session is never evicted for pressure.
  **Ambiguity resolved per the phase brief:** the general §6.3/[RFC-046](#rfc-046--ble-primary-discovery-udp-probe-and-reply-and-cross-transport-migration)
  cross-BINDING-TYPE migration (e.g. a BLE-to-WS hop) is NOT implemented —
  this reference hub has only one transport binding (WS), so it cannot
  distinguish "the same device on a new socket" from "a genuine second
  claimant" the way §6.3's own text requires for that broader case; per its
  own MAY-fallback clause the hub continues to apply the duplicate-identity
  eviction rule there. Only the [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops) STALE-instance_id case (unambiguous:
  a STALE session is never a live competing claimant) is implemented.
  Tests: `test/native/test_valence_staleness/test_main.cpp` (STALE-01..04)
  plus rewritten expectations in `test_valence_safety` (S-05/S-06, the two
  "M4a" [RFC-022](#rfc-022--registry-hygiene-omnibus).3 cases), `test_valence_m3b` (MB-10/11), `test_valence_m4b`
  (M4B-05), `test_valence_m4c` (M4C-11), and `test_valence_streamingress`
  (SI-08/SI-15). Verified: `pio test -e native`, all suites, exit 0.
- **Origin:** Operator requirement, 2026-07-27, verbatim: *"clients, even the
  webui, seem to just die sometimes. A client should never randomly die. If a
  client is not responding, they get marked stale. Any new clients kick out
  the lowest access tier stale client, but their slot and privilege is
  retained until then. You should never have to have a client reconnect just
  because you alt tabbed or locked your screen."* Grounded in a structural
  fact, not just a complaint: browsers throttle a backgrounded tab's timers
  to roughly one callback per **minute**; the deadman window is negotiable
  ([RFC-038](#rfc-038--client-negotiated-deadman-window)) but hard-clamped to `[deadman_min_ms, deadman_max_ms]` =
  **250–5000 ms**, and idle reaping ([RFC-024](#rfc-024--idle-session-reaping-for-non-owning-sessions)) fires at
  `idle_reap_multiplier(3) x ping_interval_idle_ms(1000)` = **3000 ms**. No
  legal value on either axis can survive a single throttle interval — **there
  is no way to configure this problem away**, which is why the reference
  WebUI carries a `visibilitychange` reconnect workaround (a symptom, patched
  around the actual defect, not a fix). Compounding it: `kHubMaxSessions` is
  **4** (`hub.hpp:51`, a conformance floor) — on a household machine with two
  people each holding a phone and a browser tab, four "just dozing" sessions
  is not a hypothetical, it is Tuesday.
- **Problem:** Today, silence past either liveness regime (§6.6) — the
  deadman for a source-owning session, idle reaping for everyone else — runs
  `teardownSession()` (`hub_impl.hpp:3201`) unconditionally: the slot resets
  to `FREE`, `session_id` is discarded, every subscription/publish grant is
  dropped, the intent idempotency ring dies, and (§11.4) any owned motion
  source is released through `releaseSessionSources()`. Two genuinely
  different concerns are welded into that one function call:
  1. **Motion needs to stop being unsupervised** — the actual safety half of
     §11.3.
  2. **The session needs to be destroyed** — slot freed, identity forgotten,
     grants revoked — which is a *lifecycle* decision, not a safety one, and
     is what forces a client back through full HELLO → WELCOME → catalog
     SYNC → re-SUBSCRIBE just because it went quiet for the length of one
     browser paint-throttle interval.

  Nothing in §6.6, §11.3, or the [RFC-024](#rfc-024--idle-session-reaping-for-non-owning-sessions)/[RFC-038](#rfc-038--client-negotiated-deadman-window)/[RFC-039](#rfc-039--every-refusal-is-answered-rfc-033s-principle-generalized) disposition
  distinguishes these. A browser tab losing its foreground status and a phone
  genuinely leaving the building produce *identical* hub behavior today, even
  though only one of them is actually gone.
- **Corrected premise — the deadman is not a safety mechanism (read this
  before the proposed change):** An earlier draft of this RFC argued that
  motion "must still halt" when a source-owning session goes silent, and
  treated that as non-negotiable. The operator's correction, verbatim: *"a
  client going silent isn't outputting motion! they're mutually exclusive."*
  That is simply true, and it dissolves the premise:
  - **The machine only moves when commanded.** Every motion source on this
    hub is one of two shapes, and a silent client cannot sustain either:
    - **Initiator-bound / command-driven** — `move` (MANUAL, a single bounded
      point-to-point plan that completes and holds on its own),
      `motion-input`/`motion-segment` (TCODE_STREAM, whose planner already
      brakes to rest with no external help — Valence Drive's DOCTRINE.md §8:
      *"plan ending still-moving with no fresh command → one-time
      velocity-interface brake-to-rest [SETTLE]"* — and whose segment commands are individually
      time-bounded to begin with, §5.4/§9.2). Silence from the owning session
      does not risk continued motion for either: there is no next command to
      execute, so the machine runs out of things to do and stops, by
      construction, with no hub intervention required.
    - **Hub-autonomous** — the pattern generator (`MotionSource::PATTERN`),
      which already has `SourceLossPolicy::Continue`
      (`ValenceHubService.cpp:867`) precisely because it runs *on the hub*,
      independent of the client that pressed start.
  - **Operator ruling on the one real nuance (2026-07-27), stated plainly
    rather than left open:** *"For now, motion started on the machine stays
    on the machine. We will discuss how that changes in the future."*
    Generator-driven motion is a **machine-level mode**, not tied to the
    liveness of whoever started it. A session going stale, or being evicted,
    does **not** stop it. The recourse is the safety channel: `stop`/`estop`
    are role-exempt ([RFC-025](#rfc-025--safety-semantics-completion-incl-overridebypass-ruling)b) — **any** connected session, including a bare
    `watch`-tier viewer, can halt it. This RFC deliberately does **not**
    couple machine-level motion modes to session liveness. Recorded as a
    decision made now and flagged for revisit, not an oversight.
  - **Conclusion:** there is no motion case, on this hub, that requires the
    deadman to force a stop. Command-driven sources are already
    self-limiting; the one autonomous source is deliberately
    session-independent. **The deadman's job is liveness and slot
    management. It has no safety job left to do**, and this RFC stops
    pretending it does.
- **Proposed change:**
  1. **A third session lifecycle state: `STALE`**, sitting between `LIVE` and
     `CLOSED` in `HubSessionState` (`session.hpp:29`). A session enters
     `STALE` instead of being torn down on exactly the triggers that today
     call `teardownSession()` for silence or connectivity loss:

     | Trigger | Window (unchanged from today) | Today | This RFC |
     |---|---|---|---|
     | Source-owning session, no frame received | `deadman_ms` ([RFC-038](#rfc-038--client-negotiated-deadman-window), 250–5000, default 600) | `pumpDeadman()`: GOODBYE `DEADMAN_TIMEOUT`, teardown, source loss policy runs | Goes `STALE`. Owned sources released (see below). No GOODBYE — staleness is not termination. |
     | Non-owning session, no frame received | `idle_reap_multiplier(3) x ping_interval_idle_ms(1000)` = 3000 ms | `pumpIdleReap()`: GOODBYE `IDLE_REAPED`, teardown | Goes `STALE`. Nothing owned to release. |
     | Transport reports closed/errored out of band | immediate | teardown | Goes `STALE` immediately — the case that matters most for a genuine WiFi blip, and it is *detected*, not timed out |

     **Unaffected on purpose:** a session that never reaches `LIVE` (stuck in
     `SYNCING`/`GRANTED`) keeps today's `READY_TIMEOUT` ([RFC-015](#rfc-015--syncing-order-catalog-completes-before-retained-state)) — there is
     no partially-adopted state worth preserving, and that mechanism already
     works. Voluntary `GOODBYE`, administrative eviction (§12.7), and a
     duplicate-`instance_id` `HELLO` arriving while the existing session is
     still `LIVE` (a genuine identity conflict, not a resumption) all remain
     hard, immediate destruction, exactly as today (§6.9's teardown
     equivalence rule is unchanged for these four doors).
  2. **Ownership release, decoupled from forced stop.** On the `STALE`
     transition, the hub releases every motion source the session owned —
     unconditionally and immediately, exactly like today's §11.4 release, so
     another session may claim them (`control-owner`, 0x0004, updates
     exactly as it does today — free, no change needed there). What changes:
     **this release no longer runs the `SourceLossPolicy::Stop` branch.** No
     source is halted, and the `safety` snapshot is not latched, *by virtue
     of its owner going silent* — per the corrected premise above, nothing on
     this hub needs that, and forcing it converts a graceful, planner-owned
     settle into an operator-visible `STOP` edge (`stop_latched`/
     `stop_cleared`, auto-cleared once a resuming stream's first accepted
     bundle lands per the existing SI-15 fix — but visible, and spurious, in
     the meantime) for a machine that was never actually out of control.

     Concretely: `releaseSessionSources()`'s `reason=3` path
     (deadman/staleness) becomes a plain release — call
     `_delegate.onSourceOwnership(source, 0, reason)` for each owned source
     and stop there. `reason=4` (voluntary/administrative/duplicate/
     slot-reuse teardown — genuine destruction) is **unchanged**, and still
     runs the full `Stop`-vs-`Continue` dispatch. This is a deliberate scope
     boundary, not an oversight: whether a *destroyed* session's sources
     should also skip the forced-stop dispatch is the same argument extended
     further, but it is a broader change (touches §6.9's "behaviorally
     identical" invariant across all six teardown doors, and the firmware's
     own `ValenceDriveHubDelegate::sourcePolicy()` choice of `Stop` for
     `MANUAL`/`TCODE_STREAM`) that deserves its own review rather than riding
     in on a session-lifecycle RFC. **Named follow-up, not part of this
     RFC:** revisit whether `MANUAL`/`TCODE_STREAM` need
     `SourceLossPolicy::Stop` at all on *any* teardown path, now that SETTLE
     exists. Until that lands, `Stop` still fires exactly as today on the
     four unaffected doors.

     **Honest side effect worth stating outright:** `safety_causes::deadman`
     (registry value 1) is, today, produced by exactly the code path this
     RFC removes. After this RFC, no reference code path emits it —
     `MANUAL`/`TCODE_STREAM` never reach the `Stop` branch via staleness
     anymore, and the four still-hard doors tag their releases
     `session_loss` (4), same as today. The registry value stays defined (a
     hub with a source whose `sourcePolicy()` legitimately needs
     stop-on-silence would still produce it) but the reference firmware
     orphans it. Flagged rather than silently letting a documented enum value
     go dark.
  3. **Retain / release, enumerated.** Everything not listed under Release
     stays exactly as it was the instant before staleness — this list is
     deliberately short:

     | Kept (unconditionally, for as long as the session is stale) | Released (immediately, at the moment of staleness) |
     |---|---|
     | Slot + `session_id` | Ownership of every motion source held (see above) |
     | `instance_id`, access tier (`role`), client identity (`clientKind`/`clientName`/`clientVer`/`presentationMode`) | "Active source" designation (implied by ownership release) |
     | Subscription grants (`subs`) — STATE/EVENT/STREAM h2c, at their negotiated rate/priority | — nothing else. |
     | Publish grants (`publishGrants`) — STREAM c2h rate/burst records | |
     | Intent idempotency ring (`intentRing`, §9.3) — a client that sent an intent right before going stale and never saw the ECHO gets the idempotent replay on resume, not a duplicate apply | |
     | Ingress rate-limiter state — token buckets keep refilling; a returning session is not penalized for having been away | |
     | Catalog readiness (`ready`, `readyEtagMismatch`) — no re-SYNC, no catalog refetch | |
     | Negotiated `deadmanMs` ([RFC-038](#rfc-038--client-negotiated-deadman-window)) | |
     | Bounded event queue (`events`) — keeps accepting best-effort, drop-oldest, exactly like a slow consumer | |
     | AUTH/pending-blob/pending-knock state, **if the transport itself is still attached** (resumption path A below); reset on true reattach (path B), since it was mid-flight against a socket that no longer exists | |

     A stale session costs the hub **exactly as much as a live one** — full
     `HubSession` + `Slot` footprint, unreduced (the struct is large enough
     that an earlier field bug blew an 8 KB task stack copying one, per
     Valence Drive's TRAPS.md field-bug ledger). Staleness is not a compression scheme; it
     is a promise not to reclaim something already paid for, made *only* on
     the belief the owner might come back. That belief is exactly what the
     eviction rule below exists to bound.
  4. **Resumption — two paths, neither a full HELLO renegotiation:**
     - **(A) Same-transport revival — the dominant, targeted case.** The
       backgrounded-tab and locked-screen scenarios the operator named do
       **not** close the underlying socket; the OS/browser only throttles JS
       timers, so the transport a stale session was attached to is usually
       still perfectly good. The instant the hub observes **any** frame on
       that transport again (a `PING` is enough — nothing new is required of
       the client), it flips the session back to `LIVE`. No `HELLO`, no
       `SUBSCRIBE`, no catalog fetch: the grants never left.
     - **(B) Transport re-establishment.** If the socket genuinely died
       (sleep, a real network drop), the client has no choice but to open a
       new transport and speak `HELLO` — that much is a framing-layer
       necessity, not a protocol design choice. What changes here: today,
       `handleHello()`'s duplicate-`instance_id` check (`hub_impl.hpp:362`)
       *always* evicts-and-recreates. This RFC narrows that: if the existing
       session for that `instance_id` is `STALE` (not `LIVE`), the hub
       **reattaches** the new transport to the existing slot instead — same
       `session_id`, same grants, role **re-derived from the token exactly
       as any HELLO does** (so a revoked credential is correctly downgraded,
       and an unrevoked one reproduces the identical role it already had,
       cheaply). A `WELCOME` still goes out (a `HELLO` always gets one), but
       it is answering a reattach, not a fresh negotiation — no `BUSY`
       pressure is spent (this is not new capacity, it is the same slot),
       and the catalog/readiness gate is already satisfied because `ready`
       was retained. **A duplicate `HELLO` against a `LIVE` session is
       unchanged** — that is a real identity conflict (two live claimants),
       not a resumption, and still evicts the incumbent as today.

     Either path: **grant reacquisition is not control reacquisition**,
     unchanged from §6.8 — a resumed session does not silently reclaim any
     source it used to own; it issues a fresh control-taking intent/stream
     exactly as a live session would, to take over from whoever (if anyone)
     picked the source up while it was stale.

     **What a resuming client sees, since so much may have changed while it
     was away:** resumption is treated as a fresh grant for **push purposes
     only** (not renegotiated) — every one of the session's existing STATE
     subscriptions gets the §9.1/§10.4-row-3 "first push after grant, never
     shed" treatment again on the `LIVE` transition. This is reused
     machinery, not new machinery, and it answers every version of "what did
     I miss":
     - **`cfg_gen`/config values:** the resumption push carries current
       values; any precondition-bearing intent the client had in flight is
       handled exactly as an ordinary reconnect already handles it (§6.8:
       gone, reconciled against the fresh snapshot, never blind-
       retransmitted).
     - **Catalog etag:** unaffected by staleness specifically — a
       mid-session catalog change is already signaled to every subscriber
       via the `catalog` STATE channel (§8.6); a session that was stale the
       whole time still held (and, per the table above, retained) that
       channel's grant, so it learns of a changed etag the same way a
       session that was live the whole time would. No special case needed.
     - **A latched e-stop:** `safety` is `critical` priority and retained;
       the resumption push includes its current value, so a resumed
       client's very first frame back is the true, current safety state —
       ground-truth doctrine holds through a staleness gap exactly as it
       holds through any reconnect.
  5. **Eviction — only under slot pressure, only among the stale.** A `HELLO`
     that would otherwise get `BUSY` (`occupiedCount() >= kHubMaxSessions`,
     today 4) instead first scans for a `STALE` session to reclaim:
     - Eligible: `STALE` sessions only. **A `LIVE` session is never evicted
       to make room for a new one**, full stop — the existing
       duplicate-`instance_id` mechanism is the only thing that ever
       displaces a `LIVE` session, and that requires matching identity, not
       mere pressure.
     - Choice: **lowest access tier first** (`watch` < `control` <
       `configure`); tie-break **longest continuously stale** (earliest
       staleness timestamp loses its slot first). This needs one new field,
       `staleSinceMs`, set when a session enters `STALE` — the same field
       also underwrites any future outer bound (open question below).
     - If none is eligible: unchanged — `NACK BUSY` with `retry_after_ms`,
       exactly as today.
     - The evicted session gets a best-effort `GOODBYE` (it may well not
       arrive — it was stale for a reason) with a **new** code,
       `SLOT_RECLAIMED` (0x010D): distinguishable from `SESSION_EVICTED`
       (admin/slow-consumer) and from the now-orphaned
       `DEADMAN_TIMEOUT`/`IDLE_REAPED`, for exactly the reason [RFC-039](#rfc-039--every-refusal-is-answered-rfc-033s-principle-generalized)
       registered `IDLE_REAPED` in the first place — an observer needs to
       tell "your slot was needed" apart from every other reason a session
       ends.
     - **Why only 4 slots makes this load-bearing, not decorative:**
       `kHubMaxSessions` is a conformance floor of 4. Under this RFC,
       staleness is intentionally unbounded in time (see below) — so on a
       real household machine, a phone-in-pocket plus a laptop with a
       locked screen plus a second person's equivalent pair is *four
       stale-but-not-dead sessions*, and the fifth connection attempt is the
       normal case this eviction rule exists for, not an edge case.
  6. **Observability — additive, does not depend on [RFC-018](#rfc-018--session-roster--admin-eviction).** Two new
     kinds on the existing spec-core `session-events` channel (0x0007,
     already implemented, kinds 1–3 already registered): `4 =
     session_stale`, `5 = session_resumed`, body carrying the affected
     `session_id` (same shape as the existing `takeover`/`session_joined`
     kinds). This is enough to see staleness happen on any hub today,
     without waiting on [RFC-018](#rfc-018--session-roster--admin-eviction)'s `session-roster` (0x0002, still deferred
     per the disposition table). It composes cleanly with that roster if/when
     it lands: a **persistent** stale bit belongs in the roster's per-slot
     `flags` byte (a level, matching what a roster IS), while the event pair
     above is the **edge** (an observer watching only for transitions
     doesn't want to poll a roster for them). This RFC does not depend on
     [RFC-018](#rfc-018--session-roster--admin-eviction); [RFC-018](#rfc-018--session-roster--admin-eviction) would be strictly better with this RFC already landed.
- **Two questions answered but left as the operator's call, stated so no
  future reader thinks they were overlooked:**
  1. **How long may a session stay stale?** This RFC proposes **no
     independent outer bound** — staleness lasts until either resumption or
     slot-pressure eviction, by design: any fixed cap is just a slower
     deadman with the identical browser-throttling failure mode this RFC
     exists to remove (a laptop asleep for the weekend is indistinguishable,
     from a timer's perspective, from a laptop that alt-tabbed ten seconds
     ago). The eviction rule above is the only pressure release, and with
     only 4 slots it fires often enough in practice to matter. If the
     operator wants a hard ceiling anyway — most plausibly scoped to
     `configure`-tier sessions specifically, for the security reason below —
     that is a deliberate, separate policy knob this RFC leaves open rather
     than guesses at.
  2. **Security — does this widen the trust model?** Yes, honestly, and it
     should be said plainly rather than glossed. Before this RFC, a
     `configure` session that went dark was destroyed within 600 ms (if it
     happened to be driving motion) or 3 s (otherwise) — so a stolen or lost
     device's standing access lapsed quickly on its own. After this RFC, the
     identical scenario the operator explicitly asked for — *"you should
     never have to reconnect just because you locked your screen"* — means
     an already-authenticated, still-open browser tab on a **locked** laptop
     stays a live `configure` session indefinitely, and unlocking the laptop
     resumes it with **zero additional authorization check**, because that
     is precisely the case path (A) is built to make invisible. This is not
     a new hole in *who can use the credential* — the bearer token is the
     credential either way, and reattachment (path B) still re-derives role
     from it, so a *different* claimant gains nothing new. It is a real
     widening of *how long a credential already in someone's hand keeps
     working after the legitimate holder stops actively proving it's still
     them*. That trade-off is exactly what the operator asked for, so this
     RFC makes it — but names it, rather than letting it be discovered later
     as a surprise.
- **Compatibility:** Internal hub-lifecycle behavior change — no wire-format
  break for existing clients; a client that never goes silent for long
  enough to matter behaves identically to today. Wire-visible additions, all
  additive: `session_event_kinds` 4/5 on the existing 0x0007 channel; one new
  `goodbye_codes`/`nack_codes` entry `SLOT_RECLAIMED` (0x010D).
  `HubSessionState` gains `STALE` (library-internal enum, not itself
  wire-visible). `DEADMAN_TIMEOUT` and `IDLE_REAPED` remain registered but
  are no longer emitted by the reference hub for the triggers named above —
  they stay reachable for a hub/policy combination that still needs to
  terminate outright on silence. `handleHello()`'s duplicate-`instance_id`
  branch (`hub_impl.hpp:362`) gains a reattach-if-stale case; a `HELLO`
  against a `LIVE` duplicate is unchanged. Reference implementation touch
  points: `HubSessionState` (`session.hpp:29`), `Hub::pumpDeadman` /
  `Hub::pumpIdleReap` / `Hub::releaseSessionSources` / `Hub::teardownSession`
  (`hub_impl.hpp:3041-3241`), `Hub::handleHello` (`hub_impl.hpp:349`).
  **Named follow-up, not part of this RFC:** whether
  `SourceLossPolicy::Stop` is still the right default for
  `MANUAL`/`TCODE_STREAM` on the four teardown doors this RFC leaves
  unchanged, now that VMotion's SETTLE makes the forced-halt redundant
  there too.

---

## RFC-043 — Transport conformance profiles: which bindings a hub must offer

**Status:** Landed (v1.0). SPEC §13.1 states both profiles verbatim (base profile: any single binding conforms; hardware hub profile: BLE GATT MUST, WS SHOULD, ESP-NOW supported-not-conformance-relevant), UI-serving-as-capability, and the BLE→WS auto-upgrade guidance; §17.1's hub conformance row cross-references it. Documentation-only, as proposed — no reference-hub gap beyond the one already named (BLE GATT `ITransport` unbuilt; SPEC §18-22).
**Origin:** Operator rulings 2026-07-27 (Phosphor design sessions; the ESP32
WROOM-D / OSSM-reference-PCB target).

- **Problem:** §13 defines transport bindings (WebSocket, ESP-NOW, BLE GATT,
  serial, in-process) but says nothing about which bindings a hub ought to
  OFFER. In practice every known hub target is ESP32-class silicon that
  physically has both WiFi and BLE radios, yet nothing in the spec
  discourages a hub from shipping WS-only — which strands BLE-only clients
  (phones without LAN access, browserless controllers) — or BLE-only where
  WS would serve LAN clients better. Separately, nothing says a hub need NOT
  serve a UI: a 4 MB-flash WROOM hub that cannot host web assets is a fully
  legitimate Valence citizen, and the spec should say so out loud.
- **Proposed change:** add conformance PROFILES to §13:
  - **Base profile** (sim, hosted, relay, in-process hubs): any single
    binding conforms — a hub with no radios is fully legitimate.
  - **Hardware hub profile** (embedded hubs on radio-bearing silicon):
    **BLE GATT is MUST** — the conformance floor, because it is the
    infrastructure-free path (no router, no credentials: phone-direct
    control, discovery, and the future WiFi-provisioning admin channel).
    **WebSocket is SHOULD**, expected on all ESP32-class hardware, as the
    preferred high-throughput path (dense streams, fat catalogs,
    multi-client). **ESP-NOW** is the supported ESP32-peer/remote binding —
    deliberately trivial to enable, not conformance-relevant, not actively
    developed or tested by the reference firmware.
  - Clients SHOULD auto-upgrade BLE→WS when both ends can (BLE is how you
    find and provision a machine; WS is how you stream to it).
  - Serving web assets (or any UI) is explicitly a hub CAPABILITY, never a
    conformance requirement — a UI-less hub is fully conformant, and
    clients MUST NOT assume the hub they talk to served them.
  All SHOULD/MUST language is availability policy — no wire change.
- **Compatibility:** documentation-only; no wire format, registry, or
  fixture impact. Reference-hub gap it names: the Valence Drive firmware
  currently implements only the WS binding (`ValenceAsyncWsTransport`); a
  BLE GATT `ITransport` is the named follow-up work. The legacy OSSM BLE
  masquerade service (`OssmBleService`, KinkyMakers-compat for OSSM
  Possum/XToys) is ruled END-OF-LIFE the same day and is NOT the BLE
  binding — Valence-over-BLE-GATT replaces it, it does not extend it.

---

## RFC-044 — Client onramp doctrine: TCode passthrough as a client-side adapter

**Status:** Draft — DEPRIORITIZED by operator (2026-07-27): "a later feature, parsed machine-side," a channel alongside segments and samples, not near-term work (`docs/canon/LEDGER.md`). This supersedes the posture-landed/channel-deferred disposition below: SPEC §9.6 still states the three-rung client onramp doctrine (TCode passthrough / native segments / native samples) as it was worded to match the 2026-07-27 correction, but this RFC does not carry Accepted or Landed status at v1.0.
**Origin:** Operator ruling 2026-07-27 (client-onramp calibration; supersedes
the "TCode pass-through DEFERRED post-MFP" disposition).

- **Problem:** the ecosystem strategy is to never force other firmwares' or
  clients' hands — Valence must win by being the easiest thing to
  implement. Most existing clients already generate TCode. Today their only
  path onto this machine is a legacy raw-TCode transport (serial/BLE NUS,
  §15.1), which contradicts "Valence is the only way in and out" and gives
  those clients none of Valence's session/safety/arbitration guarantees.
- **Proposed change:** define the three-rung CLIENT ONRAMP as explicit
  protocol posture. Rung 1, TCode passthrough, is a CLIENT-SIDE ADAPTER: a
  small reference library — a Phosphor kernel module first, a C# helper for
  MFP-class apps later — consumes the TCode a client already generates and
  translates it locally into native segments or samples before anything
  reaches the wire. Rung 2: native motion-segment (0x2101) — the better
  path. Rung 3: native motion-input samples (0x2100) — the dense-streaming
  path. Passthrough is CRIMINALLY easy by design; the native rungs are where
  clients graduate.
- **Compatibility:** none at the wire level. The adapter is entirely
  client-side, so there is no registered channel and nothing for the hub to
  implement. §15.1's legacy text-edge synthetic-session mechanism is
  unrelated and unaffected: it remains the only place a hub itself ever sees
  TCode bytes, and only because they arrive over a transport (serial,
  BLE-NUS) that was never a Valence frame to begin with.

**CORRECTION (operator, 2026-07-27):** the paragraphs above, and SPEC's
first-cut onramp text, originally described rung 1 as a hub-parsed
TCode-passthrough STREAM channel, with a named blocker — the TCodeParser
cross-task race (the parser lives on the transport tasks today; a
Valence-carried feed would arrive on the hub task). **That plan is
retracted, not merely deferred.** The hub NEVER parses TCode and there is
NO wire channel for it: the `0x2102 tcode-passthrough` reservation some
earlier CHANNEL-MAP.md/registry commentary carried is dropped, and
CHANNEL-MAP.md (regenerated, [RFC-047](#rfc-047--the-0xcdss-channel-allocation-grid-structure-over-arrival-order-history)) carries no such entry. Consequences:
the TCodeParser cross-task-race blocker is moot — not resolved, moot,
because a hub-side TCode parser no longer exists in any future plan; a
WROOM-class hub never needs to carry a TCode parser at all; and the
onramp's "criminally easy" promise is delivered exactly the same way
regardless — as a small reference adapter library, never as protocol
surface. SPEC §9.6's onramp paragraph is reworded to match (see SPEC.md).

---

## RFC-045 — Retire deadman-as-safety: session liveness is bookkeeping, not motion control

**Status:** Landed (v1.0). SPEC §11.3 rewritten: the deadman forces no stop for any command-driven source (settles on its own, per §9.6's closed motion surface), and a hub-autonomous source's behavior is an explicit device-catalog `on_disconnect: stop|continue` setting (default `stop`) rather than an implicit protocol behavior — no new frame, per the RFC's own instruction. §6.6's liveness table, §6.9's teardown equivalence rule, §6.8's reconnect text, §11.5's invariant 1, §12.7's `evict` bullet, the §3.2 worked narrative, and Appendix H's rationale entry are all reconciled to match — every "loss policy" mention in the document now reads consistently. `on_disconnect` is deliberately NOT a new registry field_role in this batch (no wire number was in the operator's allocation list for this RFC); it rides the ordinary settings metamodel as device-catalog data. SPEC §18-21 records the reference-firmware gap: the shipped pattern generator still behaves as unconditional `continue`, predating this RFC's default flip to `stop`. **Superseded in part by [RFC-048](#rfc-048--the-rendering-constitution-catalog-vocabulary-capability-interfaces-renderer-law) (2026-07-27):** `on_disconnect` is promoted to the registered `field_roles` entry `source.background_run` (bool, generalized to any autonomous source, not only PatternEngine) — see that entry's Compatibility note.
**Implementation landed, 2026-07-27 (Phase D).** `Hub::releaseSessionSources()` no longer runs any Stop-vs-Continue policy dispatch — the `if (pol == SourceLossPolicy::Stop) { ... }` branch (latch STOP + `onDeadmanStop()` + broadcast) is deleted outright; every release, from any of the (now seven, post-[RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops)) teardown/staleness doors, is `_delegate.onSourceOwnership(source, 0, reason)` and nothing else. `HubDelegate::sourcePolicy()`/`onDeadmanStop()` remain declared (frozen delegate interface, extended additively with a doc-comment note) but are never called by the reference hub. The STREAM-ingress "accepted bundle clears a latched STOP" workaround this RFC's own Problem section named (SI-15) is deleted from `Hub::handleStream()` — moot, not merely obsolete, since no source-loss path latches STOP any more for it to un-wedge; the separate, still-valid §11.1 rule ("an accepted source-mapped INTENT clears STOP") is unrelated and untouched in `handleIntent()`. `source.background_run` itself (the firmware delegate decision this RFC hands off to) is item 3 of this same Phase D pass — see the ledger/report for the channel choice. Verified: `pio test -e native`, all suites, exit 0 (SI-08/SI-15, S-05/S-06, and the M4a/M3b/M4b/M4c staleness rewrites all assert "nothing latches" directly).
**Origin:** Operator ruling 2026-07-27 — resolving [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops)'s own named
follow-up ("whether SourceLossPolicy::Stop is still the right default …
now that VMotion's SETTLE makes the forced-halt redundant").

- **Problem:** §11.3's source-loss policy latches a STOP when a streaming
  source dies or goes silent. That latch was load-bearing in the
  clocked-interpolator era, when a starved generator could plausibly keep
  commanding motion. Under VMotion the physics are different: absence of
  input IS the stopped state — a plan that ends with no fresh command
  settles to rest by construction. The latch now adds only friction (SI-15
  already had to make accepted STREAM bundles clear latched stops to
  un-wedge reconnect ergonomics) and implies a hazard that no longer
  exists. Operator: "any streaming client does not need latched or stop the
  machine — if the machine receives no input, it's already stopped."
- **Proposed change (expanded by the same-day calibration ruling —
  operator: "I don't see where the latch or deadman really makes sense; for
  it to be a genuine safety feature it would have to stop within 50–100 ms,
  which would just ruin any sense of stability"):** retire
  DEADMAN-AS-SAFETY wholesale. The honest decomposition:
  1. **Session liveness stays — as bookkeeping.** Silence detection, PING
     cadence, STALE marking, reattach, slot reclaim ([RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops)) are resource
     management and roster truth, not safety. Unchanged.
  2. **Source-loss forced-stop is REMOVED for all source classes.** No
     latch, no §11.3 Stop policy. A vanished streaming source leaves the
     engine to SETTLE — no input already IS the stopped state, by physics.
     The next granted source commands motion normally.
  3. **Autonomous sources get an explicit flag.** A source that generates
     its own motion (PatternEngine, future generators) is the one case
     where "controller died" ≠ "motion stops," so the policy becomes an
     operator-visible per-source setting: `on_disconnect: stop | continue`
     (continue = pattern runs in background, survives its client's death).
     Default `stop` (conservative, flippable). This replaces an implicit
     protocol behavior with an explicit, catalog-annotated choice — the
     honest version of the safety story.
  4. **Explicit stops unchanged.** 0x0005 estop/stop remain latched
     commands; operator-commanded stops are commands, not inferences.
- **Compatibility:** hub behavior change + one new wire item (the
  `on_disconnect` policy, likely a key on the publish grant or a settings
  channel field — registry addition, additive). SI-11/12/13 + SI-15
  expectations rewrite; SI-15's clear-on-accepted-bundle workaround
  dissolves. §6.5 liveness text survives; §11.3 loss-policy text is
  replaced by the flag model. Safety analysis: "unattended machine is at
  rest" holds via SETTLE (streaming) and via the default-stop flag
  (generators); what is removed is only the pretense that a ~600 ms
  reaction window was ever a safety mechanism.

---

## RFC-046 — BLE-primary discovery, UDP probe and reply, and cross-transport migration

**Status:** Landed (v1.0). Registry gains `ble_identity` (service/write/notify UUIDs), `ble_adv_flags` (pairing_window_open/ws_available), `udp_discovery` (port 22096/magic `VLNC`/reply rate limit), frame types `DISCOVER_PROBE` (0x1E) / `DISCOVER_REPLY` (0x1F), and WELCOME keys `ws_port` (46) / `ipv4` (47). SPEC §13.1 (profiles), §13.4 (BLE identity + advertising payload pinned), §13.7 (discovery doctrine restated), new §13.8 (UDP probe/reply), and §6.3 (transport migration + `ws_port`/`ipv4` documented) carry the normative text. Two decisions made without an explicit operator number and flagged for veto: (1) the UDP reply's `hub_id` field reuses the existing `boot_id` (u32) rather than a new identity primitive; (2) transport migration is specified against TODAY's session model (a `LIVE` duplicate-`instance_id` HELLO), with [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops)'s `STALE` case named as composing identically once that RFC lands — [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops) itself is NOT landed by this batch and remains Draft. No reference implementation exists yet (BLE `ITransport`, UDP responder); SPEC §18-22 records it. **[RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops) landed 2026-07-27 (Phase D)** — its `STALE` reattach case DOES compose exactly as this entry predicted (`Hub::handleReattach()` implements it for the same-binding-type case; the general cross-BINDING-TYPE migration this RFC describes remains unimplemented, since the reference hub still has only one binding).
**Origin:** Operator direction 2026-07-27 ("more robust discovery for
clients — mDNS works but isn't my pick; BLE discovery and upgrade path").
Companions: [RFC-043](#rfc-043--transport-conformance-profiles-which-bindings-a-hub-must-offer) (BLE GATT is the hardware-hub conformance floor),
[RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops) (reattach-by-instance_id), the sim's logged hub-identity spec gap,
and the 0x17 ESP-NOW BEACON precedent (per-binding discovery already exists
for the peer radio; this is the phone-facing twin).

- **Problem:** §13.4 defines the BLE GATT binding and §13.6 says to
  advertise "the service UUID with the hub name," but (1) no service/char
  UUIDs are pinned anywhere — every implementation would invent its own and
  clients couldn't scan for one known service; (2) a BLE-connected client
  has no in-band way to learn the hub's WebSocket endpoint, so the
  BLE→WS upgrade [RFC-043](#rfc-043--transport-conformance-profiles-which-bindings-a-hub-must-offer) assumes has no mechanism; (3) nothing defines what
  happens to the session when a client hops transports. mDNS remains the
  only WS-side discovery and it is the weakest link in real homes
  (multicast across mesh/consumer APs and Android is unreliable).
- **Proposed change:**
  1. **Registry pins the Valence BLE identity** (wire numbers, allocated
     at landing): ONE ecosystem-wide GATT service UUID + write(c2h) +
     notify(h2c) characteristic UUIDs. Every conformant BLE hub advertises
     the same service UUID; every client scans for exactly one thing.
  2. **Advertising payload** (≤31 B legacy adv budget): service UUID +
     shortened hub name (scan response carries the fuller name) + one flags
     byte: bit0 pairing-window-open (§13.6, existing), bit1 ws_available
     (the hub currently has a live IP + listening WS port).
  3. **In-band endpoint disclosure — the upgrade hop:** WELCOME gains keys
     (numbers at landing) `ws_port` + `ipv4` (0 = none), present on every
     binding but load-bearing over BLE: connect BLE → HELLO/WELCOME → read
     the WS endpoint → hop. Also closes the sim's hub-identity gap for
     WS-side clients (the same keys tell a WS client what the hub believes
     its own endpoint is).
  4. **Transport migration:** a HELLO arriving on a NEW transport with an
     instance_id matching a LIVE/STALE session is a MIGRATION — [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops)
     reattach semantics applied cross-transport: same session identity,
     grants/etag-skip renegotiated by the normal HELLO flow, the old
     binding torn down as a reattach (not a rude death — no loss-policy
     side effects). Clients SHOULD keep BLE bonded/known and auto-upgrade
     to WS whenever ws_available says so ([RFC-043](#rfc-043--transport-conformance-profiles-which-bindings-a-hub-must-offer) client behavior).
  5. **UDP probe — WS discovery for clients without BLE** (operator
     ruling, same day: non-BLE clients get the better option, not
     mDNS-as-consolation): a minimal broadcast probe/reply pair on a
     registry-pinned UDP port. Client broadcasts PROBE {magic, proto_ver,
     client nonce}; hub unicasts REPLY {magic, nonce echo, hub name,
     hub id, proto_ver, ws_port, fw version, catalog etag, flags
     (pairing-window bit — the 0x17 BEACON payload philosophy, plus
     endpoint)}. Read-only identity, no control surface, replies
     rate-limited (one per source per second) so a probe storm cannot
     load the hub. Plain sockets both ends — immune to the
     multicast/mesh-AP/Android failure modes that eat mDNS; ~trivial on
     AsyncUDP hub-side; lets the MFP plugin retire its hand-rolled DNS-SD
     query. Numbers (port, magic, frame ids) allocated in the registry at
     landing.
  6. **Discovery doctrine:** BLE advertisement is PRIMARY (physically
     present, no network required, works before provisioning). The UDP
     probe is the canonical WS-side discovery for LAN clients without BLE
     (desktop shells, MFP, Intiface). mDNS remains a free SHOULD for the
     one audience that can use nothing else (browsers resolving
     valence-drive.local). Manual IP always works.
- **Compatibility:** additive — new registry section (BLE identity UUIDs +
  UDP discovery port/magic/frames), two WELCOME keys, one advertising flags
  definition, migration semantics layered on [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops)'s existing reattach. No existing frame changes.
  Firmware follow-up it unblocks: the BLE GATT `ITransport` (NimBLE
  returns; single-task hub invariant preserved via the same
  callbacks-enqueue-on-foreign-task pattern the WS transport uses —
  TRAPS T5).

---

## RFC-047 — The 0xCDSS channel allocation grid: structure over arrival-order history

**Status:** Landed (v1.0) (operator-approved direction 2026-07-27 — "re-organize the
channel mapping; hex addresses don't stick in my mind"; batch-lands with
043-046). Registry `channel_id_ranges`' 0x0080-0x7FFF note now cites the 0xCDSS grid
convention (documented in full in CHANNEL-MAP.md, item 1 below — already built
in an earlier session) and reserves 0x7000-0x7FFF experimental/vendor, note-text
only per this RFC's own item 2 (the device renumber itself is a LATER phase).
Every `core_channels` entry gains `status: active`, except `0x0002 session-roster`
which gains `status: reserved` (item 3) — additive YAML metadata the registry
codegen already tolerates without changes. Item 4 (`tools/gen_channel_map.py`)
remains unbuilt; CHANNEL-MAP.md stays hand-maintained for now.

- **Problem:** device channel ids (0x0080-0x7FFF, hub-allocated) accrete in
  arrival order — ValenceDrive's own space interleaves STATE/STREAM/EVENT ids
  with no structure, so the numbers encode nothing but history and nobody
  can hold the map in their head. There is also no experimental space (a
  vendor prototyping a channel has nowhere collision-safe to play) and no
  lifecycle vocabulary in the registry (the session-roster
  "IMPLEMENTED"-lie incident had no field to catch it).
- **Proposed change:**
  1. **The 0xCDSS allocation grid** (RECOMMENDED convention for device
     space, normative for the reference firmware): class nibble
     (1=STATE 2=STREAM 3=INTENT 4=EVENT 5=STORE — class id + 1), domain
     nibble (device-chosen subsystem, declared via catalog groups), slot
     byte. Every digit answers a question; `0x2101` READS as
     STREAM-motion-01. `0x7000-0x7FFF` reserved experimental/vendor —
     never in a shipped catalog.
  2. **Valence Drive renumbers to the grid** (see docs/valence/
     CHANNEL-MAP.md for the full old→new table) — legal as a device
     catalog evolution while v1.0 is untagged; the frozen mini-catalog is
     unaffected. This is the LAST legal renumber; the grid exists so no
     future one is ever wanted.
  3. **Registry entries gain `status: active | reserved | retired`** —
     machine-checkable lifecycle so a reserved-but-unimplemented channel
     can never again be documented as live (the session-roster class of
     lie becomes a lint failure).
  4. **The human map is a generated artifact:** `tools/gen_channel_map.py`
     renders CHANNEL-MAP.md's tables from the registry + device catalog —
     documentation numbers are never typed by hand (same doctrine as the
     docs-site tables).
- **Compatibility:** device-space renumber = catalog etag bump + updates to
  the firmware `ch::` constants, sim, probe, MFP plugin, webui-js mirrors,
  devicecatalog test goldens, and a fixture re-capture. Core channels
  (0x0000-0x000E), frame types, CBOR keys: untouched. Registry `status`
  field is additive metadata (codegen emits it as comments only).

**Sub-slot convention, added 2026-07-28 (Phase C4, operator-stamped via the
rendered channel-grid visual):** the flat `SS` slot byte the allocation above
introduced is itself sub-divided into a **family nibble and a member
nibble** — `0xCDFM`, read digit by digit as class/domain/family/member. Slot
= `[family][member]`: **member 0 is always the family's master** (its own
STATE/roster channel, or the sole INTENT verb for a single-writer family),
and every non-zero member is a related channel within that family (a tuning
card, a modifier lane, a preset-store twin). The **mirror rule**: a channel
and its paired writer/twin across class bands share domain+family+member
exactly — `0x1120` kinetic-limits (STATE) and `0x3120` kinetic-set
(INTENT) are both domain=motion, family=2, member=0. **Family `0xF` is
admin/meta in every band** — `0x30F0` machine-admin (clear-fault, scan,
save, reboot) is the machine domain's admin family. **Named reserves** hold
a slot with no catalog entry behind it yet: `0x1011` battery, `0x1012`
thermal ([RFC-048](#rfc-048--the-rendering-constitution-catalog-vocabulary-capability-interfaces-renderer-law) capability interfaces). **Reserved domains** `3`
(auxiliary), `4` (playback), `5` (automation) are held for future
subsystems; domains `8`-`F` are parked for a future multi-axis convention.
Valence Drive's device catalog renumbered onto this convention (Phase C4;
`docs/valence/CHANNEL-MAP.md` carries the full old→new table and
`docs/valence/channel-grid.html` — now parsed live from
`ValenceCatalog.h` rather than hand-typed — visualizes it), and this really
is the last legal renumber: every family reserves 15 unused member slots
and every domain reserves unused families, so a new member of an existing
concept gets a numeric home without disturbing its neighbors.

---

## RFC-048 — The rendering constitution: catalog vocabulary, capability interfaces, renderer law

**Status:** Landed (v1.0). New normative companion [`RENDERING.md`](RENDERING.md)
carries the full UI/rendering constitution: the derivation chain (catalog →
category → rank → archetype → widget pattern → region → page), the three-tier
channel taxonomy + capability interfaces, and every frozen vocabulary as a
table with MUST/SHOULD language matched to the staging file's split. SPEC.md
gains §19 (Rendering) — minimal by design, establishing RENDERING.md as the
normative companion and stating the three-tier taxonomy, since channel
semantics belong in SPEC proper — plus updates to §6.1/§6.3 (the
`hub_instance_id` identity primitive) and §13.8 (the DISCOVER_REPLY
correction below). Registry gains eleven new frozen vocabulary sections
(`ui_categories` 14, `ui_ranks` 6, `value_aspects`/`value_scopes`/
`value_provenance` 6/3/3, `unit_ids` 23, `action_tags` 13, `ui_archetypes` 15
with machine-checkable `fallback:` compositions, `ui_regions` 5,
`renderer_classes` 3, `widget_patterns` 13 with `required: true` on
`axis-hero`/`pattern-panel`/`generator-advanced`) plus `identity_keys.5
hub_instance_id`. None of the eleven are wired onto a real catalog entry in
this landing — SPEC §18-23 records that plainly; wiring them is the next
catalog-evolution phase. *(Receipt 2026-10-01, rfc-6au: that phase has
happened. The reference catalog, Nucleus
`flagship_p4/src/hub/ValenceCatalog.h`, emits entry `category`/`rank` and
field `rank`/`unit_id`/`aspect`/`scope`/`provenance`; SPEC §18-23 is the
current record and [RFC-082](#rfc-082----one-home-for-the-rendering-wiring-state)
corrects §19.1, which still repeats the landing-time sentence.)* **The hub-identity fix (operator veto of an [RFC-046](#rfc-046--ble-primary-discovery-udp-probe-and-reply-and-cross-transport-migration)
decision, landed same batch):** `identity_keys` gains `5: hub_instance_id`
(u64, durable, NVS-persisted, generated once) and DISCOVER_REPLY (`0x1F`,
§13.8) is corrected to carry `hub_instance_id:u64` in place of its original
`hub_id`/`boot_id` (u32) field — [RFC-046](#rfc-046--ble-primary-discovery-udp-probe-and-reply-and-cross-transport-migration)'s own entry flagged this exact
decision for veto at landing, and this is that veto. Reply payload grows
72 → 76 bytes (+4, the `u32`→`u64` widening); `boot_id` is unchanged and
stays exactly where it already lived (`hub-status` STATE, WELCOME). **Riding
along, promoted from [RFC-045](#rfc-045--retire-deadman-as-safety-session-liveness-is-bookkeeping-not-motion-control):** `on_disconnect` becomes the registered
`field_roles` entry `source.background_run` (bool; false default = stop when
owning session ends, true = continue unattended), generalized to any
autonomous source rather than PatternEngine specifically, with its rendering
rules (co-located with the run control, confirm-gated to enable, a distinct
unattended-and-moving indicator) normative in RENDERING.md §10.1. `gen_registry_header.py`,
`gen_docs_tables.py`, and `gen_spec_pages.py` all updated and re-verified
`--check` clean against the new sections and the new SPEC §19.
**Origin:** Operator direction 2026-07-27 ("core channels should be
machine-unspecific; specify machine-specific and machine-agnostic channels
in the spec; a standardized set of UI-building rules — for a remote with an
OLED, a phone, a desktop, anything with a screen"), staged in full at
`docs/valence/[RFC-048](#rfc-048--the-rendering-constitution-catalog-vocabulary-capability-interfaces-renderer-law)-STAGING.md` and ratified clause-by-clause before this
landing; the `hub_instance_id` fix and the `source.background_run` promotion
are two additional same-day operator rulings folded into this batch.
**Problem:** (1) the spec had two channel tiers (protocol core,
device-defined) but no middle: nothing guaranteed that two different
linear-motion machines expose their axis the same way, so a client could
render any machine *correctly* but only machines it was hand-taught *well*;
(2) the catalog's UI vocabulary was partial (an `advanced` bit, `action`
tags) with no essentiality ladder, so a small-screen client had no way to
know which three things mattered and every renderer invented its own
triage; (3) renderer obligations (safety visibility, degraded-mode graying,
ground-truth adoption) were scattered across §8.5/§11.5/traces rather than
stated as one conformance list; (4) DISCOVER_REPLY's `hub_id` reused the
per-boot `boot_id`, which cannot deduplicate two hubs sharing a name across
a reboot — the field's entire job; (5) `on_disconnect` rode the settings
metamodel as unregistered device data, so a generic client could not find it
on an unmet hub without hardcoding a channel, the exact gap `command.*` and
`plan.*` were registered to close for other roles.
**Proposed change:** the full clause set is preserved verbatim in
`RENDERING.md` and this document is its index, not a duplicate:
  1. **Three-tier channel taxonomy** (SPEC §19.2, RENDERING.md §2.1): CORE /
     STANDARD / DEVICE, stated normatively, no frame or core-channel changes.
  2. **Well-known standard channels + two standardized capability
     interfaces** (RENDERING.md §2.2): `motion`/`power`/`odometer` minima,
     plus the **pattern generator** interface (`{running, select(+options),
     speed?, depth?, stroke?, sensation?}`) and the **advanced generator /
     fray-d shape** interface (master state + four modifier lanes + preset
     store/roster) — fray-d's shape is the community gold standard,
     standardized the way VMotion is the standard planner. Per-axis
     instancing and actuator-type vocabulary remain PARKED, with runway.
  3. **Two orthogonal catalog vocabulary axes** (RENDERING.md §3-4):
     `category` (WHERE, 14 ids + vendor range + the graceful-extension rule
     that renders any unrecognized id under `other`, never dropped — the
     structural valve that makes freezing the fourteen safe) and `rank` (HOW
     MUCH, six values, the `advanced` bit's migration).
  4. **Renderer classes** (RENDERING.md §12): `glance`/`handheld`/`full`
     project the SAME category tree, differing in projection and default
     surfacing, never in reachable content.
  4b. **The archetype vocabulary + interaction contracts** (RENDERING.md
     §8): fifteen archetypes, DERIVED by a normative decision table (channel
     class + field type + bounds + options + action tag → archetype; an
     explicit hint overrides), each carrying a mandatory fallback
     composition of frozen primitives. Universal contracts: pending →
     echo-confirmed visualization, gray-never-hide with reason, one unit
     table, behaviorally-described per-class projections.
  4b-ii. **Value-aspect vocabulary** (RENDERING.md §5): `aspect ×
     scope × provenance`, each frozen, with companion composition, reset
     linkage, and an honesty rule (never present a live value as a peak or
     vice versa; scope always unambiguous).
  4c. **Region/placement semantics** (RENDERING.md §9): four abstract
     regions plus one modal overlay, each WHAT-normative, geometry entirely
     the renderer author's craft.
  4d. **Page composition rules** (RENDERING.md §11): pages derived from the
     catalog, never designed per app; the same catalog yields the same page
     tree on every conformant client.
  4e. **Thirteen named widget patterns** (RENDERING.md §10), full recipes
     (composition + region + states + per-class projection); `axis-hero`,
     `pattern-panel`, and `generator-advanced` are REQUIRED on handheld/full.
  5. **Renderer laws, consolidated** (RENDERING.md §13): thirteen MUST rules,
     each earned by a documented field regression in the reference client;
     the Phosphor Tier-0 renderer is named the reference renderer.
  6. **The Vocabulary Completeness Doctrine** (RENDERING.md §14): every
     enumerable vocabulary is exhaustively enumerated pre-tag, frozen at
     v1.0, armed with an unknown-value degradation rule, and — the
     firmware-immortality rule — any post-tag addition must declare its
     fallback as a composition of frozen primitives, so a v1.0 client
     renders every future catalog forever, merely less richly.
  7. **The `hub_instance_id` identity fix** (§13.8, above): DISCOVER_REPLY's
     `hub_id` becomes a real durable identity instead of a per-boot alias.
  8. **The `source.background_run` promotion** (§11.3, above): `on_disconnect`
     becomes a registered field role, generalized beyond PatternEngine.
**Compatibility:** additive. New catalog vocabulary fields (`category`,
`rank`, aspects/scope/provenance, unit ids, archetype hints) ride the same
catalog evolution as the [RFC-047](#rfc-047--the-0xcdss-channel-allocation-grid-structure-over-arrival-order-history) renumber (one etag bump), whenever that
lands; `advanced`-bit migration mapped, not broken. Standard-channel minima
are SHOULD-level for existing hubs, MUST for hardware-hub-profile
conformance from v1.0-tag forward. No frame changes, no core-channel
changes except DISCOVER_REPLY's payload widening (item 7, a frame that
landed with zero implementations, so free). `source.background_run` is a
registry addition with no behavior change — [RFC-045](#rfc-045--retire-deadman-as-safety-session-liveness-is-bookkeeping-not-motion-control)'s semantics are
unchanged, only its discoverability is upgraded. The Completeness Doctrine's
fallback rule guarantees post-tag vocabulary additions never obligate any
shipped firmware or client.

## RFC-049 — Spec fresh-eyes panel omnibus: small normative fixes

**Status:** Landed (v1.0) — spec/registry side, for every sub-item. Hub
behavior is named **Phase D** per sub-item below and is NOT implemented by
this pass; this RFC lands the wire numbers and the normative text so Phase D
has something to implement against, exactly the spec-gap-ritual order.
**Origin:** the 15-reader spec fresh-eyes panel,
[`reviews/spec-panel-2026-07-27.md`](reviews/spec-panel-2026-07-27.md),
plus operator triage recorded in `docs/canon/LEDGER.md` ("Spec fresh-eyes
panel", 2026-07-27). Seven of the panel's eight "consistently hated" findings
are addressed here (the eighth, `source.background_run` being unshipped, is
exactly Phase D and needed no new spec work — LEDGER.md's own note).

- **Problem:** the panel converged hard on the spec's own core doctrines
  (shedding table 13/13, honesty clauses 12/13, closed motion surface
  12/13) while converging just as hard on a second pattern: a cluster of
  places where that same discipline — name the gap, pin the constant in the
  registry, make the fallback a deterministic table — had lapsed. Every
  finding below is the panel pointing the spec's own praised patterns back
  at a spot that didn't yet have them.
- **Proposed change**, one sub-item per finding:
  - **(a) `curve_family` `step` honesty.** Registry `curve_families` entry 3
    (`step`) gains `status: reserved` — number kept, never renumbered, but
    machine-checkably not actionable until a step renderer exists in the
    reference engine. SPEC §9.6 and §18-20 reworded to cite the status field
    instead of only prose. No wire change; a registry metadata addition the
    codegen already tolerates ([RFC-047](#rfc-047--the-0xcdss-channel-allocation-grid-structure-over-arrival-order-history) precedent).
  - **(b) Downgrade visibility.** New CBOR key 48 `requested_curve_family`,
    riding the same `publishes`/`granted_publishes` ENTRY map as the existing
    effective `curve_family` (45) — the client's original wish, echoed
    verbatim, so a downgrade is two present keys a client compares, not an
    inference from what it remembers sending. SPEC §9.6 gains one sentence.
    **Implementation: Phase D** (no reference hub emits key 48 yet).
  - **(c) H11's constant, pinned.** Registry `limits` gains
    `segment_handoff_k: 1.5` — was reference-implementation-only (the
    firmware's `boundHandoffVelocity` AND the MFP plugin's own
    Fritsch-Carlson limiter each hardcoded it independently), which the
    panel correctly called out as exactly the "no authoritative source for
    the clamping constant" failure the registry's own doctrine exists to
    prevent. SPEC §9.6 now cites `segment_handoff_k` instead of an
    unexplained `k = 1.5`. The panel's other H11 ask — a hub-side
    per-source scheduling-depth backstop that doesn't depend on client
    lookahead discipline — is **Phase D implementation**, named in §9.6's
    prose but not specified as a new mechanism by this RFC; it needs its
    own design pass, not just a number.
  - **(d) Trust-ledger timestamp honesty.** SPEC §7.2 and §12.6 gain a
    SHOULD-populate rule (a hub with a wall-clock source SHOULD fill
    `first_seen`/`last_seen`) plus an explicit non-audit-grade statement and
    a client display rule (distinguish a populated timestamp from zero,
    never render zero as a real date). No new wire field — `first_seen`/
    `last_seen` already exist; this is normative language only.
  - **(e) Blob grammar tightening.** New NACK `INVALID_NAMESPACE` (`0x0504`,
    the transfer band, next free after `BLOB_REFUSED`) for a `blob.ns` value
    outside every registered/device-defined namespace — split out of
    `CHUNK_UNAVAILABLE`, which now covers only a valid namespace's missing
    store/slot (§18-8 updated). SPEC §8.4's confused "a full request cannot
    also carry `chunks`" MALFORMED rule — which §18-9 had already found to
    name a wire state with no independent encoding — is replaced with the
    two rules that ARE representable and enforceable: an empty `chunks`
    array is MALFORMED, and a catalog-namespace (`ns=0`) request carrying
    `store_id`/`slot` is MALFORMED. `catalog.cddl` was checked and carries
    no BLOB_REQ frame grammar to update (it only schemas the STORE catalog
    descriptor); the blob-request grammar lives entirely in SPEC §8.4 prose.
    **Implementation: Phase D** (the reference hub predates both the
    `INVALID_NAMESPACE` split and the precise MALFORMED wording).
  - **(f) Relay architecture, stated honestly.** SPEC §14.3 gains the
    one-hop rationale the panel asked for (bounded worst-case latency
    accounting is per-hop and additive, and it stays bounded only because
    there is exactly one hop; v1 has no routing/loop-protection protocol a
    chained relay could use to bound or refuse a chain) and a new **relay
    ESTOP latency budget**: a relay MUST forward ESTOP-class frames ahead of
    all buffered traffic (already true, §14.2) and MUST add no more than one
    binding-native frame-transmission time doing it, composing with H2 into
    "binding worst-case (§13.1) plus exactly one relay-hop budget" — the
    same H2/§13.1-style accounting the panel praised, extended one hop.
    Normative text only; no wire change, no new registry number.
  - **(g) Pairing thresholds pinned.** Registry `limits` gains
    `pairing_gesture_boot_count: 3` and `pairing_gesture_max_uptime_ms:
    10000` (the power-cycle gesture's "N consecutive boots" and "~10 s",
    previously hedge prose in a normative section, §12.3c). The PIN window's
    "three failures close the window" (§12.3b) now cites the EXISTING
    `auth_attempts_max` (3) constant instead of leaving a second, unpinned
    "three" beside it — deliberately not a new number, mirroring §12.4's own
    "rather than inventing a second number" rationale for the same value.
- **Compatibility:** every wire addition is additive (one NACK code, one
  CBOR key, two `limits` entries, one registry `status` field) — no
  renumbering, no frame change, no existing field's meaning altered. The
  registry header generator (`tools/gen_registry_header.py`) gained float
  support in its `limits` emitter for `segment_handoff_k` (1.5 is the first
  non-integer, non-string limit value the registry has needed).
- **Implementation landed, 2026-07-27 (Phase D) — items (b) and (c)'s first
  half only:**
  - **(b) landed in full.** `GrantedPublish` (`wire/messages/welcome.hpp`,
    shared by `grant.hpp`) gains `has_requested_curve_family`/
    `requested_curve_family`, encoded/decoded on key 48 in both WELCOME and
    GRANT. `Hub::grantPublishWish()` echoes `wish.curve_family` verbatim
    (unmodified by `curve_policy`) alongside the existing effective value.
    Test: `test_valence_streamingress`'s SI-23b.
  - **(c), the pinned constant, landed.** The firmware's independently
    hardcoded `1.5f` default (`SystemState.h`'s `sm_tune_handoff_k`) now
    reads `valence::limits::segment_handoff_k` — the ONE remaining
    duplicate this RFC's own Problem section named. `lib/kinetic`'s own
    `Config::handoff_chord_factor` default is intentionally left as a bare
    `1.5f`: that library is zero-dependency and protocol-agnostic by
    doctrine (DOCTRINE.md §9), so it does not gain a `lib/valence` include
    for its own standalone default — only the firmware GLUE that wires the
    registry value in was carrying the duplication this RFC flagged.
  - **(c), the scheduling-depth backstop, EVALUATED AND NOT LANDED.** A
    variant of `kinetic::Engine::commitWaveform()`'s [RFC-008](#rfc-008--doctrine-the-machine-owns-motion-processing-not-the-client) handoff guard
    — falling `chord_out` back to the segment's own `chord_in` when no
    lookahead (`Command::has_next_chord`) is available, instead of skipping
    the guard per [RFC-008](#rfc-008--doctrine-the-machine-owns-motion-processing-not-the-client)'s original tail-case exemption — was implemented
    and then REVERTED after it measurably regressed this library's own
    `test_kinetic` regression bench
    ("Mixed feasible/infeasible chain settles centered and STAYS there," the
    operator's real 26.8 mm-off-center bench case): the centering-OFF
    baseline defect shrank from -23.6 mm to -9.4 mm purely as a side effect
    of the backstop clamping declared down-stroke end velocities whenever the
    reshape/centering feedback loop's own dynamics had pulled `chord_in`
    below the bound — an unverified interaction with a physically sensitive,
    operator-tuned control loop. Left OPEN per this pass's own escalation
    rule (three-strikes-then-report): a correct fix needs a signal that can
    tell "a successor is coming, just not yet queued" apart from "this is
    genuinely the last segment," which `chord_in` alone cannot provide.
    Recorded in `kinetic.hpp`'s `commitWaveform()` comment beside the
    guard, and in `Command::has_next_chord`'s doc comment, so the rejected
    approach is not silently retried.

## RFC-050 — Blob transfer backpressure + completion acknowledgment

**Status:** **Landed (v1.0), spec/registry side, 2026-07-28** (operator stamp
on the recommendation below, batched with Phase C4). Implementation is
**deferred (post-batch hub work)** — see SPEC §18-24. registry.yaml gains
frame type `0x20 BLOB_DONE` and `limits.blob_chunks_in_flight` (4); SPEC.md
§8.4 gains the backpressure decision table and the BLOB_DONE completion
contract; the reserved-range comment moves to `0x21–0x3F`.
**Origin:** the same 15-reader spec fresh-eyes panel
([`reviews/spec-panel-2026-07-27.md`](reviews/spec-panel-2026-07-27.md)),
"Blob transfer pacing and backpressure are advisory/vague, and there's no
positive application-level acknowledgment that a transfer completed"
(4/15 readers, §8.4/§5.6).

- **Problem, as the panel found it:** §8.4 said a hub "MUST respect
  transport backpressure while pacing BLOB_CHUNK emission," but never
  defined what the *signal* for that backpressure IS in normative,
  binding-independent terms — a return code, an exception, a callback were
  all left to the implementer. There was no registry knob for a pacing rate
  or budget. And after a receiver reassembles and SHA-256-verifies a
  transfer, the sender had no positive signal that it landed: "the sender
  just... stops and hopes." The panel's own improvement lead was to reapply
  the shedding table's pattern (§10.4, 13/13 loved) — a deterministic,
  normative decision table — to this gap instead of leaving it advisory.
- **Decided (operator stamp, 2026-07-28):**
  1. **A normative backpressure decision table**, §10.4-style and keyed to
     §13.1's existing per-binding congestion signal (§10.3): congested with
     budget left → send; congested at budget → **hold** emission; recovered
     → **resume** from the held index; congested **sustained > 5 s** →
     **abort**, one NACK `BUSY` with `retry_after_ms` (reusing the "one NACK
     answers one BLOB_REQ" rule, never a NACK per chunk). The budget itself
     is the panel's missing concrete number: `limits.blob_chunks_in_flight`
     (4) — an advertised sender pacing budget, a hub MAY advertise less,
     MUST NOT advertise more.
  2. **A new raw frame, `BLOB_DONE` (`0x20`, dir `any`, plane `raw`)** — the
     operator's call was **(b)** over the draft's own (a)-leaning
     recommendation: a dedicated frame separates "transfer completed" from
     the catalog namespace's readiness-gate semantics that `CATALOG_READY`
     is actually for, and generalizes cleanly to the client→hub direction
     (a STORE import, §8.7, where the *hub* is the receiver and
     `CATALOG_READY`'s c2h-only shape would not fit). Payload: the same
     identity fields as `blob_keys` (namespace, store_id, slot, generation)
     plus `status:u8` (0 verified-complete, 1 hash-mismatch, 2 aborted).
     **Sent by the RECEIVER of the transfer**, idempotently, exactly like
     `CATALOG_READY`'s existing pattern; the sender's response to a nonzero
     `status` is its own retry policy, not specified further here.
- **Compatibility:** additive in both halves. The backpressure table is
  normative text plus one new `limits` entry — no wire-format change to any
  existing frame. `BLOB_DONE` is a clean allocation from the previously-free
  `0x20–0x3F` reserved range (now `0x21–0x3F`, 31 slots); nothing shipped
  emits or expects it, so no existing hub or client changes behavior by its
  mere existence. `CATALOG_READY` (`0x19`) is unchanged and keeps its
  catalog-namespace-only job.

## RFC-051 — Critical stall parks the session instead of evicting it

- **Status:** **Landed (v1.0), 2026-07-28** (operator stamp). `Hub::parkAndDetach`
  factors the shared park body — `markStale()` + pending-knock/nonce/blob
  reset + transport close-and-null + congestion bookkeeping clear — out of
  `detachTransport()`; `trackCriticalSend()`'s stall-timeout branch now calls
  it instead of `evictSlot()`. SPEC §10.4 step 4, §6.6 (fourth staleness
  trigger), and §6.9 (six doors → five) amended in the same commit;
  `registry.yaml`'s `SESSION_EVICTED` and `never_shed_stall_eviction_ms`
  comments updated to match (no key renumbered, no wire-emitted string
  changed — comments only, `gen_registry_header.py --check` re-run clean).
- **Origin:** live kill-test verification of [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops) on Valence Drive fw
  2.1.8x, three separate kill tests across both shipped transports
  (2026-07-28): every one evicted via `SESSION_EVICTED` instead of parking.
- **Problem:** a vanished client's link reports itself CONGESTED (§10.3)
  before the transport layer can confirm it is GONE — TCP/WS half-open
  detection and reconnect-timeout logic both lag well behind the point a
  send starts failing. §10.4 step 4's never-shed stall clock
  (`never_shed_stall_eviction_ms`, 2 s) is exactly as fast or faster, so it
  always fired first and ran the full §6.9 teardown (`evictSlot`,
  `SESSION_EVICTED`) on a session that [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops)'s own transport-loss
  trigger would otherwise have PARKED and let a reconnect resume — the same
  client, the same slot, no re-HELLO. The two mechanisms were answering the
  identical question ("is this link dead?") with two different endings.
- **Proposed change:** the critical-stall path closes and detaches the
  transport and PARKS the session — exactly [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops)'s existing
  transport-loss behavior — instead of running `evictSlot`. One private
  helper (`parkAndDetach`) is the single implementation both
  `detachTransport()` and the critical-stall path call, so the two converge
  on one behavior for as long as the library exists rather than by
  convention. Congestion bookkeeping (`congestionLevel`, `criticalStalling`)
  is cleared on park (TRAPS T13: a parked session has no link to be
  congested on). The hub's own self-protection is UNCHANGED: the wedged
  LINK still closes on the identical 2 s clock; only the session's fate
  (destroyed vs. resumable) changes. `SESSION_EVICTED` narrows to admin
  evict (`session_admin_ops::evict`) only — duplicate-LIVE-instance eviction
  already used its own `DUPLICATE_INSTANCE` code and is unaffected.
  `evictSlot()` itself is retained (kept for admin evict's conceptual home
  even though admin evict and duplicate-instance each currently inline the
  equivalent GOODBYE+teardown shape rather than calling it) but is no longer
  reachable from the congestion path.
- **Compatibility:** behavioral tightening, no wire-format change. A
  conforming client already tolerates both an `evictSlot`-driven
  `SESSION_EVICTED` GOODBYE (which may simply never arrive, per §10.4's own
  best-effort framing) and an [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops) silent park — this RFC only changes
  which of those two a client should now expect from a stalled link, and a
  client written against [RFC-042](#rfc-042--session-staleness-separate-the-session-ends-from-motion-stops) already handles the parked case correctly
  (a stale reconnect is indistinguishable from any other §6.6 resumption).
  New test: `test_valence_staleness` gains a critical-stall-parks-then-
  reattaches-with-grants-intact vector (STALE state, transport null,
  congestion bookkeeping cleared, then a fresh HELLO with the same
  `instance_id` reattaches through the existing §6.3 migration path).

## RFC-052 — The authoring layer: tables, released markers, generated vocabularies, group descriptions

- **Status:** **ACCEPTED (operator, 2026-07-29) — all four parts ruled, two
  with scope amendments.** Four deliberately separable parts: (a)–(c) are
  lib/tooling additions with zero wire change; (d) is one additive
  entry-level catalog key.
  - **(a) RULED IN, STAGED.** The layer's home is the Valence lib (rejected
    alternative: build it in Valence Drive and promote later — Phase 6's
    `examples/author_minimal_hub/` is a second consumer already inside the
    approved plan, and relocating headers afterward means rewriting includes
    across the whole ported catalog). Split by phase: `field_spec.hpp` +
    `channel_table.hpp` + `catalog_feed.hpp` land in Phase 2 (all Phase 3's
    catalog port needs); `packer.hpp` + `layout_guard.hpp` land in Phase 4,
    designed against the real encoder call sites instead of guessed at.
  - **(b) RULED IN, REDUCED TO THE COMPILE-TIME HALF.** A `released` marker
    on the table plus MANDATORY `static_assert` pins on `wire_size`/offsets
    for released tables — a layout shift becomes a compile error. The lint
    half (detecting §5.4 *reorder* and *insert-before-tail*, which no
    `static_assert` can see because it requires a recorded golden shape of
    the previous release as a tracked artifact) is DEFERRED to the v1 tag:
    pre-tag, zero layouts are released, so it would enforce a rule binding
    nothing, and the reference hub's pinned catalog etag already catches
    unintended layout movement today.
  - **(c) RULED IN as written.** No open choice remained: the committed-
    artifact-plus-`--check` posture is already settled precedent from
    `gen_registry_header.py`'s own banner ("the generated header is
    COMMITTED — ESP32/Arduino builds must never need python"); the JS
    emitter inherits it so browsers never need a build step either.
  - **(d) RULED IN (2026-07-29):** card descriptions are "an absolute
    necessity" — the container desc factors the shared context OUT of its
    fields' 128-byte desc budgets, so each field's bytes spend on the delta,
    not on repeating where it lives.
- **Origin:** the campaign's traced chain (Valence Drive ledger, 2026-07-29).
  The reference catalog is ~1,980 lines of imperative builder calls in which
  the facts an operator actually edits (`min`/`max`/`step`/`desc`/`group`)
  are buried in wire machinery; the JS client hand-copies registry
  vocabularies, which is exactly how `frames.js`'s category-name table went
  stale (the RENDERING.md §3 correction in this same commit); and the
  preset-meta fields render as an unnamed, unexplained card because a group
  cannot carry a description.
- **Problem:** four related gaps.
  1. **No authoring surface.** SPEC §8.8's annotation model is complete on
     the wire, but the reference way to *author* it is `addEntry`/
     `addLayoutField` builder calls — a settings row does not read as a
     settings row, and fact-editing requires reading code. (The legibility
     goal is a machine-repo doctrine; the reusable layer belongs here.)
  2. **`released` is enforced by human memory.** §5.4's append-only rule
     binds released layouts, but nothing machine-readable marks which
     layouts ARE released — §8.5's static-client promise rests on nobody
     forgetting. Post-tag, every layout edit risks a silent wire break the
     etag catches only after the fact.
  3. **Registry vocabularies reach JS by hand transcription.**
     `gen_registry_header.py` emits C++ only; every JS-side table is a copy,
     and copies drift (the §3 ruling's other stale half).
  4. **A `group` names a card but cannot describe it.** Fields carry
     `desc`; their container cannot. The depth-4 budget blocks a field-level
     fix by design — §8.1 says containers ride the entry level, so this
     needs an entry-level key.
- **Proposed change:**
  - **(a) `valence::author` — a constexpr table layer** in the lib:
    `field_spec.hpp` (optional-membered row struct, flat designated
    initializers — presence inferred from `std::optional`, no
    `.hasMin = true` boilerplate), `channel_table.hpp` (constexpr table with
    `wire_size` and `offset_of<"name">`), `catalog_feed.hpp` (table → the
    existing builder calls, byte-equivalent, proven by lib-side native
    tests), `packer.hpp` (typed constexpr-offset writes), `layout_guard.hpp`
    (static_assert pins for the hand encoders hot channels keep). Authoring
    surface only — the wire never sees a table. Phase split at the ruling
    above.
  - **(b) A `released` marker on authored tables**: a released table turns
    §5.4 violations (reorder, resize, remove, insert-before-tail) into
    compile errors / lint findings; an unreleased table evolves freely.
    This mechanizes the §5.4/§8.5 distinction; the marker never rides the
    wire. Scope reduced at the ruling above — the lint half waits for the
    v1 tag.
  - **(c) `gen_registry_header.py` grows a JS emitter**: registry.yaml → a
    generated vocabulary module (categories, ranks, aspects, scopes,
    provenance, units, action tags, NACK codes) consumed by `clients/js`.
    Hand-copied vocabulary tables are deleted; `--check` covers both
    emitted artifacts.
  - **(d) New optional entry-level catalog key `17 group_descs`**:
    `{ * tstr => tstr }` mapping a `group` string (SPEC §8.8) to a
    user-facing description, bounded per value by `desc_max_bytes` (128)
    like field `desc`. Depth from the entry map is 3, inside the §5.3 cap —
    exactly the "containers ride the entry level" rule. Renderers surface
    it as the card's own help affordance (§8.9 rule 6, extended to the
    container); clients that predate it ignore the unknown key per §8.9
    rule 8. **Duplicate rule** (added at the (d) ruling): a group string
    spans channels when two entries in one category declare it, so two
    entries could both carry a desc for one merged card — a client binds
    the FIRST in catalog order, the same deterministic tiebreak as §8.8's
    role cardinality; conformance tooling SHOULD flag the duplication.
- **Compatibility:** (a)–(c) touch no wire byte — the catalog-feed
  byte-equivalence tests plus the reference hub's pinned catalog etag prove
  it mechanically. (d) is additive: a clean allocation of the next free
  entry-level key (17), with `catalog.cddl`, registry.yaml, and
  `gen_registry_header.py` updated in the landing commit; absent = today's
  behavior exactly, and the mandatory-fallback rule means no shipped client
  changes behavior by its existence. Nothing renumbered, nothing removed.

## RFC-053 — ESTOP over connectionless datagrams: UDP broadcast + ESP-NOW, opt-in

- **Status:** **ACCEPTED (operator direction, 2026-07-29; amended same
  day)** — the feature is ruled in with one binding condition, amended
  from the initial opt-in ruling: **opt-out, default ON** — governed by an
  NVS-persisted setting that is catalog-exposed and therefore **visible in
  every client**, plus a build flag to compile the path out entirely.
  Implementation queued (hub UDP path is small; the ESP-NOW path lands
  with that binding, which remains unimplemented in the reference
  firmware).
- **Origin:** chat 2026-07-29, immediately after the first live BLE client
  (SPEC §18-22) surfaced the e-stop-fob idea. §13.8's "read-only identity,
  no control surface" doctrine is the identified blocker: a WiFi fob today
  must discover → TCP connect → WS upgrade → scream, and a device on **no
  network at all** cannot scream over IP, period.
- **Problem:** the ESTOP frame (§5.5) was *designed* for dumb, hostile,
  stateless paths — magic-scannable without deframing, CRC-32
  self-validating, sessionless by law (§11.2: any endpoint, any tier, any
  session state), loss-tolerant by repeat-until-latched — yet the only
  WiFi path to deliver it requires a TCP connection, and the UDP listener
  is forbidden from acting on anything. The cheapest safety device
  imaginable (a ~$10 ESP32 fob with a latching button) cannot exist as a
  connectionless WiFi device, and cannot exist AT ALL off-network until
  ESP-NOW, the binding specced precisely for infrastructure-free peers,
  accepts it.
- **Proposed change:**
  1. **Scoped doctrine exception in §13.8:** a valid ESTOP frame
     (12 bytes, `E5` magic, CRC-checked) received on UDP port 22096 —
     broadcast or unicast — dispatches into the **same single e-stop
     function** as §11.2's two existing paths. This is not a "command" in
     §13.8's sense: §11.2 already removed stopping from authorization
     ("you may always stop the machine; you may not always start it").
     The magic dispatch is disjoint by construction (`VLNC` vs
     `E5 E5 E5 E5`), so the listener change is a prefix match plus CRC.
  2. **ESP-NOW acceptance:** on a hub that operates the §13.3 binding, a
     valid ESTOP frame MUST be accepted from ANY peer — paired or not,
     broadcast included. This is the no-network fob path: no AP, no
     credentials, direct 802.11 datagrams.
  2a. **Conformance shape (flexibility amendment, operator direction
     2026-07-29):** every obligation in this RFC is conditional on the
     surface existing — RFC-053 never obligates a hub to *operate* a
     datagram listener; it obligates any datagram listener the hub does
     operate to honor ESTOP (subject to item 3's setting). A hub with no
     UDP listener and no ESP-NOW binding is fully conformant and owes
     nothing here. The unconditional floor is unchanged and lives in
     §11.2: both initiation paths on every binding a hub runs — which,
     composed with RFC-043's hardware-hub profile (BLE GATT is MUST),
     already guarantees every hardware hub a sessionless raw-frame stop
     path over BLE at zero marginal implementation cost. WS-only hubs
     are in practice virtual (desktop) hubs with no physical machine for
     H1's hardware-stop responsibility to bind to. The protocol's
     datagram paths are conveniences layered above that floor, exactly
     as the floor is itself a convenience layered above the hardware
     e-stop (H1, unchanged: always the user's responsibility).
  2b. **Discoverability (APPROVED, operator 2026-07-29 — effort assessed
     trivial: one flags-byte OR of existing NVS state in the existing
     reply builder, no client obligation, no new failure mode; pre-tag,
     layout free to grow):** DISCOVER_REPLY `flags` bit1 =
     `datagram_estop` (this hub honors ESTOP on this UDP port right
     now — the setting's live value), and the ESP-NOW BEACON's flag
     byte reserves the mirror bit when that binding lands — so a fob
     learns at setup time whether screaming will be heard, rather than
     discovering it by silence. BLE needs no bit: the raw-frame path is
     unconditional on every binding a hub runs.
  3. **The opt-out condition (operator ruling, amended 2026-07-29):**
     both datagram paths are governed by one setting (proposed home: the
     safety or network settings channel, `configure` tier to change,
     NVS-persisted, catalog-exposed so every client renders it),
     **default ON** — the datagram scream works out of the box; an
     operator who wants the surface closed flips it off from any client.
     A build flag additionally allows hard removal at compile time. The
     existing session-ful paths (§11.2 paths 1–2) are untouched by the
     setting — they are never optional.
  4. **Rate limiting:** per-source, mirroring `udp_discovery`'s
     reply-rate-limit posture. The latch is idempotent, so repeats are
     cheap; the limiter bounds CRC work under a spray, nothing else.
  5. **The latching-fob pattern (informative, the intended semantics):**
     a fob with a physically latching button emits a **new initiation**
     (fresh `seq`) every repeat interval for as long as the button is
     down. Consequence: an authorized `estop_clear` at any client
     succeeds — and the machine re-latches within one interval. The
     machine is therefore effectively stopped until the physical button
     releases, while clearing authority never moves to the fob: §11.2's
     clearing rules are untouched. Release = the fob simply stops
     screaming; the latch then clears through the normal authorized path.
  6. **Open question (decide at landing):** the confirmation gap. A
     sessionless screamer cannot observe the `safety` STATE latch.
     Options: (i) fob repeats its full budget and surfaces an
     UNCONFIRMED state locally (lean — keeps the wire untouched, honest
     per §11.2's loud-local-failure rule); (ii) the hub unicasts a
     minimal acknowledgment to the datagram's source address. H1/H2
     (§1.5) apply verbatim either way: this is a convenience layer above
     the hardware e-stop, and preemption is per-hop.
- **Compatibility:** additive on the wire — the ESTOP frame is
  byte-unchanged and no existing frame, channel, or session behavior
  moves. Default-ON is a deliberate behavioral addition on upgrade: a hub
  that ships this begins honoring datagram ESTOP immediately, and the
  catalog-exposed setting is the advertised, every-client-visible off
  switch. §13.8's doctrine sentence gains a dated exception clause at
  landing (C-3 style), not a silent contradiction.

## RFC-054 — WiFi and ESP-NOW provisioning over BLE: the credentials handoff

- **Status:** **WITHDRAWN** (operator, 2026-10-01; rfc-rbe). A hub never
  discloses its own WiFi credentials: there is no hub-discloses-credentials
  path. [RFC-069](#rfc-069----client-pushed-wifi-provisioning-over-ble)
  covers provisioning in the only direction that matters (the client holds
  the credentials and pushes them in, over BLE GATT or §13.5 USB serial in
  [RFC-079](#rfc-079----config-mode-and-the-setup-category)'s config mode).
  Embedded clients and Isotope accessories are ESP-NOW only unless they can
  be provisioned on their own through RFC-069/079. The text below is kept
  as the record.
- **Origin:** §13.2 already names BLE GATT the hardware-hub conformance
  floor partly because *"the future WiFi-provisioning admin channel"*
  wants it — this RFC is that named future arriving. Made immediate by
  2026-07-28's live verification (SPEC §18-22): a Tauri Android client
  held a BLE session and performed the §6.3 BLE→WS upgrade handoff —
  which only works if the client is already on the LAN. A client that
  isn't has no in-band way to get there.
- **Problem:** two provisioning gaps, one ceremony wanted.
  1. A BLE-connected client reads `ws_port`/`ipv4` from WELCOME (RFC-046)
     but cannot *join the network* they point into: the hub knows its
     WiFi credentials and has no conformant surface to disclose them —
     RFC-009.5's secrets doctrine rightly bans STATE, and broadcast ECHO
     is just as wrong; no unicast disclosure surface exists at all.
  2. An ESP32-class peer (RFC-053's fob, a hardware remote) wants
     ESP-NOW, which needs segment/channel/key material. §13.5's pairing
     ceremony distributes keys ESP-NOW-side — but a factory-fresh peer
     could bootstrap over BLE instead, letting ONE pairing UX cover both
     radios.
- **Proposed change (options, decide at ruling):**
  - **(a)** dedicated admin INTENT ops whose response rides a
    **unicast-only** surface (to be established — the credential must
    never appear in STATE or any broadcast ECHO; this constraint is
    non-negotiable under RFC-009.5's own logic, whatever shape wins);
  - **(b)** a blob-namespace read (§8.4 machinery reused) gated to
    `configure` tier + an open §12.3 pairing window;
  - **(c)** prior art, named for the record and disfavored: an
    Improv-WiFi-style dedicated GATT characteristic outside Valence
    framing — rejected-by-default because it forks the protocol surface
    per transport, the exact thing the one-frame-format design exists to
    prevent.
  - **Security floor regardless of option:** disclosure requires
    (i) `configure` tier or better, (ii) SHOULD require an open physical
    pairing window, (iii) SHOULD require BLE link encryption/bonding,
    (iv) never STATE, never broadcast, never logged; credential rotation
    is handled by re-provisioning — no revocation pretense.
- **Compatibility:** additive ops/namespace; nothing existing changes. The
  ESP-NOW half is spec-ready but dormant until that binding is
  implemented.

## RFC-055 — Admission control: a hub that cannot serve you must SAY SO

- **Status:** ACCEPTED (operator, 2026-10-02; rfc-a90). LANDED 16266af
  (2026-10-02).
- **Ruling (operator, 2026-10-02).** Accepted as drafted. No open
  questions were posed.
- **Origin — a live failure, with receipts.** Valence Drive fw 2.2.1,
  2026-07-31. FIVE half-open TCP connections (socket opens, partial HTTP
  request, never completed) took the hub from serving to `reset_reason
  TASK_WDT` **every single attempt**. `heap_min` at the crash was 40 619 B —
  this was NOT resource exhaustion, the hub had memory to spare. Control
  experiment: EIGHT *complete* keep-alive requests at the same connection
  count survived untouched, so the trigger is incomplete requests, not load.
  This is textbook **slowloris** (known since 2009), and the industry answer
  is not novel — see Prior art below.
  The protocol's part in it: Valence today has **no way for a hub to say
  "I am full, come back in N ms."** A hub at capacity can drop, close, or
  die, and all three look identical to a client, which then immediately
  retries and makes it worse.
- **Problem — three things the spec never said.**
  1. **Capacity is invisible.** A hub advertises transports, tiers and
     channels, but never how many concurrent sessions it can actually back.
     `kSlots` is an implementation detail no client can read, so no client
     can behave well.
  2. **Refusal is indistinguishable from failure.** A refused connection, a
     crashed hub, and a flaky radio all present as "connection went away."
     A client cannot tell "not now" from "not ever" and has no basis to pick
     a retry delay, so every client picks *immediately* — a thundering herd
     aimed at a device that is already struggling.
  3. **Nothing protects incumbents.** An arriving client can degrade or
     evict an established one. **Operator ruling (2026-07-31), verbatim in
     intent:** *"the hub should keep itself alive at any cost"*; priority
     order is (1) hub stays alive AND STAYS HOMED, (2) existing sessions
     survive — the first two or three, (3) further clients wait or are
     deferred. Rehoming is not a neutral recovery on this class of machine:
     it drives the rail to a limit, which is at best disruptive and at worst
     unsafe for a user who is physically engaged with it. **Session
     admission MUST NEVER be able to cost the machine its home reference.**
- **Prior art (deliberately not reinvented).** Every layer of this is solved:
  - **CoAP [RFC 8516](https://www.rfc-editor.org/rfc/rfc8516.html)** — `4.29
    Too Many Requests` carries `Max-Age`: the rejection itself states when to
    come back. This is the closest match to what we want and it is already
    the constrained-device standard.
  - **WebSocket close `1013` "Try Again Later"** (IANA) — the exact semantic
    for "temporary, retry", distinct from `1011` internal error.
  - **MQTT 5 CONNACK reason codes** — `0x97 Quota Exceeded`, `0x89 Server
    Busy`: a refusal that names its own cause, plus `Server Reference` for
    redirect.
  - **HTTP `503` + `Retry-After`** — the same idea, oldest form.
  - **Apache `mod_reqtimeout`** — `RequestReadTimeout header=5-10,MinRate=500`:
    a short header deadline that EXTENDS while the client keeps making
    progress at a minimum byte rate. This is the answer to "harden without
    trading off performance": a slow-but-real client on bad WiFi keeps its
    connection precisely because it is still delivering; a stalled one is cut
    fast. A flat timeout cannot tell those apart.
  - **Structural note:** slow-request attacks are ineffective against
    *event-driven* servers (nginx, lighttpd) and lethal against
    thread/slot-per-connection ones.
    **Scope correction, recorded because the first draft of this RFC got it
    wrong:** the Valence Drive failure above was on its **sync HTTP sideband
    (:80 — static page, `/api/*`, OTA, uitoken)**, NOT on the Valence
    transport, which is event-driven ESPAsyncWebServer on :82 and was never
    touched by that test. The hub plane is not the structurally exposed one.
    What the incident proves for Valence is narrower and still worth a
    normative answer: **a hub is only as available as the whole process it
    lives in**, so admission control has to be stated in-protocol rather
    than inferred from a connection that vanished for reasons the client
    cannot see.
- **Proposed change.**
  1. **Advertise capacity.** WELCOME gains `max_sessions` and
     `sessions_in_use` (`welcome_limits_keys` 5 and 6 as landed). A client that can see the ceiling can decide whether
     to queue, degrade, or not connect at all.
  2. **A REFUSED terminal with a reason and a delay.** New NACK/close codes
     in the existing space (`0x0103 PAIRING_REQUIRED` … `0x0105
     SESSION_EVICTED` are precedent): `HUB_AT_CAPACITY` (`0x010E`) and
     `HUB_SHEDDING` (`0x010F`), as landed,
     each REQUIRED to carry `retry_after_ms`. A hub MUST NOT refuse silently
     and MUST NOT close bare when it knows the reason.
  3. **`retry_after_ms` is normative for clients.** A client MUST NOT retry
     sooner, and MUST apply jitter. Without this, (1) and (2) just
     synchronize the herd.
  4. **Incumbency is a right.** Admitting a session MUST NOT degrade an
     already-ADOPTED one. Hubs SHOULD reserve capacity for established
     sessions and refuse new ones instead of accepting-then-evicting.
     `SESSION_EVICTED` stays for genuine policy eviction (admin, pairing),
     never for capacity.
  5. **Progress deadlines, not flat timeouts** (the mod_reqtimeout lesson):
     a hub SHOULD cancel a connection that has not COMPLETED a handshake
     within a short deadline, where the deadline extends while the peer is
     still delivering bytes at a minimum rate. Applies to any transport with
     a multi-part handshake.
  6. **Safety ops are not subject to admission.** ESTOP and its
     connectionless forms (RFC-053) MUST remain reachable when the hub is at
     capacity. Admission control that can refuse a stop is a safety defect.
- **Compatibility:** additive. New WELCOME fields are ignorable by older
  clients; new codes land in an existing code space and degrade to "closed"
  for clients that do not decode them — which is exactly today's behavior,
  so nothing regresses. `retry_after_ms` is the only new client obligation
  and only binds clients that decode the new codes.

*Add new entries below. Keep the shape: Status / Origin / Problem / Proposed
change / Compatibility — and if it was found by a probe or a live failure,
say exactly which, future-us will want the receipts.*

## RFC-056 — Modular conformance: a hub is a set of duties, not a chip

- **Status:** ACCEPTED (operator, 2026-10-02; rfc-qqq). LANDED 99584a6
  (2026-10-02). (with RFC-057). Ruled together with RFC-057.
- **Ruling (operator, 2026-10-02).** Accepted as drafted, with the BLE
  sentence of item 2 landing as "SHOULD, and MUST where config mode is
  offered", together with
  [RFC-079](#rfc-079----config-mode-and-the-setup-category)'s
  TODO(rfc-qqq) marker in §13.1. Item 3 points at
  [RFC-069](#rfc-069----client-pushed-wifi-provisioning-over-ble) (RFC-054
  withdrawn; the queue text was repointed 2026-10-01). No open questions
  were posed.
- **Origin — a shipped split, with receipts.** Valence Drive, 2026-08-01. The
  hub was moved off the motion MCU's radios: an ESP32-C5 terminates WiFi 6 /
  5 GHz and the Valence WebSocket and relays whole frames to the ESP32-S3
  over UART (§13.5 COBS), while the `valence::Hub` itself stays on the S3.
  `valence_probe.py` reports **55 passed, 0 failed** through that split —
  HELLO, WELCOME, catalog + blob transfer, every subscription, INTENT, STREAM,
  segments, safety modes — with the S3's own WebSocket **compiled out
  entirely**. From the client's side nothing changed; only the IP did.
  The spec never said this was allowed. It never said it was forbidden either,
  and that silence is the problem: the one implementation that tried it had to
  reason from first principles about whether it was still conformant.
  Two costs the split surfaced, both spec-shaped rather than code-shaped, are
  in *Problem* below.
- **Problem — three things the spec assumes without saying.**
  1. **Conformance is written as if a hub were one processor.** §13.1's
     profiles say "a hub MUST offer binding X", and every existing sentence
     reads as though the thing offering the binding and the thing owning the
     catalog, sessions and role layer are the same silicon. Nothing in the
     wire format requires that. A hub is a set of DUTIES — golden-vector-exact
     encoding, the §6.3 session lifecycle, the role/trust layer, the catalog
     contract, the §13.1 declared properties — and where those duties execute
     is an implementation concern the protocol has no stake in.
  2. **The hardware-hub profile makes BLE GATT a MUST**, and that MUST is now
     doing harm. Operator ruling, verbatim in intent: *BLE-only controllers
     are kinda pointless — the ESP32 is cheap, and Valence is meant to be
     high performance.* BLE's real jobs are discovery and provisioning; RFC-046
     UDP discovery already covers the first on any WiFi-bearing hub, and a
     remote a user actually streams to is on WiFi regardless. Forcing a BLE
     stack onto every hardware hub costs real memory — **~64 KB of NimBLE plus
     a 16,560 B port object on Valence Drive, on a device whose free heap was
     36 KB** — to satisfy a checkbox its deployment never uses.
  3. **The credential bootstrap has no stated owner once BLE is optional.**
     §13.1 leans on BLE as "the infrastructure-free path… the future
     WiFi-provisioning admin channel"; RFC-069 (repointed 2026-10-01 from the
     withdrawn RFC-054) pushes provisioning over BLE or serial. Drop
     the BLE MUST and a WiFi-only hardware hub has no spec'd way to receive
     credentials, which is a hole, not a simplification.
- **Proposed change.**
  1. **Add §13.0 "What conformance binds" (normative).** Conformance is
     defined over the WIRE and the DUTIES, never over topology. Explicitly:
     a conformant hub MAY be implemented across **multiple processors, cores,
     or physical devices** in any arrangement, provided the composite satisfies
     the golden vectors (`spec/vectors/`), the §6.3 session lifecycle, the role
     and trust layers, and the §13.1 property declarations for whichever
     bindings it exposes. A client MUST NOT be able to tell the difference, and
     MUST NOT probe for it. Corollary, worth stating because it is the case
     that motivated this: **an internal link between hub components is not a
     Valence binding and has no conformance duty of its own** — it may be any
     transport at all, including a §13.5 serial link carrying Valence frames,
     and it is invisible to conformance.
  2. **Demote BLE GATT from MUST to SHOULD** in the hardware-hub profile,
     **and MUST where config mode is offered** (RFC-079; the ruling's
     wording, the draft said SHOULD alone), and say why: it is the infrastructure-free discovery/provisioning path and
     remains RECOMMENDED wherever the silicon has a radio going spare. A
     hardware hub that ships WiFi + UDP discovery + a provisioning path (3)
     and no BLE is fully conformant.
  3. **New client duty, replacing what the BLE MUST implicitly guaranteed:**
     a client that can provision a HARDWARE hub **MUST** provide a way for the
     user to enter WiFi credentials — a form, a QR scan, an RFC-069 push
     over BLE or serial (repointed 2026-10-01 from the withdrawn RFC-054), a
     captive portal, an SD card, whatever suits it. The spec
     mandates the CAPABILITY, never the mechanism. Without this, dropping the
     BLE MUST would strand a factory-fresh hub with no route onto a network.
  4. **Amend §13.1's "Clients SHOULD auto-upgrade BLE→WS"** to be conditional
     on BLE existing, and add its sibling: where a hub exposes several
     bindings, clients SHOULD prefer the highest-throughput one its properties
     declare (§13.1 matrix), not merely WS-over-BLE.
- **What this deliberately does NOT change.** No wire format, no frame type,
  no registry id, no golden vector. The §13.1 property matrix and the
  `min_transport_payload` = 242 floor are untouched. This is a conformance
  and availability edit; a v1.0 implementation that already conforms still
  conforms after it, with one exception noted below.
- **Compatibility.** Strictly loosening, except for (3), which adds a client
  duty. A hardware hub that shipped BLE remains conformant and RECOMMENDED. A
  client written against the old text loses nothing — it may simply now meet
  hubs with no BLE, which it already had to tolerate under the base profile.
  **Migration note for Valence Drive:** BLE was removed there on 2026-08-01,
  which was a conformance violation from that moment until this RFC lands.
  Recorded so the gap is a decision in the log, not a discrepancy someone
  finds later.
- **Second receipt (2026-09-02).** Valence Drive ratified a THREE-component
  hub: the ESP32-C5 terminates the network, the ESP32-S3 runs `valence::Hub`
  and owns policy, and an RP2350 runs the motion planner and pulse generation
  over an internal SPI link, reporting its rendered position as the machine's
  position truth (Valence Drive `architecture.md` §2, dev board sd-4k1). The
  motion processor is now a separate component too. Item 1's corollary covers
  it unchanged: SPI is an internal link, not a binding, and has no
  conformance duty. Nothing in the proposal changes; the case for it does.
- **Prior art.** The duty-vs-topology distinction is how USB (device *classes*,
  not device *chips*), Modbus (RTU/TCP gateways are transparent), and MIDI
  (a merger is not a device) all handle it. The industry answer to
  "may I split the implementation?" is uniformly yes-if-indistinguishable.

## RFC-057 — The two HTTP escapees are HUB duties, not chip duties

- **Status:** ACCEPTED (operator, 2026-10-02; rfc-qqq). LANDED 99584a6
  (2026-10-02). (with RFC-056). Ruled in the same ruling as RFC-056;
  additive, landable later with no break, landed with RFC-056 because it is
  a paragraph.
- **Ruling (operator, 2026-10-02).** Accepted, noted by the operator as
  additive (landable later with no break) and landed now with RFC-056
  since it is a paragraph. No open questions were posed.
- **Depends on:** [RFC-056](#rfc-056--modular-conformance-a-hub-is-a-set-of-duties-not-a-chip),
  whose duty-vs-topology principle this extends to the two HTTP escapees.
  RFC-056 without this entry is incomplete: it frees the Valence bindings
  from topology and leaves the two non-Valence duties silently pinned to
  whichever chip happens to run the hub.
- **Origin — a strip that the current text makes unimplementable.** Valence Drive
  is removing WiFi from the ESP32-S3 entirely, so the S3 is hub, planner,
  arbiter and current sensing with no radio and no IP stack; the ESP32-C5
  already terminates WiFi and the WebSocket. That is exactly the split RFC-056
  blesses. But SPEC §1 says: *"On the reference device exactly two HTTP duties
  are permanently exempt, because Valence structurally cannot own them:
  firmware/asset OTA … and the optional served-page token sideband."* Both
  are HTTP duties, HTTP needs an IP stack, and after the strip the component
  being flashed has neither.
  The reading that "the hub" means "the chip running `valence::Hub`" makes
  the reference device non-conformant the moment the radio leaves, for a
  change that improves it. That reading cannot be right, but the text does
  not currently say so.
- **Why it matters beyond one device.** The OTA carve-out rests on an AUTH
  argument, not a transport one: OTA rights are never derivable from a
  Valence role, so OTA must not ride a Valence channel. That argument is
  about WHERE AUTHORITY COMES FROM. It says nothing about which processor
  holds the flash being written, and it must not be read as though it did --
  otherwise the spec accidentally forbids the safest available arrangement,
  in which the network-facing component authenticates the upload and the
  motion component never exposes a network surface at all.
- **Proposed change.**
  1. **Restate the two escapees as duties of the COMPOSITE hub.** In §1 item 8,
     replace "on the reference device" framing with: the two exempt duties
     belong to the hub as a whole. A multi-component hub MAY serve either duty
     from any component, and MAY carry the resulting bytes to their destination
     component over the internal link. Per RFC-056 the internal link is not a
     Valence binding and has no conformance duty, so this is invisible to
     clients and to the golden vectors.
  2. **State the OTA carve-out's actual scope, normatively.** OTA MUST NOT be
     reachable through any Valence channel, verb, or role. It MUST have an
     authority plane of its own. Neither requirement constrains which component
     terminates the upload, nor how bytes reach the component that writes flash.
  3. **Add the corollary for the token sideband.** `/uitoken`'s security
     property is browser same-origin, so it MUST be served by whichever
     component serves the page. On a split hub that is the network-facing
     component by construction. A component that serves no page owes no
     sideband -- which resolves, rather than creates, the awkward case.
  4. **Non-normative note:** where a split hub's non-network component can be
     reflashed only over the internal link, implementers SHOULD prove that path
     before removing the last independent one. Recovery from a broken update
     path is a bench act. This is guidance, not conformance.
- **What this deliberately does NOT change.** No wire format, no frame type,
  no registry id, no golden vector, no role or grant semantics. OTA stays off
  Valence, and stays on its own token plane; the queue's standing ruling
  ("HTTP has exactly TWO permanent escapees") is preserved verbatim in force.
  This entry only says WHICH BOX the duty sits in, never whether it exists.
- **Compatibility.** Strictly loosening. A single-chip hub serving both duties
  itself is unaffected and remains the common case. No implementation that
  conforms today stops conforming.
  **Migration note for Valence Drive:** the S3's HTTP surface is being retired
  in favor of the C5 serving OTA and piping the image over the existing
  §13.5 serial link's bridge control channel -- link machinery, deliberately
  NOT a Valence channel, so item 2 is satisfied by construction. Recorded so
  the sequencing is a decision in the log rather than a discrepancy found later.
- **Second instance of item 4 (2026-09-02).** The RP2350 motion component of
  Valence Drive's three-component hub is reflashable only over USB today and
  gains a link-fed A/B update path (dev board sd-4k1.3), sequenced BEFORE the
  motion port that would make it the most-edited firmware in the product.
  Item 4's guidance ("prove the path before removing the last independent
  one") is being followed as written; recorded here so the second case is a
  decision in the log.
- **Prior art.** Same shape as RFC-056's: a USB composite device's firmware
  -update interface is a duty of the device, not of a particular silicon die;
  a Modbus gateway authenticates on the side it faces. Nothing in the industry
  ties "who authenticates the update" to "who holds the flash".

## RFC-058 -- End-velocity `unspecified` semantics and the rest-before-hold rule

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-zj1). LANDED a48c03a
  (2026-10-01).
- **Ruling (operator, 2026-10-01).** Accepted with the firmware receipt's
  correction: the dwell rule reports its own anomaly kind 10
  `dwell_zeroed`, not `HandoffBounded` (item 3 below now reads so). Landing
  verifies that no golden vector encodes the segment layout before claiming
  no vector change.
- **Receipt 2026-09-03 (Valence Drive fw 2.5.2, after the RP-owns-motion port
  and the kinetic refactor of the same day).** What the reference does
  now, item by item: (1) the sentinel value is unchanged and still lives only
  in the reference catalog comment and the MFP plugin's hand copy; the
  registry limit is still the ask. (2) NOT implemented as written: the
  reference resolves `unspecified` to a stream-velocity estimate whenever
  the stream reads dense (`kinetic.hpp`, `commitWaveform`, the
  `has_end_vel` fallback), with or without a scheduled successor, and to
  rest only on a sparse stream. The field does not hit it because the
  reference client sends explicit rest before every hold and gap (MFP
  v0.4.6), which is exactly the client-side rule this RFC exists to make
  unnecessary. The machine now holds a queue of scheduled plans, so "a
  successor is scheduled" is a real, testable state; the fix is small and is
  tracked on the machine board (sd-4k1.20). (3) Implemented, with one
  divergence from the proposed text: the dwell rule reports its own anomaly
  kind (`dwell_zeroed`, kind 10) rather than reusing `HandoffBounded`,
  because the census was unreadable with the two conflated; the proposal
  text should follow the code here. (4) Unchanged. Compatibility note
  stands: no bytes change.
- **Origin -- two measured drive losses, one spec silence.** Valence Drive
  fw 2.4.105 (dev board sd-ar3) and fw 2.4.108-112 (sd-d77), both on the
  `segments`-kind channel, both root-caused with the encoder validator and
  the engine's per-commit census:
  1. A client re-sent its HOLD point at ~1 Hz during script lulls, each
     re-send carrying a stale spline tangent as the end velocity (six distinct
     values, |vf| up to 3.409 norm/s = 916 mm/s, each repeated ~22x). The hub
     honored them: the plan arrived at the hold point at whip speed, flew
     through, was re-commanded, and oscillated at ~1 Hz until the drive lost
     quadrature counts above its follow rate. **54 mm of position gone.**
  2. A client sent the "no end velocity" sentinel on the last segment before
     a gap or at end of script. The reference hub resolved the sentinel from
     its own stream-velocity estimate, stale from the preceding motion
     (settles logged at -1.343 norm/s on spans that should arrive at rest),
     coasted past the hold, settle-braked beyond it, and the next action's
     catch-up darted back at 300-800 mm/s inside gentle content.
  Both were fixed on the machine (a dwell rule; explicit-rest resolution) AND
  on the client (MFP plugin v0.4.6, "gap-next and end-of-script handoffs are
  explicit rest, never the sentinel"). The client half is the tell: a second
  client would have to rediscover both rules, which is precisely what
  [RFC-008](#rfc-008--doctrine-the-machine-owns-motion-processing-not-the-client)'s
  write-once rule exists to prevent.
- **Problem -- three things §9.6 assumes without saying.**
  1. **The sentinel is not in the spec.** §9.6 names the segment as
     `{target, duration, end_velocity}` and never says end velocity can be
     absent. The reference encodes "unspecified" as the i16 field's minimum
     value (`INT16_MIN`, because 0 is a real slope: a reversal ends AT rest),
     documented only in the reference catalog's source comment. A second
     hub or client has no authoritative source for the value or its meaning.
  2. **No rule for `unspecified` with no scheduled successor.** The handoff
     guard (§9.6, H11) acts only when the successor is in hand. When it is
     not, the hub must still pick a boundary velocity, and the reference
     picked an estimate from prior motion. That is wrong by construction:
     arrival before a hold, a gap, or the end of content is rest by
     definition, and no estimate of past motion can know that.
  3. **A re-commanded identical target is a hold, and the spec does not say
     so.** Honoring a nonzero declared end velocity at a hold point is never
     what the author meant; it is a tangent the client failed to zero.
- **Proposed change.**
  1. **Name the sentinel in the registry** as a packed-layout convention
     (§5.4): a signed integer layout field carrying an end velocity reserves
     its type's minimum value as `unspecified`; zero is a real slope. Pin it
     as `limits.segment_end_vel_unspecified = -32768` (i16) so codegen emits
     it for every consumer language and the hand copy in the MFP plugin
     (`SegmentEndVelSentinel`) becomes generated (T20 class).
  2. **Normative hub resolution of `unspecified`.** With a scheduled
     successor the hub MAY derive the boundary velocity from the adjoining
     chords (the existing guard's lookahead). **Without a scheduled successor
     the hub MUST resolve `unspecified` to rest (0)**, never to an estimate
     derived from prior motion. Rationale is measured: item 2 above.
  3. **Dwell rule (SHOULD).** A segment whose target lies within
     `limits.segment_dwell_span` (registry, normalized units; reference
     0.02) of the previous accepted segment's target on the same source is a
     hold. A declared nonzero end velocity on it SHOULD be bounded to zero
     and surfaced as its own anomaly kind, 10 `dwell_zeroed` (the draft
     had said: the existing `HandoffBounded` kind, no new kind; the
     2026-09-03 receipt showed the census unreadable with the two
     conflated). Tested against the
     TARGET, never position: each whip displaces position, so a position
     test never re-arms.
  4. **State the client's freedom, not a duty.** A client MAY emit explicit
     hold segments across gaps (the reference client does) and MAY declare
     rest explicitly; neither is required for good motion. A gap with no
     segment settles the machine, as §6.6 already says.
- **Compatibility.** Additive. The sentinel VALUE is what already ships, so
  no bytes change; the reference hub already implements items 2 and 3
  (fw 2.4.105+, `kinetic` dwell rule). One registry table gains two
  limits. Verify whether any golden vector encodes a 0x2101-shaped
  end-velocity field before claiming "no vector changes".
- **Test of the doctrine (RFC-008).** Would every conforming client have to
  write "send explicit rest before holds"? Yes, so it belongs on the machine.
  Does resolving `unspecified` depend on which client sent it? No. Passes.

## RFC-059 -- Hub-advertised scheduling latency

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-r4v). LANDED 876ca7c
  (2026-10-01). (with RFC-084). Ruled together with
  [RFC-084](#rfc-084----future-anchored-samples-points-an-arrival-time-under-the-same-lead-cap).
- **Ruling (operator, 2026-10-01).** Accepted as drafted, ruled together
  with RFC-084: for `samples`-kind grants, `schedule_latency_us` states the
  chase-planning budget (the bound RFC-084's conformance test measures).
  Item 1 below now says so.
- **Receipt 2026-09-03.** The origin's numbers are gone and the mechanism
  is still right. The reference deleted its sample-synthesis holdback (the
  two-knot, 120 ms plus 40 ms pipeline) on 2026-09-03, and after the
  RP-owns-motion port the hub forwards every `segments`-kind sample to the
  motion processor on arrival with its anchor; the processor parks up to
  eight scheduled plans and promotes each at its anchor instant. So for
  `segments`-kind the reference's execution delay is now the composite's
  hop latency (sub-millisecond over the internal link) and no longer a
  planner constant; for `samples`-kind it is replan-at-arrival with no
  holdback. That is the strongest argument FOR this RFC, not against it:
  the value moved from 160 ms to under 1 ms across one firmware release,
  and a client that had learned 160 ms from a human would now lead its
  media by a sixth of a second. `schedule_latency_us` on the grant is the
  only place a client can learn the current number. Item 4 (a `plan.latency`
  role) stays optional.
- **Origin -- a hub constant living in a client's settings.** Valence Drive
  fw 2.4.120-2.4.122 (dev board sd-2fb, sd-beq, sd-2vp). To survive knot
  jitter on bare-point (`samples`-kind) streams the reference engine now
  renders a fixed two knots (~120 ms) plus a 40 ms jitter margin BEHIND the
  stream head. The commit messages say it plainly: *"pipeline latency is a
  fixed two knots (120 ms), calibratable in MFP"* and *"constant, absorbed
  once by MFP's sync offset."* A media player aligning video to motion has to
  know that number, and today it learns it from a human who read the
  firmware. That is interop by folklore, the exact shape
  [RFC-014](#rfc-014--timed-segment-scheduling-contract) already had to fix
  once for `max_future_schedule_ms`.
  A second receipt: Valence Drive ratified a three-component hub on
  2026-09-02 (network C5, hub-and-policy S3, motion planner RP2350 over an
  internal SPI link). The composite's execution delay is the sum of hops only
  the hub can see; a client cannot measure it and must not guess it.
- **Problem.** §5.4 tells a client how far AHEAD it may schedule
  (`max_future_schedule_ms`) and says nothing about how far BEHIND the
  schedule the hub will actually execute. For `segments`-kind streams that
  delay is the hub's pacing and planning depth; for `samples`-kind streams it
  is a synthesis holdback the client cannot see at all. Either way a client
  that lip-syncs media to motion is guessing, and a guess that is right for
  one firmware version is wrong for the next.
- **Proposed change.**
  1. **`schedule_latency_us` (CBOR key 49) on `granted_publishes` entry
     maps**, alongside `burst` (42) and `curve_family` (45): the hub's
     declared fixed delay between a sample's scheduled time (segments:
     `t_base + t_off`; samples: the sample's own stamp) and the start of its
     execution, inclusive of every hub-internal hop. Per entry, because it
     differs by mode. On a `samples`-kind grant it states the hub's
     chase-planning budget: how far behind a sample's arrival time
     (RFC-084) the commanded curve passes through it.
  2. **It is a commitment, not an estimate.** The hub keeps the declared
     value constant for the life of the grant; a change is an unsolicited
     GRANT (§10.2), never a silent drift. Absent or zero means unspecified,
     which is today's behavior.
  3. **Clients SHOULD lead their media by the declared value and MUST NOT
     hardcode a per-hub constant.** A client MAY still expose a user trim on
     top; the declared value is the zero of that trim.
  4. **Optional telemetry twin:** a `plan.latency` field role
     ([RFC-035](#rfc-035--a-role-vocabulary-for-motion-plan-telemetry)
     family) so the live value is visible on a STATE channel for diagnostics
     and generic renderers. Not required for conformance.
- **What this deliberately does NOT propose.** A client WISH for lower
  latency. The delay is a property of the hub's planner robustness against
  the jitter it measures, not a preference; letting a client bid it down is
  letting the client re-litigate feasibility, which §9.6 forbids. A wish key
  can come later with evidence.
- **Compatibility.** Purely additive: one optional CBOR key on an entry map
  (§4.3 requires decoders to ignore unknown keys) and one optional role. No
  packed layout, frame type, or vector changes. The reference hub can
  populate it today from `kinetic` constants it already owns.

## RFC-060 -- Rename: SlopSync becomes Valence

- **Status:** ACCEPTED and LANDED (v1.0-candidate), 2026-09-21, in the single
  rename commit this entry describes. Accepted by the operator ruling of the
  same day ("atomic change every single instance now"); every proposed byte
  below is in the registry, SPEC.md, the generated views and the fixtures as
  of that commit.
- **Receipts -- the values actually taken.**
  - `protocol_name: valence`, spec id `valence/1`, `proto_ver` still **1**.
  - `ws_subprotocol: "valence.v1"`, `mdns_service: "_valence._tcp"`,
    RECOMMENDED WebSocket endpoint `/valence` (SPEC §13.2).
  - `udp_discovery.port: 22096` (0x5650, ASCII 'VP'), `magic: "VLNC"`
    (0x56 0x4C 0x4E 0x43). **The IANA check item 2 demanded was run**
    against the service-name-and-port registry CSV on 2026-09-21: 22096 is
    UNASSIGNED for both tcp and udp (nearest neighbors 22005 and 22125), so
    the proposed port stands and no amendment was needed.
  - `ble_identity` UUIDs `56414C45-4E43-4531-8000-00000000000{1,2,3}`
    ('VALE' 'NC' 'E1'), service / write(c2h) / notify(h2c) as before.
  - **2026-09-21 receipt:** the reference firmware was renamed **Nucleus**
    (full name Valence Nucleus) the same day, after this RFC landed; the
    `'valence-drive'` product example in the HELLO identity note became
    `'nucleus'`. Editorial note only -- no value, id or encoding moved. The
    body below keeps its original wording.
  - Product example `'valence-drive'`; NVS namespace note `valence`;
    log-level notes cite `geiger::Level` (verified against the geiger library:
    `enum class Level` lives in `geiger/geiger_core.hpp` and the `GLOGx` macro
    names are UNCHANGED, so only the enum's qualification moved).
  - Wire-visible catalog text: the JS client's captured-catalog fixture
    carried `"Motion bundles accepted over SlopSync."` and five
    `slopmotion-*` channel names; both were respelled (T11) and the fixture's
    etag moved `b69eb06249ebe73a` -> `1f0244534f758694`. `valence_lint`'s
    two frozen-artifact hashes were re-pinned in the same commit; the
    fixtures' ENCODED bytes did not move, only their header comments.
  - One deviation from item 6's spelling: the MFP plugin's codec class is
    `ValenceWire`, not `Valence.Wire`. The plugin is a single file with no
    namespace and its PluginBase subclass is now `Valence`, so a namespace
    `Valence` beside a type `Valence` is a C# name collision (CS0101). The
    term of art is unchanged; only the separator is.
  - `hub/slopbench` -> `hub/bench` (CMake project and target `bench`),
    product name Valence Bench; `slopscope` -> `valence_trace` (Valence
    Trace); `slopsoak` -> `valence_soak`; `ssmanager` -> `valencetool`
    (Valence Tool); the `slopsync-canon` skill -> `valence-canon`.
- **Origin -- a rebrand, ruled, with the wire-visible half deferred to this
  queue.** The ecosystem is being renamed ahead of its first public tag:
  the protocol is **Valence**, the reference machine firmware is **Valence
  Drive** (repo ValenceDrive, the ESP32-P4 OSSM Flagship), the reference
  client is **Phosphor**, and the libraries are kinetic / flux / geiger. The
  code-level renames are each repo's own business; the strings a peer can
  observe on the wire are not, because they are registry facts (§5.7) and
  T11 makes every one of them a protocol change. This entry is the ONE
  atomic pass those strings ride, per the 2026-07-27 C-11 ruling that
  pre-release wire strings ARE respelled, in one commit, with fixtures and
  goldens regenerated.
- **Problem.** The name appears on the wire in seven places, every one of
  them registry-owned. Renaming the repo and leaving them is a lie a
  packet capture exposes; renaming them piecemeal is seven RFCs and seven
  pin bumps. The registry today (quoted, not remembered):
  `protocol_name: slopsync` and the spec id `slopsync/1`;
  `ws_subprotocol: "slopsync.v1"`; `mdns_service: "_slopsync._tcp"`;
  `udp_discovery.port: 21328` (0x5350, ASCII 'SP') and
  `udp_discovery.magic: "SLOP"`; `ble_identity` service and characteristic
  UUIDs `534C4F50-5359-4E43-8000-00000000000{1,2,3}` (ASCII 'SLOP' 'SY'
  'NC'); the HELLO identity note's product example `'slopdrive-32'`; the
  `limits` note naming the `slopsync` NVS namespace; and the
  `log_levels` notes citing `sloplog::Level`. SPEC.md additionally
  recommends the endpoint `/slopsync` (§13, WebSocket binding) and the
  reference catalogs carry the word inside at least one wire-visible
  description (`"Motion bundles accepted over SlopSync."`, an etag input).
- **Proposed change.** One commit in this repo, then a pin bump in every
  consumer.
  1. **Identity strings.** `protocol_name: valence`; spec id `valence/1`;
     `ws_subprotocol: "valence.v1"`; `mdns_service: "_valence._tcp"`;
     RECOMMENDED endpoint `/valence`. `proto_ver` stays **1**: the grammar
     does not change, so §4's bump rule is not triggered.
  2. **UDP discovery.** `magic: "VLNC"` (0x56 0x4C 0x4E 0x43, the same
     printable-ASCII convention as before and as the ESTOP magic, §5.5).
     `port: 22096` (0x5650, ASCII 'VP', Valence Probe), keeping the
     mnemonic-port convention. The port MUST be checked against the IANA
     registry at acceptance; if 22096 is assigned, the next free 'V?' pair
     is taken and this entry amended, never a random port.
  3. **BLE identity.** New service and characteristic UUIDs with the same
     greppable-ASCII rule: proposed `56414C45-4E43-4531-8000-00000000000{1,2,3}`
     ('VALE' 'NC' 'E1', service / write / notify as today). A phone
     scanning for the old UUID never finds a Valence hub, which is the
     intended outcome: there is no old hub in the field.
  4. **Notes and examples.** Product example becomes `'valence-drive'`;
     the NVS namespace note becomes `valence` (the P4 reference already
     stores under that name); `sloplog::Level` citations become
     `geiger::Level`. Values are untouched; these are identifier renames in
     prose that codegen copies into headers.
  5. **Wire-visible catalog text.** Every reference catalog description
     that names the protocol is respelled (T11), and the affected etags,
     the mini-catalog fixture, and the golden byte arrays are regenerated
     in the same commit. `slopsync_lint`'s frozen-artifact hashes are
     re-pinned there and nowhere else.
  6. **Repo and identifiers (not wire, listed so the pass is whole).**
     Repository SlopSync -> Valence; `lib/slopsync` -> `lib/valence`;
     include root `slopsync/` -> `valence/`; C++ namespace `slopsync::` ->
     `valence::` including `generated/registry_constants.hpp`; the JS
     client package; the MFP plugin `SlopSync` -> `Valence` and its `SlopWire`
     codec class -> `Valence.Wire` (the term of art "wire" is KEPT, per
     ruling: "on the wire", "wire format", "wire numbers" are how every
     implementer already reads this spec); tools `slopsync_probe` ->
     `valence_probe` (Valence Probe), `slopsync_lint` -> `valence_lint`,
     `slopscope` -> `valence_trace` (Valence Trace), `slopsoak` ->
     `valence_soak`; `hub/slopbench` -> Valence Bench; `test/native/
     test_slopsync_*` -> `test_valence_*`; the `slopsync-canon` skill;
     `ssmanager` -> Valence Tool; consumers' `slopsync.pin` -> `valence.pin`.
     The docs-site title and URL follow (rfc-0y5 custom domain).
- **What this deliberately does NOT propose.** A `proto_ver` bump (no
  grammar change). A transition shim that accepts both subprotocols or
  both magics: every known client and hub lives in these repos and flips
  with the pin, and a shim is exactly the compat layer the 2026-07-25
  breaking-is-allowed ruling exists to avoid. Any renumbering. Any change
  to the spec's own nouns: "hub", "client", "channel", "wire" stay; product
  names (Phosphor, Valence Drive) do not enter normative text, which keeps
  saying "client" and "reference implementation". A parked name, **Valence
  Bond**, is reserved for the pairing ceremony and trust ledger and is NOT
  spent here.
- **Receipt 2026-09-21 (evening).** The reference libraries were renamed the same day:
  kinetic (was vmotion), flux (was vglow), geiger (was vlog); log macros GLOG*. The
  five `vmotion-*` channel names in the reference catalogs and the JS fixture became
  `kinetic-*` (same byte lengths), fixture etag 1f0244534f758694 -> 0d6b06067f5ed837.
- **Compatibility.** Breaking at the string level for anything built
  against `slopsync.v1`, `SLOP`, or the old UUIDs, and allowed because
  nothing is tagged (never-renumber binds from the v1.0 tag forward). Order
  of landing: this repo in one commit (registry, SPEC, generated headers,
  vectors, fixtures, lint hashes); ValenceDrive bumps its pin and flips its
  WS port's subprotocol echo and NVS namespace in the same change; the
  archived SlopDrive-32 repo stays at the pre-rename pin and never follows.
  Sequencing note from the bench: land AFTER the val-091.13 lag A/B, since a
  pin bump mid-measurement muddies the comparison.

## RFC-061 -- TCode passthrough adapter conventions: ingest port, L0 mapping, loopback

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-b9m). Not landed. Lands
  together with
  [RFC-044](#rfc-044--client-onramp-doctrine-tcode-passthrough-as-a-client-side-adapter)
  whenever that is picked up; nothing to do until then.
- **Ruling (operator, 2026-10-01).** Accepted; lands with RFC-044. No open
  questions were posed.
- **Origin -- the first adapter needed a port and found none.** Phosphor's
  example `tcode-adapter` plugin (`plugins/examples/tcode-adapter/`) is the
  "Phosphor kernel module" SPEC §9.6 names, shipped as a tier-2 plugin. To
  receive TCode from an existing app it opens a TCP listener, and neither
  RFC-044 nor SPEC §9.6 says where. It took **8000**, the ecosystem's
  convention: MultiFunPlayer's default network endpoint is
  `tcode.local:8000`, chosen to match the TCode ESP32 firmware. That is
  folklore, the shape [RFC-059](#rfc-059----hub-advertised-scheduling-latency)
  already calls out, and the planned C# helper would have to rediscover it.
- **Problem.** RFC-044 promises "criminally easy" passthrough, and an adapter
  pair that disagrees on the port (or on what `L05` means) makes an MFP
  profile work against one Valence client and not another. Two adapters fed
  the same line must produce the same motion, and today nothing says what
  that motion is.
- **Proposed change.** All three items bind ADAPTERS; no hub duty changes.
  1. **Default ingest port.** An adapter that accepts TCode over TCP SHOULD
     listen on **8000** by default, user-configurable. Recorded once as a
     registry constant (e.g. `tcode_adapter.default_port`) and emitted by
     codegen, so no adapter hand-copies it (the T20 lesson). It is NOT a
     wire number in the §4.4 sense: no hub opens it.
  2. **L0 mapping.** Magnitude digits are a fraction (`L05` = `L0500` = 0.5).
     0 maps to the hub's `window.min`, 1 to `window.max` (roles, never
     field names); when the hub publishes no window, the target field's own
     catalog bounds. An `I<ms>` suffix is the segment duration. `S` suffixes,
     other axes and device commands (`D*`, `$*`) are ignored unless a later
     entry maps them to roles. A window not yet reported yields no target,
     never a guessed one ([RENDERING.md](RENDERING.md) §13 law 9).
  3. **Loopback by default.** The ingest socket is an unauthenticated path
     onto a session that may hold control tier. An adapter MUST bind
     loopback by default; widening it is an explicit user act, and the
     adapter SHOULD say so where the user enables it.
- **Receipt -- the interim path, so nobody reads the example as the target.**
  RFC-044 names segments or samples as the translation. The reference JS
  client cannot publish a STREAM yet (no publish wishes in HELLO, no STREAM
  sender; rfc-ts3), so Phosphor's adapter submits through its model's
  motion-input door, which today sends a `command.position` setpoint
  ([RFC-032](#rfc-032--command-and-telemetrytarget-make-commanded-motion-discoverable))
  and drops the `I` duration. That is a client limitation, not a proposal:
  once clients/js publishes, the same door emits segments and item 2's
  duration survives.
- **What this deliberately does NOT propose.** Any hub-side channel or
  parser (RFC-044's correction stands). A UDP binding (MFP also speaks UDP;
  add it when an adapter needs it). A normative L0 mapping for hubs (§15.1
  legacy edges keep whatever mapping their hub already uses).
- **Compatibility.** Additive. One optional registry constant, no frame,
  key, layout or vector changes.

## RFC-062 -- Live renderer-class selection

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-l8p). LANDED 0342526
  (2026-10-01).
- **Ruling (operator, 2026-10-01).** Accepted, with open question 1
  answered: RENDERING §12.1 RECOMMENDS boundary values informatively in CSS
  px (handheld/full near 600 to 960, the client's choice stated), and
  defines the FLOOR by derivation: the width at which the persistent strip
  still holds its mandatory controls at law 12's 40 px targets. Below the
  floor no client degrades further; a desktop client MUST enforce the floor
  as its OS minimum window size (Phosphor: 320 today); phones sit above it
  by construction. Prior art cited: Material 600/840 dp, Windows 640/1008
  epx, Apple size classes. Open question 2: as drafted, a hub never needs
  a client's class. Item 2 below now reads so.
- **Origin:** Phosphor ph-vdk.5. The reference client runs in a resizable
  desktop window, on a phone that rotates and splits its screen, and on a
  tablet that is touch-driven and desktop-sized at once. It has no class
  model, only a width breakpoint that swaps navigation, because RENDERING
  §12 says only that a device "between two classes adopts the nearer one"
  and calls that "a deployment choice". A window is not a deployment: its
  budget changes while the operator is holding a control.
- **Problem.**
  1. **Class is specified as a constant.** RENDERING §12 and the registry
     `renderer_classes` note assume one display and one input model for
     life. Nothing says when, or whether, a client re-derives its class, so
     two conformant clients at the same window size may render different
     page trees, and §11's consistency invariant ("differing only by class
     projection") cannot be tested.
  2. **§8.3 couples the input model to the class.** A large touch tablet is
     `full` by budget and touch by input; §8.3 gives it pointer primitives,
     and law 12's touch-target floor then depends on a size breakpoint
     rather than on the finger.
  3. **Nothing protects in-flight state across a switch.** A class change
     rebuilds the page tree. Without a rule, a rebuild can drop a pending
     write's lifecycle display (law 5), resolve or lose an open confirm,
     commit a half-finished drag, or move the operator to a different
     category mid-task.
  4. **Law 10 keys persisted layout on stable ids but not on class.** A
     card order arranged on a desktop is applied to the phone projection of
     the same catalog, where nobody chose it.
- **Proposed change.** New RENDERING §12.1 "Class selection"; §12's "adopts
  the nearer one" sentence becomes a pointer to it.
  1. **Inputs.** Class is a function of two inputs: the *usable viewport*
     (the area the client may draw in after host chrome, in the host's
     device-independent length units, never device pixels) and the *primary
     pointer*: `none` (rotary encoder, keys), `coarse` (touch) or `fine`
     (mouse, stylus).
  2. **Selection.** Primary pointer `none` selects `glance`. Otherwise the
     client compares the usable viewport against two client-chosen
     boundaries, glance/handheld and handheld/full. This document
     RECOMMENDS values informatively, in CSS px: handheld/full near 600 to
     960, the client stating its choice. It defines the **floor** by
     derivation: the usable width at which the persistent strip still holds
     its mandatory controls at law 12's 40 px targets. Below the floor no
     client degrades further, and a desktop client MUST enforce the floor as
     its OS minimum window size (Phosphor: 320 today); phones sit above it
     by construction. Prior art: Material 600/840 dp, Windows 640/1008 epx,
     Apple size classes. (The draft had said: no boundary values, §1:
     nothing here is a pixel.) A client SHOULD choose its boundaries so that
     every control of the selected class meets law 12's floor at that
     size.
  3. **Input primitives follow the pointer, not the class.** §8.3's input
     columns are selected by the primary pointer: `coarse` gets the
     `handheld` primitives (tap, modal confirm, touch-target floor) at any
     class, `fine` gets the `full` primitives, `none` gets the `glance`
     primitives. The class selects projection and default surfacing (§12
     table) only.
  4. **Continuous re-derivation (MUST).** A client whose usable viewport or
     primary pointer can change at runtime MUST re-derive its class whenever
     either changes. A client whose inputs never change (an OLED remote)
     derives once; nothing changes for it.
  5. **Hysteresis (MUST).** Each boundary has a band. The class moves up
     only when the viewport exceeds the boundary plus the band, and down
     only when it falls below the boundary minus the band. The band SHOULD
     be at least 10 percent of its boundary. A class change MUST be deferred
     while a gesture is in progress (an uncommitted drag, a held encoder
     press) and applied when the gesture ends.
  6. **Invariants across a switch (MUST).**
     - Reachable content does not change (restates §12).
     - The active category is preserved: the category page the operator is
       on remains the active root. On `glance` the menu stack is rebuilt to
       that category's root.
     - Pending write state is preserved: every in-flight intent keeps its
       §8.1 lifecycle state, and the control rendering it after the switch
       shows that state. A switch MUST NOT send, resend, or cancel an
       intent, and MUST NOT commit a gesture that was not released.
     - An open `overlay` confirm either survives the switch with its content
       or is dismissed as canceled. A switch MUST NOT resolve a confirm as
       accepted.
     - The `stop` affordance stays reachable throughout, including during
       the rebuild (law 1, §9 `persistent`).
  7. **Persisted layout is per class (MUST).** A client that persists layout
     keys it on the pair (class, stable id). A layout saved under one class
     MUST NOT be applied under another; returning to a class restores that
     class's own layout. Law 10 gains this sentence.
- **Wire impact.** None. Rendering only; class never crosses the wire.
- **Registry impact.** `renderer_classes` note text: "A device between
  budgets adopts the nearer class" becomes a pointer to RENDERING §12.1. No
  number moves.
- **Conformance impact.** New RENDERING §12.1; §8.3 reframed (input columns
  keyed by primary pointer); law 10 extended. Testable device-free: drive a
  fixture catalog through a viewport sweep in both directions and assert the
  class sequence, the preserved category, and an in-flight intent's
  lifecycle state across the switch (Phosphor ph-vdk.9 is that harness).
- **Open questions (answered 2026-10-01; see Ruling).**
  1. §11's consistency invariant is only as strong as the boundaries.
     Should this document RECOMMEND boundary values, informatively and in
     physical length, so two clients at the same size pick the same class?
  2. Does a hub ever need to know a client's class? This RFC assumes not.

## RFC-063 -- A wire carrier for the `destructive` flag

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-c5u). LANDED 778d534
  (2026-10-01). Item 6, the RENDERING §5.4 pointer repair (spec
  contradiction bead rfc-dmf), lands with it.
- **Ruling (operator, 2026-10-01).** Accepted as drafted: `setting_flags`
  gains `destructive`; schema-field key `destructive_options` (64-bit
  mask); `action.reboot`/`action.reset` imply it; `source.background_run`
  stays confirm-gated by role (open question 2 confirmed); item 6's pointer
  repair lands with it. Open question 1: as drafted, no entry-level flag.
- **Origin:** Phosphor ph-vdk.4 and ph-vdk.3. Building the confirm layer
  RENDERING requires, the reference client found that the flag it is told
  to confirm on cannot arrive.
- **Problem.**
  1. **A MUST with no carrier.** RENDERING §8.2 row 6 ("destructive flag ⇒
     mandatory confirm, every class"), §8.4 `trigger` ("`destructive` flag
     ⇒ mandatory confirm, every class, no exception"), §10.1 rule 2
     ("exactly as a `destructive`-flagged `trigger`") and the registry
     `ui_archetypes` `trigger` note all bind client behavior to a
     `destructive` flag. SPEC §8.8 defines `flags` as the `setting_flags`
     bitmask with three bits (`advanced`, `restart_required`, `secret`), and
     the catalog CDDL has no other carrier. No hub can set the flag and no
     client can read it, so the confirm rule is unimplementable, and a
     client that tries anyway guesses from labels, which law 6 forbids.
  2. **Op selects need per-op granularity.** Most verbs ride op selects: one
     `action.*` schema field whose `options` are the ops (the SPEC §8.8
     `option_access` rationale). One field-level flag cannot say that
     `clear_fault` is harmless and a factory reset is not.
  3. **A dangling pointer.** RENDERING §5.4 sends the reset confirm to "the
     destructive-trigger contract (§8.7)"; RENDERING has no §8.7.
- **Proposed change.**
  1. **`setting_flags` gains `destructive`.** On a schema field carrying an
     `action.*` role it means: invoking this verb loses state the operator
     cannot restore from the client (configuration, stored items, counters,
     sessions, uptime). On a writable layout field (`setting_key` present)
     it means: writing this setting has that effect.
  2. **Per-option mask for op selects.** A new optional schema-field key,
     `destructive_options`: a uint bitmask whose bit *i* marks option *i*
     destructive. Options past bit 63 cannot be marked; an op table that
     needs more splits across fields. A scalar keeps the field map inside
     the §8.1 depth-4 budget.
  3. **Resolution.** An invocation is destructive iff the field carries the
     `destructive` flag, or the invoked option's bit is set in
     `destructive_options`, or the field's role is `action.reboot` or
     `action.reset`. The two tags imply it because their registry notes
     already require confirmation; a hub need not restate it.
  4. **Client rule (MUST).** A client MUST confirm-gate every destructive
     invocation on every class with the §8.3 primitive (long-press on
     `glance`, modal confirm otherwise), rendered in the `overlay` region
     (§9). The confirm names the op by its catalog label. A client MUST NOT
     infer destructiveness from labels, names, or `desc`.
  5. **Hub rule.** The flag is rendering metadata. A hub MUST NOT change
     wire behavior on it and MUST NOT assume a confirm happened: the confirm
     protects an operator from a mis-tap, not a hub from a client.
  6. **Pointers repaired.** RENDERING §5.4's "(§8.7)" becomes "(§8.4
     `trigger`)". §8.2 row 6 and §8.4 `trigger` cite SPEC §8.8 for the
     carrier.
- **Wire impact.** Additive: one new bit in an existing bitmask and one new
  optional schema-field key. Per SPEC §8.9 item 8 an older client renders an
  unknown flag generically, i.e. without a confirm, which is today's
  behavior; nothing gets worse. Etags move only for catalogs that adopt it.
- **Registry impact.** `setting_flags` gains `destructive`; the registry
  owner allocates the bit. The catalog CDDL `schema-field` gains
  `destructive_options`; the registry owner allocates the key. The
  `ui_archetypes` `trigger` note cites the new bit. No existing number
  moves.
- **Conformance impact.** RENDERING §8.2 row 6 and §8.4 become testable: a
  fixture catalog with a flagged trigger, a masked op select and an
  `action.reboot` field, asserting a confirm for exactly the destructive
  invocations and for no others. Reference-hub authoring follow-up: flag
  the destructive admin and preset ops.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Should `destructive` also be legal at entry level, gating every
     writable field of a channel? This RFC says no: per field keeps one home.
  2. `source.background_run` false-to-true (RENDERING §10.1 rule 2) stays
     confirm-gated by role, not by this flag, so no hub can forget it.
     Confirm that split.

## RFC-064 -- Index-0 filler applies to op selects only

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-8pk). LANDED fe50cc4
  (2026-10-01).
- **Ruling (operator, 2026-10-01).** Accepted as drafted. Open question 2
  (the archetype hint) was carried and ruled by
  [RFC-083](#rfc-083----the-archetype-hint-is-struck-color-and-datetime-bind-by-role):
  option B, the hint is struck.
- **Origin:** Phosphor ph-vdk.3, implementing generic select rendering from
  both documents at once.
- **Problem -- the two documents contradict.** SPEC §8.9 (the paragraph
  [RFC-034](#rfc-034--placeholder-entries-in-options-lists) landed) scopes
  the filler rule exactly: "For a `schema` select field carrying an
  `action.*` role, wire value 0 is NOT an operation unless the governing op
  table registers an op at 0". RENDERING §8.4 `select` drops the scope:
  "index 0 is a filler label (SPEC §8.9) and MUST NOT render as
  actionable", i.e. on every select. Followed literally, RENDERING breaks
  ordinary settings: the reference hub's `pattern.select` field has index 0
  = "Simple Stroke", its factory default, and a client obeying RENDERING
  §8.4 can never select the default pattern. Read-only selects break the
  same way (the reference `plan_kind` readout's index 0 `none` is a real
  state). RENDERING yields to the registry on conflict, but neither document
  says which wins against the other, so a client author must guess.
- **Proposed change.**
  1. **The rule binds op selects only.** An *op select* is a `schema` field
     carrying an `action.*` role and `options`. On an op select, index 0 is
     filler unless the governing op table registers op 0, and MUST NOT be
     rendered as actionable. SPEC §8.9 wording stands unchanged.
  2. **Every other select treats index 0 as a real value.** A layout field
     with `options` (writable or read-only) and a schema field with
     `options` and no `action.*` role render index 0's label, offer it as a
     choice where writable, and adopt it from ground truth like any other
     value.
  3. **RENDERING §8.4 `select` note corrected** to: "Index-aligned. On an op
     select (SPEC §8.9) index 0 is filler and MUST NOT render as actionable;
     on every other select index 0 is a real value."
  4. **Authoring note (informative).** A settings select that wants a
     "none" choice declares it at index 0 as a real, selectable option.
- **Wire impact.** None.
- **Registry impact.** `ui_archetypes` `select` note gains "index 0 is filler
  only on op selects (SPEC §8.9)". No number moves.
- **Conformance impact.** Fixture: one settings select, one read-only select
  and one op select, each with a meaningful label at index 0; assert index 0
  is selectable, displayed, and not actionable respectively.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. None on the filler rule itself. It is a correction, queued because
     RENDERING is normative and changes to it ride the queue.
  2. **The same two documents contradict on the archetype hint (bead
     rfc-vdc).** RENDERING §8.2 row 1 derives from an "Explicit `archetype`
     annotation" that "always wins", rows 16-17 depend on it, and §14(c)
     gives it an unknown-value rule. SPEC §8.9 item 3: "choose the widget
     from **type + constraints, never from a hint** -- there is no widget
     field, deliberately", and the catalog CDDL defines no archetype key. No
     renderer, of any class, can implement §8.2 as written while §8.9
     forbids the input it starts from. Resolve in this RFC's ruling or a
     sibling: either register an optional archetype key and amend §8.9
     item 3, or strike row 1 and give `pad2d`, `color` and `datetime` a
     role-based trigger.

## RFC-065 -- Event-channel purpose roles and event-kind labels

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-x3n). LANDED b46c2d9
  (2026-10-01). Closes SPEC §18 item 2 on landing.
- **Ruling (operator, 2026-10-01).** Accepted as drafted, with open
  question 1 answered yes: the STATE twin carries the channel role
  `anomaly.summary`, so log and counters bind together (item 1 below now
  registers it). Open question 2: as drafted, nothing further pre-tag.
- **Origin:** Phosphor ph-vdk.7 and ph-vdk.14. The reference client finds
  the anomaly channel by regex over the entry NAME, which law 6 forbids,
  because nothing else identifies it; it then prints anomaly kinds as bare
  numbers except where the hub smuggles a label in. The reference hub
  (Nucleus, `motion-anomaly`) mirrors `event_kind` (33) into `body` key 1 as
  a select field with `options`, and says why in its catalog source: "the
  catalog has no vocabulary for LABELING event kinds, and `options` on a
  schema field is the one registered mechanism for turning a number into a
  name."
- **Problem.**
  1. **No identity for a device-authored EVENT channel.** Field roles
     (SPEC §8.8) are per field; an EVENT's purpose is a property of the
     whole entry. Spec-core EVENT channels are bound by id (law 2), but a
     device-authored anomaly channel has only its name, so every client
     either name-matches (law 6 violation) or shows it as one more generic
     stream in `diagnostic` rank, where an operator misses it.
  2. **No labels for device-authored kinds.** SPEC §18 item 2 states the gap
     and defers it: "The fix is an additive entry-level annotation and is
     deliberately deferred rather than guessed at." The body-mirror
     workaround duplicates the discriminator (two homes for one number) and
     does not generalize to a kind whose body has no room for it.
- **Proposed change.**
  1. **Entry-level purpose role.** A new optional entry key `role` (tstr,
     at most 24 bytes) naming a registered *channel role*, a new
     string-valued registry vocabulary with the `field_roles` doctrine:
     unregistered values are legal, recognition is an opportunity, generic
     fallback is mandatory. This RFC registers one value, for EVENT entries:
     `events.anomaly`: edges reporting that the machine did something other
     than what it was asked (a clamped command, a planner fallback, a
     rejected plan). Its latched counters, where present, are the §9.4
     STATE twin. Unlike a field role, a channel role MAY appear on more than
     one entry; a client renders each, ascending by id. A second value, for
     STATE entries: `anomaly.summary`, the latched counters that are the
     STATE twin of an `events.anomaly` channel, so a client binds the log
     and its counters together (ruling on open question 1; the draft
     registered `events.anomaly` alone).
  2. **Binding rule (MUST).** A client that gives anomaly events a
     dedicated surface (RENDERING §10 `event-stream`, a safety-adjacent
     log) MUST select the channels by `events.anomaly` or by core identity,
     never by name. A channel without the role renders as an ordinary
     `event-stream`.
  3. **Entry-level `event_kinds` label table.** A new optional EVENT-entry
     key: a map uint to tstr (label at most 24 bytes), labeling that
     channel's `event_kind` values. Depth: entry, map, tstr = 2. Counts
     against `catalog_max_entry_bytes`.
     - **Append-only (MUST).** Across firmware versions a released kind
       value is never reassigned a different meaning; a retired kind keeps
       its entry.
     - **One home.** The table MUST be absent on spec-core channels, whose
       kinds are registry tables (`session_event_kinds`, `log_event_kinds`,
       `pairing_event_kinds`, `safety_event_kinds`).
  4. **Rendering (MUST).** A client renders an event's kind by its label;
     a kind with no label (or a channel with no table) renders as its
     decimal number. Never dropped, never guessed from `body`.
  5. **The workaround retires.** A hub MAY keep mirroring the kind into
     `body`; a client MUST take the kind from `event_kind` (33) and its
     label from the table.
- **Wire impact.** Additive: two optional entry-level catalog keys. Decoders
  skip unknown keys (§4.3). Etags move only for catalogs that adopt them. No
  frame changes.
- **Registry impact.** New string vocabulary section (proposed name
  `channel_roles`) with `events.anomaly` and `anomaly.summary`. Catalog CDDL `entry` gains `role`
  and `event_kinds`; the registry owner allocates both keys. SPEC §18 item 2
  struck; §9.4 gains one paragraph pointing here.
- **Conformance impact.** Fixture: a device EVENT entry carrying both keys,
  one kind labeled and one not; assert the channel is found with its name
  changed, the labeled kind renders by label, the unlabeled one by number.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Should the STATE twin carry a role too (for example
     `anomaly.summary`) so the event log and its counters bind together?
  2. Other EVENT purposes worth registering pre-tag (a procedure-completion
     stream, RFC-020)? This RFC registers only the one with a shipping
     instance.

## RFC-066 -- Modulators: catalog-declared modifiers attached to the field they ride

- **Status:** ACCEPTED AS AMENDED (operator, 2026-10-01; rfc-0sm). LANDED
  b75e482 + affa61a (2026-10-01). Retitled from "Advanced-generator lanes
  are catalog-declared instances": the term "lane" is retired, the role
  family is `mod.*`, one modulator per entry, attached to its base field by
  `mod_target`. Lands together with
  [RFC-081](#rfc-081----advanced-generator-master-roles) (accepted the same
  day), whose `advgen.*` base controls are what modulators target. Resolves
  spec contradiction bead rfc-oy6 (SPEC §8.8 per-catalog role cardinality)
  by construction rather than by exemption, and the modulator half of
  rfc-bf4.
- **Ruling (operator, 2026-10-01).** Accepted as amended: retitle to
  modulators; term "modulator", role family `mod.*` on the modulator's
  fields (`mod.amount`, `mod.rise`, `mod.hold`, `mod.fall`, `mod.rest`,
  `mod.phase`, plus optional `mod.shape`, a select; absent = the cycling
  trapezoid); the field unit carries the clock (strokes or seconds) and no
  role bakes in a time base; one optional entry-level key `mod_target` on
  the modulator's channel naming the field it rides as (channel id, field
  index), the RFC-078 relationship-target addressing; one modulator per
  entry is the normative shape and no §8.8 cardinality exemption is needed;
  a complete modulator renders as a group attached under its target
  wherever that field is placed; `generator-advanced` is the RFC-081 base
  controls plus whatever modulators target them, and the "four or more"
  minimum is withdrawn; `mod.amount` is defined clean (0 = no modulation),
  and Nucleus flips its 100 = off field semantic in the same release.
  Open questions answered: (1) yes, a machine-readable link, and it is
  `mod_target`; (2) separately, as RFC-081, landed together; (3) the family
  is `mod.*` and "lane" is retired. **The draft had said:** six `lane.*`
  roles on a fixed lane shape, one lane per STATE channel, lane roles exempt
  from §8.8's per-catalog cardinality, at least four lanes drawn in id
  order.
- **Origin:** Phosphor ph-vdk.11. Building the REQUIRED `generator-advanced`
  pattern (RENDERING §10) against the reference hub, whose shape disagrees
  with the spec's.
- **Problem.** (Kept from the draft; it is the receipt.)
  1. **Four in the spec, six on the wire.** RENDERING §2.2 defines the
     advanced generator as "master state + four modifier lanes (in-speed,
     out-speed, in-accel, out-accel, each `{ctrl, amplitude, step, wait,
     offset}`)"; §10 and the registry `widget_patterns` note repeat "four".
     The reference hub (Nucleus) emits SIX lanes, one STATE channel each
     (speed-in, speed-out, accel-in, accel-out, depth-1, depth-2), and its
     lane field set is `{amplitude, in_step, in_wait, out_step, out_wait,
     offset}`, not the spec's five fields. A renderer built to RENDERING
     draws four lanes and drops two; one built to the hub is not
     RENDERING-conformant.
  2. **Nothing identifies a lane.** No field role exists for any lane field
     or for the advanced generator at all, so a renderer can bind the
     pattern only by channel or field name, which law 6 forbids. Law 7 then
     makes the REQUIRED pattern undeclarable in conformance terms: its
     essential bindings have no names a client may use.
  3. **The role cardinality rule blocks the obvious fix.** SPEC §8.8: "A
     registered role SHOULD appear on at most one field per catalog". A lane
     role repeats once per lane by construction.
  4. **RENDERING's `ctrl` has no carrier.** The spec's lane names the base
     control it modulates; the wire has no field or key that does, so a
     renderer cannot put a modifier next to the thing it modifies.
- **Proposed change (as accepted).**
  1. **The term.** A *modulator* is a periodic modifier that rides one base
     field of a generator: it swings that field's effective value by its
     amount through a cycle. "Lane" is retired everywhere it named this
     concept (RENDERING §2.2 and §10, the registry `widget_patterns` note).
  2. **The roles.** Registered `field_roles`, on the modulator's own fields:
     - `mod.amount`: how far the modulator swings its target. **0 means no
       modulation**, cleanly: a modulator at 0 leaves its target exactly at
       its base value.
     - `mod.rise`, `mod.hold`, `mod.fall`, `mod.rest`: the four phases of
       the cycle (rising toward the swing, held there, falling back, resting
       at base).
     - `mod.phase`: the cycle's offset against its siblings.
     - `mod.shape` (OPTIONAL): a select naming the waveform. Absent means
       the cycling trapezoid the four phase roles describe.
     The field's unit carries the clock: a phase counted in strokes declares
     `count`, one counted in seconds declares `s`. No role bakes in a time
     base. The reference hub's six fields map one to one: `amplitude` to
     `mod.amount`, `in_step` to `mod.rise`, `in_wait` to `mod.hold`,
     `out_step` to `mod.fall`, `out_wait` to `mod.rest`, `offset` to
     `mod.phase`.
  3. **One modulator per entry.** A STATE entry carrying `mod.amount`,
     `mod.rise`, `mod.hold`, `mod.fall`, `mod.rest` and `mod.phase` is one
     complete modulator; each `mod.*` role appears at most once per entry. A
     client binds a modulator only when all six are present (law 7); a
     partial set falls through to generic rendering. The modulator's display
     label is its fields' `group`.
  4. **`mod_target` (new optional entry-level key).** On the modulator's
     channel entry, naming the field it rides as `[channel id, field
     index]`: the layout index of a layout field, the same
     (channel, field) addressing
     [RFC-078](#rfc-078----accessory-conformance-profile-and-the-hub-relationship-engine)
     uses for a relationship target. Entry key number by the registry owner.
     A `mod_target` that names no field in the catalog is ignored and the
     modulator renders unattached (item 6).
  5. **No cardinality exemption.** A modulator is found through its own
     entry and attached through `mod_target`, never through a catalog-wide
     role search, so §8.8's one-per-catalog SHOULD and its
     first-in-catalog-order tiebreak are never the binding path and no
     exemption is written (operator ruling).
  6. **Rendering.** A complete modulator with a resolving `mod_target`
     renders as a group attached under its target, wherever that field is
     placed: on a derived page, inside `generator-advanced`, or on a
     user-authored surface
     ([RFC-080](#rfc-080----user-authored-surfaces-and-presentation-choice)).
     A complete modulator with no resolving target renders as its own group
     in the generator's `settings-card`. A renderer MUST draw every declared
     modulator and MUST NOT cap the count.
  7. **`generator-advanced` is the base controls plus their modulators.**
     The pattern binds on RFC-081's essential bindings (the `advgen.*` base
     controls and `pattern.running`) and draws whatever modulators target
     them. The "four or more" minimum is withdrawn: zero modulators is a
     legal advanced generator.
  8. **Text corrected.** RENDERING §2.2 ("master state + four modifier
     lanes ...") and §10 `generator-advanced`, and the registry
     `widget_patterns` note, read "master controls (RFC-081) plus whatever
     modulators target them (RFC-066)".
- **Wire impact.** Role strings (catalog text) and one optional entry-level
  key; an adopting hub's etag moves (T11). No frame changes. Reference
  cost: 36 role annotations and six `mod_target` keys across six entries,
  far inside `catalog_max_entry_bytes`.
- **Registry impact.** `field_roles` gains `mod.amount`, `mod.rise`,
  `mod.hold`, `mod.fall`, `mod.rest`, `mod.phase`, `mod.shape`; the catalog
  CDDL `channel-entry` gains `mod_target` (`[uint, uint]`, number by the
  registry owner); `widget_patterns` `generator-advanced` note text. No
  number already in use moves.
- **Conformance impact.** Fixture: an advanced generator with six
  modulators, each `mod_target`ing one base control, plus a decoy entry
  carrying five of the six roles; assert each modulator renders under its
  target, the decoy renders generically, and a modulator whose target is
  placed on a user-authored surface renders there. A modulator at
  `mod.amount` 0 leaves its target at base.
- **Compatibility.** Nucleus follow-up, same release: the seven role
  annotations and `mod_target` on its six modulator entries, and
  `amplitude` flips from "100 = off" to "0 = no modulation". Phosphor:
  bind by `mod.*` and `mod_target`, drop the lane renderer.
- **Open questions.** All answered by the ruling above.

## RFC-067 -- Store verbs: one registered op select, not split preset tags

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-2n5). LANDED 1a50ff8
  (2026-10-01).
- **Ruling (operator, 2026-10-01).** Accepted as drafted: tag named
  `store` (open question 1), `store_ops` {`save` 1, `load` 2, `delete` 3,
  `rename` 4}, `preset_save` and `preset_recall` retired pre-tag, `delete`
  destructive by registration. Open question 2 (linking the CRUD channel)
  is folded into
  [RFC-070](#rfc-070----store-to-roster-linkage)'s `store_id`, carried on
  the `action.store` INTENT entry too.
- **Origin:** Phosphor ph-vdk.11 and ph-vdk.3; the drift is the reference
  hub's. Nucleus's `pattern-presets-cmd` INTENT carries its CRUD verb as one
  op select, `{"reserved", "save", "load", "delete", "rename"}`, tagged
  `action.preset`. RENDERING §7 and the registry `action_tags` register
  `preset_save` and `preset_recall` and no `preset`. No catalog in any repo
  emits either registered tag.
- **Problem.**
  1. **The registered tags do not fit the mechanism.** SPEC §8.7 names FOUR
     store verbs riding INTENT on one device-declared channel: `save`,
     `load`, `delete`, `rename`. Two tags cover two of them; `delete` and
     `rename` have none. Both registered verbs carry parameters (`slot`,
     `name`), so a split field is not "no value payload" and RENDERING §8.2
     row 6 would not even derive a `trigger` for it.
  2. **The verbs are named but not numbered.** §8.7 spells the four verbs in
     prose and no registry table numbers them, so every hub picks its own
     option order and a client can tell `delete` from `load` only by label,
     which law 6 forbids. That matters: `delete` is destructive and `load`
     is not.
  3. **Presets are one kind of store.** §8.7: "Presets, saved positions,
     limit profiles, recordings and the trust ledger are all the same
     machinery." A verb tag scoped to presets must be re-registered for
     every other kind.
- **Proposed change (recommended option: register the op-select
  convention).**
  1. **Register `store_ops`**, an op table numbering SPEC §8.7's verbs from
     1: `save` 1, `load` 2, `delete` 3, `rename` 4. Index 0 is op-select
     filler (SPEC §8.9). As landed, op 3 is spelled `delete_item` in the
     registry (wire value 3; the prose verb stays `delete`), because
     `delete` is a C++ keyword and codegen emits the names.
  2. **Register the action tag `store`.** A schema field with role
     `action.store` is an op select whose `options` are index-aligned with
     `store_ops`. It MUST NOT declare options beyond the registered ops; a
     device-specific store verb rides a separate `action.*` field. The
     store's `kind` (§8.7), not the tag, says what the store holds.
  3. **Retire `preset_save` and `preset_recall`** before the tag. They have
     zero emitters, and "numbers bind from the v1.0 tag forward" (queue
     standing ruling) makes this the last free moment.
  4. **`delete` is destructive by registration.** Extending
     [RFC-063](#rfc-063----a-wire-carrier-for-the-destructive-flag) item 3,
     `action.store` op `delete` implies `destructive`; a hub need not mask
     it.
  5. **Reference-hub follow-up:** one role string, `action.preset` to
     `action.store`, and its option order already matches.
- **Why not the split.** Splitting into `preset_save` / `preset_recall`
  fields leaves `delete` and `rename` untagged, multiplies one channel into
  several (the §12.7 administration surface chose "one channel, not three"
  for exactly this: one rate limiter, one idempotency ring, one place a
  renderer looks), and still does not produce payload-less triggers. The
  op-select convention is what the safety-intents channel, the admin
  surface and the reference store writer already do.
- **Wire impact.** None for bytes on the frame; the reference catalog's role
  string changes, so its etag moves (T11).
- **Registry impact.** New op table `store_ops` (four entries); `action_tags`
  gains `store` and loses `preset_save` / `preset_recall` (pre-tag
  restructuring). RENDERING §7 table and count ("thirteen") follow;
  `widget_patterns` `generator-advanced` note says "preset save/recall via
  `action.store`".
- **Conformance impact.** Fixture: a STORE pair plus an `action.store` op
  select; assert four actions rendered by op number, `delete` confirm-gated,
  index 0 not actionable.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Keep the tag name `preset` (zero reference change) instead of `store`?
     This RFC prefers `store` because the verbs are kind-agnostic.
  2. Nothing links a STORE entry to its CRUD channel; the reference hub
     borrows `setting_channel` on the roster STATE. Specify that link here,
     or in a separate RFC?

## RFC-068 -- Substituted-widget conformance: bindings, host-owned regions, one intent path

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-8qh). LANDED 23a8b9d
  (2026-10-01). Companion to
  [RFC-061](#rfc-061----tcode-passthrough-adapter-conventions-ingest-port-l0-mapping-loopback),
  whose adapter already follows item 4 below.
- **Ruling (operator, 2026-10-01).** Accepted as drafted. Open question 1:
  whole-pattern or single-archetype substitution only, never part of a
  pattern. Open question 2: as drafted, nothing reaches the wire.
- **Origin:** Phosphor ph-vdk.20, from DESIGN §2 (the Prime Rule: "Plugins
  add features through Valence, not around it") and §3 (a Tier-2 plugin
  widget renders instead of the Tier-0/1 rendering for a channel). The
  reference client is landing a plugin host now (`src/plugins/host.js`:
  plugins write fields and submit motion only through host calls, each
  behind a declared permission).
- **Problem.** RENDERING §10 defines each widget pattern's bindings, region,
  extra states and projection, and §13 lists the laws a *client* obeys.
  Neither says what holds when a client lets a third-party component
  replace a pattern or an archetype instance. Three failure shapes follow,
  each a safety defect under §13:
  1. A substitute that binds fewer roles than the pattern requires renders
     a partial instrument (law 7), or drops the pattern's extra states (a
     `pattern-panel` without its `source.background_run` toggle, §10.1).
  2. A substitute that can draw anywhere can cover the `stop` affordance
     (laws 1, 11; §9 "No `content` may ever obscure or displace
     `persistent`") or draw its own confirm, forging or suppressing one.
  3. A substitute with its own path to the hub bypasses pending-to-echo
     display (law 5), access gating (SPEC §8.9 gray-never-hide), destructive
     confirms and the §9.3 intent ingress limit.
  A client's conformance claim is meaningless if loading one component can
  void it.
- **Proposed change.** New RENDERING §10.2 "Substituted widgets". Terms: the
  *host* is the conformant client; a *substituted widget* is any rendering
  component, not authored as part of the host, that the host renders in
  place of a §10 pattern or an §8 archetype instance.
  1. **Inherited contract (MUST).** A substituted widget inherits, from the
     pattern or archetype it replaces, every essential binding, every extra
     state, its region, and every §13 law. The host MUST NOT mount a
     substitute whose declared bindings do not cover the replaced pattern's
     essential bindings; it renders the pattern itself instead (law 7:
     decline, never partial).
  2. **Host-owned regions (MUST).** The `persistent` and `overlay` regions
     (§9) belong to the host. A substituted widget MUST NOT render into
     them, over them, or in any way that obscures or displaces them, and the
     host MUST enforce this structurally (the widget is given a bounded
     surface inside `primary` or `content`, never the page). Confirms are
     host-rendered: a widget requests an invocation, and the host applies
     the destructive rule (RFC-063) and its own confirm.
  3. **Safety bindings stay the host's (MUST).** The `stop` archetype and
     the `safety-strip` pattern cannot be substituted. Law 2 binds them to
     core identity; a substitute is an annotation-level choice by
     construction.
  4. **One intent path (MUST).** A substituted widget sends intents and
     stream input only through the host's intent path, which applies
     access gating, the destructive confirm, the §8.1 write lifecycle and
     rate limiting exactly as for host-rendered controls. It MUST NOT hold a
     transport, a socket, or any channel to the hub of its own. It reads
     state only from the host's shadow of the catalog and STATE (ground
     truth, law 4), never from a private copy it can let drift.
  5. **Failure is a fallback (MUST).** If a substituted widget fails (throws,
     fails to mount, or stops rendering), the host unmounts it and renders
     the replaced pattern or archetype itself. In-flight intents keep their
     lifecycle state, as across a class switch
     ([RFC-062](#rfc-062----live-renderer-class-selection) item 6).
  6. **Conformance claim.** A host that enforces items 1 to 5 structurally
     keeps its RENDERING conformance claim with any set of substituted
     widgets loaded. A host that cannot enforce them for some component
     (for example, one given unrestricted page access) MUST NOT claim
     conformance while that component is loaded.
- **Wire impact.** None. Nothing here is visible to a hub; a hub cannot
  tell a substituted widget's intent from the host's, which is the point.
- **Registry impact.** None. `widget_patterns` notes unchanged.
- **Conformance impact.** New RENDERING §10.2; one sentence in §13 pointing
  at it. Testable device-free with a hostile fixture widget that tries to
  draw over `persistent`, open its own confirm, and bind a partial role
  set; assert each attempt is contained and the stop affordance stays
  reachable.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Should a substitute be allowed to replace only part of a pattern (one
     lane of `generator-advanced`), or always the whole pattern? This RFC
     assumes the whole pattern or a single archetype instance.
  2. Does anything about substitution need to reach the wire (a hub
     wanting to know its operator's UI is third-party)? This RFC says no.

## RFC-069 -- Client-pushed WiFi provisioning over BLE

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-qf5). LANDED 4f98e6b
  (2026-10-01). Item 4's secret-ECHO encoding (spec contradiction bead
  rfc-bry) lands with it and binds every `secret` field: §8.8 Secrets reads
  "ECHO confirms application by carrying the applied key with the CBOR value
  `true` in place of its value, so §9.3's key-completeness holds; a client
  decoding `applied` against the schema MUST accept `true` for a
  `secret`-flagged key whatever the field's type." Its one-time companion
  [RFC-054](#rfc-054--wifi-and-esp-now-provisioning-over-ble-the-credentials-handoff)
  is WITHDRAWN.
- **Ruling (operator, 2026-10-01).** Accepted as drafted (the gate already
  admits BLE GATT, serial and in-process), with the ruling that the §13.5
  USB serial binding is a first-class provisioning path beside BLE: in
  config mode
  ([RFC-079](#rfc-079----config-mode-and-the-setup-category)) both are
  active at once and both accept `wifi_join`. Open question 2: no
  hub-published SSID scan list; the client enters the SSID. Open question
  1: moot, RFC-054 is withdrawn and no ESP-NOW key material exists to carry
  (the RFC-075 spoke is unencrypted). Reference provisioning client: a
  public browser tool (Web Bluetooth + Web Serial) hosted from the docs
  site, bead rfc-cat.
- **Origin:** Phosphor ph-vdk.24 (the provisioning `wizard`, RENDERING §10).
  RFC-054 frames only one direction: a hub that already knows its WiFi
  credentials disclosing them to a BLE client. The first-run case runs the
  other way. A factory-fresh hub has no network; the operator's phone has
  the credentials and a BLE link (the hardware-hub conformance floor, §13).
  No conformant surface carries credentials INTO a hub, so the wizard
  pattern has nothing to drive.
- **Problem.**
  1. **No discoverable writer.** The settings metamodel could carry an SSID
     and a `secret` passphrase, but nothing lets a generic client find that
     channel on a hub it has never met without a role or core identity, and
     the first run is exactly the hub it has never met.
  2. **The outcome is later than the write.** A join takes seconds and can
     fail (wrong passphrase, no such network). §9.3's ECHO means "applied";
     the procedure pattern that handles long operations reports its outcome
     on a broadcast STATE channel.
  3. **The secret-echo rule is underspecified.** SPEC §8.8: "ECHO confirms
     application **without echoing the value**". §9.3: "a key **absent** from
     the ECHO means NOT applied". A hub cannot satisfy both without an
     encoding neither section gives.
  4. **The gate is unstated.** RFC-054's security floor (configure tier,
     pairing window, BLE link security, never STATE, never broadcast, never
     logged) is written for disclosure only.
- **Proposed change.**
  1. **A core provisioning channel.** A new spec-core INTENT channel,
     `provisioning` (`0x000F` as landed, status reserved), `configure`
     access, with an op select (`action.provision`) over a registered op
     table `provisioning_ops`. This RFC registers op `wifi_join` (the draft
     left room for RFC-054's disclosure op; RFC-054 is withdrawn). A core id, not a
     device channel plus role, because the first-run client binds by
     identity (law 2's reasoning) and a headless hub has no other surface.
  2. **`wifi_join` schema:** `op`, `ssid` (tstr), `passphrase` (tstr, MAY be
     empty for an open network). Both credential fields carry the `secret`
     flag. Schema keys allocated with the channel.
  3. **Gate (MUST).** The hub accepts `wifi_join` only when all hold: the
     session holds `configure`; a §12.3 pairing association window is open,
     or the hub is factory-fresh (zero `configure` tokens, §12.3c); the
     frame arrived on a BLE GATT, serial, or in-process binding. Otherwise
     NACK `ACCESS_DENIED`. A network binding is refused because it rides the
     network being changed and is cleartext (H4); BLE requires physical
     proximity. A hub SHOULD require LE Secure Connections on the link
     (§12.9).
  4. **Unicast-only result.** The hub defers the reply until the join
     attempt concludes or `provision_join_timeout_ms` (new limit) elapses.
     Success: ECHO, whose `applied` carries `op`, carries each credential key
     with the CBOR value `true` in place of its value (the general encoding
     of §8.8's "without echoing the value", which this RFC makes normative for
     every `secret` field), and carries the resulting `ipv4` and `ws_port`
     under their channel-schema keys. Failure: NACK with a new code,
     `NETWORK_JOIN_FAILED` (`0x0304` as landed), whose `detail` MUST NOT contain either
     credential. ECHO and NACK already go to the sender only (§9.3). A
     duplicate `intent_id` during the attempt joins it; it MUST NOT start a
     second attempt.
  5. **No stranding (MUST).** A hub that already has working credentials
     keeps them until the new ones join successfully; a failed join leaves
     the prior configuration in effect.
  6. **Never disclosed (MUST).** Credentials never appear in STATE, in any
     EVENT (including the log channel, §16.2), in GOODBYE or NACK `detail`,
     in any diagnostic surface, or in the ECHO of any other session. Public
     consequences are not secret and ride their existing homes: `ipv4` and
     `ws_port` in WELCOME (§6.3), `ble_adv_flags.ws_available` (§13.4). A
     client MUST NOT log or persist the credentials beyond the send.
  7. **Then the upgrade.** On success the client SHOULD perform the §6.3
     migration to WS (from BLE or from serial) using the returned endpoint.
     The §13.5 USB serial binding is a first-class provisioning path beside
     BLE GATT, not a fallback (ruling).
- **Wire impact.** Additive: one core INTENT channel, one op table, one NACK
  code, one limit. The secret-ECHO encoding is a clarification that binds
  existing `secret` fields; no shipped hub is known to echo one today.
- **Registry impact.** `core_channels` gains `provisioning` (INTENT);
  new `provisioning_ops` (`wifi_join`); `action_tags` gains `provision`;
  `nack_codes` gains `NETWORK_JOIN_FAILED`; `limits` gains
  `provision_join_timeout_ms`. Numbers as landed: channel `0x000F`
  (status reserved), `NETWORK_JOIN_FAILED` `0x0304`. The `setting_flags` `secret` note gains the
  ECHO encoding.
- **Conformance impact.** Behavioral tests: refused over WS; refused with
  the window closed; success ECHO carries `true` for both credentials;
  failure leaves prior credentials in effect; the log ring and every STATE
  snapshot captured during the run contain neither credential bytes.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. ESP-NOW material (RFC-054 item 2) in the same op table, or later?
  2. Should the hub scan and publish visible SSIDs for the wizard to offer?
     A scan list is not secret but is a privacy surface; this RFC leaves
     SSID entry to the client.

## RFC-070 -- Store-to-roster linkage

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-ind). LANDED a7c9295
  (2026-10-01).
- **Ruling (operator, 2026-10-01).** Accepted with the CRUD link folded in:
  `store_id` (entry key 17) on the roster STATE entry AND on the
  `action.store` INTENT entry, so one key joins store, roster and writer.
  Optional, consistent with the other rendering annotations (open question
  3), with a catalog lint warning when a roster-shaped STATE lacks it. Open
  question 2 answered by the fold. Open question 1 is a Nucleus follow-up
  on its own board, unchanged. Items 1 to 3 below now read so.
- **Origin:** Phosphor ph-vdk.11. Building the REQUIRED `generator-advanced`
  pattern's preset store against the reference hub: a renderer that has
  found a STORE entry and a STATE entry shaped like §8.7's dynamic half
  still cannot prove one enumerates the other without comparing names.
- **Problem.**
  1. **§8.7 defines a pair and no key joining it.** "The dynamic half is a
     separate tiny STATE channel carrying `{generation, count, capacity}`...
     Every store in the protocol is this pair of entries," but no field on
     either entry names the other. RENDERING §8.2 row 5 ("STORE-class
     channel + its roster STATE pair (SPEC §8.7)" -> `list`) already assumes
     the pairing is known, which begs the question this RFC answers.
  2. **The only working method today is name matching**, which law 6
     forbids ("a conformant client never pattern-matches a channel or field
     *name*"). The reference hub's own pair, `paired-devices` (0x000C) /
     `paired-devices-roster` (0x000D), is adjacent-id and suffix-named by
     convention only; nothing in the catalog says the second is the first's
     roster rather than an unrelated STATE channel that happens to sit next
     to it.
  3. **Consequence for `generator-advanced`.** The preset store's roster
     cannot be sited inside the store's own card next to its verbs
     ([RFC-067](#rfc-067----store-verbs-one-registered-op-select-not-split-preset-tags)'s
     `action.store` op select); law 7 then makes the pairing undeclarable,
     so a conformant client renders the roster as a bare, disconnected list
     with no visible relationship to the store it enumerates.
- **Proposed change.**
  1. **A new optional channel-entry key, `store_id`** (channel-entry map key
     17, the next free entry-level slot after RFC-048's `rank` at 16;
     `uint`, same u8 vocabulary as `store-descriptor` key 1 / `blob_keys`
     key 2). Applies to a **STATE**-class entry whose layout is exactly
     `{generation, count, capacity}` (§8.7's dynamic half), naming the
     `store_id` of the STORE entry it enumerates, AND to the INTENT entry
     carrying the `action.store` op select
     ([RFC-067](#rfc-067----store-verbs-one-registered-op-select-not-split-preset-tags))
     that writes that store's items. One key joins store, roster and writer
     (ruling; the draft linked roster to store only). `store_id` is unique per
     hub (`store-descriptor`'s own comment), so the match is exact and
     never ambiguous, unlike matching by id adjacency or name suffix.
  2. **Renderer rule.** A client matches a roster-shaped STATE entry
     carrying `store_id = N` against the STORE-class entry whose
     `store.store_id = N`. On a match, render `list` (archetype 9) sited
     inside that store's card, alongside its CRUD verbs when the
     `action.store` (RFC-067) INTENT entry carries the same `store_id`. **A roster-shaped STATE entry with `store_id` absent, or naming
     no STORE entry in the catalog, renders as a plain, unlinked list**: its
     `{generation, count, capacity}` fields shown generically, with no
     assumed relationship to any store. This is the fallback law 7 already
     requires (decline the composite, never guess it) and keeps a
     pre-adoption hub (no `store_id` emitted) rendering exactly as it does
     today, degraded but not broken.
  3. **RENDERING §8.2 row 5 corrected** to name the trigger precisely:
     "STORE-class entry whose `store_id` (store-descriptor key 1) is named
     by a STATE entry's `store_id` (channel-entry key 17)" replaces the
     vague "its roster STATE pair".
- **Wire impact.** None beyond one additive optional entry-level key on
  roster STATE entries; an adopting hub's etag moves (T11), matching every
  other RFC-048-era rendering annotation.
- **Registry impact.** SPEC §8.1's entry-level key table gains `store_id`
  (OPTIONAL on a store's roster STATE and on its `action.store` INTENT
  entry; the catalog linter warns when a roster-shaped STATE lacks it);
  `schema/catalog.cddl` gains `? 17 => uint` on `channel-entry` with the
  same note. `store-descriptor`'s comment on its own `store_id` (key 1)
  gains a pointer to this key as its roster-side counterpart. No number
  already in use moves.
- **Conformance impact.** Fixture: a catalog with one STORE entry
  (`store_id: 1`) and two STATE entries shaped like a roster, one carrying
  `store_id: 1` and one carrying no `store_id` at all; assert the first
  renders `list` inside the store's card and the second renders as a plain,
  unlinked list, never guessed into the wrong store or into no store at all.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Reference-hub follow-up (Nucleus): emit `store_id` on
     `paired-devices-roster` naming `paired-devices`'s `store_id`, and on the
     preset store's roster once [RFC-066](#rfc-066----modulators-catalog-declared-modifiers-attached-to-the-field-they-ride)/[RFC-067](#rfc-067----store-verbs-one-registered-op-select-not-split-preset-tags)
     land.
  2. This RFC links roster to store; it does not link either to the CRUD
     INTENT channel that writes items. [RFC-067](#rfc-067----store-verbs-one-registered-op-select-not-split-preset-tags)'s
     own open question 2 flags that gap (the reference hub borrows
     `setting_channel` on the roster for it). Fold that link into this
     key's job, or leave it to a third RFC once RFC-067 is ruled on?
  3. Should `store_id` be REQUIRED on every roster-shaped STATE entry going
     forward (closing the gap for good) or stay optional indefinitely for
     hubs that never co-render store and roster? This RFC assumes optional,
     consistent with every other RFC-048 rendering annotation.

## RFC-071 -- Motion-input field roles: find the stream target without a name

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-xul). LANDED 4ea91d8
  (2026-10-01).
- **Ruling (operator, 2026-10-01).** Accepted as drafted. Open question 1:
  the absent value for an untagged field is
  [RFC-058](#rfc-058----end-velocity-unspecified-semantics-and-the-rest-before-hold-rule)'s
  registered sentinel (`limits.segment_end_vel_unspecified`), one home.
  Open question 2: `input.velocity` stays registered and optional; a client
  that does not understand it leaves the field at its default. Item 3
  below now reads so.
- **Origin:** rfc-ts3, the reference JS client's publish path. Proving it
  live against the Nucleus sim (0.1.5-p4hub) meant finding the motion-input
  channel and its target field from the catalog. The channel is findable
  structurally (class STREAM, direction c2h, `stream_kind`), but nothing
  says which layout field is the target, which is the duration, or which is
  the end velocity. The run had to key the target on `unit_id` `normalized`
  and zero-fill every other field by position, which is a guess that happens
  to match this hub.
- **Problem.**
  1. **§9.6 names the vocabulary and no field carries it.** Native segments
     are "timed `{target, duration, end_velocity}` commands", native samples
     are dense points, and a client "SHALL be able to send its content as
     authored". It cannot send `target` on a hub it has never met without
     knowing that hub's field name for it. Nucleus names them `target_norm`,
     `duration_ms`, `end_vel_norm`, `vel_norm`; another hub may not.
  2. **The only working method is name matching**, which RENDERING §13 law 6
     forbids for conformant clients. [RFC-032](#rfc-032--command-and-telemetrytarget-make-commanded-motion-discoverable)
     closed the same gap for the INTENT side (`command.position`) and
     `plan.*` ([RFC-035](#rfc-035--a-role-vocabulary-for-motion-plan-telemetry))
     for plan telemetry; the STREAM input side is the one motion surface
     still reachable only by hardcoding.
  3. **It blocks the onramp.** [RFC-044](#rfc-044--client-onramp-doctrine-tcode-passthrough-as-a-client-side-adapter)'s
     TCode adapter and [RFC-061](#rfc-061----tcode-passthrough-adapter-conventions-ingest-port-l0-mapping-loopback)
     item 2 map `L0` to a target and `I<ms>` to a duration. Without roles
     the adapter cannot be hub-agnostic, which is the whole point of doing
     the translation client-side.
- **Proposed change.**
  1. **Four `field_roles`, for layout fields of a c2h STREAM entry:**
     - `input.target`: the commanded position of the sample or segment, in
       the field's own unit and scale.
     - `input.velocity`: a `samples`-kind point's instantaneous velocity
       hint.
     - `input.duration`: a `segments`-kind sample's commanded time extent.
     - `input.end_velocity`: a `segments`-kind sample's velocity at its
       end, the §9.6 handoff.
  2. **A c2h STREAM entry that accepts motion MUST tag `input.target`.**
     The other three are tagged where the layout has the field. A client
     finds the motion-input channel as the c2h STREAM entry of the wanted
     `stream_kind` carrying an `input.target` field; a c2h STREAM with no
     `input.target` is some other input, never motion.
  3. **An untagged field is filled with its own "absent" value**, never
     with a guessed zero: for an end velocity, RFC-058's registered
     sentinel (one home, ruling); any other field the client does not
     understand, `input.velocity` included, is left at its catalog
     default.
- **Wire impact.** None on frames or layouts. Tagging a field adds one
  annotation key the entry already supports, so an adopting hub's etag
  moves (T11).
- **Registry impact.** `field_roles` gains the four `input.*` names.
- **Conformance impact.** A catalog check: every c2h STREAM entry whose
  `stream_kind` is `segments` tags `input.target` and `input.duration`.
  A client test: a hub whose motion-input fields are renamed still receives
  the correct target.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. The "absent" encoding for an untagged or unused field is
     [RFC-058](#rfc-058----end-velocity-unspecified-semantics-and-the-rest-before-hold-rule)'s
     sentinel question (Nucleus uses -32768 on `end_vel_norm`, stated only in
     a catalog comment). Rule it there, or carry a per-field `absent` value
     here?
  2. Is `input.velocity` worth a role, or is a samples-kind velocity hint a
     device extension a generic client should leave at its default?

## RFC-072 -- Discovery identity: the mDNS service record retires; the scan-response company id is pinned

- **Status:** ACCEPTED AS RESCOPED (operator, 2026-10-01; rfc-uvh). LANDED
  d2348d9 (2026-10-01). rfc-uvh stays open for the MFP plugin and clients/js
  move to the §13.8 UDP probe. Retitled from "Discovery identity: a durable
  id in mDNS TXT, a pinned scan-response company id": instead of adding an
  `id` key to the TXT record, the record itself retires.
- **Ruling (operator, 2026-10-01).** Accepted as rescoped. The
  `_valence._tcp` mDNS service record and its TXT key set are RETIRED: the
  §13.7 service text and the `mdns_service` limit are struck. Native
  clients discover by the §13.8 UDP probe, which already carries
  `hub_instance_id`. A hub that serves a page SHOULD run an mDNS hostname
  responder (`machine.local`) so a browser can reach the served page; that
  is hostname resolution, not service browsing. Item 3 survives: pin the BLE
  manufacturer-data layout `company_id 0xFFFF + flags u8`. Open questions
  answered: (1) the `0xFFFF` testing-id question stays OPEN pre-v1.0; (2) no
  TXT `fw` key, because there is no TXT. Phosphor drops its mDNS browse.
  **The draft had said:** add TXT `id=<hub_instance_id>` and a registry
  `mdns_txt` block, keeping the service record.
- **Origin:** Phosphor ph-vdk.25 (mDNS browse beside the §13.8 UDP probe)
  and ph-vdk.16 (reading `ble_adv_flags` for the BLE-to-WS upgrade).
- **Problem.** (Kept from the draft; problems 1 and 2 are now answered by
  removal rather than repair.)
  1. **mDNS TXT carries no durable identity.** §13.7 lists `v`, `name`,
     `etag` and `pairing`. §13.8 gave the UDP reply `hub_instance_id`
     precisely so a client can deduplicate one hub across reboots (the
     RFC-048 correction). A client merging mDNS and UDP results can only
     match on address and port, which splits a multi-homed hub into two rows
     and loses a hub whose lease moved, and an mDNS-only hub has no key a
     client can remember between launches.
  2. **The TXT keys live only in prose.** The registry pins `mdns_service`
     (under `limits`) but not the key set, so no generator emits them and no
     drift gate can check a client's copy.
  3. **The flags byte's company identifier is unpinned.** §13.4 puts
     `ble_adv_flags` in a 5-byte Manufacturer-Specific-Data record in the
     scan response but names no company id. The retired S3 reference used
     `0xFFFF`, the Bluetooth SIG's testing id. A client must guess which MSD
     entry is Valence's, and an implementation that picks another id is
     invisible to every client.
  Two discovery paths that must be merged by a key one of them lacks is one
  path too many: §13.8 already says it is the canonical WS-side discovery
  path for a LAN client without BLE, and browsers cannot mDNS-browse at all
  (§13.7).
- **Proposed change (as accepted).**
  1. **The mDNS service record retires.** §13.7's `_valence._tcp` bullet and
     its TXT key set are struck, and registry `limits.mdns_service` is
     removed. Native clients discover WS-side hubs by the §13.8 UDP probe;
     BLE discovery (§13.4) is unchanged.
  2. **A hostname responder, not a service.** A hub that serves a page
     SHOULD answer mDNS hostname queries for its own name
     (`<name>.local`, `machine.local` in the reference), so a browser can
     reach the served page by name. This is hostname resolution only: no
     service type, no TXT, nothing a client browses or parses.
  3. **Pin the MSD layout.** The company id `0xFFFF` and the record layout
     `company_id:u16le + flags:u8` are pinned (as landed: `msd_company_id`
     in a `ble_identity` registry block, not inside `ble_adv_flags`). A client reads the
     flags byte only from that company id's record.
- **Wire impact.** Subtractive for mDNS (a hub stops advertising a service
  record no conformant client needs); item 3 pins what the reference hub
  already sent.
- **Registry impact.** `limits.mdns_service` removed; a `ble_identity`
  block carries `msd_company_id` `0xFFFF` (as landed; the draft put it in
  `ble_adv_flags`). No `mdns_txt` block.
- **Conformance impact.** A hub carrying `hub_instance_id` advertises the
  same value in WELCOME and the UDP reply (already §13.8); no test reads
  mDNS. A BLE scan finds the flags byte under company id `0xFFFF`.
- **Compatibility.** Phosphor drops its mDNS browse (ph-vdk.25) and
  discovers by UDP and BLE. **The MFP plugin discovers only by mDNS today**
  (`clients/mfp/ValenceConnect.cs` `MdnsDiscovery`, a PTR query for
  `_valence._tcp.local`): it must move to the §13.8 UDP probe in the same
  landing, or its device list goes empty against a conformant hub.
  clients/js re-exports the generated `MDNS_SERVICE` (`index.js`,
  `frames.js`); the export goes with the limit.
- **Open questions.**
  1. **Still open pre-v1.0:** `0xFFFF` is reserved by the SIG for testing.
     Ship on it, apply for an assigned id, or move the byte into Service
     Data under the Valence service UUID (a 19-byte record that does not fit
     beside the full name)?
  2. ~~Should TXT also carry `fw`?~~ Answered: no TXT exists.

## RFC-073 -- Store item encoding: a registered CBOR map, a kind namespace, and an optional per-item digest

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-019). LANDED 1b4a1af
  (2026-10-01).
- **Ruling (operator, 2026-10-01).** Accepted as drafted: `digest` over
  `payload` only (open question 1); `kind` domains open, advisory grouping
  never validated against a list (open question 2).
- **Origin:** Nucleus commit 631f31d, `flagship_p4/src/hub/ValenceDevice.cpp`
  `encodePresetItem`/`readBlob` and `PatternPresetStore.h` (val-091.12), first
  live store-item transfer against the pattern-presets store (`store_id` 2,
  `kind` `"pattern.frayd"`; measured 73-byte item). The same gap surfaced
  independently on the client side: rfc-0d9's close stamp notes
  "SPEC §8.7 advertises no per-item digest, so status 1 for a store item
  needs a caller-supplied `expectDigest`."
- **Problem.**
  1. **§8.7 names a store item's fields and gives them no byte layout.**
     "Items are `{slot, name, kind, payload}`" is prose, not a registered
     CBOR map. Every field except `payload` already has a home in
     `blob_keys` (3, 5, 6) because BLOB_REQ and the CRUD intents carry them
     too, but nothing says the item's own on-wire document — the bytes a
     BLOB_CHUNK stream for `ns = 1 (store)` actually reassembles into — IS
     that same map. Two conforming hubs could disagree on the encoding
     (a bare 4-element array, a different key numbering, `payload` first)
     and still each satisfy §8.7's prose, breaking interop on the one thing
     the blob verb exists to move.
  2. **Nucleus's own fix is the answer, unregistered.** `encodePresetItem`
     builds a 4-key CBOR map keyed `blob::slot` (3), `blob::name` (5),
     `blob::kind` (6), `blob::payload` (7) — reusing the registry's own
     `blob_keys` sub-map rather than inventing a parallel one. That is the
     right call (one key space for one concept, not two), but it exists only
     as a comment ("keyed by the registry's `blob_keys` in ascending
     order") in one implementation.
  3. **`kind` is a string with no registered shape.** §8.7 gives two
     examples, `"pattern.frayd"` and `"trust.ledger"`, both already
     `<domain>.<variant>`, but nothing requires the pattern. An unstructured
     `kind` gives a generic client (one that cannot decode `payload`, by
     design) nothing to group or icon-select on, and invites collision
     between two independent devices' item kinds.
  4. **RFC-050's `BLOB_DONE` `status = 1` (hash-mismatch) has nothing to
     check against for a store item.** The catalog namespace's equivalent
     check is the client's own SHA-256 over the whole decoded catalog
     (§6.4); a store item carries no analogous value anywhere in its own
     encoding, so a receiver can only report mismatch when some caller
     supplies an expected digest out of band — not from the wire.
- **Proposed change.**
  1. **Register the store item as a CBOR map reusing `blob_keys`.** A store
     item, wherever it appears as a self-contained document — the bytes a
     `BLOB_CHUNK` stream for `ns = 1` reassembles into, and a `save`
     intent's import `payload` when the import carries a full item rather
     than a bare `payload` bstr — is a CBOR map with keys drawn from
     `blob_keys`: `3 (slot)`, `5 (name)`, `6 (kind)`, `7 (payload)`,
     REQUIRED, plus the new `11 (digest)` below, OPTIONAL. No new key space;
     ratifies Nucleus's choice rather than replacing it.
  2. **Register `blob_keys` key 11, `digest`** — `bstr`, SHA-256 (32 B) over
     `payload` alone, OPTIONAL. Present, it is what [RFC-050](#rfc-050--blob-transfer-backpressure--completion-acknowledgment)'s
     receiver checks locally to decide `BLOB_DONE` `status` (0 vs 1) for a
     store transfer, the same role the catalog's own SHA-256 plays for
     namespace 0 — without it a receiver has no wire-carried expectation and
     MAY still omit `BLOB_DONE` per §8.4's existing carve-out. A hub that
     never computes one omits the key; nothing downstream requires it.
  3. **Register the `kind` namespace convention.** `kind` MUST be
     `<domain>.<variant>` (already the shape of both existing examples): a
     protocol- or convention-recognized `<domain>` (`pattern`, `trust`,
     and any future spec-named category) followed by a device- or
     format-chosen `<variant>`. Opacity of `payload` is unaffected — `kind`
     is a label, never a schema selector the protocol interprets.
  4. **Size bounds are the declaring STORE entry's own fields, restated as
     the item map's governing limits, not new registry entries.** `name`
     MUST fit the store's `name_max`; `payload` MUST fit its `per_item_max`
     (§8.7, defaulting to `preset_item_max_bytes`). No new `limits` key: the
     per-store descriptor already carries both, and this RFC only states
     that the item document's own fields are the thing they bound.
  5. **The trust ledger is unaffected.** `"trust.ledger"`-kind stores keep
     `trust_ledger_keys` (§12.6) as their registered item grammar, per
     §8.7's own carve-out; this RFC's map governs every other `kind`.
- **Wire impact.** Additive. `blob_keys` gains one optional key (11); no
  existing key renumbers, no existing hub or client that ignores `digest`
  changes behavior. Hubs already encoding items as Nucleus does need no wire
  change at all, only the registration catching up to what they emit.
- **Registry impact.** `blob_keys` gains `11: digest`. §8.7 gains the
  normative item-map citation (which keys, which are required) in place of
  the current field-name prose, plus the `kind` namespace convention.
  `schema/catalog.cddl` gains a `store-item` map type for `blob_keys` 3/5/6/7
  (required) + 11 (optional).
- **Conformance impact.** Fixture: a `BLOB_CHUNK` reassembly for a
  registered-shape store item decodes as the map above; a digest present in
  the item and a payload that fails to verify against it drives `BLOB_DONE`
  `status = 1`; a `kind` fixture rejects a string with no `.` separator from
  the conformance linter (advisory, not a wire NACK — `kind` validation is
  hub-side per §8.7's existing `INVALID_VALUE` rule, unaffected here).
- **Origin implementation, ratified vs. changed:** Nucleus's key reuse
  (3/5/6/7) and its `<domain>.<variant>` `kind` (`pattern.frayd`) are
  RATIFIED as the normative shape. CHANGED: Nucleus's `encodePresetItem`
  carries no `digest` today and will need one to make its own `BLOB_DONE`
  usable for status-1 detection; this RFC does not require backfilling it
  before the RFC lands.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. `digest` over `payload` alone, or over the whole 4-field map (`slot`,
     `name`, `kind`, `payload`)? Payload-only means renaming a slot's item
     (`rename`) never invalidates a digest a client cached from a prior
     read; whole-map means a digest also proves the label wasn't corrupted
     in transit. This RFC proposes payload-only, on the reasoning that
     `slot`/`name`/`kind` already ride the same reassembled bytes §8.4
     already integrity-covers by chunk indexing, and RFC-050 status 1 is
     about content, not addressing.
  2. Should `kind` domains be a registry-enumerated list (closed set,
     `INVALID_VALUE` for an unrecognized `<domain>`) or open (`<domain>` is
     advisory grouping only, never validated)? This RFC assumes open,
     consistent with `kind` staying a label the protocol never schema-checks.

## RFC-074 -- STOP semantics for streams: refused while latched, re-armed only by an explicit command

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-2ly). LANDED ef003e3
  (2026-10-01) for clauses 1, 2 and 4, written against the STOP level of
  the day; clause 3 (RESUME as the re-arm) and the STOP-to-PAUSE fold
  LANDED 1ddf8af (2026-10-02) with RFC-085. Accepted under the safety fold
  ruled the same day,
  [RFC-085](#rfc-085----three-safety-pairs-one-control-each-pause-and-resume-override-and-return-estop-and-release)
  (accepted 2026-10-02): read STOP below as PAUSE.
  The title keeps the draft's wording as the record.
- **Ruling (operator, 2026-10-01).** Accepted under the RFC-085 fold: STOP
  and HOLD are retired; PAUSE is the one latched non-emergency level
  (decelerate, hold position, every source suspended, stream bundles
  dropped and counted, generator parked), cleared ONLY by RESUME. Clauses
  1, 2 and 4 apply to PAUSE unchanged; clause 3's re-arm is RESUME, with no
  PUBLISH side effect and no new op (open question 1). PAUSE inherits
  STOP's role exemption (any tier may pause); RESUME stays `control`. Open
  question 2 moot (no intent clears PAUSE); open question 3 moot (HOLD
  retired). The proposed change below now reads so.
- **Origin:** val-2w2 in Nucleus, found landing val-cu2. The 0x0005 `stop`
  op halted the pattern generator and braked the plan in flight, but a
  client still streaming 0x2100 samples replanned the machine on its next
  bundle, straight past the brake, while `safety` still showed STOP latched.
- **Problem.**
  1. **§11.1 is silent on whether a stream sample is "a new accepted motion
     intent".** STOP "clears by any new accepted motion intent from an
     authorized source" and its source is "deactivated". §9.3 says streams
     are not intents, and the reference hub stopped letting a bundle clear
     STOP when [RFC-045](#rfc-045--retire-deadman-as-safety-session-liveness-is-bookkeeping-not-motion-control)
     retired the deadman latch. Nothing says what happens to the bundle
     itself while STOP holds, so the reference hub delivered it and the
     delegate planned it.
  2. **The result is a safety word that lies.** `safety` reports STOP while
     the machine moves under the stream that STOP was sent to halt. That is
     a ground-truth violation on the one channel that must never lie
     (§9.4's event/state duality rests on it).
  3. **STOP exists for a client that will not stop on its own.** A stream
     that keeps feeding through STOP is exactly that client; honoring its
     next sample makes STOP a one-tick brake that a 50 Hz sender overrides
     in 20 ms.
  4. **Streams have no start verb.** §11.4 acquires a stream source on its
     first accepted bundle, and §6.7 PUBLISH is the only per-channel act a
     streaming client performs before sending. So "an explicit restart"
     has no stream-native spelling today.
- **Proposed change.**
  1. **While PAUSE is latched, a hub MUST NOT act on c2h motion-input
     bundles** (`samples` or `segments` kind, any channel the application
     maps to a source, §11.4). Each such bundle is dropped whole and
     counted, exactly as §9.2's ingress drops are (the draft said STOP;
     the RFC-085 fold made it PAUSE). It is NEVER NACKed: a
     per-bundle NACK at stream rate is the storm §9.2 carve-outs exist to
     avoid, and the latched `safety` snapshot is the signal (§9.4).
  2. **A stream sample never clears PAUSE**, and under the RFC-085 fold
     no motion intent does either.
  3. **Stream re-arm is RESUME.** The `resume` op on `safety-intents`
     (`control`) is the only clear, for streams as for every other source.
     No PUBLISH side effect and no new op. (The draft had proposed that a
     PUBLISH granting a source-mapped c2h channel clears STOP, as an INTENT
     on a mapped channel then did.)
  4. **The drop counter is the hub's existing stream-drop counter.** A hub
     that publishes one (the Nucleus `kinetic-diag` `sync_dropped`) counts
     PAUSE drops there; no new registry counter.
  5. **ESTOP is unchanged and stricter.** It refuses every source until the
     §11.2 explicit clear, and a clear re-arms nothing on its own.
- **Wire impact.** None of its own. No new frame, key or op; the op and
  safety-word changes are RFC-085's.
- **Registry impact.** None.
- **Conformance impact.**
  - **Hubs:** a test streams samples, sends `pause`, keeps streaming, and
    asserts position holds and `safety` PAUSE stays latched; then sends
    `resume` and asserts the next bundle moves the machine (an INTENT and a
    PUBLISH under PAUSE each clear nothing). The Nucleus sim run under val-2w2 is the
    reference shape: 87 of 87 samples sent under STOP refused and counted,
    position range 0.000 mm over 2 s, motion resumed after a 0x3100 move.
  - **Clients:** a client streaming through PAUSE MUST expect its bundles
    to be dropped silently and resumes only by `resume`. A client SHOULD
    subscribe `safety` so it can show the operator why its stream went
    still, and MUST NOT resume automatically on seeing PAUSE latch;
    resuming is an operator act, or PAUSE is decorative.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. **Is PUBLISH the right re-arm, or should it be an op?** An op on the
     motion source (a `stream_arm` on `safety-intents`, `control`) is more
     explicit and auditable than a side effect of renegotiating a grant;
     PUBLISH is cheaper and needs no catalog entry. A re-PUBLISH sent only
     to change rate would also re-arm under clause 3.
  2. **Which intents clear STOP.** The reference hub clears on ANY accepted
     intent on a mapped channel, so a `pattern_cmd` write that does not
     start the generator clears STOP too. Should the clear be limited to
     intents that start motion?
  3. **Does HOLD refuse streams the same way?** HOLD's source is
     "suspended" until RESUME; this RFC reads that as the same drop rule
     with RESUME as the only clear, but no hub implements HOLD yet.

## RFC-075 -- ESP-NOW spoke binding: an unencrypted hub-and-spoke profile for accessories

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-2lo). LANDED 8484552
  (2026-10-01). First of five companion entries:
  [RFC-076](#rfc-076----accessory-join-and-declaration-accessory-channels-in-the-user-channel-space)
  (join and declaration),
  [RFC-077](#rfc-077----live-catalog-growth-announcing-a-new-etag-to-live-sessions)
  (live catalog growth),
  [RFC-078](#rfc-078----accessory-conformance-profile-and-the-hub-relationship-engine)
  (conformance and relationships) and
  [RFC-079](#rfc-079----config-mode-and-the-setup-category) (config mode),
  all accepted the same day.
- **Ruling (operator, 2026-10-01).** Accepted as drafted. Open questions:
  (1) active scan, yes; (2) unicast does not refresh the deadman, one
  clock; (3) scan channels 1 to 13 everywhere, and a regional accessory MAY
  scan a subset; (4) no STOP bit on the beacon: under
  [RFC-085](#rfc-085----three-safety-pairs-one-control-each-pause-and-resume-override-and-return-estop-and-release)
  pause reaches accessories through the RFC-078 interlock as commanded safe
  values, and only `estop_latched` is broadcast.
- **Origin:** operator rulings 2026-09-26. Accessories (a peristaltic pump, a
  vibrator, a motorized stand) run a small accessory firmware (Isotope, the
  reference accessory) and attach to the hub over ESP-NOW in a star: the hub
  is the center, each accessory is a spoke, and no accessory ever talks to a
  client. ESP-NOW is natively a star, runs beside station-mode WiFi on the
  same radio, and needs no router. The rulings fix five properties: no
  encryption, a 20-peer ceiling (typical deployment 3), a 1 Hz hub beacon the
  accessory scans for, a fail-safe on beacon loss or goodbye, and
  self-describing accessories.
- **Problem.**
  1. **§13.3 is a client-session binding.** It gives per-peer sessions, the
     ACKMASK reliability layer, and a BEACON (`0x17`) sent "every 500 ms
     **only while a pairing window is open**" (§13.7). An accessory is not a
     client session and has nothing that tells it, outside a pairing window,
     that its hub is still alive.
  2. **The channel is invisible.** ESP-NOW transmits only on the radio's
     current channel (ESP-IDF: "the channel must be set as the channel that
     the local device is on"). A hub in station mode sits on its access
     point's channel, which the accessory cannot know and which moves when the
     access point moves.
  3. **Nothing obliges a spoke to fail safe.**
     [RFC-045](#rfc-045--retire-deadman-as-safety-session-liveness-is-bookkeeping-not-motion-control)
     retired the session deadman as a safety mechanism because a
     command-driven machine settles to rest by construction (§11.3). An
     accessory does not: a pump or a motor holds its last commanded output
     forever. The argument that retired the machine-side deadman is exactly
     the argument for keeping one on the spoke.
  4. **The security posture is unstated.** §12.9 permits unencrypted ESP-NOW
     "for `watch`-class traffic". Accessory traffic actuates things.
  5. **The frame budget is unstated for small peers.** An accessory is a
     small MCU; §5.6 fragmentation and reassembly is cost it should not pay.
- **Proposed change.**
  1. **A spoke profile, new §13.3.1 "ESP-NOW spoke".** Two roles: the
     **accessory host** (a hub) and the **accessory** (RFC-078 defines both
     duty sets). Topology is a star: frames flow only between the host and
     each accessory, never accessory to accessory, and no client session runs
     on the spoke. The §13.3 client-session binding is unchanged and MAY run
     beside the spoke on the same radio. Spoke frames are ordinary Valence
     frames (§5.1 header) carried one per ESP-NOW payload; channel ids on the
     spoke are accessory-relative (RFC-076 item 1). **ESP-NOW v1 framing is
     pinned:** a spoke frame MUST NOT exceed 250 bytes, even where the
     silicon supports ESP-NOW v2 payloads (up to 1470 bytes, ESP-IDF
     `ESP_NOW_MAX_DATA_LEN_V2`), so v1-only silicon interoperates.
  2. **Unencrypted, by ruling. New HONESTY CLAUSE (H13).** Spoke frames carry
     no ESP-NOW encryption and no Valence authentication. The accepted threat
     model, stated so no UI can imply otherwise: anyone within radio range
     holding an ESP32 can (a) read every spoke frame; (b) forge a BEACON,
     ESTOP, GOODBYE, INTENT or STREAM bundle that an accessory will act on;
     (c) forge accessory telemetry to the host; (d) keep an accessory alive
     after its real hub has died by forging beacons; (e) jam the channel
     (H12). Why it is accepted (operator ruling): the setting is private, the
     range is a room or a house, comparable consumer accessories are open BLE
     today, and per-peer ESP-NOW encryption would cap the peer list at 17
     (default 7, ESP-IDF) and add a key-distribution ceremony. What bounds the
     consequences, as obligations:
     - an accessory MUST clamp every received actuating value into its
       declared `min`/`max` (RFC-076), so a forged command can do nothing a
       legitimate one could not;
     - a host MUST NOT treat accessory telemetry as safety-grade input: no
       accessory value may clear a safety latch, satisfy an interlock, or gate
       machine motion;
     - a client MUST NOT present spoke traffic as authenticated or private.
     The item 5 deadman protects against a dead or departed hub. It is not a
     defense against an attacker (clause (d)), and it is not a substitute for
     hardware interlocks on the accessory itself (H1 applies to accessories
     verbatim). §12.9's ESP-NOW paragraph gains: "The spoke profile (§13.3.1)
     is unencrypted at every tier; see H13."
  3. **BEACON is the hub heartbeat.** The registry already carries `0x17`
     BEACON; this RFC reuses it rather than allocating a second beacon, and
     pins its raw payload (little-endian, tail-extensible per §5.4):
     `boot_id:u32 + catalog_etag:8B + flags:u8 + hub_instance_id:u64 +
     wifi_channel:u8` = 22 bytes (a 30-byte frame). The first three fields
     are the §13.7 prefix unchanged. Header channel is `0x0000`; the header
     `seq` is the beacon sequence, incremented once per beacon per boot and
     compared per §7.3.
     - `flags`: bit0 `pairing_window_open` (unchanged meaning); bit1
       `datagram_estop` (the mirror bit
       [RFC-053](#rfc-053--estop-over-connectionless-datagrams-udp-broadcast--esp-now-opt-in)
       item 2b reserved, ratified here); bit2 `accessory_host` (this hub runs
       the spoke and accepts accessory joins); bit3 `estop_latched` (this
       hub's `safety` snapshot shows ESTOP latched right now). Bits 4 to 7
       MUST be zero.
     - `hub_instance_id` is the §6.1 durable identity. A hub without one MUST
       NOT act as an accessory host: accessories bind to it (RFC-076 item 7).
     - `wifi_channel` is the primary channel the hub transmits on (1 to 14).
       An accessory that hears a beacon leaked from an adjacent channel
       retunes to the named one.
     - **Cadence.** An accessory host MUST broadcast BEACON every
       `spoke_beacon_interval_ms` (1000) for as long as the spoke is up,
       whether or not a pairing window is open, and every 500 ms while one is
       (the §13.7 cadence, never slower). §13.7's "only while a pairing window
       is open" is amended to bind only hubs that are not accessory hosts.
  4. **Channel follow.** The host never changes channel for its accessories;
     it follows its access point. The accessory does the searching:
     1. At boot, and on every deadman fire (item 5), the accessory scans
        channels 1 to 13 everywhere (a regional accessory MAY scan a
        subset, ruling). On each channel
        it broadcasts one DISCOVER_PROBE (`0x1E`, the §13.8 raw payload
        unchanged) and listens `spoke_scan_dwell_ms` (150) for a BEACON from
        its hub: source address and `hub_instance_id` both match its stored
        pairing, or, for an accessory in pairing state (RFC-076 item 3), any
        BEACON with `accessory_host` and `pairing_window_open` set.
     2. An accessory host that receives a DISCOVER_PROBE on the spoke MUST
        answer with an immediate, out-of-cadence **broadcast** BEACON, at most
        one per `spoke_scan_dwell_ms`. Broadcast, because a unicast answer to
        an unknown address would spend a peer-list entry (item 9).
     3. **Two scan modes, both conformant.** Active (probe, then listen):
        about 150 ms per channel, 13 x 150 ms, about 2 s cold join, which is
        the ruled figure. Passive (listen only, no probe): about one beacon
        interval per channel, up to 13 x 1 s, about 13 s. An accessory
        SHOULD scan actively; a host MUST answer probes (step 2). The probe
        only finds the hub: the beacon alone remains the deadman's heartbeat
        (item 5).
     4. Rescan after beacon loss is the same code path as boot. No BLE
        channel hint exists (ruled out).
  5. **The accessory deadman (normative duty).** An accessory MUST enter its
     **safe state** when any of these holds:
     1. no BEACON from its hub (source address and `hub_instance_id` match)
        has arrived for its deadman window: `spoke_deadman_ms` (5000, five
        missed beacons at the idle cadence) or the shorter window its
        declaration carries (RFC-076 item 3), which MUST NOT be below
        2 x `spoke_beacon_interval_ms`;
     2. it receives any GOODBYE frame (`0x11`) from its hub, whatever its
        code and even if the payload fails to decode: safe immediately;
     3. it receives a valid ESTOP frame (§5.5, CRC-checked) from **any**
        source, or a BEACON from its hub with `estop_latched` set: safe
        immediately;
     4. a local fault it can detect.
     **Only BEACON refreshes the deadman.** Unicast commands do not, so one
     clock answers "is my hub alive" and a hub whose beacon task has died is
     treated as dead even if a stale command path still runs.
     **The safe state** is: every actuating field (every value-bearing field
     of a declared INTENT schema or c2h STREAM layout) held at the `safe`
     value its declaration carries (RFC-076 item 5, REQUIRED there), and any
     verb in progress abandoned.
     **Leaving it.** From deadman, GOODBYE or fault: only on a fresh
     actuating command from its hub received after a matching BEACON. From
     ESTOP: only after a BEACON with `estop_latched` clear, and then only on a
     fresh command. An accessory MUST NOT restore its pre-safe values on its
     own. A host SHOULD broadcast GOODBYE (`REBOOTING` or `NORMAL_CLOSURE`) on
     the spoke before a planned reboot or spoke shutdown.
  6. **Frame budget: MUST fit.** Every spoke frame MUST fit one ESP-NOW v1
     payload (250 bytes including the 8-byte header). §5.6 fragmentation MUST
     NOT be used on the spoke, so an accessory never implements reassembly.
     Anything larger moves only over the blob verb (§8.4), which is chunked by
     construction (`catalog_chunk_payload` 192 plus headers). RFC-076 item 5
     makes this a declaration-validation rule.
  7. **Reliability.** §13.3's ACKMASK loss signal and stop-and-wait control
     retransmit (3 x 100 ms) apply to each host-accessory link unchanged. STATE
     and STREAM are not retransmitted.
  8. **ESTOP on the spoke.**
     [RFC-053](#rfc-053--estop-over-connectionless-datagrams-udp-broadcast--esp-now-opt-in)
     item 2 is unchanged: a host accepts a valid ESTOP frame from any peer on
     its channel, so a fob that follows item 4 is heard. In addition, on
     latching ESTOP the host MUST broadcast the ESTOP frame on the spoke,
     repeating at `estop_repeat_interval_ms` up to `estop_repeat_max` (§11.2),
     and MUST keep `estop_latched` set in every BEACON while the latch holds,
     which is the 1 Hz loss-recovery path for an accessory that missed every
     repeat. The acknowledgment is the accessory's status snapshot reporting
     `safe_estop` (RFC-078 item 1); the host stops repeating once every
     joined accessory has reported it, and shows any that have not as
     unconfirmed on its accessory roster (RFC-076 item 10). An accessory MUST
     NOT rebroadcast an ESTOP frame: the spoke has no relay role.
  9. **Peer limit.** ESP-IDF caps the peer list at 20 entries ("The maximum
     number of paired devices is 20"), and "a device with a broadcast MAC
     address must be added before sending broadcast data", so the broadcast
     entry the beacon needs takes one of them. Receiving broadcast and
     unencrypted unicast needs no entry. **A host therefore addresses at most
     19 accessories by unicast**, fewer if the §13.3 client binding shares
     the same list. A host declares its accessory capacity (RFC-076 item 10);
     rotating peer entries to exceed it is permitted and not required.
  10. **Radio coexistence.** The spoke rides the station interface on the
      access point's channel. An accessory host MUST NOT operate a softAP
      while the spoke is up (operator ruling; see
      [RFC-079](#rfc-079----config-mode-and-the-setup-category) item 1).
  11. **Implementation risks (informative, not spec matters).** Where the
      radio sits on a co-processor behind esp_hosted (the reference Flagship
      pairs an ESP32-P4 host with an ESP32-C6), ESP-NOW reaches the host
      through a shim bridging `esp_now_*` over esp_hosted CustomRpc (esphome
      PR 17712). That shim has three open bugs a host implementer must guard
      against: a send can stall; the peer table goes stale after a
      co-processor restart; a full peer table reports success. The deadman
      makes the first two fail safe on the accessory side; the third
      silently caps item 9's capacity, so a host SHOULD count its own peer
      entries rather than trust the add result.
- **Wire impact.** No new frame type. BEACON's payload is pinned and
  tail-extended from 13 to 22 bytes, with flag bits 2 and 3 new and bit 1
  ratified; no shipped hub sends BEACON today, so pinning is free.
  DISCOVER_PROBE gains an ESP-NOW use with its payload unchanged.
- **Registry impact.** `frame_types` `0x17` note: the pinned layout and the
  spoke cadence; `0x1E` note: the spoke use. New `beacon_flags` table (bits 0
  to 3). `limits` gains `spoke_beacon_interval_ms` (1000),
  `spoke_deadman_ms` (5000) and `spoke_scan_dwell_ms` (150); values are the
  registry owner's to confirm. §1.5 gains H13. The task list's "beacon frame
  type" resolves to the existing `0x17`.
- **Conformance impact.** Accessory tests run over the §13.6 in-process
  binding with loss injection and a simulated channel number:
  (1) beacons stop: safe state within the deadman window plus one beacon
  interval, every actuating field at its `safe` value; (2) GOODBYE with a
  garbage payload: safe within one frame; (3) ESTOP from an unpaired
  address: safe; (4) BEACON with `estop_latched`: safe; (5) leaves safe only
  on a fresh command, never by restoring the prior value; (6) hub on channel
  11 found within 13 x `spoke_scan_dwell_ms`; (7) a BEACON carrying another
  `hub_instance_id` never refreshes the deadman; (8) no emitted frame over
  250 bytes; (9) an out-of-range forged INTENT is clamped. Host tests: beacon
  at 1000 ms with the window closed and 500 ms with it open; a probe draws
  one broadcast BEACON; `estop_latched` tracks `safety`; ESTOP is broadcast
  on latch and repeats stop when every accessory reports `safe_estop`.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Active scan (DISCOVER_PROBE reused, ~2 s) as proposed, or passive only
     (13 s worst case, zero host work)?
  2. Should unicast host traffic also refresh the deadman? Proposed no: one
     clock.
  3. Regional channel sets: scan 1 to 13 everywhere, or follow the
     accessory's configured region (12 to 14 vary)?
  4. Should BEACON also carry STOP latched, or is `estop_latched` the only
     safety bit the spoke needs (STOP reaches accessories through RFC-078's
     interlock as commanded safe values)?

## RFC-076 -- Accessory join and declaration: accessory channels in the user channel space

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-7bq). LANDED b18fac1
  (2026-10-01). Rides the spoke of
  [RFC-075](#rfc-075----esp-now-spoke-binding-an-unencrypted-hub-and-spoke-profile-for-accessories);
  its catalog consequences are
  [RFC-077](#rfc-077----live-catalog-growth-announcing-a-new-etag-to-live-sessions),
  which also owns capacity; the duty sets are
  [RFC-078](#rfc-078----accessory-conformance-profile-and-the-hub-relationship-engine).
- **Ruling (operator, 2026-10-01).** Accepted with the slice narrowed: 128
  ids per accessory is excessive. Slice width is 32 ids
  (`accessory_slice_ids` `0x20`): `r = 0` session-scoped, `r = 1`
  accessory-status, `r = 2` to `r = 31` the accessory's own (30 at most).
  The user space `0x8000`-`0xBFFF` then holds 512 slices, so a forgotten
  slice is never reused for the life of a hub. Rationale: a pump is 3
  channels, a three-motor vibrator about 6, a motorized stand 6 to 8; a
  worst-case 30-channel declaration is about 3.5 KB (19 chunks). Open
  questions: (1) carve from reserved, yes; (2) one join per window, yes;
  (3) a `configure` session may open the window in-band, yes; (4) no STORE
  entries in a declaration for now; (5) the hub does not rewrite `group`
  strings. Isotope DESIGN.md §16's budget and the Nucleus accessory-store
  sizing are recomputed at 30 channels per slice (owed on those boards).
  Items 1, 5, 6 and 10 below now read so.
- **Origin:** operator rulings 2026-09-26. Pairing: the operator holds the
  hub's pairing button to open a window; an accessory in pairing state
  broadcasts a join request; the hub accepts during the window, assigns a
  channel slice, and stores it. The accessory is **self-describing**: its
  channels, types, ranges and deadman are baked in at flash time and
  declared to the hub on join; the hub mirrors them into its store. Only
  hub-side things (names, relationships) are authored from a client. Once
  paired, the accessory "lives in user space on the machine": its definition
  is saved to hub flash, loaded at boot, and its channels join the hub's
  catalog, up to roughly 128 channels per accessory.
- **Problem.**
  1. **No channel space exists for channels that arrive at runtime.** Core
     ids are spec-governed, and the device range (`0x0080`-`0x7FFF`) is the
     hub firmware's own allocation (CHANNEL-GRID.md). Neither can take ids a
     third party brings at runtime without colliding with a later firmware.
  2. **No join handshake.** §12.3's ceremony ends in a client token; an
     accessory holds no session and wants no token.
  3. **No declaration grammar, and there must not be a second one.** §8.1's
     channel entry already describes kinds, packed types, ranges, units and
     roles. A parallel "accessory descriptor" would fork the vocabulary every
     renderer reads.
  4. **Nothing names what survives a reboot of either side**, or what
     identifies an accessory across reflashes and address changes.
  5. **A generic client cannot see or forget accessories** without a
     hub-specific screen, which RENDERING §13 law 6 forbids.
- **Proposed change.**
  1. **The user channel space.** `channel_id_ranges` gains `0x8000-0xBFFF`,
     name `user`, carved from the reserved `0x8000`-`0xFFFF`
     (`0xC000`-`0xFFFF` stays reserved). It is divided into 512 **slices**
     of `0x20` ids; slice *k* has base `0x8000 + 0x20 * k` (the draft had
     128 slices of `0x80`). Slices are
     assigned by the hub at join (item 6), never allocated by hub firmware.
     An accessory declares **relative** ids: relative id *r* maps to absolute
     id `base + r` in the hub's catalog. `r = 0x00` is never a channel (on the
     spoke it is the session-scoped channel BEACON, ACKMASK and GOODBYE ride);
     `r = 0x01` is the registered accessory-status STATE (RFC-078 item 1);
     `r = 0x02` to `0x1F` are the accessory's own, 30 at most. On the spoke
     the header carries the relative id; everywhere else, the absolute one.
     Slice membership (`id & 0xFFE0`) is how a client groups one accessory's
     channels: a structural rule, not name matching. How many of those ids a
     given hub can actually carry is RFC-077 item 7's capacity question; the
     slice width is an address space, not a promise.
  2. **The pairing window.** Accessory joins use the §12.3 association window
     ([RFC-027](#rfc-027--capability-agnostic-pairing--tiered-access-operator-ordered)
     lineage): one window, one timer (`pairing_window_default_s`), reported by
     BEACON flag bit0 (RFC-075 item 3) and `ble_adv_flags` bit0. It opens by
     the hub's pairing control (a physical button bound per §12.3(c)) or by
     the `window_open` op (item 10). **An accepted join is the window's single
     grant**, exactly as a push-to-pair knock is: the window closes after it.
     One press, one device.
  3. **JOIN_REQ (new frame, raw, accessory to hub, unicast).** An accessory
     enters pairing state by its own local gesture (device-defined) or, when
     factory-fresh, on its own. It scans per RFC-075 item 4 for any BEACON
     with `accessory_host` and `pairing_window_open`, then sends JOIN_REQ to
     that beacon's source address, once per BEACON received, until answered.
     A paired accessory sends the same frame to its stored hub on every
     reacquisition (item 8). Payload (little-endian): `accessory_id:u64 +
     proto_ver:u8 + declaration_etag:8B + deadman_ms:u16 + flags:u8 +
     fw_version:str16 + product:str16` = 52 bytes. `deadman_ms` is the
     accessory's declared deadman window (0 = `spoke_deadman_ms`), bounded
     per RFC-075 item 5. `flags` bit0 `pairing_state` (this accessory is
     asking to pair, as opposed to rejoining); bits 1 to 7 zero.
  4. **JOIN_REPLY (new frame, raw, hub to accessory, unicast).** Payload:
     `hub_instance_id:u64 + accessory_id:u64` (echoed) `+ result:u8 +
     flags:u8` = 18 bytes. `result` from a new `join_results` table:
     0 `accepted`; 1 `window_closed` (unknown accessory, no window open);
     2 `capacity` (no free slice, no peer entry, or the declaration would
     exceed the hub's advertised capacity, RFC-077 item 7); 3 `unsupported`
     (`proto_ver`); 4 `declaration_invalid` (item 5); 5 `not_paired` (a
     rejoin from an accessory the hub has forgotten). `flags` bit0
     `declaration_needed` (the hub holds no declaration with this etag and is
     about to fetch it). **Every JOIN_REQ is answered** (§4.5); answers to
     unknown accessories are rate-limited per source address at the
     `udp_discovery.reply_rate_limit_per_source_s` posture.
  5. **The declaration IS the accessory's catalog.** An accessory's
     declaration is a §8.1 catalog: the same CDDL (Appendix C), the same
     deterministic encoding, the same etag (§8.3), with relative ids. It
     moves over the blob verb as the accessory's own namespace 0: on
     `declaration_needed` the hub sends BLOB_REQ (`ns = 0`), the accessory
     answers BLOB_CHUNK with §8.4 pacing, the hub verifies SHA-256 against
     JOIN_REQ's `declaration_etag` and sends BLOB_DONE
     ([RFC-050](#rfc-050--blob-transfer-backpressure--completion-acknowledgment)).
     No second grammar exists. One addition, usable in any catalog and
     REQUIRED in a declaration:
     - **`safe`** (new field annotation, layout-field and schema-field map
       key 25 as landed; RFC-063 took 24): the value the field takes in
       the accessory's safe state (RFC-075 item 5); same type as the field;
       within its `min`/`max`. REQUIRED on every value-bearing field of every
       INTENT schema and every c2h STREAM layout in a declaration. A field
       whose `role` is `action.<name>` (a verb) is exempt: entering the safe
       state abandons a verb in progress.
     Kinds, packed types, ranges, units, roles, `desc`, `options` and every
     other annotation keep their §8.1/§8.8 meanings unchanged. A declaration
     SHOULD carry `category` on its entries (`auxiliary`, 7, is the natural
     home for a secondary actuator).
     **Validation (hub MUST; on failure JOIN_REPLY `declaration_invalid` and
     nothing is stored):** every id in `0x01`-`0x1F`; the `r = 0x01` entry
     matches RFC-078's registered layout exactly; every STATE layout fits
     `min_transport_payload` (§9.1); every INTENT and EVENT schema's
     worst-case encoded frame fits 250 bytes (RFC-075 item 6); every
     `setting_channel` names an id inside the declaration; every entry fits
     `catalog_max_entry_bytes`; the whole declaration fits
     `accessory_declaration_max_bytes` (new limit); every required `safe` is
     present and in range; no STORE entries (open question 4).
  6. **What the hub persists, and slice stickiness.** Per accessory, in
     non-volatile storage: `accessory_id`, peer address, slice index,
     declaration bytes and etag, `deadman_ms`, the hub-authored name, and the
     relationships that reference it (RFC-078). **A slice is sticky:** the
     accessory keeps it across reboots of either side and across declaration
     replacement until it is forgotten, so an absolute id a client layout or
     a relationship stored stays valid (RENDERING §13 law 10). A forgotten
     slice is never reassigned: 512 slices outlast the life of a hub, and a
     hub whose every slice has been used refuses further joins `capacity`. At
     boot the hub rebuilds its catalog from persisted declarations before
     admitting sessions, so the etag is stable across hub reboots for an
     unchanged accessory set. **A paired accessory that is absent keeps its
     channels in the catalog**: it is offline, not gone; the hub stops
     pushing its STATE (clients show it stale, RENDERING §13 law 8) and
     answers writes to it with NACK `ACCESSORY_OFFLINE` (new code,
     `0x0305` as landed).
  7. **Accessory identity.** `accessory_id` is a u64 the accessory generates
     randomly at first boot and persists, unchanged by reboots and firmware
     updates: the accessory twin of `hub_instance_id` (§6.1). The radio
     address is a transport address, not identity: the hub keys records on
     `accessory_id` and updates the stored address on rejoin. An accessory
     whose storage is wiped is a new accessory and must pair again. The
     accessory persists its hub's `hub_instance_id` and address; it needs no
     slice number, because it speaks relative ids.
  8. **Re-join after power loss, no window.** An accessory with a stored hub
     scans (RFC-075 item 4) for that `hub_instance_id` and sends JOIN_REQ. A
     hub holding a record for that `accessory_id` accepts whether or not a
     window is open. Equal `declaration_etag`: no transfer (the §6.4
     etag-match pattern). Different etag (the accessory was reflashed, same
     identity): the hub refetches, revalidates and replaces the declaration
     in the same slice; the catalog changes per RFC-077; relationships whose
     target field no longer exists are disabled (RFC-078 item 3). After any
     join the accessory is in its safe state until its hub commands it. A hub
     reboot needs nothing extra: every accessory's deadman fires, it rescans,
     it rejoins.
  9. **Leave and forget.** **Forgetting is hub-side only.** The
     `accessory-admin` op `forget` (`configure`): the hub sends the accessory
     GOODBYE `NORMAL_CLOSURE`, deletes its record and every relationship
     targeting it, frees the slice, and removes its channels (RFC-077). A
     later JOIN_REQ from it is answered `not_paired`; the accessory MAY then
     clear its stored hub. An accessory's own GOODBYE, or its local unpair
     gesture, marks it offline and deletes nothing: spoke frames are
     unauthenticated (H13), so an accessory-originated delete would let a
     forged frame wipe a record.
  10. **Core surfaces for generic clients.** Three spec-core channels (ids
      as landed below, each status reserved):
      - `accessories` (`0x0010`), STORE, `kind` `"accessory.record"`, `watch` access,
        with a **registered item grammar** (`accessory_record_keys`:
        `accessory_id`, `slice`, `name`, `product`, `fw_version`,
        `declaration_etag`). §8.7's carve-out applies for the trust ledger's
        reason: this is protocol content every client must read the same way.
      - `accessories-roster` (`0x0011`), STATE, `watch`: `{generation u16, count u8,
        capacity u8, online 4 x bitfield8, safe 4 x bitfield8,
        unconfirmed_estop 4 x bitfield8}` = 16 bytes, bit *i* of each mask
        being the accessory held in slot *i* of the `accessories` store.
        (The draft indexed 128 bits by slice; at 512 slices a slice-indexed
        mask would cost 64 bytes per mask, so the masks index store slots,
        32 of them, above any ESP-NOW capacity.) `capacity` is the hub's accessory capacity (at most
        19 over ESP-NOW, RFC-075 item 9). One tiny snapshot answers "which
        accessory is online, which is safe, which has not confirmed an
        e-stop" without re-enumerating the store.
      - `accessory-admin` (`0x0012`), INTENT, `configure`, one op select with role
        `action.accessory` over `accessory_admin_ops`: `window_open` (the
        in-band twin of the pairing button, open question 3), `forget
        {accessory_id}`, `rename {accessory_id, name}`.
- **Wire impact.** Two new frame types (JOIN_REQ, JOIN_REPLY) in the
  `0x21`-`0x3F` spec range; a new channel-id range; one field annotation key;
  three core channels; one item grammar; one NACK code. Nothing existing
  moves.
- **Registry impact.** `frame_types` gains JOIN_REQ `0x21` and JOIN_REPLY
  `0x22` (as landed) with their raw layouts; `channel_id_ranges` gains
  `0x8000-0xBFFF` `user`; `catalog.cddl` gains `? 25 => setting-default`
  (`safe`) on `layout-field` and `schema-field`; new `join_results`,
  `accessory_record_keys`, `accessory_admin_ops`; `action_tags` gains
  `accessory`; `core_channels` gains the three entries; `nack_codes` gains
  `ACCESSORY_OFFLINE`; `limits` gains `accessory_declaration_max_bytes` and
  `accessory_slice_ids` (`0x20`). CHANNEL-GRID.md gains the user-space row.
- **Conformance impact.** (1) Happy path: window open, JOIN_REQ, JOIN_REPLY
  `accepted` with `declaration_needed`, BLOB_REQ/CHUNK/DONE, entries appear
  at `base + r`, window closes. (2) Unknown accessory, window closed:
  `window_closed`, nothing stored. (3) Known accessory, window closed, same
  etag: accepted, no BLOB_REQ sent. (4) Same `accessory_id`, new etag:
  refetch, same slice. (5) A declaration missing one `safe`:
  `declaration_invalid`, catalog etag unchanged. (6) Slice and etag stable
  across a hub reboot. (7) `forget`: GOODBYE sent, entries removed, the next
  join from a fresh accessory gets a never-used slice. (8) A forged GOODBYE
  from the accessory's address deletes nothing. (9) A write to an offline
  accessory: `ACCESSORY_OFFLINE`.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Carve the user space from the reserved `0x8000`-`0xFFFF` (proposed), or
     from unused device-range domains?
  2. One join per window (single grant, proposed), or a window that admits
     several accessories until it times out?
  3. May a `configure` session open the accessory window in-band, or only the
     physical control (RFC-027's presence proof)?
  4. May a declaration carry STORE entries (presets held on the accessory)?
  5. Should the hub rewrite an accessory's entry `group` strings to its
     hub-authored name, or leave naming to the `accessories` record alone?

## RFC-077 -- Live catalog growth: announcing a new etag to live sessions

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-cou). LANDED 4c0ede7
  (2026-10-01). Item 8 as landed: the `Catalog32` capacities are build flags
  `VALENCE_CATALOG_*`, and Nucleus sets them for the Flagship. Consequence
  of
  [RFC-076](#rfc-076----accessory-join-and-declaration-accessory-channels-in-the-user-channel-space);
  item 7 (capacity) gates every join RFC-076 describes.
- **Ruling (operator, 2026-10-01).** Accepted. Item 8 ruled: break it now,
  before any tag: the reference library's catalog capacities (`Catalog32`
  entries, layout and schema field counts, `kCatalogScratchBytes`) become a
  build-time parameter of the hub; the Flagship build is sized for its
  accessory count (RFC-076 at 30 channels per slice; val-9u0.5 sizing
  recomputed). Open questions: (1) no base etag, degraded mode is the
  answer for pinned clients; (2) `CHANNEL_WITHDRAWN` as an unsolicited
  NACK; (3) subscribing to `catalog` `0x0001` becomes a MUST for every
  client; (4) the user space is accessories only. Risk accepted knowingly:
  a client with stale layouts is covered by the byte-identical core
  guarantee and law 10 inert keys. Items 2, 7 and 8 below now read so.
- **Origin:** operator rulings 2026-09-26: once paired, an accessory's
  channels join the hub's catalog. The orchestrator's read, recorded with the
  rulings: the catalog therefore changes at runtime, and the spec needs a
  rule for live growth and a mid-session re-announce. Capacity facts from
  the Nucleus planner: the reference library instantiates its catalog as
  `Catalog32 = BasicCatalog<48, 200, 160, 192, 4>` (48 entries, 200 layout
  fields, 160 schema fields; `lib/valence/include/valence/channel/catalog.hpp`)
  and encodes it into `kCatalogScratchBytes` = 32768 (`hub.hpp`); Nucleus uses
  189 of the 200 layout fields today.
- **Problem.**
  1. **§8.6 forbids it.** "The set of channels and fields is enumerated at
     connect and is never created or destroyed at runtime."
  2. **The half that exists blinds a live session.** §4.2 rule 3 already
     says a hub whose catalog changes without reboot MUST publish the new
     etag on the `catalog` STATE channel (`0x0001`), and clients MUST
     "re-enter SYNCING". Re-entering SYNCING drops readiness (§6.4): no STATE
     and no STREAM reach the session, including `safety`, and its INTENTs are
     refused `NOT_READY`. Pairing a pump would blind every connected
     controller to the safety latch and stall every motion stream for a
     catalog transfer, over a change that touched none of their channels.
  3. **No rule for grants on channels that vanish**, or for channels that
     appear.
  4. **Nothing confines the change**, so a client cannot know which of its
     cached layouts survive.
  5. **Capacity is unbounded on paper and tiny in practice.** RFC-076's slice
     had room for 126 channels as drafted (30 as accepted); the reference library has 11 spare layout
     fields. Nothing tells a client or an accessory how much room a hub has,
     or what refusal looks like.
- **Proposed change.**
  1. **Only the user space changes at runtime.** §8.6 is amended: entries in
     the core and device ranges are fixed per firmware boot; entries in the
     user space (RFC-076 item 1) MAY be added, replaced or removed at
     runtime, and only by an accessory join, a declaration replacement, or a
     forget. An accessory going offline changes nothing (RFC-076 item 6), so
     a flapping link can never churn the catalog. **Every core and device
     entry a session decoded under the old etag is byte-identical under the
     new one.** A hub that changes anything outside the user space without a
     reboot (a simulator, a host hub) keeps §4.2 rule 3 exactly as written.
  2. **Announcement reuses `catalog` (`0x0001`).** No CATALOG_CHANGED frame:
     the hub publishes `0x0001` carrying the new etag, which §4.2 rule 3
     already requires. Every client MUST subscribe to `0x0001` (ruling; the
     draft said MUST for clients tracking growth, SHOULD for the rest).
  3. **A user-space change does not revoke readiness.** §4.2 rule 3's
     "re-enter SYNCING" and §6.4's gate are narrowed to changes outside the
     user space. A LIVE session stays ready across a user-space change: the
     hub keeps pushing every granted STATE and STREAM, keeps accepting its
     INTENTs and bundles, and records per session the etag it last
     acknowledged. The client fetches the new catalog over BLOB `ns = 0` in
     the background, verifies SHA-256, and sends CATALOG_READY with the new
     etag (§6.4, idempotent as ever). SUBSCRIBE, PUBLISH and INTENT are
     validated against the hub's current catalog, as always. **A client that
     cannot accept the grown catalog** (its `total_bytes` exceeds the
     client's reassembly budget) MAY stay LIVE on its old etag, degraded as
     §8.5(a) describes, instead of GOODBYE `BLOB_REFUSED`: item 1 makes its
     old knowledge exactly correct for everything it had.
  4. **Channels that vanish.** On removal the hub, for every session:
     1. drops every subscription and publication grant on the removed ids and
        discards their retained values;
     2. sends **one NACK `CHANNEL_WITHDRAWN`** (new code, `0x0205` as landed)
        carrying `channel_id` per withdrawn grant. Silence is not an option
        (§4.5, §6.7): a subscription that silently stops presents as a
        rendering bug;
     3. answers later INTENTs on a removed id `UNKNOWN_CHANNEL`, and drops and
        counts later bundles on one (§9.2).
     Removed accessory channels are never motion sources, so no ownership
     moves; relationships targeting them are disabled per
     [RFC-078](#rfc-078----accessory-conformance-profile-and-the-hub-relationship-engine)
     item 3.
  5. **Channels that appear.** Nothing is delivered until a session
     subscribes (§10.2). No implicit grant, including for a live session
     whose HELLO wish-list named the id (wishes are evaluated once, at
     HELLO).
  6. **Transfers in flight.** A catalog transfer running when the etag
     changes is aborted with the one NACK §8.4 already specifies for an item
     whose generation moved (`CHUNK_UNAVAILABLE`); the etag change counts as
     that generation change. The client restarts against the new etag.
  7. **Capacity.** A hub that hosts accessories declares its budgets, and
     refuses honestly past them.
     1. **Per-accessory budget:** the most entries, layout fields and schema
        fields one declaration may use on this hub. At most 31 entries
        (RFC-076's 32-id slice less `r = 0`, the status entry included); in
        practice far fewer.
     2. **User-space budget:** the total entries, layout fields, schema
        fields and encoded catalog bytes the hub can add beyond its own
        catalog, across all accessories.
     3. **Advertised remaining capacity.** RFC-076 item 10's
        `accessories-roster` gains tail fields (§5.4): `per_accessory_entries
        u8, free_entries u16, free_layout_fields u16, free_schema_fields u16,
        free_catalog_bytes u16`. On-change, like the rest of the roster, so a
        client can say "room for about one more small accessory" before
        anyone presses a button. A hub MUST NOT advertise room it lacks.
     4. **Refusal.** A declaration that would exceed either budget is refused
        with JOIN_REPLY `capacity` (RFC-076 item 4). This clarifies RFC-076:
        a JOIN_REPLY with `declaration_needed` set is provisional, and the
        final JOIN_REPLY follows validation and the capacity check. The
        refusal is also emitted on `pairing-events` (`0x000B`) as a new kind,
        `accessory_refused` (kind 9 as landed) `{accessory_id, result}`, so
        the operator who
        opened the window learns why nothing appeared. The `accessory-admin`
        op `window_open` is answered NACK `ACCESSORY_CAPACITY` (new code,
        `0x0306` as landed) when
        the hub has no free slice, no free peer entry, or less budget than the
        smallest legal declaration (the status entry plus one channel).
  8. **The reference library's capacities become a build-time parameter.**
     The operator's explicit "break it now, before any tag" (2026-10-01):
     `Catalog32`'s entry, layout-field and schema-field counts and
     `kCatalogScratchBytes` stop being fixed in the `hub.hpp`/`catalog.hpp`
     public API and become parameters a hub build sets. The Flagship build
     is sized for its accessory count at RFC-076's 30 channels per slice
     (val-9u0.5's sizing recomputed). Whatever a build chooses, the hub MUST
     advertise exactly the headroom it has under item 7.3. (The draft held
     this open as a frozen-API change and capped the reference at its
     11-field headroom until ruled.)
  9. **Etag and reconnect are unchanged.** The etag covers the whole catalog,
     user entries included (§8.3); sorted by id, user entries follow every
     device entry. A reconnecting client with a stale etag runs §6.8 SYNCING
     normally.
  10. **Hub-served page and hosted clients: no implication.** The catalog is
      a renderer's only input (RENDERING §1), so Phosphor and a hub-served
      page both re-render from the new catalog with no asset change. A
      client SHOULD re-render in place, MUST keep user layouts keyed on stable
      ids (RENDERING §13 law 10), and MUST show an offline accessory's
      channels stale (law 8), never remove them.
- **Wire impact.** No new frame. Two NACK codes (`CHANNEL_WITHDRAWN`,
  `ACCESSORY_CAPACITY`), one pairing event kind, roster tail fields.
  Behavioral rules: §8.6 amended, §4.2 rule 3 and §6.4 narrowed.
- **Registry impact.** `nack_codes` gains the two codes; `pairing_event_kinds`
  gains `accessory_refused`; `core_channels` `0x0001` note: announces
  user-space growth without revoking readiness; the `accessories-roster`
  note gains the tail fields. No limit changes: budgets are per hub and
  advertised, not registered.
- **Conformance impact.** (1) A LIVE session subscribed to `safety` and one
  accessory STATE; an accessory joins: `safety` pushes continue with no gap,
  `0x0001` carries the new etag, the client fetches and sends CATALOG_READY,
  and its INTENTs are never refused `NOT_READY`. (2) Diff the encoded core
  and device entries before and after: byte-identical. (3) Forget: one
  `CHANNEL_WITHDRAWN` per withdrawn grant; the next INTENT on the id gets
  `UNKNOWN_CHANNEL`. (4) A catalog transfer in flight across a join is
  aborted by one NACK. (5) A declaration one field over `free_layout_fields`
  is refused `capacity`, an `accessory_refused` event fires, and the etag
  does not move. (6) Remaining-capacity fields drop by exactly the admitted
  declaration's use. (7) A client over its reassembly budget stays LIVE
  degraded.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Static-profile clients (§8.5) see an etag mismatch after every pairing.
     Add a second, "base" etag over the non-user entries so a pinned client
     matches exactly, or accept degraded mode as the answer?
  2. `CHANNEL_WITHDRAWN` as an unsolicited NACK (proposed), or an unsolicited
     GRANT at rate 0?
  3. Should subscribing to `0x0001` become a MUST for every client, not only
     for those that track growth?
  4. May a hub put other runtime-discovered hardware (not accessories) in the
     user space, or is the user space accessories only?
  5. The item 8 ruling: raise the reference library's catalog limits (a
     compatibility break), make them a build-time parameter of the hub, or
     keep them and ship tiny accessories only?

## RFC-078 -- Accessory conformance profile and the hub relationship engine

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-j5f). LANDED ede1f46
  (2026-10-01). Builds on
  [RFC-056](#rfc-056--modular-conformance-a-hub-is-a-set-of-duties-not-a-chip)
  (still PROPOSED): if RFC-056 is refused, the duty lists below still stand
  as profile text in §17.1. Companion to RFC-075, RFC-076 and RFC-077, all
  accepted the same day.
- **Ruling (operator, 2026-10-01).** Accepted with the map table
  anticipated: `relationship_maps` registers 1 `linear_clamp`, 2 `invert`,
  3 `threshold_hysteresis`, 4 `slew_limit`, 5 `lowpass`, 6 `gate` (output
  only while the source is inside a range, else safe), 7
  `piecewise_table`, each defined below with its parameters in physical
  units (open question 1). Open questions: (2) pause disarms relationships
  (the [RFC-085](#rfc-085----three-safety-pairs-one-control-each-pause-and-resume-override-and-return-estop-and-release) model; no HOLD exists);
  (3) direct client writes under pause are the operator's act, allowed;
  (4) stream stamps are applied on arrival with relative offsets, no spoke
  time sync; (5) relationships are authored through RFC-067 store verbs (a
  relationships STORE with `action.store`), and `relationship-admin` is
  dropped; (6) chains allowed, feedback loops rejected at save. Companion:
  Phosphor authors relationships as a node graph (ph board), the seven
  maps as nodes. Items 2 to 4 below now read so.
- **Origin:** operator rulings 2026-09-26. Isotope, the reference accessory
  firmware, is ESPHome-shaped: a declarative config goes through a generator
  to an image. An accessory driven by the machine (a pump following stroke
  speed, a vibrator following position, a stand following machine angle) is
  a **relationship**, and relationships are **hub policy**: evaluated on the
  hub, surviving the client closing.
- **Problem.**
  1. **No profile fits an accessory.** RFC-056 defines a hub as a set of
     duties but names no subset. The full hub profile (sessions, tiers, the
     trust ledger, BLE GATT, several bindings) is absurd for a pump, and
     nothing says which of it an accessory may omit.
  2. **No duty set names what a hub owes its accessories.**
  3. **A client-side relationship dies with the client.** A client can drive
     a pump from machine speed only while it is connected, and every client
     would reimplement the mapping: the §9.6 write-once argument applies
     verbatim.
  4. **Nothing stops accessories.** STOP and ESTOP stop the machine (§11.1).
     A relationship keeps driving a pump from a stopped machine's stale
     speed, and a direct client write can start one mid e-stop.
- **Proposed change.**
  1. **The `accessory` profile (new, §17.1).** An accessory is a hub whose
     only peer is its accessory host, over the RFC-075 spoke. It MUST:
     - satisfy parser totality (§5.8) and encode its frames golden-vector
       exact (§5.1 header, §5.3 CBOR profile, §5.4 layouts);
     - declare itself as a §8.1 catalog with relative ids, `safe` values and
       the item 5 validation rules of RFC-076, and serve it as blob namespace
       0 over BLOB_REQ/BLOB_CHUNK with §8.4 pacing;
     - answer every INTENT with ECHO or NACK, post-clamp and key-complete
       (§9.3), keeping idempotency over at least its most recent `intent_id`
       (stop-and-wait, §13.3, allows one outstanding control frame per
       direction);
     - accept c2h STREAM bundles on its declared stream channels, validating
       the §5.4 caps and dropping violators whole;
     - push each declared STATE channel to its host at its declared
       `max_rate_hz` (on change for 0) with no SUBSCRIBE: the host is its
       sole, implicit subscriber;
     - carry the registered **accessory-status** STATE at relative id `0x01`:
       `{state u8, fault u8, beacon_seq u16}` = 4 bytes, `state` from a new
       `accessory_states` table (0 `live`, 1 `safe_joined` (joined, awaiting
       its first command), 2 `safe_deadman`, 3 `safe_goodbye`, 4
       `safe_estop`, 5 `safe_fault`), `fault` device-defined (0 none),
       `beacon_seq` the header seq of the last BEACON it accepted. Pushed on
       change and at least every `spoke_beacon_interval_ms`;
     - honor every RFC-075 duty: channel follow, the deadman and the safe
       state, clamping, the 250-byte budget, no ESTOP rebroadcast;
     - keep a durable `accessory_id` and join per RFC-076.
     **Absent, never required of an accessory:** HELLO/WELCOME and the rest
     of the session layer, the readiness gate, SUBSCRIBE/UNSUBSCRIBE/GRANT/
     PUBLISH, PROBE, CLOCK, access tiers, pairing tokens, AUTH, HUB_SIG, the
     trust ledger, every core channel from `0x0001` to `0x000E`, control
     ownership (its host is its only caller), multiple peers, BLE GATT,
     WebSocket, mDNS and UDP discovery, and the rendering annotations
     (`category`, `rank` and the rest stay optional).
  2. **The `accessory-host` duty set (new, for hubs).** A hub that sets
     BEACON `accessory_host` MUST: beacon, answer probes and broadcast ESTOP
     per RFC-075; run the join, declaration fetch, validation, persistence and
     sticky slices of RFC-076, with its three core channels; grow its catalog
     per RFC-077 and advertise its capacity; and:
     - **proxy, never expose.** Clients never address an accessory. The host
       serves client subscriptions to accessory STATE from its retained copy.
       It forwards a client INTENT on an accessory channel only after its own
       checks (tier, declared range, the ownership rule of item 3, the
       interlock of item 4), under its own spoke `intent_id`, and answers the
       client with an ECHO carrying the **accessory's** applied values: the
       accessory is the ground truth (§1.2), not the forward. No answer after
       §13.3's retransmits: NACK `ACCESSORY_OFFLINE`. c2h bundles are
       forwarded the same way under the client's publication grant. An
       accessory runs no CLOCK: it applies a forwarded bundle's samples on
       arrival, keeping their relative offsets (`t_off`); the spoke has no
       time sync (ruling).
     - **the sole-caller rule extends to accessories** (§11.4): the host is
       the only thing that commands one.
     - **never widen access.** An actuating accessory channel is at least
       `control` in the host's catalog whatever its declaration says, the
       same obligation §11.2 places on `estop_clear`; the host MAY raise any
       declared floor further.
     - run the relationship engine (item 3) and the interlock (item 4).
  3. **Relationships are hub policy.** A relationship maps one source field
     to one target field:
     - **source:** a numeric field of an h2c STATE or STREAM layout anywhere
       in the host's catalog (core, device, or another accessory's user
       space), named by `(channel id, layout index)`;
     - **target:** a value-bearing field of an accessory's INTENT schema or
       c2h STREAM layout, named by `(absolute channel id, schema key or layout
       index)`;
     - **map:** from the registered `relationship_maps` table, seven maps
       (ruling; the draft registered `linear_clamp` alone). Every bound and
       parameter is in each field's physical units (post-`scale`), and every
       map's output is finally clamped into the target's declared
       `min`/`max`. Let `L(in) = out_min + (clamp(in, in_min, in_max) -
       in_min) * (out_max - out_min) / (in_max - in_min)`, with `in_min !=
       in_max`.
       1. `linear_clamp`: `out = L(in)`.
       2. `invert`: `out = out_max + out_min - L(in)`, the same line
          reversed (`in_min` maps to `out_max`).
       3. `threshold_hysteresis`: parameters `on_above` and `off_below`
          (source units, `off_below <= on_above`). The output is `out_max`
          once the source rises to `on_above` and `out_min` once it falls
          to `off_below`, unchanged in between; it starts at `out_min` when
          armed.
       4. `slew_limit`: `L(in)`, with the output's rate of change bounded
          by `rise_per_s` and `fall_per_s` (target units per second; one
          value serves both when the second is absent).
       5. `lowpass`: `L(in)` through a first-order low-pass with time
          constant `tau_s` (seconds).
       6. `gate`: `out = L(in)` while `in_min <= in <= in_max`, else the
          target's `safe` value: output exists only while the source is
          inside the range.
       7. `piecewise_table`: up to 8 `(in, out)` points, `in` strictly
          ascending; linear between points, held at the end values outside
          them; the four bounds are unused.
       Parameters beyond the four bounds ride the item's `params` key, an
       array of up to 16 numbers in the order listed for its map.
     **Evaluation.** On the host, on every source update, writing the target
     only when the mapped output moved by at least the target field's `step`
     (any change if none is declared), no faster than the target channel's
     `max_rate_hz` and, for an INTENT target, within
     `intent_ingress_default_per_s`. A map with internal state
     (`slew_limit`, `lowpass`) is also evaluated at the target's
     `max_rate_hz` while its output is still converging. Writes take the proxy path of item 2, so
     the accessory's ECHO is the truth the relationship reports.
     **Persistence and independence.** Relationships are stored in the host's
     non-volatile storage and survive every session ending and every reboot;
     no session owns one, and evaluation never depends on any session
     existing. Each carries a persisted `enabled` and a volatile **`armed`**,
     which is false at every boot: a reboot re-arms nothing (item 4).
     **Ownership.** An enabled, armed relationship owns its target field: a
     client write to that field gets NACK `SOURCE_CONFLICT` (§11.4's code,
     reused) until the relationship is disarmed or disabled. One target field
     has at most one enabled relationship; a second is refused
     `INVALID_VALUE`.
     **Degradation.** Source or target removed (RFC-077 item 4, RFC-076 item
     8): the relationship is disabled and its target, where it still exists,
     set to its `safe` value. Target accessory offline: the relationship
     idles; on rejoin, if still armed, the host sends the current mapped
     value.
     **Storage and authoring.** A core STORE `relationships`, `kind`
     `"relationship.map"`, `watch` access, with a registered item grammar
     (`relationship_keys`: `rel_id`, `name`, `source_channel`,
     `source_field`, `target_channel`, `target_field`, `map`, `in_min`,
     `in_max`, `out_min`, `out_max`, `params`, `enabled`); §8.7's carve-out
     applies because the hub interprets the item. Its roster STATE
     `relationships-roster`: `{generation u16, count u8, capacity u8, armed
     2 x bitfield8, faulted 2 x bitfield8}`, bit *i* for `rel_id` *i*,
     `capacity` at most `relationships_max` (16), joined to the store by
     RFC-070's `store_id`. Ids as landed, each status reserved:
     `relationships` `0x0013`, `relationships-roster` `0x0014`, and the
     writer `relationships-write` `0x0015`. **Relationships are authored through [RFC-067](#rfc-067----store-verbs-one-registered-op-select-not-split-preset-tags)
     store verbs** (ruling): a core INTENT carrying an `action.store` op
     select and the same `store_id`, `configure` access. `save` creates or
     replaces an item (enabling or disabling is a `save` with `enabled`
     changed), `delete` removes one, `rename` renames it. **Chains are
     allowed** (an accessory field may be the source of another
     accessory's target); a `save` that would close a feedback loop (a
     cycle through source and target fields) is refused `INVALID_VALUE`.
     (The draft had a dedicated `relationship-admin` INTENT over
     `relationship_admin_ops` with `put`, `delete`, `enable`/`disable` and
     `arm`/`disarm`; it is dropped.) Names and relationships are authored
     from a client, per the rulings; the host only stores and evaluates
     them. Phosphor authors them as a node graph, the seven maps as nodes.
  4. **Safety interlock (MUST).**
     - While ESTOP is latched in `safety` (`0x0003`): every relationship is
       disarmed; every relationship target is driven to its `safe` value (the
       accessories also self-safe on the broadcast ESTOP frame, RFC-075 item
       8); client writes to actuating accessory fields are refused
       `ESTOP_ACTIVE`.
     - On PAUSE latching ([RFC-085](#rfc-085----three-safety-pairs-one-control-each-pause-and-resume-override-and-return-estop-and-release)):
       every relationship is disarmed and every target driven to its `safe`
       value, once. PAUSE does not refuse later direct client writes: under
       pause they are the operator's own act, allowed. (The draft said STOP
       and asked about HOLD and PAUSE; STOP and HOLD are retired.)
     - **Arming is `resume`.** The `resume` op, the one explicit operator
       act that clears PAUSE, arms every enabled relationship, the same
       operator-act principle
       [RFC-074](#rfc-074----stop-semantics-for-streams-refused-while-latched-re-armed-only-by-an-explicit-command)
       applies to streams. Nothing else arms one: an ESTOP release lands in
       PAUSE (§11.2, "clearing never restarts motion", applied to
       accessories), a reboot leaves every relationship disarmed, and
       saving an enabled relationship arms it only at the next `resume`.
       (The draft armed through explicit `arm`/`disarm` ops on the dropped
       `relationship-admin` channel.)
     - The interlock is hub policy and never depends on a client session,
       exactly as the relationships it governs.
- **Wire impact.** No new frame. New core channels (`relationships` STORE,
  `relationships-roster` STATE, and its `action.store` writer INTENT), the registered
  accessory-status layout, and new vocabularies. No existing behavior moves
  for a hub that is not an accessory host.
- **Registry impact.** §17.1 gains profiles `accessory` and
  `accessory-host`. New `accessory_states`, `relationship_maps` (1 to 7
  as above), `relationship_keys` (with `params`); no
  `relationship_admin_ops` and no `relationship` action tag (authoring
  rides `action.store`); `core_channels` gains the three
  entries (`0x0013` to `0x0015` as landed, status reserved); an `accessory_status` layout entry
  for relative id `0x01`; `limits` gains `relationships_max` (16).
- **Conformance impact.** Accessory profile: a harness over the §13.6
  in-process binding drives a declared accessory through join, declaration
  fetch, INTENT/ECHO with clamping, a STREAM bundle over the caps, and every
  RFC-075 safe-state entry; it asserts the status snapshot's `state` at each
  step. Host: (1) close every session, move the source: the target follows.
  (2) Latch ESTOP: every target reaches `safe`, statuses read `safe_estop`,
  a client write is refused `ESTOP_ACTIVE`. (3) Release ESTOP: targets
  stay `safe` until `resume`. (4) Reboot: relationships persist, `enabled` intact,
  `armed` false. (5) A client write to an armed target: `SOURCE_CONFLICT`.
  (6) Forget the target accessory: the relationship is disabled, one
  `CHANNEL_WITHDRAWN` per grant (RFC-077). (7) A declaration asking for
  `watch` on an actuating channel is served at `control`.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Which maps beyond `linear_clamp`: invert, piecewise table, threshold
     with hysteresis, smoothing or slew limit, speed-to-duty?
  2. HOLD and PAUSE: should they disarm relationships like STOP, or leave
     them running (the machine is parked, not stopped)?
  3. Under a latched STOP, refuse direct client writes to accessories as
     ESTOP does, or accept them as the operator's own act (proposed)?
  4. STREAM bundles carry hub-timebase stamps (§7.1) and an accessory runs
     no CLOCK: apply them on arrival with relative offsets only, or give the
     spoke a minimal time sync?
  5. Author relationships through RFC-067's store verbs instead of a
     dedicated `relationship-admin` channel, if RFC-067 lands?
  6. May an accessory field be a source for another accessory's target
     (chains), and must the host reject feedback loops?

## RFC-079 -- Config mode and the setup category

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-ewm). LANDED 4d267b0
  (2026-10-01). The §13.1 BLE sentence carries TODO(rfc-qqq) until RFC-056
  is ruled. Gives
  [RFC-069](#rfc-069----client-pushed-wifi-provisioning-over-ble)
  (client-pushed WiFi provisioning) the hub state it assumes; places
  [RFC-076](#rfc-076----accessory-join-and-declaration-accessory-channels-in-the-user-channel-space)'s
  accessory pairing control. Lands together with RFC-055/056/057 (not yet
  ruled) so the §13.1 BLE sentence reads SHOULD, and MUST where config mode
  is offered. Prerequisite on the reference hub: Nucleus has no BLE today.
- **Ruling (operator, 2026-10-01).** Accepted with ui category 15 `setup`
  (open question 1: a category, not a binding over three existing ones).
  Config mode activates BLE advertising AND the §13.5 USB serial binding
  together; both accept RFC-069 `wifi_join`. Open question 2: accessory
  pairing waits until the hub has joined WiFi (the spoke follows the
  access point's channel and there is none in config mode). Open question
  3: `configure` to the first knock in config mode, as drafted. Open
  question 4: the advertisement bit is enough. **Scope of `setup`
  (second ruling the same night):** the machine COMMISSIONING surface, not
  only first-run network: every writable configuration a person needs to
  make the machine usable, including its geometry and ceilings; pinout and
  board-level facts stay out. Nucleus follow-up: `machine-config`
  (0x1000) and the kinetic ceilings move to category `setup`, the wizard
  steps through them in authoring order, and machine geometry and the
  ceilings become setup-category settings with sane defaults and a
  required first-run pass, not compile-time constants. RFC-054 is
  withdrawn (no hub-discloses-credentials path). Items 1, 4 and 5 below now
  read so.
- **Origin:** operator rulings 2026-09-26. First-time WiFi provisioning:
  boot the machine with the pairing button held and it enters **config
  mode**: pairing window open, BLE advertising with the window flag, no WiFi,
  configuration over BLE. A hub in config mode appears in a client's
  discovery list like any hub, and the client offers a different set of
  options. No softAP, ever: the ESP-NOW spoke
  ([RFC-075](#rfc-075----esp-now-spoke-binding-an-unencrypted-hub-and-spoke-profile-for-accessories))
  shares the radio and must follow the access point's channel. The
  orchestrator's read, recorded with the rulings: the session lands at
  `configure`, and the catalog exposes a setup category that a client renders
  generically, with the wizard pattern as polish.
  **CANON FLAG, for the hardware repo to resolve (this RFC does not):**
  `Hardware/flagship/SPEC.md` (decision row 2026-09-23) reads "SW2 PAIR (hold
  = pair, **held at power-on = AP config mode**, press TBD)". "AP config
  mode" means a softAP, which tonight's ruling forbids. This entry is written
  against the 2026-09-26 ruling (BLE only, no softAP); the Flagship SPEC row
  needs the operator's correction in its own repository.
- **Problem.**
  1. **No state reliably offers provisioning.** RFC-069's `wifi_join` gate
     needs an open window and a BLE link. The §12.3(c) power-cycle gesture
     opens a window on a hub that is otherwise running normally, and nothing
     defines a mode in which a factory-fresh hub, or one moved to a new network, waits, safely,
     for credentials.
  2. **The common ESP32 answer is barred.** SoftAP captive portals (Improv,
     WiFiManager) pin the radio to the softAP's own channel, which an
     accessory following RFC-075 cannot rely on, and the ruling forbids it.
  3. **A generic client cannot find first-run controls.** The provisioning
     intent belongs in `network` (11), pairing in `session` (12), the machine
     name in `system` (13). A client that meets a hub it has never seen must
     either assemble a first-run flow from three tabs or show a hub-specific
     screen, which RENDERING §13 law 6 forbids.
  4. **Discovery cannot show "needs setup".** `ble_adv_flags` says a window
     is open, which is also true of an ordinary pairing press.
- **Proposed change.**
  1. **Config mode (new §13.4.1).** Entered by booting with the hub's
     pairing control held (a hub with a pairing button binds this gesture;
     the §12.3(c) power-cycle gesture is unchanged and does not enter config
     mode). In config mode the hub:
     - opens the §12.3 association window at boot
       (`pairing_window_default_s`); the pairing control re-opens it;
     - advertises BLE GATT (§13.4) with `ble_adv_flags` bit0
       `pairing_window_open` while the window is open and new bit2
       `config_mode` for the whole mode;
     - does **not** associate to WiFi and runs no WebSocket listener
       (`ws_available` clear);
     - MUST NOT operate a softAP. This binds every mode, not only this one:
       an accessory host never runs a softAP (RFC-075 item 10);
     - activates the §13.5 USB serial binding alongside BLE GATT; both
       accept RFC-069 `wifi_join`, as first-class paths (ruling; the draft
       was BLE only);
     - does not run the RFC-075 spoke: accessory pairing waits until the
       hub has joined WiFi, because the spoke follows the access point's
       channel and there is none in config mode (ruling).
     A hub that offers config mode MUST implement BLE GATT; under RFC-056's
     proposed demotion of BLE to SHOULD, config mode is the condition that
     makes it MUST again. Config mode does not wipe anything: factory reset
     stays the deliberately harder gesture §12.3(c) requires.
  2. **Leaving config mode.** On a successful RFC-069 `wifi_join` the hub
     SHOULD leave config mode without a reboot: bring up the station and the
     WebSocket listener, set `ws_available`, clear `config_mode`, so the
     client can migrate per §6.3. A hub MAY instead commit by rebooting
     (ECHO `reboot_in_ms`, §9.3). A reboot without the gesture always leaves
     config mode.
  3. **The session lands at `configure`.** Booting with the control held is
     a physical-presence proof (§12.3(c)), and physical access is outside the
     threat model (§12.1). In config mode the window's single grant is
     `configure` **whether or not `configure` tokens already exist**; this
     amends §12.3's grant rule for this gesture only. The mechanism is the
     existing one, with no new wire: the client connects at `watch`, sends a
     bare PAIR_REQ, receives PAIR_GRANT `{token, configure}`, presents the
     token by AUTH (§12.4), and holds `configure`. It keeps a durable token,
     so its later WebSocket session after migration is `configure` too.
     Sessions that did not win the grant stay `watch`.
  4. **The `setup` ui category.** `ui_categories` gains **15 `setup`**:
     the machine's COMMISSIONING surface, "network credentials, machine
     name, accessory pairing, and the machine's own geometry and ceilings"
     (ruling; the draft scoped it to first-run and re-provisioning). A hub
     places there every writable configuration a person needs to make the
     machine usable. In particular it SHOULD place there:
     - RFC-069's `provisioning` channel;
     - the settings channel carrying `identity.name` (the writable machine
       name, RFC-026; its read-only twin is WELCOME `identity.hub_name`,
       [RFC-016](#rfc-016--in-band-hub-identity-capabilities--catalog-introspection)),
       split into its own channel if it shares one with unrelated settings,
       because `category` is entry-level;
     - RFC-076's `accessory-admin` channel (its `window_open` op is the
       accessory pairing control).
     - the machine's own geometry and ceilings: rail length, travel
       window, speed, accel and jerk ceilings, geometry, the degree-to-mm
       ratio and the like.
     Pinout and board-level facts stay out of the catalog. Operator
     principle (2026-10-01): the Flagship is a motor controller that can be
     strapped to any machine with a motor; how motor motion becomes machine
     motion is the OWNER's configuration, entered through `setup`, never
     firmware knowledge, and the `axis` archetype is the presentation of
     that configuration, not an assumption in the firmware. Categories are
     static: these entries carry `setup` in every mode, and the catalog does
     not change with the mode (§8.6 invariance holds).
  5. **Client conformance.** A client connected to a hub whose advertisement
     carried `config_mode` SHOULD open on the `setup` category, presented
     with the `wizard` widget pattern (RENDERING §10): one step per entry in
     authoring order (§8.9 item 4), the provisioning step showing RFC-069's
     ECHO or NACK outcome, ending with the §6.3 migration to WS (from BLE or
     serial). It MUST
     render the category generically from the catalog: never a hub-specific
     screen, never a channel found by name (RENDERING §13 law 6). A client
     that does not know id 15 renders it under `other` (RENDERING §3's
     graceful-extension rule), so nothing is lost on an older client. A
     client listing discovered hubs SHOULD mark a `config_mode` hub
     distinctly ("needs setup"); the presentation is the client's.
- **Wire impact.** One advertising flag bit; one category id. No frame, no
  key. Behavioral: §12.3's grant rule gains the config-mode case.
- **Registry impact.** `ble_adv_flags` bit2 `config_mode`; `ui_categories`
  15 `setup` (RENDERING §3's table follows). §13.4 gains §13.4.1; §12.3 and
  §13.1 gain the cross-references above.
- **Conformance impact.** Hub: booted with the control held, it advertises
  bits 0 and 2, offers no WebSocket, and a WiFi scan shows no SSID from it;
  the first knock is granted `configure` even with a `configure` token
  already stored; the token store survives the mode; a successful
  `wifi_join` sets `ws_available` and clears `config_mode`. Client: a
  fixture catalog whose setup entries carry renamed channels still renders
  the wizard; a client built before id 15 shows those entries under `other`.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. RENDERING §3 freezes the category set "at the v1.0 tag" and records the
     ruling that "adding categories later makes things awful". No tag exists,
     so id 15 is legal today, but it cuts against that intent. A new
     category, or no category and a `setup` binding over the existing
     `network`/`session`/`system` entries (a rank, role, or wizard binding)?
  2. Does the ESP-NOW spoke run in config mode (station started,
     unassociated, on a fixed channel, accessories finding it by scan), or is
     accessory pairing deferred until the hub has joined WiFi?
  3. `configure` for the config-mode grant regardless of existing admins
     (proposed), or keep §12.3's zero-token rule and grant `control`?
  4. Is the advertisement bit enough, or does a client that reconnects from a
     bonded address without scanning need an in-session config-mode
     indicator (a field role on `hub-status`)?

## RFC-080 -- User-authored surfaces and presentation choice

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-94c). LANDED efb23fc
  (2026-10-01). Amends RENDERING.md only; no wire change. Phosphor
  implements it (204480e, built "as though accepted" earlier the same day).
- **Ruling (operator, 2026-10-01).** Accepted. The open questions were
  decided as veto-able defaults by the orchestrator (operator: "idk"):
  (1) no hub-side hold-to-run now, its own RFC if an accessory needs it;
  (2) presentations stay client craft, no portable layout format until a
  second client exists; (3) single fields placeable anywhere, as coded;
  (4) a display-only instance of a writable field shows the pending ladder
  for writes from elsewhere, never only the settled value (law 5). Item 3
  below now reads so.
- **Origin:** operator rulings 2026-09-26 for the Phosphor UI builder
  (Phosphor ph-e82.1). Phosphor becomes a builder: a user places controls on
  a grid, where a control is one catalog field with a chosen presentation
  (knob, slider, stepper or toggle for a writable field; number, bar, bulb
  or graph for a readout), and saves named layouts per user per client. The
  Phosphor builder plan raised a flag against RENDERING §13 law 10 (layout
  keys); this RFC carries the operator's resolution.
- **Problem.**
  1. **RENDERING has no user-authored surface.** §11 says pages "are
     **derived from the catalog**, never designed per app", and §9 says "a
     pattern's region assignment (§10) is part of its spec definition, never
     a per-app choice". Read literally, a saved layout is non-conformant.
  2. **Nothing separates what a user may choose from what they may not.**
     §8.2 derives the archetype by first match; nothing says whether a user
     may change it, or only how it looks.
  3. **No rule for per-placement ranges.** A user wants a slider over 0 to
     40 % of a 0 to 100 % field. Nothing says whether a placement may narrow,
     widen, or re-default a field, or what it shows when the hub's value lies
     outside the narrowed range.
  4. **No rule for toggle placements on non-bool fields** (which two values a toggle writes).
  5. **Law 10 blocks keying.** "Key persisted client layout on stable ids,
     never on indices or wire vocabulary." A field with no `role` has no
     stable semantic id beyond its channel id and its name, and law 6
     forbids binding by name.
- **Proposed change.**
  1. **Two kinds of surface.** The **catalog-built UI** is the derived page
     tree of §11 with the region assignment of §9, unchanged and still
     REQUIRED of every client claiming RENDERING conformance. It earns its
     keep on hardware remotes and embedded processors with a screen and
     buttons, where no user will ever author anything. A client MAY
     **additionally** offer **user-authored surfaces**: saved layouts the
     user composes. A user-authored surface is not the catalog-built UI and
     never replaces it: **every field MUST stay reachable through the
     derived pages** whatever any layout contains or omits. §11's
     consistency invariant ("the same catalog yields the same page tree")
     binds the derived tree only. RENDERING §11 and §9 gain one sentence each
     saying so.
  2. **What a user-authored surface may never do.**
     - remove, cover or displace the `persistent` region (§9 placement
       invariants) or the `stop` archetype (law 1): a surface always carries
       a stop affordance the user cannot remove (the Phosphor top strip is
       the reference form, operator ruling);
     - change what a placement binds to: the user chooses how a field looks,
       never which field it is (laws 6 and 7);
     - suspend the universal interaction contract (§8.1): every writing
       presentation shows the four-state write ladder (law 5), grays with a
       reason rather than hiding, and renders only values the wire sent;
     - place a composite without all its essential bindings (law 7): it
       declines, exactly as on a derived page.
  3. **Archetype fixed, presentation chosen.** The archetype is the §8.2
     first match and is not user-editable. (The draft added "including an
     explicit `archetype` annotation, row 1"; RFC-083 struck that row.) Within it the user picks a **presentation** by
     read/write class:
     - a **writable** field (one that writes, per §8.2 rows 3 and 6 to 11)
       may take any writable presentation: knob, slider, stepper,
       segmented, toggle and the like;
     - a **read-only** field may take any read-only presentation: number,
       bar, bulb, graph, hero numeral and the like;
     - a writable field MAY ALSO be placed with a read-only presentation, as
       a **display-only instance** (the set speed shown as a hero numeral).
       It writes nothing, shows the applied value, and shows the pending
       ladder (law 5) for writes made elsewhere, never only the settled
       value (ruling on open question 4).
     Presentations are client vocabulary, not registered. The `stop`
     archetype (row 2) is bound by identity and takes no presentation
     choice beyond the client's own rendering of it.
  4. **Per-placement range parameters.** A placement with a range
     presentation MAY set `min`, `max`, `step` and `default`, each inside the
     catalog's own bounds: a placement may **narrow, never widen**; `step`
     MUST be a whole multiple of the catalog `step` where one is declared;
     `default` (the placement's return value) MUST lie inside the placement's
     own range. The narrowing is a UI constraint only: the hub stays the
     referee (SPEC §8.8, "validation is hub-side"). **Ground truth wins over
     the narrowing:** when the applied value lies outside a placement's
     range (another client set it, or the hub clamped differently), the
     placement MUST show the true value and mark it out of range, never pin
     it silently to its own edge.
  5. **Toggle placements.** A toggle placement on any writable field (not
     only a `bool`) is configured one of two ways:
     - **two values**: each press writes the other of values A and B, both
       inside the field's range;
     A momentary override-and-return mode (press writes A, release restores)
     was drafted and WITHDRAWN by operator ruling 2026-09-26: a client-side
     restore depends on the client surviving the press, which runs against
     the principle that policy lives on the hub, and it does not earn its
     place. A toggle placement is two-valued, full stop. A hub-side
     hold-to-run (a write that reverts unless refreshed) stays an open
     question below, as its own future RFC if an accessory ever needs it.
  6. **Saved layout keys, and a scoped amendment to law 10.** A saved
     layout keys each placement on stable identity:
     - the hub, by `hub_instance_id` (§6.1) where present;
     - the field, by its registered `role` where it has one;
     - otherwise by **channel id plus field name** (for a schema field, its
       name; the CBOR key is not stable across a re-authored schema).
     Law 10 is amended: "Key persisted client layout on stable ids, never on
     indices or wire vocabulary. **For user-authored surfaces only**, a field
     with no role MAY be keyed on channel id plus field name." This is a
     storage key for re-finding a placement the user made, not semantic
     binding, so law 6 still holds: no client ever infers what a field means
     from its name. A key that no longer resolves after a firmware update
     (field renamed or removed) leaves the placement **orphaned and shown as
     missing**; it MUST NOT be rebound to a different field by guess.
     Channels in the user space (RFC-076) are keyed by their absolute id,
     which RFC-076 item 6 keeps stable while the accessory stays paired.
     Resolves the Phosphor builder plan's law-10 flag.
  7. **Layouts live on the client.** Named layouts are stored per user per
     client, locally (operator ruling; sync later, maybe). Nothing about them
     reaches the hub or the wire.
- **Wire impact.** None.
- **Registry impact.** None. RENDERING.md amended: §9 and §11 (one sentence
  each, item 1), §8 (presentation choice, items 3 to 5), §13 law 10 (item
  6).
- **Conformance impact.** Client tests: (1) a catalog whose every field is
  also reachable on the derived pages while a user surface omits most of
  them; (2) a user surface cannot remove the stop affordance or cover
  `persistent`; (3) a narrowed placement shows an applied value outside its
  range as out of range; (4) a placement cannot widen past the catalog
  `max`; (5) a firmware
  update renaming an unroled field orphans its placement, which is shown as
  missing and never silently rebound.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Should the protocol offer a hub-side hold-to-run (a write that reverts
     unless refreshed) for fields where a held state matters, such as an
     accessory pump? The client-side momentary mode was withdrawn; if the
     need is real it is a hub duty and its own RFC.
  2. Should presentations become a registered vocabulary, so a saved layout
     can move between clients (a portable layout format), or stay client
     craft?
  3. Single fields placeable anywhere on a surface, or only inside nests
     (undecided in the rulings)?
  4. Should a display-only instance of a writable field render its pending
     writes from elsewhere (the ladder), or only the settled applied value?

## RFC-081 -- Advanced-generator master roles

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-bf4). LANDED 3725a6b
  (2026-10-01). Lands together with
  [RFC-066](#rfc-066----modulators-catalog-declared-modifiers-attached-to-the-field-they-ride)
  as amended (modulators). No wire numbers.
- **Ruling (operator, 2026-10-01).** Accepted as drafted, family
  `advgen.*` (open question 1), landed together with RFC-066 as amended.
  Masters bind by `advgen.*` roles; modulators attach to them by
  `mod_target` (open question 2: a modulator names its base by
  `mod_target`, not by a role). Items 1, 3 and 4 below are aligned with
  RFC-066 as amended.
- **Origin:** board bead rfc-bf4 (Phosphor ph-vdk.11 audit). Reference
  shape: Nucleus `flagship_p4/src/hub/ValenceCatalog.h`, entry
  `pattern-advanced` (0x1210), whose eight master fields (`ap_mode`,
  `master`, `max_depth`, `min_depth`, `in_speed`, `out_speed`, `in_accel`,
  `out_accel`) carry no `role`; its run/stop is the shared generator's
  `pattern.running` on `pattern-state` (0x1200).
- **Problem -- three normative texts cannot all hold.**
  1. RENDERING §10 lists `generator-advanced` as **MUST** (handheld/full),
     and the registry `widget_patterns` entry 10 carries `required: true`.
  2. RENDERING §13 law 6: a conformant client "never pattern-matches a
     channel or field *name*"; law 7: "Require **all** of a composite
     widget's essential bindings, or decline entirely."
  3. Registry `field_roles` has no role for any advanced-generator field.
     SPEC §8.8 even records the inclusion test that "keeps device internals
     out of `pattern.*`", and the advanced controls were kept out under it.
  A client can bind the pattern only by name (violating law 6), or decline
  it (violating the §10 MUST). RFC-066 removes the lane half of this; the
  master half remains: the pattern's own essential bindings ("master
  controls", RENDERING §10) have no identity.
- **Proposed change.**
  1. **Register the master role set** in `field_roles`, family `advgen.*`
     (the advanced generator is a standardized capability interface,
     RENDERING §2.2, so the §8.8 inclusion test is met by the interface
     itself, not by any one firmware):
     - `advgen.master`: overall rate scale of the advanced program, percent
       of its own range;
     - `advgen.depth_max`, `advgen.depth_min`: the deep and shallow stroke
       bounds the program swings between, percent of the stroke window;
     - `advgen.speed_in`, `advgen.speed_out`: inward and outward stroke speed
       bases;
     - `advgen.accel_in`, `advgen.accel_out`: inward and outward
       acceleration bases;
     - `advgen.mode`: bool, present only where the advanced program is a mode
       of a generator that also plays the classic `pattern.select` set: true
       = the generator plays the advanced program.
     These are the six base controls RFC-066's modulators target (by
     `mod_target`), plus the master scale and the mode switch.
  2. **Run/stop is `pattern.running`.** The master run/stop RENDERING §10
     names binds the `pattern.running` role. A hub offering an advanced
     generator MUST carry `pattern.running` for it; `source.background_run`
     co-locates with it per RENDERING §10.1 unchanged.
  3. **Essential bindings (law 7).** `generator-advanced` binds only when
     `pattern.running`, `advgen.master` and the six base roles are all
     present; modulators attach by `mod_target` and are not essential (the
     draft also required RFC-066's four-lane minimum, which the RFC-066
     ruling withdrew). `advgen.mode` is
     essential only when `pattern.select` is present. Anything less falls
     through to `settings-card` (RENDERING §10), which is conformant.
  4. **Cardinality unchanged.** Each `advgen.*` role appears once per
     catalog; SPEC §8.8's SHOULD and first-in-catalog-order tiebreak apply
     as written (RFC-066 as amended writes no exemption either).
  5. **Text corrected.** RENDERING §2.2 "master state" and §10 "master
     controls" gain "(the `advgen.*` roles plus `pattern.running`, RFC-081)";
     the registry `widget_patterns` 10 note gains the same pointer.
- **Wire impact.** None beyond role strings, which are catalog text: an
  adopting hub's etag moves (T11). Reference cost: eight `role` strings on
  0x1210, roughly 150 bytes, far inside `catalog_max_entry_bytes` (4096).
- **Registry impact.** `field_roles` gains eight `advgen.*` strings (string
  vocabulary, nothing numeric to allocate). `widget_patterns` 10 note text.
  No number moves; codegen regenerates the role constants.
- **Conformance impact.** Fixture: the RFC-066 six-modulator catalog plus a
  master entry carrying all eight roles and a `pattern-state` entry carrying
  `pattern.running`; assert `generator-advanced` binds. Variants: drop
  `advgen.depth_min` (assert decline to `settings-card`); rename every
  master field (assert the binding survives, law 6). Nucleus follow-up on
  its own board: eight role annotations on 0x1210.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. Family name: `advgen.*` (short, unambiguous) versus folding into
     RFC-066's naming once its open question 3 settles.
  2. Should a lane name its base control by role (lane `ctrl`, RFC-066 open
     question 1), now that the bases have roles to point at?

## RFC-082 -- One home for the rendering wiring state

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-6au). LANDED d12403e
  (2026-10-01). Editorial: no wire, registry or conformance change.
- **Ruling (operator, 2026-10-01).** Accepted; re-measure the annotation
  counts on Nucleus `ValenceCatalog.h` at landing and stamp Phosphor as the
  client half. Item 2 below now reads so.
- **Origin:** board bead rfc-6au. Verified against the reference catalog,
  Nucleus `flagship_p4/src/hub/ValenceCatalog.h` (the `.hasCategory`,
  `.hasRank`, `.hasUnitId` and value-axis annotations on its entries and
  fields), 2026-10-01.
- **Problem -- SPEC says both things.**
  1. SPEC §19.1, last sentence: "Nothing in RENDERING.md is wired onto a real
     catalog entry as of this landing -- §18-23 records that plainly."
  2. SPEC §18 item 23: "RENDERING.md's vocabulary is now wired onto the
     reference catalog".
  Item 23 is current; §19.1 froze the RFC-048 landing-time state into
  normative prose (Canon C-2: status is not prose). The
  [RFC-048](#rfc-048--the-rendering-constitution-catalog-vocabulary-capability-interfaces-renderer-law)
  Status line said the same and carries a dated receipt as of this entry.
  Item 23 has gone stale in its own pointers: it cites
  `include/comms/ValenceCatalog.h` and `webui/src`, which are paths in the
  archived S3-era firmware, not in Nucleus or Phosphor.
- **Proposed change.**
  1. **§19.1's last sentence is replaced** by: "Whether a reference catalog
     and a reference client carry RENDERING.md's vocabulary is recorded in
     §18 item 23 and nowhere else." The section keeps no state of its own.
  2. **§18 item 23's pointers are refreshed** at landing: the catalog file
     becomes Nucleus `flagship_p4/src/hub/ValenceCatalog.h` and the
     annotation counts are re-measured there (the 113 desc / 44 role figures
     were counted on the archived catalog). Its client half ("no reference
     client yet renders from it", `webui/src`) is re-stamped against
     Phosphor, the reference renderer named by RENDERING §13, as the client
     half (ruling); the landing measures Phosphor's coverage rather than
     this text asserting it.
- **Wire impact.** None.
- **Registry impact.** None.
- **Conformance impact.** None; the change removes a self-contradiction a
  reader could otherwise cite either way.
- **Open questions.** None.

## RFC-083 -- The archetype hint is struck; `color` and `datetime` bind by role

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-vdc). LANDED e22bd8e
  (2026-10-01). Option B. Carried
  [RFC-064](#rfc-064----index-0-filler-applies-to-op-selects-only) open
  question 2. No wire numbers.
- **Ruling (operator, 2026-10-01).** Accepted, option B: strike the
  archetype hint; row 4 `pad2d` by identity, rows 16 and 17 by role. RGB
  only: `color.red`/`green`/`blue`, no HSV role set (convert in firmware;
  open question 1). `datetime.moment`, `datetime.start` and `datetime.end`
  carry HUB TIME, seconds in the hub's own §7.1 timebase (unit `hub_s`,
  [RFC-086](#rfc-086----units-deg-us-and-a-hub-time-stamp-unit-display-autoranging-is-a-client-choice)),
  never Unix epoch: the hub needs no RTC and no NTP, and the client
  converts to wall time with the CLOCK offset it already holds. A stored
  moment is valid for the hub's current `boot_id`; a client re-arms after a
  hub reboot. No outside-network time source is assumed anywhere (open
  question 2). Items 3 and 4 below now read so.
- **Origin:** board bead rfc-vdc (Phosphor ph-vdk.3 audit), recorded first
  as RFC-064 open question 2.
- **Problem -- RENDERING derives from an input SPEC forbids.**
  1. RENDERING §8.2 row 1: "Explicit `archetype` annotation present -> that
     archetype (override)". §8 intro: an optional explicit `archetype` hint
     "exists for overrides only, and always wins". Rows 16 (`color`) and 17
     (`datetime`) trigger only on an "explicit hint", and the note under the
     table says row 4 (`pad2d`) "commonly" relies on it. §14(c) gives an
     "unrecognized archetype hint" degradation rule.
  2. SPEC §8.9 item 3: "choose the widget from **type + constraints, never
     from a hint** -- there is no widget field, deliberately". SPEC §1.2
     principle 7: "no widget hints, no layout, no ordering metadata, no
     styling, ever". SPEC §19.1: "No widget hint ... is ever wire-visible".
     `spec/schema/catalog.cddl` defines no archetype key and its
     annotation-block banner repeats "no widget hints".
  No hub can send the hint and no client can read it, so rows 16 and 17 can
  never fire and `color` and `datetime` are unreachable archetypes, frozen
  into the vocabulary (§14) with no path to them.
- **Option A -- register the hint (not chosen; kept as the record).** A new optional layout- and
  schema-field key `archetype` (uint, a `ui_archetypes` id); §8.9 item 3,
  §1.2 principle 7, §19.1 and the CDDL banner are amended to carve it out.
  Cost: reverses a principle stated in four places, and every hub author
  gains a styling knob the protocol was designed not to have; an archetype
  chosen by firmware also collides with RFC-080's user presentation choice.
- **Proposed change (as accepted, option B) -- strike row 1, trigger by role.**
  1. **Row 1 is struck**, with the §8 intro clause ("an optional explicit
     `archetype` hint exists for overrides only, and always wins") and the
     §14(c) "unrecognized archetype hint" clause. SPEC is unchanged: it was
     right.
  2. **Row 4 (`pad2d`) is defined by identity**: two `command.position`
     fields on one INTENT entry. The "commonly relies on the hint" note goes.
  3. **Row 16 (`color`)** triggers on three writable numeric fields in one
     `group` carrying the registered roles `color.red`, `color.green` and
     `color.blue`. All three are essential (law 7); fewer fall through to the
     fallback composition `slider` + `slider` + `slider` (§8.4), which is
     what they render as today. RGB only: no HSV role set is registered; a
     hub with an HSV light converts in firmware (ruling).
  4. **Row 17 (`datetime`)** triggers on a writable field carrying the
     registered role `datetime.moment`, or on two fields in one `group`
     carrying `datetime.start` and `datetime.end` (an interval). All three
     carry **hub time**: seconds in the hub's own §7.1 timebase, unit
     `hub_s` (RFC-086), never Unix epoch. The hub needs no RTC and no NTP;
     the client converts to wall time with the CLOCK offset it already
     holds. A stored moment is valid for the hub's current `boot_id`, and a
     client re-arms it after a hub reboot. (The draft had said a `u32` count
     of seconds since the Unix epoch, UTC.) A field without the
     role renders as its type says (§8.2 rows 9 to 13), never as a date.
  5. **Cardinality.** `color.*` and `datetime.*`
     repeat by construction (two lights, two schedules). They are exempt
     from SPEC §8.8's per-catalog SHOULD and MUST appear at most once per
     `group`; the §8.8 first-in-order tiebreak applies within a group.
  6. **The note under the table** becomes: "Rows 4, 16 and 17 trigger on
     registered roles, never on a hint; SPEC §8.9 item 3 holds for every
     row."
- **Wire impact.** Option B: none beyond role strings in adopting catalogs
  (etag moves, T11). Option A: one new optional field key.
- **Registry impact.** Option B: `field_roles` gains `color.red`,
  `color.green`, `color.blue`, `datetime.moment`, `datetime.start`,
  `datetime.end` (strings, nothing numeric), with a convention line making
  them per-group; `ui_archetypes` 12 to 14 notes name their triggers. Option
  A: the registry owner allocates the field key, and the catalog CDDL grows
  it.
- **Conformance impact.** Option B fixture: a `color` group with all three
  roles (assert `color`), the same group missing `color.blue` (assert three
  sliders), a `datetime.moment` field (assert `datetime`), and an unroled
  `u32` named `start_time` (assert a numeric control, law 6). RENDERING §8.2
  becomes implementable as written, which no client can claim today.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. RGB only, or also an HSV role set? An HSV light could ship
     `color.hue` / `color.saturation` / `color.value` as a second trigger
     set; this draft registers RGB only, the shape the over-provisioned
     lighting accessories (RENDERING §8.4 `color` note) would ship first.
  2. `datetime.moment` presumes the hub has wall time; SPEC §18 item 12 (H7)
     records that the reference hub does not. Is a schedule field on a hub
     without a clock legal, or must such a hub omit it?

## RFC-084 -- Future-anchored `samples` points: an arrival time under the same lead cap

- **Status:** ACCEPTED (operator, 2026-10-01; rfc-csn). LANDED 876ca7c
  (2026-10-01). (with RFC-059). Ruled together with
  [RFC-059](#rfc-059----hub-advertised-scheduling-latency). No wire numbers;
  widens one existing limit's scope.
- **Ruling (operator, 2026-10-01).** Accepted as drafted, ruled together
  with RFC-059 (open question 1): for `samples`-kind grants
  `schedule_latency_us` states the chase-planning budget. Open question 2:
  the cross-check holds, no RFC-058 or RFC-071 text moves. Nucleus
  follow-up: `commit()` treats a chase point's future anchor as its arrival
  time; ph-vdk.26's sine is the regression case.
- **Origin:** Phosphor ph-vdk.26, 2026-09-25, against Nucleus. A client that
  stamped `samples` points ahead of hub time (a duration lead, to meet the
  machine at the curve) measured +5.5 % overshoot on a 1 Hz sine at about
  30 ms send jitter, because the hub delayed the chase by the lead instead
  of arriving by it. Reference behavior: Nucleus
  `flagship_p4/src/hub/ValenceDevice.cpp` clamps every c2h sample's lead to
  `kStreamFarFutureUs` = 250 ms whatever its `stream_kind`, and
  `lib/kinetic/include/kinetic/kinetic.hpp` `commit()` plans a future
  anchor as a scheduled start ("A FUTURE anchor is a SCHEDULED PLAN"), for
  chase points as for segments.
- **Problem.**
  1. **No lead cap for `samples`.** SPEC §5.4 binds `max_future_schedule_ms`
     (250 ms) to `segments` only ("A hub MUST clamp scheduling to at most
     `max_future_schedule_ms` ... ahead of its own current time"), and the
     registry note says the same. For `samples` nothing bounds how far
     ahead a point may be stamped, so a hub's queue depth and a client's
     lead are folklore again, the exact failure RFC-014 registered the limit
     to end.
  2. **The anchor's meaning is unstated for motion input.** §5.4 says a
     `samples` timestamp is "the instant sample *i* **describes**. It is
     observational." That reads cleanly for h2c telemetry. For a c2h motion
     input it can be read two ways: the instant the machine should *be* at
     the point (an arrival time), or the instant it should *start* toward
     it (a start time, the `segments` meaning). The reference hub reads the
     second; the text says the first. The difference is a lead's worth of
     lag, measured as overshoot.
- **Proposed change.**
  1. **Arrival semantics (SPEC §5.4, `samples` bullet).** Appended: "On a
     c2h motion input, the instant a sample describes is the instant the
     commanded curve passes through it. A hub SHOULD reach the sample's
     value at that instant as closely as its ceilings allow, and MUST NOT
     treat the timestamp as the start of a move toward it; start times are
     the `segments` meaning, chosen by declaring `stream_kind` `segments`
     (§9.2)." The hub stays the referee of feasibility (§1.2 principle 6):
     arrival is a target, not a guarantee.
  2. **One lead cap for every c2h STREAM.** §5.4's clamp sentence moves out
     of the `segments` bullet and binds both kinds: a hub MUST clamp a c2h
     sample's timestamp to at most `max_future_schedule_ms` ahead of its own
     current time; further out is clamped, not rejected. "Clients SHOULD
     schedule no further ahead than half that budget" binds both kinds. This
     is what the reference hub already does.
  3. **Late samples unchanged.** A sample whose instant has passed is
     consumed at once under §7.3; this RFC adds nothing for the past.
- **Wire impact.** None. No frame, field or number changes; a client that
  stamps samples at arrival time (no lead) sees no difference.
- **Registry impact.** `limits.max_future_schedule_ms` note text: "for every
  c2h STREAM channel" in place of "for segment-class STREAM channels", with
  the arrival semantics for `samples` pointed at §5.4. No number moves.
- **Conformance impact.** Hub behavioral test: a 1 Hz sine streamed as
  `samples` with a constant 100 ms lead and injected send jitter; assert
  the position telemetry (§9.2, its observable truth) lags the stamped curve
  by no more than the hub's chase-planning budget, not by the lead, and that
  peak excursion stays within the stamped amplitude plus a stated tolerance.
  Second test: a point stamped 400 ms ahead is clamped to 250 ms, never
  rejected. Nucleus follow-up on its own board: `commit()` treats a chase
  point's future anchor as its arrival time; ph-vdk.26's sine is the
  regression case.
- **Open questions (answered 2026-10-01; see Ruling).**
  1. [RFC-059](#rfc-059----hub-advertised-scheduling-latency)'s
     `schedule_latency_us` (rfc-r4v) is where a client learns how far
     behind its stamps the hub executes. Under arrival semantics, for
     `samples` it should state the chase-planning budget the conformance
     test above bounds. Rule the two together so they agree.
  2. Cross-check at ruling: [RFC-058](#rfc-058----end-velocity-unspecified-semantics-and-the-rest-before-hold-rule)
     (end-velocity semantics) and [RFC-071](#rfc-071----motion-input-field-roles-find-the-stream-target-without-a-name)
     (motion-input roles) both touch the samples/segments split; neither
     states an anchor meaning, so no text of theirs moves.

## RFC-085 -- Three safety pairs, one control each: pause and resume, override and return, estop and release

- **Status:** ACCEPTED (operator, 2026-10-02; rfc-crn). LANDED 1ddf8af plus
  test f144928 (2026-10-02), which also landed RFC-074 clause 3. Pre-tag
  restructuring: numbers retire as gaps, nothing is renumbered. Folds in
  [RFC-074](#rfc-074----stop-semantics-for-streams-refused-while-latched-re-armed-only-by-an-explicit-command),
  whose clause 3 lands with this entry.
- **Ruling (operator, 2026-10-02).** Accepted as drafted, including the
  drafter's veto-able calls: PAUSE keeps safety-word bit 3 (bits 1 and 2
  retired); ops 7 and 8 renamed `override`/`return`, 9 and 10 retired,
  1 renamed `release`; `estop_cuts_power` as WELCOME `identity` key 6;
  `body.level` retired; a hub with a motion source MUST implement PAUSE;
  override held until `return` arrives; ESTOP drops override; `resume`
  refused `ESTOP_ACTIVE` / `INTERLOCK` / `NOT_HOMED`; release by
  press-and-hold; the per-move `bypass` key retired. The three open
  questions are answered at landing by the lander's best reading and
  recorded. **Answered at landing (1ddf8af, veto-able):** (1)
  `home_required` is modes bit 1 (freed by `bypass_limits`' retirement),
  set by an ESTOP on a hub declaring `estop_cuts_power`, cleared when a
  home completes; (2) a point move on an idle, unpaused, unowned rail is an
  ordinary source activation, and jog is override-only only while some
  source owns the rail; (3) the home verb stays allowed under PAUSE whether
  or not the hub is unhomed.
- **Origin:** operator rulings 2026-10-01 on rfc-crn, in this order: the
  fold of STOP and HOLD into PAUSE; the override refinement (override
  carries pause, jog only under override, return to the paused position,
  "jog" replaces "user"); the arbitration consequence for §11.4; the travel
  window stays writable; the merge of the two latched modes; the final
  naming and the one-control-per-pair rendering law; ESTOP cuts motor power;
  the `estop_cuts_power` declaration for machines without a motor switch;
  that declaration REQUIRED of a hardware hub.
- **Problem.**
  1. **Four levels where two do the work.** SPEC §11.1 as it reads today
     ("Four distinct levels, all latched or gated in the `safety` STATE
     channel") defines ESTOP, STOP ("Decelerate to zero at configured decel;
     source deactivated", cleared by "Any new accepted motion intent from an
     authorized source"), HOLD ("Decelerate, then actively hold position;
     source suspended", cleared by RESUME) and PAUSE ("The hub-autonomous
     generator suspends at a safe phase; position parked", cleared by
     RESUME). STOP's clear is the fuzzy one RFC-074 had to pin down: a
     stream bundle is not an intent, so what clears STOP for a streaming
     client had no spelling. HOLD has no implementer (RFC-074 open question
     3). An operator reaching for "stop the machine, keep it where it is"
     has three near-synonyms to choose from and no way to know which one a
     given hub honors (§11.1 lets a hub NACK `UNSUPPORTED_OP` for any of
     them).
  2. **Two latched modes that overlap.** §11.1 carries `manual_override` and
     `bypass_limits` in the snapshot's appended modes byte, written by four
     ops (`override_on`/`override_off`/`bypass_on`/`bypass_off`,
     [RFC-025](#rfc-025--safety-semantics-completion-incl-overridebypass-ruling)
     (c)), plus "a per-move bypass flag on a motion intent, where a hub
     offers one". Nothing says how they combine, and neither says what
     happens to a source that owns the rail while the operator takes it by
     hand.
  3. **A jog takes the rail from a stream by priority.** §11.4: "Takeover
     *between* source types remains the arbiter's existing priority logic,
     unchanged." On the reference hub a manual point move is an accepted
     motion intent that simply wins over a running stream. Hand and stream
     then both command position, in sequence, with nothing visible to say
     which one owns the rail.
  4. **Clearing is a separate button.** §11.2's `estop_clear` op and the
     RENDERING §10 `safety-strip` render latch and clear as distinct
     controls. Two quick taps on a panic control can latch and then clear.
  5. **"E-stop" promises more than some hubs deliver.** §11.2 asks for
     "Immediate driver-level stop" and H1 says the hardware path is the
     guarantee of last resort, but a client cannot tell whether a given
     hub's ESTOP removes motor power or decelerates under power. The label
     the operator sees is the same either way.
  6. **"User" names the manual move.** The registry roles `limit.user.speed`
     and `limit.user.accel` ("the USER (manual) limit set") name the jog
     speed pair after who sends it rather than what it is. "Jog" is the
     industry term.
- **Proposed change.**
  1. **Two levels (SPEC §11.1 table rewritten).**

     | Level | Meaning | Motion behavior | Clears by |
     |---|---|---|---|
     | **ESTOP** | Emergency stop, latched | Item 3: motor power cut where declared, else a maximum-deceleration halt; motion prohibited while latched | `release` (§11.2 preconditions), which lands in PAUSE |
     | **PAUSE** | The one latched non-emergency level | Decelerate to zero at configured decel, then actively hold position; every source suspended | `resume` only |

     - **PAUSE suspends every source.** c2h motion-input bundles on any
       source-mapped channel are dropped whole and counted, never NACKed
       (RFC-074 clauses 1, 2 and 4, unchanged, with PAUSE in place of
       STOP); a hub-autonomous generator parks at a safe phase; motion
       INTENTs are refused (`INTERLOCK`) except the home verb (item 3) and,
       under override, jog (item 2). Ownership is not released by a pause:
       the owning session keeps the source, suspended.
     - **Only `resume` clears PAUSE.** No motion intent, no stream bundle
       and no PUBLISH clears it (RFC-074 clause 3's re-arm is `resume`; no
       PUBLISH side effect and no new op). `resume` is refused `ESTOP_ACTIVE`
       while ESTOP is latched, `INTERLOCK` while override is latched (item
       2), and `NOT_HOMED` while the hub is unhomed (item 3).
     - **Authorization.** `pause` (op 4) becomes ROLE-EXEMPT, inheriting
       STOP's place under §11.2's "you may always stop the machine; you may
       not always start it": any session, `watch` included, may pause.
       `resume` (op 5) stays `control`. A client MUST NOT send `resume` on
       its own initiative (RFC-074's client clause, now about PAUSE): it is
       an operator act or PAUSE is decorative.
     - **A hub with a motion source MUST implement PAUSE.** It is half of
       the strip's mandatory pair (item 4); §11.1's "a hub whose application
       does not implement a level MUST NACK `UNSUPPORTED_OP`" no longer
       applies to it. It still applies to override on a hub with no rail
       control.
     - **Retired ops.** `stop` (2) and `hold` (3) are retired pre-tag; their
       numbers stay gaps and are never reused. A hub answers them
       `UNSUPPORTED_OP` until the tag, then they are simply unknown ops.
     - **Safety word.** bit0 ESTOP and bit3 PAUSE keep their positions;
       bits 1 (STOP) and 2 (HOLD) are retired, zero on send. Keeping PAUSE
       at bit3 moves no shipped byte.
     - **Event kinds.** `safety_event_kinds` 3 `stop_latched` and 4
       `stop_cleared` are renamed `pause_latched` and `pause_cleared`.
       `body.level` retires with the extra bits (one level leaves nothing to
       disambiguate); `cause` stays and still separates an operator pause
       (`user`) from `deadman` and `session_loss`.
     - **Causes.** `safety_causes` is unchanged. ESTOP's causes remain
       `user`, `fault` and `relay`. Session loss and the deadman latch PAUSE,
       never ESTOP, wherever a hub latches anything for them; RFC-045 is
       unchanged, so a command-driven source still latches nothing at all
       (§11.3) and the hub-autonomous case stays the delegate's decision.
  2. **OVERRIDE and RETURN: one rail-bound mode (SPEC §11.1 modes, §11.4).**
     The two latched modes `manual_override` and `bypass_limits` merge into
     one, **override**, written by the op pair `override` / `return`.
     - **`override` carries PAUSE.** Accepting `override` latches PAUSE as a
       side effect if it is not already latched; override never exists
       without PAUSE. PAUSE alone stops the machine in place; override
       additionally hands the rail to the operator, lifts the travel window
       and the hub's soft limits (hardware protection is untouched, H1), and
       enables jog. The hub records the **paused position**: where the
       machine came to rest under PAUSE.
     - **Jog is the operator's hand on the rail.** Under override, a jog (a
       manual point move at jog speed and jog accel) is the only motion the
       hub accepts, inside or outside the travel window as the operator
       chooses. The suspended source stays suspended, so hand and stream
       never command position at once.
     - **Arbitration (§11.4 amended).** While any source owns the rail and
       override is not latched, a jog intent is REFUSED `SOURCE_CONFLICT`.
       Override is the only way the operator takes the rail from a source;
       the "arbiter's existing priority logic" sentence no longer lets a
       manual move win over a stream.
     - **`return`** arms a smooth move back to the paused position at jog
       speed and jog accel. Jog is refused while it runs. On arrival the
       override bit clears and the machine is in plain PAUSE awaiting
       `resume`. Return takes no gate beyond `control`.
     - **The travel window stays writable at any time** (the `window.*`
       roles): while a source owns the rail, while paused, and under
       override. Only jog is gated; nothing here freezes window edits.
     - **ESTOP drops override.** An ESTOP latch clears the override bit
       (on a power-cutting hub the paused position is no longer known, item
       3); release lands in plain PAUSE.
     - **Ops.** `override_on` (7) is renamed `override` and `override_off`
       (8) is renamed `return` (registry identifier `return_op`, wire name
       `return`, as landed), both with the merged semantics, both
       `control`. `bypass_on` (9) and `bypass_off` (10) are retired as gaps.
     - **Modes byte.** bit0 is `override` (was `manual_override`); bit1
       (was `bypass_limits`) is `home_required` as landed (open question
       1).
     - **The per-move `bypass` key retires.** A jog under override is
       already outside the limits by mode, so a per-intent escape hatch has
       nothing left to do. A hub that offers one drops it.
     - **Bound to the rail, not free-standing.** The pair is an ESSENTIAL
       BINDING of the `axis` archetype (the rail widget carries it). A
       client with no rail control declines it and renders nothing
       (RENDERING §13 law 7); it is not a safety-strip control.
  3. **ESTOP and RELEASE (SPEC §11.2).**
     - **A declared stop category.** A hub DECLARES whether its ESTOP cuts
       motor power, as a new boolean `estop_cuts_power`, carried in WELCOME
       `identity` (key 37) as new `identity_keys` 6. Identity is chosen over
       the §13.1 binding matrix because this is a property of the hub, not
       of a transport, and it is known at WELCOME, before LIVE, so a
       client's first paint labels the control correctly. The declaration is
       the firmware author's responsibility and is REQUIRED of a
       hardware-profile hub (§13.1); the spec mandates the declaration,
       never the mechanism. A client MUST treat an absent key as `false`.
     - **`true`: power cut.** ESTOP opens the motor switch (the H1 path):
       the machine goes limp, with no holding torque, its position reference
       is lost, and the hub marks itself unhomed. This is an IEC 60204-1
       category 0 stop, chosen because a person is on the rail. True on the
       Nucleus Flagship (it owns a motor switch).
     - **`false`: halt.** ESTOP is a maximum-deceleration controlled stop,
       latched exactly as above, with power kept and home kept. False on
       `valencesim` and on a budget build with the motor-switch bypass
       jumper fitted.
     - **Same op, same latch, either way.** The raw `0xE5` frame (§5.5), the
       `estop` op (6), the repeat-until-latched rule and the relay
       obligation are unchanged.
     - **`release`.** `estop_clear` (1) is renamed `release`, still
       `control`. The hub still refuses `CLEAR_REFUSED` unless §11.2's
       preconditions hold (cause resolved, motion at rest; the "no other
       stop level pending escalation" clause loses its object and is
       struck). Release lands in **PAUSE**, never in motion. On a `true`
       hub, release restores power with the hub unhomed: the home verb
       (`action.home`) is the one motion accepted under PAUSE while
       unhomed, and `resume` is refused `NOT_HOMED` until a home completes.
       Sequence: estop, Halted, release, PAUSE unhomed, home, resume. On a
       `false` hub, release lands in PAUSE homed.
     - **Accessories are unchanged.** RFC-075's spoke ESTOP broadcast and
       safe state stand; RFC-078's interlock reads PAUSE where it read STOP.
  4. **Rendering (RENDERING §8.2, §8.4, §9, §10, §13).**
     - **One control per pair.** Each pair (pause/resume, override/return,
       estop/release) renders as ONE control with two states. There is no
       separate clear, release or resume button anywhere.
     - **The persistent strip's mandatory pair is e-stop plus pause.**
       §8.2 row 2 binds `pause`/`estop` op identity (was `stop`/`estop`);
       §8.4 row 11 and §10 `safety-strip` follow; law 1 reads "Keep the
       e-stop and pause controls reachable at every rank on every class".
     - **E-stop.** Pressing latches. Its latched state reads **Halted**.
       Release is the same control held: press-and-hold, RECOMMENDED 3 s,
       on every class and on a physical remote button (a RENDERING SHOULD;
       the duration is client vocabulary). This supersedes the earlier
       same-night wording that put release behind the §8.3 destructive
       primitive; the hold exists so two panic taps can never
       latch-then-release. The hub's §11.2 preconditions still decide.
     - **The label follows the declaration.** A hub declaring
       `estop_cuts_power` true renders **E-Stop**; false or absent renders
       **Halt**. A client MUST NOT render "E-Stop" on a hub that declared
       false or declared nothing: H1 made testable.
     - **Pause.** Press latches PAUSE; a second press on the same control is
       `resume`, no gate.
     - **Override.** On the rail's control row (item 2): press is
       `override`, second press is `return`, no gate.
  5. **"Jog" replaces "user".** Every role, field name, setting and document
     that calls the manual move pair "user" speed/accel is renamed. The
     inventory as of 2026-10-01:
     - **Registry** `field_roles`: `limit.user.speed` to `limit.jog.speed`,
       `limit.user.accel` to `limit.jog.accel`; their notes say "JOG
       (manual) limit set".
     - **SPEC** §8.8, the field-roles example sentence naming
       `limit.user.speed`.
     - **RENDERING**: no occurrence.
     - **Generated** (regenerated, never hand-edited):
       `lib/valence/include/valence/generated/registry_constants.hpp`
       (`limit_user_speed`, `limit_user_accel`),
       `clients/js/generated/registry_vocab.js`.
     - **Valence hand copies:** `clients/mfp/ValenceConnect.cs`
       (`RoleLimitUserSpeed`, `RoleLimitUserAccel`),
       `tools/valence_probe.py` (role list), the `tools/gen_registry_header.py`
       docstring example.
     - **Nucleus:** `flagship_p4/src/hub/ValenceCatalog.h` (`factory::
       user_speed`/`user_accel`, the 0x0081 layout fields `user_speed` /
       `user_accel` and their `enabled_mask` bit names, the 0x0101 schema
       fields keys 3 and 4, `roles::limit_user_*`); `StoredState.h`;
       `ValenceDevice.cpp` (`motionSetUserLimits` and the key 3/4 apply and
       echo paths); `ValenceHub.cpp` static asserts; `valence_config.h`
       (`DEFAULT_USER_MAX_SPEED_MM_S`, `DEFAULT_USER_ACCEL_MM_S2`);
       `motion/MotionArbiter.h` (`_user_v`, `_user_a`); native tests
       `test_motion_arbiter`, `test_stored_state`, `test_kinetic` (comment).
     - **Phosphor:** `src/model/roles.js` (`limitUserSpeed`,
       `limitUserAccel`, labels "User speed", "User accel").
     Field names are device vocabulary: renaming them moves an etag (T11)
     and no packed byte; the stored-state blob layout is unchanged.
  6. **Text this retires.** SPEC §11.1 (table, "all four levels", the
     override/bypass paragraphs), §11.2 (`estop_clear`, clause (c)), §11.3
     ("role-exempt `stop`/`estop`"), §11.4 (between-type takeover for
     jog), §12 role-exemption sentence, §18 item 3, and Appendix I (F16,
     F17) and Appendix J lines naming HOLD/STOP; registry `0x0003` and `0x0005` notes,
     `safety_intent_ops`, `safety_event_kinds`, the `safety` action tag
     note; RENDERING §8.2 row 2, §8.4 `stop`, §9 `persistent`, §10
     `safety-strip`, §10.1 rule text naming role-exempt `stop`, laws 1
     and 2.
- **Wire impact.** Pre-tag restructuring, no frame changes. Ops 2, 3, 9 and
  10 retired as gaps; 1, 7 and 8 renamed with merged semantics; `pause`
  becomes role-exempt. Safety word bits 1 and 2 and modes bit1 retired.
  Event kinds 3 and 4 renamed, `body.level` retired. One new
  `identity_keys` entry (6, `estop_cuts_power`). Two role strings renamed.
  The `0xE5` frame, `estop_seq` and the repeat rule are untouched.
- **Registry impact.** `safety_intent_ops` (renames, retirements, the
  role-exemption banner naming `estop` and `pause`); `safety_event_kinds` 3
  and 4; the `0x0003` and `0x0005` notes; `identity_keys` gains 6
  `estop_cuts_power` (bool); `field_roles` renames; `action_tags` `safety`
  note. Codegen regenerates.
- **Conformance impact.**
  - **Hub:** a `watch` session pauses; streamed bundles under PAUSE are
    dropped and counted and position holds (the RFC-074 test shape); no
    INTENT, bundle or PUBLISH clears PAUSE; `resume` does. Under a stream,
    a jog is refused `SOURCE_CONFLICT`; under override it is accepted
    outside the window; `return` arrives at the paused position at jog
    speed and leaves plain PAUSE. A window write is accepted while paused
    and while a source owns the rail. On a `true` hub, ESTOP leaves the hub
    unhomed, `release` lands in PAUSE, `resume` is refused `NOT_HOMED`
    until a home completes; `release` while moving is `CLEAR_REFUSED`. A
    hardware-profile hub that omits `estop_cuts_power` fails the probe.
  - **Client:** a fixture hub declaring `false` (and one declaring nothing)
    renders Halt, never E-Stop; each pair is one control; release requires
    the hold; a client never sends `resume` unprompted.
- **Compatibility and follow-ups.** Nucleus: retire the STOP path in favor
  of PAUSE; the MotionArbiter gains the jog refusal; the motor switch on
  ESTOP and the unhomed mark; declare `estop_cuts_power` true; the jog
  rename; bench stamp: jog under stream refused, jog under override
  accepted, return on `return`. `valencesim`: declare false. Phosphor:
  relabel the strip, one control per pair, the rail carries
  override/return, and its TCode and buttplug adapters send `resume`
  explicitly, never implicitly.
- **Open questions (answered at landing, 1ddf8af; see Ruling).**
  1. **Surfacing "home required".** `resume` is refused `NOT_HOMED` after a
     power-cutting ESTOP, and a client must say why. Proposed: the freed
     modes bit1 becomes `home_required` (set by ESTOP on a `true` hub,
     cleared by a completed home), so the safety snapshot alone explains
     the refusal. Alternative: leave it to a device-catalog role.
  2. **A point move with no owner, no pause and no override.** The rulings
     say both "jog only under override" and "refused while a source owns
     the rail". This draft reads the second as the binding rule: a manual
     point move on an idle, unpaused rail is an ordinary source activation
     under §11.4. Confirm, or make jog override-only outright.
  3. **The home verb under PAUSE.** This draft admits `action.home` under
     PAUSE whether or not the hub is unhomed (homing is an operator act
     with its own tier). Narrow it to "only while unhomed"?

## RFC-086 -- Units: `deg`, `us` and a hub-time stamp unit; display autoranging is a client choice

- **Status:** ACCEPTED (operator, 2026-10-01). Pre-approved on its bead
  (rfc-263) as described and drafted directly as accepted; registry
  allocation of the three unit ids rides the same landing pass. LANDED
  20b2da5 (2026-10-01).
- **Origin:** operator ruling 2026-10-01 while running the RFC queue, with
  [RFC-083](#rfc-083----the-archetype-hint-is-struck-color-and-datetime-bind-by-role)
  (its `datetime.*` roles carry hub time and need a unit that says so).
- **Problem.**
  1. **No angle unit.** Registry `unit_ids` (RENDERING §6) has no angle. A
     rotary or tilting accessory (RFC-076's motorized stand) has nothing to
     declare.
  2. **No microsecond unit.** Hub time is microseconds everywhere in SPEC §7
     (§7.1, §7.2 `t_base`), and the table registers only `ms` (7) and `s`
     (8). A field carrying a raw hub-time interval must be rescaled or lie
     about its unit.
  3. **A hub-time stamp is not a duration.** RFC-083 ruled that
     `datetime.moment`/`start`/`end` carry seconds in the hub's own §7.1
     timebase, never Unix epoch. Declared as `s`, a client cannot tell a
     duration from a stamp it must shift by its CLOCK offset to show wall
     time.
  4. **Nothing says whether a client may rescale for display.** A `V` field
     reading 0.085 is clearer as 85 mV. Without a rule, one client
     autoranges and another invents a prefix vocabulary on the wire.
  The table is marked "frozen at v1.0" (RENDERING §6, "deliberately
  over-provisioned so that a foreseeable future actuator never needs a v1.1
  vocabulary addition"), but no tag exists, so additions are legal now and
  this is the moment.
- **Proposed change.**
  1. **`unit_ids` gains three entries** (as landed: `deg` 23, `us` 24,
     `hub_s` 25):
     - `deg`: angle in degrees. Radians are a math convenience, not a knob
       unit.
     - `us`: time in microseconds, the §7 hub-time resolution.
     - `hub_s`: seconds in the hub's own §7.1 timebase, distinct from `s`
       so a client knows to apply its CLOCK offset before showing wall time.
       The unit of RFC-083's `datetime.*` roles.
  2. **Display autoranging (RENDERING §6, one sentence).** A client MAY
     autorange SI prefixes for DISPLAY (85 mV for a `V` field reading
     0.085) and MUST NOT alter the wire unit or scale. Magnitude lives in
     the field's `scale` (§5.4), never in a prefix, so no prefix or range
     vocabulary exists on the wire.
  3. **Temperature stays `deg_c` only.** Kelvin and Fahrenheit are display
     conversions, not units a field declares.
- **Wire impact.** Additive: three unit ids. No number in use moves.
- **Registry impact.** `unit_ids` gains `deg`, `us`, `hub_s`; RENDERING §6's
  table follows. Codegen regenerates the unit constants.
- **Conformance impact.** The unknown-unit rule (RENDERING §6) already
  covers an older client meeting the new ids. Client fixture: a `hub_s`
  field renders as wall time through the CLOCK offset; a `V` field at 0.085
  may display 85 mV and its write path still sends volts.
- **Open questions.** None.

## RFC-087 -- Segments-kind bundles span the schedule horizon; the horizon is advertised per grant

- **Status:** ACCEPTED (operator, 2026-10-02; rfc-66i). LANDED 1dbdc3e
  (2026-10-02).
- **Ruling (operator, 2026-10-02).** Accepted as drafted, including open
  question 1's proposal: c2h `segments`-kind `t_off` counts in 100 µs units
  (limit `segment_t_off_unit_us`); per-transport bundle counts as stated
  (32 WebSocket/serial, 29 ESP-NOW, 28 BLE); the supersede-from-`t_base`
  flush. Open question 2: as drafted, the hub picks the horizon (it MAY
  expose a setting) and no client wish key is registered.
- **Origin:** operator direction 2026-10-01 while running the RFC queue. A
  lookahead client (a funscript player, anything that can see its future)
  sends ten bundles per 200 ms today, because SPEC §5.4 caps every bundle's
  span at `bundle_max_span_ms` (20 ms) whatever its `stream_kind`. For a
  `segments` stream, whose stamps are execution starts (§5.4,
  [RFC-014](#rfc-014--timed-segment-scheduling-contract)), the 20 ms cap
  buys nothing: the hub already holds the scheduled plan, and the frames are
  pure overhead on the link most likely to be poor.
- **Problem.**
  1. **One span cap for two meanings.** §5.4 rule 3: "span `t_off[n-1] ≤
     bundle_max_span_ms` (20 ms)", "the caps exist to bound latency,
     buffers, and fragmentation". For `samples` (chased on arrival,
     [RFC-084](#rfc-084----future-anchored-samples-points-an-arrival-time-under-the-same-lead-cap))
     a wider span only adds lag. For `segments` the latency is the client's
     chosen lead, not the span, and the bound that matters is how far ahead
     a start may be stamped.
  2. **The horizon is a fixed number.** `max_future_schedule_ms` (250,
     registry `limits`) is the clamp for every c2h STREAM (RFC-084). A
     player on poor WiFi wants more future in flight; nothing lets a hub
     offer it.
  3. **The bundle header cannot express the span.** `t_off` is "u16 µs
     offset of sample[i] from t_base" (§5.4 layout), so no bundle can span
     more than 65.535 ms. A 250 ms window of segments does not fit the
     header as written, at any `n`.
  4. **A long horizon makes a seek visible.** At 1000 ms, a player that
     seeks or skips has up to a second of already-scheduled segments still
     to play out unless something flushes them.
- **Proposed change.**
  1. **Span cap by kind (§5.4 rule 3).** `bundle_max_span_ms` (20) stays
     for `samples`-kind and for every h2c STREAM. For a c2h STREAM whose
     `stream_kind` is `segments`, the span cap is the grant's schedule
     horizon (item 2): `t_base + t_off[n-1]` MUST NOT lie further ahead of
     hub time than the horizon. `n` stays bounded by `bundle_max_samples`
     (32) and by rule 5 (the binding's `max_frame`): with the reference
     6-byte segment (0x2101) a full bundle is 6 + 2x32 + 6x32 = 262 bytes,
     inside WebSocket and serial (504), while ESP-NOW (242) carries 29 and
     BLE (236) 28. At 32 per bundle that is 128 segments/s at 250 ms, 64/s
     at 500 and 32/s at 1000, all above dense funscript rates.
  2. **The horizon is advertised per grant.** A new CBOR key
     `schedule_horizon_ms` (key 50 as landed) on `granted_publishes` entry maps, beside
     [RFC-059](#rfc-059----hub-advertised-scheduling-latency)'s
     `schedule_latency_us`, present on `segments`-kind grants. Its value is
     one of 250 (the default, today's `max_future_schedule_ms`), 500 or
     1000; the registry pins the steps and a CEILING of 1000
     (`schedule_horizon_max_ms`). The two larger steps exist for lookahead
     players on poor WiFi. A grant without the key means 250. Like
     `schedule_latency_us` it is a commitment for the life of the grant; a
     change is an unsolicited GRANT (§10.2). Clients SHOULD fill bundles
     toward the advertised horizon; RFC-014's "schedule no further ahead
     than half that budget" stays a SHOULD against the granted value.
  3. **The horizon is a cap, never a delay.** It bounds how far ahead a
     segment's START may be stamped. The hub adds no wait and never waits
     for a bundle to fill; each segment executes at its stamped time
     (§5.4). A low-latency `segments` client stamps 50 ms ahead and sends
     small bundles under the same 250 ms horizon; its felt latency is its
     own lead plus `schedule_latency_us`, so no 100 ms step is needed.
     `samples`-kind keeps the 20 ms span and RFC-084's 250 ms lead cap:
     chased on arrival, a wider span only adds lag.
  4. **`t_off` resolution for `segments` bundles (§5.4 layout).** On a c2h
     `segments`-kind STREAM, `t_off` counts in units of
     `segment_t_off_unit_us` (new limit, 100), so a u16 spans 6.5535 s,
     covering the 1000 ms ceiling with margin, at 0.1 ms resolution.
     `samples`-kind and h2c bundles keep 1 µs units. The decoder already
     branches on `stream_kind` for the timestamp's meaning; the unit rides
     the same branch. Bytes and rules 1, 2, 4 and 5 are unchanged.
  5. **Flush is a supersede rule, not pause.** A newly accepted bundle on a
     `segments` channel replaces every scheduled, not-yet-started segment
     from the same source whose start is at or after the new bundle's first
     start (`t_base`). A segment already executing is handed off at the new
     first start exactly as any successor's start hands it off today (§9.6).
     A player that seeks sends fresh segments stamped from now plus its
     lead, and everything stale is gone; a client that resends an
     overlapping window replaces the overlap, so a resend is idempotent.
     PAUSE then RESUME
     ([RFC-085](#rfc-085----three-safety-pairs-one-control-each-pause-and-resume-override-and-return-estop-and-release))
     is not the flush: it is an operator-level safety latch every
     connected client shows, and a seek is not a safety act.
  6. **Semantics restated.** A gap with no bundle settles the machine (no
     bundle, no motion; RFC-058 item 4, §6.6). A segment longer than the
     horizon is legal: the horizon bounds start time, never duration.
  7. **Segments without lookahead.** A client that cannot see its future
     gets [RFC-058](#rfc-058----end-velocity-unspecified-semantics-and-the-rest-before-hold-rule)'s
     rest-without-successor at the end of each bundle, which is correct and
     visibly stop-start. Such an application belongs on `samples`, and
     §9.2's `segments` bullet gains a sentence saying so.
- **Wire impact.** One `granted_publishes` key. `t_off` units change for
  c2h `segments` bundles only (pre-tag; the reference hub must follow in
  the same release, see compatibility). Span rule 3 is kind-dependent. No
  frame type changes.
- **Registry impact.** `cbor_keys` gains `schedule_horizon_ms` (key 50 as
  landed); `limits` gains `schedule_horizon_max_ms` (1000), the
  pinned steps (250, 500, 1000) and `segment_t_off_unit_us` (100);
  `max_future_schedule_ms` note: the default horizon for `segments` and the
  lead cap for `samples`; `bundle_max_span_ms` note: `samples` and h2c
  only. RFC-049 (c)'s unlanded scheduling-depth backstop is unaffected.
- **Conformance impact.** Hub: a `segments` bundle spanning 240 ms under a
  250 ms grant is accepted; one stamped 300 ms ahead is clamped (never
  rejected); a grant advertising 1000 accepts a 900 ms span; a seek bundle
  supersedes the stale tail and the next segment starts at the new stamp;
  a `samples` bundle over 20 ms is still malformed. Client: a lookahead
  client sends one bundle per horizon window and fills toward the
  advertised value.
- **Compatibility.** Pre-tag. Nucleus: kinetic's plan queue (eight
  scheduled plans today) is sized against 32 segments in flight at the
  chosen horizon, the supersede rule, the `t_off` unit on 0x2101, and the
  grant key; the bench bead measures the oscillation buffer first. clients/js
  and the MFP plugin: fill to the horizon, decode the grant key.
- **Open questions (answered 2026-10-02; see Ruling).**
  1. **The `t_off` unit (item 4).** The rulings did not address the u16
     limit; 100 µs units are this draft's answer. Alternatives: 1 ms units
     (simpler, funscript-native), or keep µs and widen `t_off` to u32 for
     `segments` (a different byte layout per kind).
  2. **Who picks the horizon.** This draft lets the hub choose (a hub MAY
     expose it as a setting). Should a client be able to wish for one on
     its `publishes` entry, echoed post-clamp like `burst` (RFC-013), or
     does that re-litigate a hub property the way RFC-059 declined to?

## RFC-088 -- Flip: a rail-bound direction flip, home swaps ends

- **Status:** ACCEPTED (operator, 2026-10-02; rfc-tnm). LANDED a7415b0
  (2026-10-02).
- **Ruling (operator, 2026-10-02).** Accepted as drafted: label **Flip**,
  role `axis.flipped` (open question 1). Open question 2 (category) was
  not ruled separately; as drafted the spec binds the role, never the
  channel, so where the field lives (the reference `machine-modes`, or a
  setup-category entry) is the hub author's choice.
- **Origin:** operator direction 2026-10-01 while running the RFC queue.
  The machine calls one end of its rail home. The Flagship can be mounted
  either way round, and a user who mounts it reversed wants one control
  that makes the other end home rather than a reversed sense on every
  slider, stream and preset.
- **Problem.**
  1. **Direction is baked in.** Position 0 is the homing end on every
     reference surface. A reversed mount makes every client's slider,
     every stream and every saved preset run backwards, and nothing in the
     catalog can say so.
  2. **A client-side flip is the wrong home.** A client that mirrors values
     itself fixes only its own surfaces; another client, a TCode adapter
     (RFC-061) or an RFC-078 relationship still sees the raw sense. The
     §9.6 write-once argument applies: the hub must own it.
  3. **There is no role to find it by.** The reference `machine-modes`
     STATE (Nucleus 0x1030, written through `modes_set` 0x3030) holds the
     machine's modes, but a generic client binds by role only (RENDERING
     §13 law 6), and no role names a direction.
- **Proposed change.**
  1. **A stored mode with a role.** A writable layout field (bool, or a
     two-option select) carrying a new registered role `axis.flipped`. It
     is a setting (§8.8 `setting_key`), persisted across reboot because it
     describes how the machine is mounted. The reference places it on
     `machine-modes` (0x1030, appended at the tail per §5.4, written through
     0x3030); the spec binds the role, never the channel.
  2. **Effect: home swaps ends.** With the flip on, position 0 is the far
     end. The hub mirrors, against the homed travel
     (`geometry.measured_travel`): position telemetry (`telemetry.position`
     reads travel minus position), the travel window (`window.min`/`max`
     report the same physical window in the flipped frame), and every c2h
     stream and intent target. No client needs to know the state to
     behave; presets keep their meaning because they are stored in the
     frame they were authored in, and the hub mirrors on the way in.
  3. **Gate (hub MUST).** A write that changes the flip is refused:
     `SOURCE_CONFLICT` while any source owns the rail (the flip is a
     between-streams act); `NOT_HOMED` while the hub is unhomed (the mirror
     needs a measured travel); `INTERLOCK` while
     [RFC-085](#rfc-085----three-safety-pairs-one-control-each-pause-and-resume-override-and-return-estop-and-release)
     override is latched or the machine is moving. It never acts
     mid-motion. A write that leaves the value unchanged is an ordinary
     no-op ECHO (§4.2 `cfg_gen` unchanged).
  4. **Rendering (RENDERING §8.4 `axis`).** One toggle control with two
     states on the rail's control row, beside home and RFC-085's
     override/return; an essential binding of the `axis` archetype where
     the role is present (absent role, no control). Confirm-gated on every
     class with the §8.3 destructive primitive: reversing a rail under a
     person is a real act. Label **Flip** (operator ruling 2026-10-01).
- **Wire impact.** One field role. The reference catalog appends one byte
  to 0x1030 (tail-only, §5.4) and its etag moves (T11).
- **Registry impact.** `field_roles` gains `axis.flipped`. No number.
- **Conformance impact.** Hub: a homed rail flips, and telemetry reads
  travel minus position; a flip write under an owning stream is refused
  `SOURCE_CONFLICT`, unhomed `NOT_HOMED`, under override `INTERLOCK`; a
  stream sent after the flip lands mirrored; the flip survives a reboot.
  Client: the toggle renders on the rail row only where the role exists
  and asks for confirmation.
- **Compatibility.** Nucleus follow-up on its own board: the field on
  0x1030, the mirroring in the kinetic and telemetry paths, the bench stamp
  above. Phosphor: the toggle on the rail row.
- **Open questions (answered 2026-10-02; see Ruling).**
  1. **Role name.** The draft on the bead proposed `axis.inverted`; this
     text uses `axis.flipped` to match the ruled label. Either is fine on
     the wire.
  2. **Category.** Under RFC-079's commissioning scope (the setup category
     holds the machine's geometry), mounting direction is setup data, but
     `machine-modes` is category `tuning` and categories are entry-level.
     Move the field to a setup-category entry, or leave it with the modes?

## RFC-089 -- Store writer field roles: find slot, name and item by identity

- **Status:** DRAFT (2026-10-02; rfc-hen). Ruling pending.
- **Origin:** Phosphor ph-e82.13.6, 2026-10-02. Building the relationships
  store writer (`relationships-write` 0x0015,
  [RFC-078](#rfc-078----accessory-conformance-profile-and-the-hub-relationship-engine)),
  the node-graph agent found that nothing names the writer's parameter
  fields. It finds them by type today (the one unroled uint, the one text
  field, the one byte-string field), which is a guess RENDERING §13 law 6
  forbids.
- **Problem.**
  1. **The verb is named, its arguments are not.** SPEC §8.7 (as landed by
     [RFC-067](#rfc-067----store-verbs-one-registered-op-select-not-split-preset-tags))
     tags the op select `action.store` and numbers its ops; RFC-067 problem
     1 itself says "both registered verbs carry parameters (`slot`,
     `name`)". No role says which schema fields beside the op select carry
     them. A writer that grows a second uint (a flags word, a source index)
     breaks every type-guessing client silently.
  2. **The import carrier is unnamed.** §8.7 says a `save` import carries a
     full item as the store-item document
     ([RFC-073](#rfc-073----store-item-encoding-a-registered-cbor-map-a-kind-namespace-and-an-optional-per-item-digest)),
     but not which field holds it.
  3. **No per-verb argument set.** `load` without a slot, or `rename`
     without a name, has no stated answer, so two hubs refuse differently
     or not at all, against §4.5's every-refusal-answered rule.
- **Proposed change.**
  1. **Three registered field roles** (registry `field_roles`), each on a
     schema field of the INTENT entry that carries the `action.store` op
     select:
     - `store.slot`: an unsigned integer, the item's slot in the store.
     - `store.name`: a text field, the item's name, fitting the store's
       `name_max` (§8.7).
     - `store.item`: a byte string carrying one whole §8.7 store-item
       document (the RFC-073 `store-item` CBOR map: `slot`, `name`, `kind`,
       `payload`, optional `digest`), never the bare `payload`. The
       document is the same bytes a BLOB_CHUNK stream for `ns = 1`
       reassembles into, so an export from one hub is an import to
       another unchanged. Carried as a byte string, it adds no CBOR depth
       to the INTENT (§5.3's cap of 4 is untouched), and §8.7's opacity
       holds: the hub reads the document's keys and checks `kind`, size and
       `digest`, and never decodes `payload`.
  2. **Binding scope (§8.8 role cardinality).** The three roles bind within
     the entry that carries the `action.store` op select, and that entry's
     `store_id` ([RFC-070](#rfc-070----store-to-roster-linkage)) says which
     store they address. Like the `mod.*` roles under `mod_target`
     (RFC-066), they repeat once per writer entry and are told apart by
     that key, so the at-most-one-per-catalog SHOULD and the
     first-in-order tiebreak do not apply to them. A client never resolves
     them catalog-wide.
  3. **Per-verb argument set (hub MUST).** A missing required field is
     refused `INVALID_VALUE`; a field the verb does not use is ignored and
     not echoed.

     | Op | `store.slot` | `store.name` | `store.item` |
     |---|---|---|---|
     | `save` (1) | optional: absent, the hub picks a free slot | required | optional: absent, the hub captures current live state (§8.7) |
     | `load` (2) | required | | |
     | `delete` (3) | required | | |
     | `rename` (4) | required | required | |

     ECHO is key-complete over what was applied (§9.3), so a `save`
     without `store.slot` is echoed with the slot the hub chose; that is
     how the client learns it. A store with no live state to capture (the
     relationships store, 0x0013) refuses a `save` without `store.item`
     with `INVALID_VALUE`.
  4. **One address, never two.** When `store.item` is present, its
     document's `slot` and `name` MUST equal `store.slot` and
     `store.name`; a mismatch is refused `INVALID_VALUE`, never resolved by
     the hub picking one.
  5. **Rendering.** A client binds a store writer's controls by these
     roles alone: the slot comes from the linked roster (RENDERING §8.2
     row 5), the name from a text input, and `store.item` is filled by the
     client's import path, never typed by a person. A writer with
     `action.store` and none of the three roles renders the ops as plain
     actions, never guessed into arguments by type.
- **Wire impact.** No bytes move. Reference catalogs gain three role
  strings on existing schema fields, so their etags move (T11).
- **Registry impact.** `field_roles` gains `store.slot`, `store.name`,
  `store.item`, each noting the per-entry binding scope. The 0x0015 note
  (`relationships-write`) gains "slot, name and item fields carry the
  `store.*` roles".
- **Conformance impact.** Hub: `load`, `delete` or `rename` without
  `store.slot`, and `save` or `rename` without `store.name`, NACK
  `INVALID_VALUE`; a `save` without a slot is echoed with the chosen slot;
  an item whose document slot disagrees with `store.slot` NACKs
  `INVALID_VALUE`. Client fixture: a writer entry with a second, unroled
  uint field beside `store.slot` binds the roled field, never the other.
- **Compatibility.** Pre-tag, additive. Reference-hub follow-ups (Nucleus
  board): `pattern-presets-cmd` and the relationships writer (0x0015) tag
  their slot, name and item fields and enforce the per-verb set. Phosphor
  (ph-e82.13.6): bind by role and drop the type guess.
- **Open questions.**
  1. **Item size against the frame.** An INTENT is one frame, and a store
     item may reach `per_item_max` (default 4096, §8.7), far past the
     242 B `min_transport_payload`. As drafted, an import that does not fit
     the binding's `max_frame` cannot be sent over that binding
     (`FRAME_TOO_LARGE`). Is that acceptable for v1 (relationships and
     small presets fit), or does it need a c2h blob path (BLOB_CHUNK is
     h2c only today, §8.4)? This draft does not invent one.
  2. **A full store on `save`.** The draft lets the hub pick the slot when
     `store.slot` is absent and refuse when no slot is free. Should a full
     store have its own NACK code rather than `INVALID_VALUE`?
  3. **`store.item` on `save` (operator check).** The bead listed `save`
     as slot optional + name + item. This draft keeps `store.item`
     optional because §8.7 makes capture-live-state the default `save`,
     and requires it only where a store has no live state to capture.
     Confirm, or make it required everywhere (which retires
     capture-by-default).

## RFC-090 -- SPEC 5.4 rule 3 repair: the segments span cap is relative to `t_base`

- **Status:** DRAFT (2026-10-02; rfc-0wp). Ruling pending. Editorial and
  separable: it changes no behavior the operator ruled, and is proposed
  as landable without a separate ruling on the precedent of
  [RFC-063](#rfc-063----a-wire-carrier-for-the-destructive-flag) item 6
  (a spec-contradiction repair, bead rfc-dmf, carried as its own item with
  no wire, registry or conformance change).
- **Origin:** Valence val-091.54, 2026-10-02. The library's `handleStream`
  dropped a `segments` bundle whose last start lay beyond the granted
  horizon, following SPEC §5.4 rule 3 as landed by
  [RFC-087](#rfc-087----segments-kind-bundles-span-the-schedule-horizon-the-horizon-is-advertised-per-grant)
  (1dbdc3e). Commit 9dd395d moved it to the clamp; this entry brings the
  rule's wording into line.
- **Problem.** SPEC §5.4 contradicts itself for c2h `segments` bundles:
  1. **Rule 3** reads "`t_base + t_off[n-1]` MUST NOT lie further ahead of
     hub time than the horizon", and the paragraph after the rules makes
     any violation **malformed**, rejected **whole**.
  2. **The lead-cap paragraph** two blocks down
     ([RFC-084](#rfc-084----future-anchored-samples-points-an-arrival-time-under-the-same-lead-cap),
     extended by RFC-087) says a sample stamped further out than the cap
     "is clamped, not rejected", for both kinds.
  3. **RFC-087's own conformance impact** says "one stamped 300 ms ahead is
     clamped (never rejected)".

  Rule 3 mixes two bounds: how wide a bundle is (a shape property,
  decidable from the bundle alone, so a malformation) and how far ahead of
  now it lies (a lead, which depends on arrival time and is the lead cap's
  business). A bundle stamped 300 ms ahead with a 50 ms span is well
  formed; only its lead is too long.
- **Proposed change.** Rule 3 of §5.4's bundle rules becomes:

  > 3. span: for a `samples`-kind or h2c bundle, `t_off[n-1] ≤
  >    bundle_max_span_ms` (20 ms); for a c2h `segments`-kind bundle,
  >    `t_off[n-1] × segment_t_off_unit_us` MUST NOT exceed the grant's
  >    schedule horizon (RFC-087). The span is measured from `t_base`; how
  >    far the bundle lies ahead of hub time is not a span violation, and a
  >    bundle whose stamps lie beyond now plus the cap is clamped per the
  >    lead-cap paragraph below, never rejected;

  Nothing else in §5.4 changes; the lead-cap and schedule-horizon
  paragraphs already say the rest.
- **Wire impact.** None. The library already behaves this way (9dd395d):
  the span cap is `t_off[n-1] × 100 µs ≤ horizon`, malformed if over, and
  the lead beyond hub time is clamped.
- **Registry impact.** None.
- **Conformance impact.** None new: RFC-087's stated cases (a 240 ms span
  under a 250 ms grant accepted, a bundle stamped 300 ms ahead clamped) now
  agree with the rule text. Stated for clarity: a c2h `segments` bundle
  whose span exceeds the horizon is still malformed and rejected whole.
- **Compatibility.** Nucleus pins 9dd395d, which carries the clamp; no
  firmware follow-up.
- **Open questions.**
  1. **How the clamp lands (separate from this repair).** The lead-cap
     paragraph clamps "a c2h sample's timestamp"; 9dd395d clamps a bundle
     by moving its `t_base` earlier until the last stamp sits on the cap,
     keeping every spacing so each segment keeps its duration. Pinning
     each late stamp at the cap instead would collapse a `segments` tail
     onto one instant and break rule 2's strict increase. Should the
     lead-cap paragraph say the bundle moves earlier as a whole? That is a
     normative clarification needing its own ruling; this entry does not
     include it.

## RFC-093 -- Classic and Advanced generators are two rail sources, not one generator with a mode

- **Status:** LANDED 4ca8592 (2026-10-02). ACCEPTED (operator, 2026-10-02;
  rfc-cs9). Pre-approved: landed directly as accepted, like
  [RFC-086](#rfc-086----units-deg-us-and-a-hub-time-stamp-unit-display-autoranging-is-a-client-choice).
- **Origin:** operator ruling 2026-10-02 (bead rfc-cs9), while the
  Phosphor factory plugin (ph-e82.18) and the Nucleus arbiter were being
  reconciled with
  [RFC-081](#rfc-081----advanced-generator-master-roles).
- **Problem.**
  1. **The advanced program is a mode of the classic generator.** RFC-081
     item 1 registered `advgen.mode`, a bool "present only where the
     advanced program is a mode of a generator that also plays the
     `pattern.select` set", and bound the advanced pattern's run/stop to
     the shared `pattern.running`. One run/stop and a mode switch make
     "which program is the machine playing" a property of a hidden toggle
     rather than of which control the operator pressed.
  2. **SPEC §11.4 never names generators as sources.** Arbitration is
     specified for sessions and streams; nothing says two on-hub
     generators compete for the rail under the same rules.
- **Proposed change.**
  1. **Two sources.** The Classic pattern generator and the Advanced
     generator are two separate generator sources in the §11.4 sense. They
     never run at the same time: starting one while the other owns the rail
     is refused `SOURCE_CONFLICT` until the owner is stopped. There is no
     automatic handoff. §11.4 gains one bullet naming hub-autonomous
     generators as sources that arbitrate like any other.
  2. **`advgen.mode` is retired** (pre-tag; the string is burned, never
     reissued). The "Advanced program" switch is removed.
  3. **`advgen.running` is registered** (bool): the advanced generator's own
     run/stop, an essential binding of `generator-advanced` in place of the
     shared `pattern.running`. `pattern.running` stays the classic
     generator's.
  4. **Rendering (RENDERING §10 `generator-advanced`).** Run/stop binds
     `advgen.running`. A client renders Classic and Advanced as two panels
     or tabs, each with its own start/stop, never a mode switch, and shows
     the hub's `SOURCE_CONFLICT` refusal when the other owns the rail.
     RENDERING §2.2's advanced-generator row and the registry
     `widget_patterns` 10 note follow.
- **Wire impact.** Two role strings (one retired, one registered); an
  adopting hub's etag moves. No number.
- **Registry impact.** `field_roles`: `advgen.mode` retired,
  `advgen.running` registered; `pattern.running` and `widget_patterns` 10
  notes. Codegen regenerates (`field_roles::advgen_mode` disappears,
  `advgen_running` appears).
- **Conformance impact.** Hub: starting Advanced while Classic owns the
  rail is refused `SOURCE_CONFLICT` and vice versa; stopping the owner
  lets the other start. Client: two start/stop controls, no mode switch;
  `generator-advanced` declines when `advgen.running` is absent.
- **Compatibility.** Nucleus: two sources in the MotionArbiter, the
  advanced entry carries `advgen.running` and drops `advgen.mode`
  (`ValenceCatalog.h`; val board). Phosphor: the factory plugin's tabs
  (ph-e82.18) and `roles.js` (`advgenMode` retires).
- **Open questions.** None.

## RFC-094 -- Navigation tiers: Machine, Link and Client; `control` becomes `generator`; `tuning` and `library` fold into `motion` and `system`

- **Status:** LANDED 0c33da4 (2026-10-02). ACCEPTED (operator, 2026-10-02; rfc-ct1). The open questions
  resolve to the draft's answers: (1) ids 5 and 9 are retired pre-tag and
  never reissued; (2) the tier-2 identifier is `link`; (3) all of `session`
  (12) is tier 2; (4) the generated vocabulary exposes tier membership both
  as a per-category attribute and as an iterable table. Landing follows the
  amendment ritual.
- **Origin:** operator review of the Phosphor sidebar, 2026-10-02: "control
  doesn't fit what it holds, which is generators, patterns etc"; "motion
  library and system seem to be all things that could live in system under
  sections, tuning seems to fit in motion better, system feels diag and
  config"; "3 categories on the left: Machine, all on the machine things;
  Valence, things on or between the machine and phosphor/clients; then
  Phosphor, which are all local settings." Raised as a Valence RFC because
  RENDERING §3 makes the category tree, in registry order, the navigation
  skeleton every renderer shares; a client-local regroup would fork it.
- **Problem.**
  1. **`control` (1) is misnamed for what it holds.** Its note reads
     "driving the machine now: move, pattern run/speed/depth, streams"; on
     the reference hub it holds the classic and advanced generators and
     the stream surface. "Control" also names an access tier (§12) and the
     strip's "in control" state, so one word carries three meanings.
  2. **`tuning` (9) and `motion` (2) are one subject at two depths**, and
     `library` (5) is stored state of the system. As separate top-level
     categories they make a flat sidebar of one page per id for a single
     machine; the reference hub emits seven of the fifteen.
  3. **The tree has no tier above categories.** Things on the machine,
     things on or between the machine and its clients (pairing and trust,
     the session view, the log channel), and renderer-local settings are
     three kinds of place. The reference client already draws Machine,
     Console and Phosphor groups by a rule of its own (`App.svelte`),
     which no other renderer shares; §3 exists to prevent exactly that.
- **Proposed change.**
  1. **Rename `ui_categories` 1 `control` to `generator`.** Same id, same
     contents (generators, streams, move). Codegen identifier changes;
     the wire does not.
  2. **Fold `tuning` (9) into `motion` (2) and `library` (5) into
     `system` (13).** Entries move; the former category name becomes the
     entry's `subgroup` (RENDERING §3 already allows one). Ids 5 and 9 are
     retired pre-tag and never reissued. `system` is read as diagnostics
     and configuration: power, thermals, memory, firmware, logs, stored
     content.
  3. **Register `ui_nav_tiers`**, three values, and give every
     `ui_categories` row a `tier`:
     - 1 `machine`: generator, motion, safety, limits, playback,
       auxiliary, automation, hardware, system, setup, other, and every
       vendor id.
     - 2 `link`: `session` (12) and `network` (11), plus the
       renderer-provided views of the protocol itself (pairing, the
       session view, the 0x0008 log). The reference client labels this
       tier "Valence".
     - 3 `client`: renderer-local settings (display, plugins, saved hubs,
       the embedded server). No catalog entry ever lands here; the
       registry reserves the tier so every renderer draws the same three
       and in the same order.
  4. **RENDERING §3** gains the tier rule: tiers in registry order, then
     categories in registry order within a tier, subgroups within a
     category; labels stay the renderer's and localizable. The "frozen at
     the v1.0 tag" sentence is unchanged in force: the tag has not
     happened, and this is the last change to the set before it.
- **Pros.** One skeleton all renderers share, now including the tiers the
  reference client was already drawing by itself. Honest names. A shorter
  sidebar for a one-machine hub. Subgroups keep Tuning and Library
  findable without a top-level page each.
- **Cons.** Pre-tag churn of two ids and one name. Every hub emitting 5
  or 9 changes its catalog (etag moves). The tier-2 views that are not
  catalog entries (pairing, session view, log) are named by membership
  only; the spec cannot place what it does not emit.
- **Cost.** Spec: RENDERING §3 table and one rule, registry two retirements,
  one rename, one new table, codegen. Nucleus: `ValenceCatalog.h` has
  eight category sites to move (six tuning, two library) and the sim etag
  moves, so Phosphor re-records its fixture. Phosphor: the sidebar reads
  tiers from the generated vocabulary instead of its own rule (already
  planned work). MFP plugin: untouched (no categories).
- **Wire impact.** Category ids on the moved entries; etag. Nothing else.
- **Registry impact.** `ui_categories`: 1 renamed, 5 and 9 retired,
  `tier` per row; `ui_nav_tiers` added; generated headers follow.
- **Conformance impact.** Client: draws the three tiers in order; the
  graceful-extension rule is unchanged (an untaught id still lands under
  `other`, tier 1). Hub: emits 2 and 13 with `subgroup` where it emitted
  9 and 5.
- **Open questions.**
  1. Retire 5 and 9 (this draft) or keep them with a registered parent so
     renderers nest them and no hub catalog changes? Retiring is cleaner
     pre-tag; keeping is cheaper now.
  2. The tier-2 identifier: `link` (this draft) or the protocol's own
     name. Registry identifiers have so far avoided naming the protocol.
  3. Does all of `session` (12) belong in tier 2, or only pairing and
     trust, with ownership and roles staying on the machine side?
  4. Whether the generated-vocabulary header exposes tier membership as a
     table clients iterate, or only as a per-category attribute.

## RFC-095 -- Advanced generator dwell: `advgen.dwell_crest` and `advgen.dwell_trough`, a hold at each end of the stroke in stroke periods

- **Status:** LANDED 20f968e (2026-10-02). ACCEPTED (operator, 2026-10-02:
  "just approve that rfc, its 2x controls"; rfc-ct1's sibling bead). The open questions resolve to the
  draft's defaults: additive dwell, u16 at 0.01 strokes, a period is the
  whole cycle. Landing follows the amendment ritual.
- **Origin:** operator review of the Advanced Penetration plugin
  (ph-e82.18), 2026-10-02: "add a crest and trough dwell as a float of
  periods so a trough dwell @0.5 with a stroke period of 200ms would be
  100ms of dwell, I get the at min and at max rhythm modifiers do
  something similar but the dwell is more curve shaping than
  patternization." The plugin cannot draw what the wire does not carry
  (RFC-068, RFC-080: plugins present the protocol, never extend it), so
  the parameter is registered here first.
- **Problem.** The advanced program (RFC-081) shapes one stroke with six
  base controls: two depths, two speeds, two accelerations. Its curve
  reverses the instant it reaches either depth. A hold at the deep end or
  the shallow end is a property of the stroke's shape, like its
  acceleration, not a variation across strokes. The rhythm modifiers'
  `mod.hold` and `mod.rest` (RFC-066) vary a control across strokes and
  cannot express "every stroke pauses at the top for a tenth of a period".
- **Proposed change.**
  1. **Two roles, `field_roles`:** `advgen.dwell_crest` (the hold at the
     deep bound, `advgen.depth_max`) and `advgen.dwell_trough` (the hold
     at the shallow bound, `advgen.depth_min`). Each is a layout field of
     the advanced generator's STATE entry with a `setting_key` on its
     writer, unit `strokes` (the period of one stroke as the clock, the
     same unit the modifiers already use), numeric with two decimals, zero
     = no hold. A dwell of 0.5 on a 200 ms stroke holds 100 ms. No
     maximum is implied by the role; the field's own `max` bounds it.
  2. **Semantics (hub MUST):** the dwell is inserted at the bound after
     the inward or outward half completes and before the reversal starts;
     the stroke period grows by the dwell (dwell is additive, it does not
     compress the moving halves). Speed and acceleration bases are
     unchanged. A modifier whose `mod_target` is a dwell field varies it
     per stroke exactly as it varies any other base control.
  3. **Rendering (RENDERING §10 `generator-advanced`):** the two dwells
     are optional bindings; a client that finds them renders them with the
     base controls (the reference plugin draws them as handles on the
     stroke curve and marks a long hold as a truncated flat). Absent
     roles: nothing to draw, the widget does not decline.
  4. **Reference hub:** two new base controls in `AdvancedPattern`,
     appended to 0x1210 at the tail per SPEC §5.4 with writer keys 46 and
     47 on 0x3210, each a u16 at 0.01 strokes (0 to 655.35), gated by a
     second `meta.enabled_mask` bitfield (the first is full: seven knobs
     and `running`). Two more modifier entries (RFC-066) ride their
     `mod_target`s. Etag moves.
- **Pros.** The hold is a stroke-shape control where it belongs; presets
  capture it; modifiers can ride it; the plugin's curve and the hub's
  motion agree. Additive dwell keeps every existing preset's stroke
  identical at dwell 0.
- **Cons.** Two more fields and two more modifier entries on a hub whose
  0x1210 enabled mask is already full. A dwell is a hold at a bound where
  the rail is at rest, which is also where a stall is least visible: the
  plan strip must keep showing "holding" so a long dwell is not mistaken
  for a stalled source.
- **Cost.** Registry: two role strings and codegen. Spec: one paragraph in
  RENDERING §10. Nucleus: `AdvancedPattern` stroke planner, catalog
  fields, second mask, two modifier entries, presets payload grows by two
  values (migration: absent reads 0), sim rebuild, fixture re-record in
  Phosphor. Phosphor: the plugin's dwell handles (designed, waiting on
  this); the generic widget renders the fields by role for free.
- **Wire impact.** Two new layout fields, two writer keys, one mask byte,
  two modifier entries on an adopting hub; etag moves. No numbers in the
  registry beyond the role strings.
- **Registry impact.** `field_roles`: two additions; `widget_patterns` 10
  note names them as optional.
- **Conformance impact.** Hub: dwell 0 reproduces today's stroke exactly;
  a modifier targeting a dwell varies it. Client: optional bindings only.
- **Compatibility.** Presets stored before this RFC load with dwell 0.
- **Open questions.**
  1. Additive dwell (this draft) or dwell within the period (the moving
     halves compress so the period holds)? Additive matches "a float of
     periods" and keeps old presets identical; within-period keeps the
     rate under a modifier ride.
  2. u16 at 0.01 strokes (this draft) or f32? Two bytes each is the
     cheaper snapshot; f32 is the honest "float of periods".
  3. Does a dwell count toward the modifiers' stroke clock (one stroke =
     move in, hold, move out, hold)? This draft says yes: a period is
     the whole cycle.

## RFC-096 -- A ` / ` separator in a group string names a section

- **Status:** DRAFT (2026-10-02; rfc-4ed). Ruling pending.
- **Origin:** the RFC-094 landing, 2026-10-02 (Nucleus 312f396, Phosphor
  79896da). Every field folded from `tuning` (9) and `library` (5) took the
  subgroup's name as its `group`, so the eleven former Tuning cards (Active
  plan, Planner, Anomalies, Plan time, Stream ingress, Motion behavior,
  Streaming, Sample streams, Curve, Infeasible moves, Settling) drew as one
  card on the Motion page. Operator ruling the same day: every former
  heading stays its own card, under a Tuning (or Library) section. The
  reference hub and client adopt this convention ahead of a ruling, as a
  presentation choice (Nucleus val-mwu; Phosphor ph-efai, DESIGN §10.11).
- **Problem.** `group` (SPEC §8.8, key 11) is one free-text string per
  field, and RENDERING §3 makes it the subgroup under a category. A fold
  has two levels to state, the former category and then the card, and one
  string to state them in: the subgroup's name alone loses the cards, the
  card heading alone loses the subgroup RFC-094 promised. Nothing on the
  wire sits between a category and a card.
- **Proposed change.**
  1. **Convention (RENDERING §3, a note after the subgroup sentence):** the
     first ` / ` (space, solidus, space) in a `group` string separates a
     **section** from the card heading: `Tuning / Planner` is the card
     Planner in section Tuning. A `group` without one is a card with no
     section. Only the first separator splits; a later one belongs to the
     card heading.
  2. **Rendering (MAY):** a renderer that adopts it draws a section's cards
     together under one section heading, catalog order within the section
     (RENDERING §11), and keys each card on the whole string. Where a page
     puts sections among cards with none is the renderer's craft (the
     reference client draws cards with no section first). A renderer that
     does not adopt it draws the whole string as the card heading, which
     still reads correctly: that graceful path is why this is a
     convention and not a field.
  3. **Authoring (AUTHORING.md, the card row):** a hub that folds a
     category into a subgroup writes `<subgroup> / <card>`; a card heading
     that needs a slash writes it unspaced (`In/out`).
- **Pros.** No wire, registry, codec or vector change, and every released
  client already renders the string. `group` stays the one home of
  grouping, so a section cannot disagree with its card. It states
  membership, as `group` already does, never layout (SPEC §1.2 item 7).
- **Cons.** Meaning inside free text: a heading that holds ` / ` by
  accident is split. Two levels only. The prefix rides every field: the
  reference catalog grew 829 B (25,471 to 26,300 B) and its etag moved.
  Section names stay hub strings, unlocalized, as every `group` is.
- **Cost.** Spec: one informative note in RENDERING §3 and one AUTHORING.md
  line; no registry, codegen or vector change. Nucleus: the `card::` group
  strings in `ValenceCatalog.h` (sim etag 8e5be2a88c0d69e7). Phosphor: the
  splitter and the section header row. MFP plugin: untouched (it draws no
  categories).
- **Wire impact.** None. An adopting hub's group strings change and its
  etag moves.
- **Registry impact.** None.
- **Conformance impact.** None required: MAY for renderers.
- **Open questions.**
  1. A field instead (a `section` key on the field or the entry)? It is
     unambiguous and localizable, but costs a registry key and a codec
     change before the tag, and a client that predates it loses the
     section.
  2. Should the separator be a named registry constant, so clients and
     lint share one spelling?

## RFC-097 -- The catalog channel's STATE layout: etag, chunk count, entry count (12 bytes)

- **Status:** DRAFT (2026-10-02, from the RFC-077 library landing fd36721).
- **Origin:** the reference library now re-announces a grown catalog on the
  `catalog` channel 0x0001 (RFC-077, SPEC §8.6) and the JS client must
  check a background refetch against the announced etag. The registry's
  `core_channels` note for 0x0001 says only "etag, chunk count, entry
  count" and pins no layout, so a client cannot decode the announcement
  without reading the library.
- **Problem.** Every other core STATE channel carries a pinned layout in the
  registry (the `accessory_status` precedent). 0x0001 is the one every
  client MUST subscribe to and the only one with no wire shape. The
  library chose one; the JS client cannot rely on it until the registry
  does. Until then valence-js adopts a refetched catalog unverified and
  does not cache it.
- **Proposed change.** Registry `core_channels` 0x0001 gains
  `layout: "etag_lo u32 + etag_hi u32 (the 8 etag bytes in wire order) +
  chunk_count u16 + entry_count u16 = 12 B"`, on-change, retained,
  `watch` access, normal priority, exactly as the library emits it today.
  SPEC §4.2-3 and §8.6 gain the pointer "layout per the registry". The
  JS client then verifies a background refetch against the announced etag
  and caches it.
- **Pros.** One shape, pinned where every other shape is; the refetch path
  becomes verifiable; no implementation changes (the library already
  emits it, no hub declares 0x0001 yet).
- **Cons.** Twelve bytes where eight would do if the counts were dropped;
  the counts are what let a client size its reassembly budget before the
  transfer starts (§8.5(a)), so they stay.
- **Cost.** Registry one line, codegen, SPEC two pointers, clients/js one
  decode and one check, one conformance vector pinning the 12 bytes.
- **Wire impact.** None today (no hub declares 0x0001); the first hub that
  does emits this shape.
- **Open questions.** None.

## RFC-098 -- Rail ownership is released when its source goes quiet; `control-owner` names each slot's source kind

- **Status:** DRAFT (operator ruling 2026-10-03: "jogging within the window
  while it is idle is fine, not during streaming or gen"; measured gap
  2026-10-03 on valencesim and the P4).
- **Origin.** Phosphor hid the jog tape at idle because `control-owner`
  showed a slot still owned. Measured: a session that streams and then
  stops is refused SOURCE_CONFLICT on its own jog at idle (the hub counts
  `_owner[Stream]` until the session leaves); once session A has jogged,
  session B's idle jog is refused TAKEOVER_REQUIRED (the jog slot is held
  for A's life). Both follow §11.4 as written. Neither is what the operator
  means by "idle".
- **Problem.** §11.4 ties ownership to the session, not to the source
  being live. A slot stays owned after the stream's last bundle has played
  out, after a jog has settled, after a generator stopped (the reference
  releases the generator slot on stop, but the spec does not say it must).
  "Idle" therefore has no wire meaning, and a client cannot draw the jog
  tape honestly. Separately, `control-owner` carries owner session ids
  per slot but no vocabulary for which slot is which source, so a client
  guesses from field order (the plugin's known shortcut).
- **Proposed change.**
  1. **Quiet release (hub MUST).** A source's ownership ends when the
     source is quiet: a generator on stop; a jog when the move settles
     (plan at rest); a stream when its last admitted bundle has played out
     and no bundle has arrived for `stream_quiet_release_ms` (registry
     limit, 500 ms default, never below one schedule horizon). Ownership is
     re-acquired by the next intent or bundle under the normal §11.4
     rules. The session keeps its grants and tier; only the rail slot is
     released. `control-owner` publishes the release.
  2. **Idle jog.** With every slot free and no PAUSE, a jog inside the
     travel window is admitted from any `control` session without
     override; override remains the only way outside the window (§11.1).
  3. **Source kind on `control-owner`.** Each slot carries a
     `source_kinds` value (registry: jog, stream, classic, advanced,
     remote, reserved) beside its owner id, and the control-owner entry's
     option labels stop being the only naming. Clients draw the plan strip
     for stream, classic and advanced owners and the jog tape otherwise.
  4. **The owner announces who it is (operator, 2026-10-03).** Beside the
     kind, each owned slot carries the owning session's `client_kind` and
     `client_name` as given in its HELLO (§6.2), so any client can name the
     source in words ("stream: MultiFunPlayer on ATLANTIC-PC", "advanced:
     Phosphor funscript player"), find it, and offer the §11.4 TAKEOVER
     with the owner named rather than a bare session id. The hub-served
     page's own session is named the same way. Names are display strings
     and never a key: ownership keys stay the session id.
- **Pros.** "Idle" becomes a wire fact; the tape and the plan strip stop
  guessing; a client's earlier stream never locks its own jog; the
  plugin's field-order shortcut retires.
- **Cons.** A stream that pauses longer than the quiet window loses the
  slot and re-acquires it on the next bundle (one `control-owner` push
  each way); a jog pinned by a slow settle holds the slot a little longer.
- **Cost.** SPEC §11.4 two paragraphs, registry one limit and one small
  vocabulary, codegen; library arbiter release on quiet; Nucleus
  `railOwned()` and the arbiter's owner bookkeeping, sim, fixture;
  Phosphor `railOwned()` reads the kind instead of the running flags.
- **Wire impact.** Three fields per slot on `control-owner` (kind, client
  kind, client name; etag moves on adopting hubs); one new limit.
- **Open questions.** (1) 500 ms quiet window, or tie it to the grant's
  horizon only. (2) Does a quiet release of a stream also clear a PAUSE it
  never latched (no: command-driven sources latch nothing, §11.4).

## RFC-099 -- Trial writes: a setting applied live without persisting, then committed or reverted

- **Status:** ACCEPTED (operator, 2026-10-03: "neither mode saves to NVS
  until you apply your settings as defaults; if this needs an RFC build
  like we'd accept it"; rfc-2s0). LANDED a0f3fcb (SPEC, registry, codegen),
  28ba317 (library, valence-js, localhub), the live sim test beside this
  line's commit; reference hub Nucleus c89ae84.
- **Origin:** the Phosphor funscript player's analyzer (ph-smvd), which
  tunes the machine's writable settings (the travel and input limits, the
  kinetic limits, chase and waveform cards, blend) either LIVE or in a
  PREVIEW that the operator abandons. On the reference hub every accepted
  write marks the config blob dirty and lands in NVS after the debounce, so
  an abandoned preview rewrites flash and a preview that crashes or loses
  its link leaves the machine on values nobody chose to keep.
- **Problem.** The spec has one kind of write. A value is either set or not,
  and whether it survives a reboot is the hub's private policy. A client
  cannot ask for "apply now, keep only if I say so", cannot undo a run of
  writes without remembering every prior value itself (and a client that
  dies cannot undo anything), and a second client cannot tell that the
  values it sees are on trial.
- **Change.**
  1. **The `trial` key (cbor key 51, bool) on INTENT** beside `precondition`
     (30) and `takeover` (32). `true` makes the write a **trial write**:
     applied, clamped, echoed and published exactly as any write (§9.3), but
     never persisted. Absent or `false` is a **durable write**, today's
     behavior. A trial write changes an effective value, so it bumps
     `cfg_gen` under §4.2 rule 2 like any change, and the STATE shows the
     trial value: the shadow is the machine's effective state, never a
     preview of it.
  2. **Capability by catalog.** A hub supports trial writes iff its catalog
     declares `settings-trial` (core channel 0x0016). A client MUST NOT send
     `trial` to a hub that does not: under §4.3 such a hub ignores the key
     and persists the write.
  3. **Per-session trial set.** The hub records, per session, each
     (channel, key) it trial-wrote and the key's **pre-trial value** (its
     value before that session's first trial write of it; later trial writes
     keep the first baseline). Only keys the ECHO applied join the set.
     A durable write by the same session to a key in its set applies,
     persists, and ends that key's trial.
  4. **Exclusive keys.** While a key is in one session's trial set, any write
     to it from another session, trial or durable, is refused with the new
     NACK `TRIAL_CONFLICT` (0x0307, intent range: an unaware client falls
     back to the generic intent refusal under §4.3). The whole intent is
     refused, no key applied. SOURCE_CONFLICT (0x0403) is not reused: it is
     a safety-range code and names a motion source.
  5. **Commit and revert ops** on the new core INTENT channel
     `settings-trial` (0x0016), `control` floor, one schema field `op` (key 1,
     role `action.trial`, options index-aligned with the new `trial_ops`:
     1 `commit`, 2 `revert`). Each acts only on the sender's own set.
     `commit` persists every trialed value of the session and clears the
     set; no effective value changes, so `cfg_gen` does not move. `revert`
     restores every pre-trial value and clears the set; a restored value
     that differs bumps `cfg_gen` and republishes. Both ECHO `{1: op}`; on an
     empty set both are accepted no-ops. A new channel rather than a
     `session_admin_ops` member: session-admin is `configure` and governs who
     may do what, while a trial is opened by any session allowed to write the
     setting (`control` on the reference hub).
  6. **Lifecycle.** A session's trials revert when it ends by any §6.9 door
     and when it is parked STALE (RFC-042): a trial never outlives the
     session that can commit it. A reboot loses them by construction, since
     nothing was persisted. ESTOP and PAUSE revert nothing: the values are
     live settings, and the latch is separate.
  7. **What a hub refuses.** A trial write on a channel or key the hub
     cannot restore unconditionally (a verb, a motion command, a key whose
     write the hub gates on live machine state) is refused `UNSUPPORTED_OP`
     with a detail. Revert never refuses: where a constraint between values
     no longer admits a pre-trial value, the hub restores the nearest legal
     one and publishes it.
  8. **`meta.trial_pending`** (field role): a `bitfield8` on a settings STATE
     layout whose bit *i* marks the *i*-th setting-annotated field as holding
     a trial value, any session's, exactly the indexing of
     `meta.enabled_mask` (§8.8). On-change, retained. Every client sees that
     trials are open and on which fields; nothing about it is client-local.
  9. **Persistence.** A hub that persists settings MUST NOT persist a trial
     value before its commit: through every other persist, a trialed key's
     stored value stays its pre-trial value.
- **Pros.** Live tuning and preview become one mechanism with an undo the
  hub owns, so a crashed or disconnected preview cleans up after itself. The
  operator's "apply as defaults" is one op. Flash is written once per
  commit instead of once per abandoned experiment. Other clients are told,
  per field.
- **Cons.** One key, one core channel, one op table, one NACK code and one
  role. The hub holds a baseline per trialed key (bounded by the trialable
  keys it declares, because keys are exclusive across sessions). A
  durable write from a second client to a trialed key is refused until the
  trial ends.
- **Cost.** SPEC §4.2, §6.9, §8.8, §9.3, §16.1 text; registry; codegen;
  library trial bookkeeping in the hub with delegate hooks (baseline,
  restore, commit); clients/js key, channel and ops. Nucleus: the delegate's
  baseline and restore per key, persist from stored values with trials
  substituted, the `settings-trial` entry and a `trial_mask` on each
  settings card. Phosphor: `api.writeTrial`, `api.commitTrial`,
  `api.revertTrial`, `api.trialPending`.
- **Wire impact.** Additive: a key, a core channel, an op table, a NACK
  code, a role. An adopting hub's etag moves.
- **Open questions.** None blocking. Whether a durable write by the owning
  session should instead be refused while its own trial is open stays the
  draft's call (it ends the trial, which is what "set this for good" means).
