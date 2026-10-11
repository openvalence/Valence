---
title: Channel classes
description: >-
  Valence clause 9: STATE, STREAM, INTENT/ECHO, EVENT and STORE semantics, and
  the closed motion input surface.
generated: true
---

<!-- ==========================================================
     GENERATED FILE — DO NOT EDIT.
     Source of truth: spec/SPEC.md
     Generator:       docs-site/tools/gen_spec_pages.py
     Regenerate:      python docs-site/tools/gen_spec_pages.py
     CI gate:         python docs-site/tools/gen_spec_pages.py --check
     Normative text is copied verbatim. Hand edits are overwritten
     and fail the docs build. Edit the specification instead.
     ========================================================== -->

# 9. Channel Classes *(normative)* {#s9}

## 9.1 STATE — the shadow {#s9-1}

STATE channels carry **idempotent full snapshots** of a coherent group of fields.

- **Full-snapshot rule:** every STATE frame contains the complete current value of its channel. There are no deltas in `valence/1` — a delta would make frame loss corrupting, destroying the property the whole design leans on.
- **MTU rule:** a STATE payload MUST fit `min_transport_payload` (242 B) unfragmented. This is a *catalog design constraint*: a state group that does not fit is split into multiple channels at catalog-design time (and, if they are settings, given the same `category` so they render as one tab — [§8.8](catalog.md#s8-8)). Conformance tooling SHOULD flag violations mechanically, since layout size is statically known.
- **Retained value:** the hub keeps the latest value of every STATE channel and MUST push it immediately upon grant — connect, re-subscribe, reconnect — subject only to the readiness gate ([§6.4](session.md#s6-4)). This is the device-shadow primitive; it is what "page load adopts device state" compiles to.
- **Conflation:** the hub maintains at most a depth-1 queue per (channel, subscriber) — a newer snapshot replaces a queued unsent one. Subscribers therefore see the freshest state their link can carry, never a backlog. Newest-wins by seq on receive ([§7.3](time.md#s7-3)).
- **Rate:** `granted_rate_hz` is a *ceiling* on push frequency. On an on-change channel (`max_rate_hz` 0) a subscriber is pushed at most once per change, conflated. On a periodic channel it is pushed at `min(pace, change rate)`, where pace is the grant, or `max_rate_hz` under a rate-0 grant. A rate-0 grant is echoed as 0. A hub SHOULD keep a periodic channel's retained value current on every tick it pushes on and pace only per grant: a publication schedule of its own beats against every grant at another rate (RFC-113).
- **Sample time:** a periodic STATE layout MAY carry one `telemetry.sample_time` field, the hub time (u32 µs, [§7.2](time.md#s7-2)) at which every other field of the same layout was sampled. Only on a periodic channel (`max_rate_hz` > 0): on an on-change channel a fresh stamp makes every refresh a change and defeats conflation. An accessory declaration ([§17.1](conformance.md#s17-1).1) MUST NOT carry it. It is consumed, never drawn as a value; a client SHOULD time the snapshot by it, through its CLOCK offset ([§7.1](time.md#s7-1)), rather than by its arrival (RFC-113).
- **Bitfields:** flag-word channels use `bitfield8` fields with catalog-enumerated bit meanings. A latched safety word is still a full snapshot like everything else.
- **First push after a grant is never shed** ([§10.4](qos.md#s10-4)). A subscriber's very first snapshot is what takes it from READY to LIVE; shedding it would strand the session.

## 9.2 STREAM — the data plane {#s9-2}

STREAM channels carry timestamped sample bundles ([§5.4](wire-format.md#s5-4)) in either direction: telemetry h2c, motion input c2h.

- **`stream_kind` says what a sample IS**, and everything else follows from it:
  - **`samples` (0, default)** — dense points reporting a value **at an instant**. A dropped sample is recoverable by interpolation from its neighbors. Decimable.
  - **`segments` (1)** — each sample **commands a time extent**: it carries its own duration and is not a point on a continuous curve. A dropped segment is a permanently lost **command**, not a recoverable interpolation gap. **Not decimable** ([§10.4](qos.md#s10-4)). A segments stream wants lookahead: a client that cannot see its future gets the rest-without-successor rule ([§9.6](#s9-6)) at the end of each bundle, which is correct and visibly stop-start, and such an application belongs on `samples` (RFC-087).
  This is an explicit registered property, not an inference. An earlier heuristic classified segment channels by looking for a time unit in the layout — but `unit` is a free-form string, so two conforming hubs could disagree (`ms` vs `msec` vs `millis`) and therefore **shed differently under identical congestion**, which is exactly the divergence [§10.4](qos.md#s10-4) exists to eliminate.
- **Ordering:** guaranteed only on ordered bindings. On datagram bindings the consumer rules of [§7.3](time.md#s7-3) — drop-not-newer, timestamp-driven consumption — are the whole contract. STREAM consumers MUST be written against the weakest line of the [§13.1](transports.md#s13-1) matrix.
- **No per-sample acknowledgments**, in either direction. At 333 Hz an ACK would be a storm; [§9.3](#s9-3) explains why motion *input* correctness does not need one.
- **Grants bound sample rate, not frame rate.** A 240 Hz grant delivered as ~48 fps × 5-sample bundles is conformant and expected. (At 240 Hz five samples span 16.7 ms; a sixth would exceed the 20 ms span cap — the caps interlock.)
- **Inbound (c2h) ingress validation.** A hub accepts a bundle only on a channel the sending session was granted as a publication ([§6.2](session.md#s6-2), [§6.7](session.md#s6-7)). A bundle on an unknown, ungranted, wrong-class, or wrong-direction channel is **silently dropped and counted**. Before acting on an accepted bundle the hub MUST re-validate the [§5.4](wire-format.md#s5-4) caps against its **own** catalog; a bundle violating any cap is dropped **whole**, never parsed part-way. A bundle from a session that is not yet ready ([§6.4](session.md#s6-4)) is likewise dropped and counted.
- **Two sanctioned NACK carve-outs.** STREAM is otherwise never NACKed, but silence is a bad answer to a client that is structurally broken rather than merely fast:
  1. **`RATE_LIMITED`** for sustained ingress overage ([§10.5](qos.md#s10-5)), throttled;
  2. **`SOURCE_CONFLICT`** on the first bundle dropped because another **live** session owns the source ([§11.4](safety.md#s11-4)), throttled the same way, once per (session, source). Without it, a producer whose source is owned by someone else is silently dead: every bundle dropped, zero wire signal. Producers SHOULD also subscribe the `control-owner` channel for the full picture.

## 9.3 INTENT / ECHO — the control plane {#s9-3}

INTENT is the only way a client changes anything. CBOR: `channel_id` (15) naming an INTENT-class channel, `intent_id` (18), `value` (20) per the channel's `schema`, optional `precondition` (30), optional `takeover` (32), optional `trial` (51).

- **ECHO is mandatory and truthful.** The hub replies ECHO `{intent_id, applied (19), cfg_gen}` — or NACK. `applied` carries the **post-clamp values actually in effect**, which MAY differ from what was requested. The client's shadow updates from ECHO and the ensuing STATE broadcast, **never from its own request**. All *other* subscribers learn of the change via STATE; ECHO goes only to the sender. **ECHO is key-complete over what was applied:** `applied` carries every key from the intent's `value` map that the hub applied; a key **absent** from the ECHO means NOT applied, and the client MUST fall back to reported truth (the ensuing STATE) for it. This is what makes "silently accepted" and "silently ignored" distinguishable on every hub.
- **Idempotency:** `intent_id` is session-scoped, client-assigned, monotonically increasing. The hub keeps a ring of the last `idempotency_ring_depth` (32) `id → ECHO` pairs per session; a duplicate id re-emits the stored ECHO and MUST NOT re-apply. The ring dies with the session ([§6.8](session.md#s6-8)) — which is safe *because*:
- **Absolute values only.** Intent schemas MUST express target state ("set speed 400"), never operations on current state ("add 20"). A client wanting an increment computes the absolute target from its shadow and MAY guard against races with `precondition` = expected `cfg_gen`; mismatch → NACK `CONFLICT`, client re-reads and retries. This one rule is what makes the reconnect story ([§6.8](session.md#s6-8)) sound and two-operator racing merely annoying instead of corrupting.
- **Rate limiting:** hub-enforced per session, `intent_ingress_default_per_s` (50) by default; excess → NACK `RATE_LIMITED`. Generous for UIs, hostile to accidental loops. **Role-exempt safety ops are rate-limited too** ([§11.2](safety.md#s11-2)).
- **Trial writes** (RFC-099). An INTENT carrying `trial` = `true` is a **trial write**: applied, clamped, echoed, published and counted toward `cfg_gen` exactly as any write, but **never persisted**. Absent or `false`, the write is **durable**. A hub supports trial writes iff its catalog declares the core INTENT channel `settings-trial` (`0x0016`); a client MUST NOT send `trial` to a hub that does not, because [§4.3](foundations.md#s4-3) makes that hub ignore the key and persist the write.
  1. **The trial set.** The hub records, per session, each (channel, key) the session trial-wrote and that key's **pre-trial value**, its value before the session's first trial write of it; later trial writes keep that baseline. A key joins only when the ECHO carries it. A durable write by the same session to a key in its set applies, persists, and ends that key's trial.
  2. **Exclusive keys.** While a key is in one session's trial set, a write to it from any other session, trial or durable, MUST be refused whole with NACK `TRIAL_CONFLICT`, no key applied.
  3. **Commit and revert.** `settings-trial` carries one op select (key 1, role `action.trial`, `trial_ops`), `control` floor, handled by the hub, acting only on the sender's own set. `commit` persists every trialed value of the set and clears it; no effective value changes, so `cfg_gen` does not move. `revert` restores every pre-trial value and clears the set; a restored value that differs advances `cfg_gen` and republishes its STATE. Both ECHO `{1: op}`, and both are accepted no-ops on an empty set.
  4. **Lifecycle.** A session's trials revert when it ends by any [§6.9](session.md#s6-9) door and when it goes `STALE` ([§6.6](session.md#s6-6)): a trial never outlives the session that could commit it. A reboot loses them by construction. ESTOP and PAUSE revert nothing: the values are live settings, and the latch is separate.
  5. **Refusals.** A trial write on a channel or key the hub cannot restore unconditionally (a verb, a motion command, a value whose write the hub gates on live machine state) is refused `UNSUPPORTED_OP`. Revert itself is never refused: where a constraint between values no longer admits a pre-trial value, the hub restores the nearest legal one and publishes it.
  6. **Persistence.** A hub that persists settings MUST NOT persist a trial value before its commit; through every other persist, a trialed key's stored value stays its pre-trial value. Settings STATE layouts SHOULD carry `meta.trial_pending` ([§8.8](catalog.md#s8-8)) so every client sees which values are on trial.
- **Streams are not intents.** High-rate motion *input* rides STREAM and is never echoed per-sample. Its observable truth is the position telemetry the hub publishes — you see what the machine actually did, which is the only truth that matters. Only discrete state changes ride INTENT.
- **Actions.** A schema field whose `role` is `action.<name>` is a **verb**, not a value: `action.home`, `action.reset_stats`. ECHO echoes the op. Two rules make an action observable rather than private to its sender:
  1. a resettable counter group's twin STATE channel carries a field tagged `meta.reset_gen`, incremented on every applied reset, so **all** subscribers observe the reset;
  2. **classification:** an action that restores *configuration* values bumps `cfg_gen` **and** `reset_gen`; an action that only clears *counters* bumps `reset_gen` alone.
- **Procedures.** A long-running guarded operation — a multi-step device programming sequence, a verified write-then-readback — cannot be expressed by intent-and-echo alone, because its real result arrives later. It is not a new frame type; it is a **documented catalog pattern**:
  - start it with an action intent; ECHO means **accepted**, not complete;
  - progress and outcome ride a twin STATE channel carrying `{procedure, phase, progress, result}`, where `phase` is a `procedure_phases` value (`idle`/`running`/`succeeded`/`failed`/`aborted` registered; 128+ device-defined intermediate steps that a client renders as `running` if it does not recognize them). Full snapshots make it reconnect-safe by construction;
  - completion also emits an EVENT;
  - **one procedure STATE channel per concurrently-runnable procedure** — full-snapshot semantics can represent exactly one;
  - **reboot-commit:** where accepting the intent commits by rebooting, the ECHO's `applied` map carries `reboot_in_ms` (43); the hub then GOODBYEs every session with `REBOOTING` before going down, and the changed `boot_id` tells returning clients what happened.

## 9.4 EVENT — edges, not levels {#s9-4}

EVENT channels carry discrete occurrences. CBOR: `event_kind` (33), `timestamp` (21), optional `seq_of_state` (34), and `body` (40) — a sub-map whose integer keys come from **the channel's own catalog `schema`**, exactly as INTENT's `value` does.

The `body` sub-map is what makes device-authored EVENT channels possible at all. With kind-specific fields at the top level, every device wanting an event channel would have needed a registry PR to name its own fields — the precise coupling the self-describing catalog exists to prevent. `event_kind` and `seq_of_state` stay at the top level because they are protocol framing, not payload.

- **Best-effort.** Events are conflated and bounded like everything else and are **NOT replayed on reconnect** — *except* where a channel's catalog entry declares a `replay_depth`, in which case the hub MAY replay up to that many entries from its ring tail when the channel is granted. The log channel ([§16.2](errors.md#s16-2)) is the sanctioned use; the exception exists so "what went wrong just before I connected" is answerable without making every grant a burst.
- **The event/state duality rule (safety-critical).** Any event a client could not afford to have missed MUST have a **latched STATE twin**: the event says "this just happened", the state says "this is (still) true". E-stop is the canonical pair — the safety-events channel for the edge, the `safety` channel for the latch. A reconnecting client adopts the latch and needs no history. **No safety behavior may depend on EVENT delivery.** Events are UX (toasts, logs, timelines); states are truth.
- **Edges are emitted on transitions only.** A repeated ESTOP frame re-broadcasts the STATE — that is [§11.2](safety.md#s11-2)'s only loss-recovery mechanism and it must keep working — but it does **not** re-emit the edge. An edge that did not happen is a lie.
- **Overflow:** per-subscriber event queues are bounded (`event_queue_depth_per_subscriber`, 16); overflow drops **oldest** and increments a visible `events_dropped` counter on the hub-status channel. There is exactly one home for that counter; a per-channel duplicate would drift.
- **Purpose and kind labels for device-authored channels** (RFC-065). Spec-core EVENT channels are bound by id and their kinds are registry tables. A device-authored EVENT entry names its purpose with the entry-level `role` ([§8.1](catalog.md#s8-1), registry `channel_roles`) and labels its kinds with the entry-level `event_kinds` table. `events.anomaly` marks edges reporting that the machine did something other than what it was asked (a clamped command, a trimmed knot, a piece over a ceiling, a refused knot); its latched counters, where present, are the duality rule's STATE twin and carry the channel role `anomaly.summary`, so log and counters bind together. A client that gives anomaly events a dedicated surface MUST select those channels by `events.anomaly` or by core identity, never by name; a channel without the role renders as an ordinary event stream. A client renders an event's kind by its `event_kinds` label, and a kind with no label (or a channel with no table) as its decimal number: never dropped, never guessed from `body`. The kind is always taken from `event_kind` (33); a hub MAY also mirror it into `body`, but that mirror is never the label's home. **`event_kinds` is append-only (MUST):** across firmware versions a released kind value is never reassigned a different meaning, and a retired kind keeps its entry.

## 9.5 STORE — collections {#s9-5}

STORE-class entries declare blob stores; their semantics are [§8.7](catalog.md#s8-7). A STORE entry carries no layout and no schema, is never subscribed, and never emits frames: its dynamic half is an ordinary STATE channel and its items move over the blob verb.

## 9.6 The motion input surface *(normative)* {#s9-6}

This section states, as protocol obligation, where kinematic work lives. It exists because the natural pull when a client sends bad motion is to make the client smarter — and for an ecosystem protocol that is a trap. Every kinematic rule pushed into clients is re-implemented subtly differently by every integrator, is unverifiable by the device, and is a reason not to adopt the protocol at all. It also cannot be right in general: a client cannot know the hub's planner shape, its live limit set, or its stroke window, and all three change at runtime.

1. **The motion input surface is CLOSED and small.** A hub accepts motion in exactly three modes: **native samples** (a `samples`-kind STREAM of dense points), **native segments** (a `segments`-kind STREAM of timed `{target, duration, end_velocity}` commands), and **TCode passthrough** ([§15.1](legacy.md#s15-1)). Everything a client does is adapting *its* source material into one of those three. Adding a fourth mode is a deliberate specification act, not something that accretes.
2. **Write-once rule.** If **every** conforming client would otherwise have to implement a given piece of kinematic work, that work belongs on the machine — written once, verifiable, identical for all clients. A client SHALL be able to send its content **as authored** within one of the three modes and receive good motion, with no feasibility analysis of its own.
3. **No per-client case logic on the motion plane.** A hub MUST NOT branch on **client identity** when planning or executing motion. If a hub appears to need such a branch, this specification is underspecified and the fix is a rule here, not a device-side special case. *Scope:* authorization is identity-branching by definition and is the named carve-out — tiers, the trust ledger and the served-page sideband are authorization. The **motion plane** stays identity-blind.
4. **Client-side feasibility adaptation is always OPTIONAL** — quality of implementation, never required for correctness. **No conformance test may demand it.**
5. **Carry intent, not pre-chewed motion.** Wire design prefers the sender's authored `{target, duration, end_velocity}` over a pre-rendered approximation. A hub can always degrade intent; it can never recover information the client threw away.

**Motion-input field roles** (RFC-071). The layout fields of a c2h STREAM entry carry the [§9.6](#s9-6) vocabulary as registered `field_roles`: `input.target` (the commanded position of the sample or segment, in the field's own unit and scale), `input.velocity` (a `samples`-kind point's instantaneous velocity hint), `input.duration` (a `segments`-kind sample's commanded time extent) and `input.end_velocity` (a `segments`-kind sample's velocity at its end, the handoff). **A c2h STREAM entry that accepts motion MUST tag `input.target`**; the other three are tagged where the layout has the field. A client finds the motion-input channel as the c2h STREAM entry of the wanted `stream_kind` carrying an `input.target` field, never by name; a c2h STREAM without `input.target` is some other input, never motion. A client fills every field it has no value for, untagged or not understood (including `input.velocity`, which stays optional), with its `unspecified` value: the [§5.4](wire-format.md#s5-4) sentinel registered by RFC-058, one home, never a guessed zero.

**Resolving `unspecified`, and the dwell rule** (RFC-058). A segment whose end velocity is `unspecified` ([§5.4](wire-format.md#s5-4)) leaves the boundary velocity to the hub. With a scheduled successor the hub MAY derive it from the adjoining chords. **Without a scheduled successor the hub MUST resolve `unspecified` to rest (0)**, never to an estimate derived from prior motion: arrival before a hold, a gap or the end of content is rest by definition, and an estimate of past motion cannot know that (measured: a stale estimate coasted past a hold and darted back at 300-800 mm/s). A segment whose target lies within `segment_dwell_span` (registry `limits`, normalized units) of the previous accepted segment's target on the same source is a **hold**: a declared nonzero end velocity on it SHOULD be bounded to zero and surfaced as its own anomaly kind (the reference hub's `dwell_zeroed`, kind 4, labeled per [§9.4](#s9-4)). The test is against the previous **target**, never position: each whip displaces position, so a position test never re-arms. A client MAY emit explicit hold segments across gaps and MAY declare rest explicitly; neither is required for good motion, and a gap with no segment settles the machine ([§6.6](session.md#s6-6)).

**The direction flip** (RFC-088). A hub whose rail can be mounted either way round MAY offer a stored, writable layout field (bool, or a two-option select) carrying the role `axis.flipped`: a setting ([§8.8](catalog.md#s8-8) `setting_key`), persisted across reboot because it describes how the machine is mounted. The spec binds the role, never the channel (the reference places it on its `machine-modes` entry, appended at the tail per [§5.4](wire-format.md#s5-4)). **Effect: home swaps ends.** With the flip on, position 0 is the far end, and the hub mirrors against the homed travel (`geometry.measured_travel`): position telemetry reads travel minus position, the travel window (`window.min`/`window.max`) reports the same physical window in the flipped frame, and every c2h stream and intent target is mirrored on the way in. No client needs to know the state to behave; presets keep their meaning because they are stored in the frame they were authored in. **Gate (hub MUST):** a write that changes the flip is refused `SOURCE_CONFLICT` while any source owns the rail (the flip is a between-streams act), `NOT_HOMED` while the hub is unhomed (the mirror needs a measured travel), and `INTERLOCK` while override is latched ([§11.1](safety.md#s11-1)) or the machine is moving; it never acts mid-motion. A write that leaves the value unchanged is an ordinary no-op ECHO ([§4.2](foundations.md#s4-2): `cfg_gen` unchanged). Rendering: RENDERING.md §8.4 `axis`.

**The measured travel** (RFC-101). A completed home cycle ([§11.1](safety.md#s11-1)) takes a datum at the home end (0) and at the far end; the far datum is the measured travel, published as `geometry.measured_travel`, and the hub MAY store it in its `geometry.max_travel` setting through that setting's own writer: clamped to the setting's catalog bounds, persisted, `cfg_gen` advanced once (a hub-side change, RFC-011), the travel window held inside it as any write of that setting holds it. The setting is then the next cycle's search distance: a rail made longer needs `geometry.max_travel` raised before a cycle can find its new far end.

**Limits discovery is for display and optional pre-adaptation.** A hub SHOULD tag its kinematic ceilings and window bounds with `field_roles` (`limit.*`, `window.*`) so a client can find them on *any* hub without hardcoding a channel number. But the normative word for a client acting on them is **MAY, never SHOULD**: a client MUST NOT be required to reason about feasibility in order to produce good motion. Limits are shown to the operator; the machine's job is to play back whatever it is fed as well as it possibly can.

Note in particular that knowing `vmax/amax/jmax` is **not sufficient** to predict feasibility, because peak-versus-mean depends on the shape the hub plans. A rest-to-rest cubic over a chord `d` in time `T` (PCHIP between two crests, below) peaks at `1.5·d/T` in velocity, so a client applying the naive `d/T ≤ vmax` test concludes a stroke is fine when the profile actually needs 1.5× that. This is precisely why clause 4 exists and why clause 2 puts the work on the hub.

**Curve family declaration: retired** (RFC-106, pre-tag). A segment stream declares nothing beside its knots: its declaration is per knot, an end velocity given (an authored angle the hub keeps, held to `vmax`) or `unspecified` (a free knot the hub shapes, below). CBOR keys 45 (`curve_family`) and 48 (`requested_curve_family`) and the `curve_families` table are retired: a hub ignores key 45 in a wish entry ([§4.3](foundations.md#s4-3)) and emits neither key.

**Free-knot rendering** (RFC-106, RFC-108). A hub that renders segment streams with handles, as the reference does, follows these rules, so that a second implementation and a client's drawing of the hub's curve match it sample for sample. `smoothness`, `handle_floor` and `trim_max` are the hub's planner settings (RFC-108; the reference carries them on its `kinetic-planner` card).

1. **The renderer.** Between knots the hub renders a cubic Bézier in the
   time-position plane. Knots stay on the author's clock in time and
   position (only the amplitude rule below moves one, in position). Each
   knot has one angle (its velocity) and two handle lengths (the time
   extent of each handle as a fraction of its span). The piece from knot
   L to knot R, T seconds and D of travel, has the control points (0, 0),
   (l0 T, s0 l0 T), (T - l1 T, D - s1 l1 T) and (T, D) relative to L,
   where s0 and s1 are the two angles, l0 is L's outgoing length and l1
   is R's incoming one. The curve parameter u is not time: velocity,
   acceleration and jerk are time derivatives (v = (dp/du) / (dt/du)).
   Lengths stay within [0.05, 0.95]. A piece whose two lengths are one
   third is the polynomial cubic, the cubic Hermite of RFC-030 with the same
   end velocities, so an authored cubic whose angles are given renders exactly
   while its lengths stay at a third; the angles a free knot takes are
   the style's rule (rule 3). The continuity classes are geometric: G1 is
   velocity continuity through the knot (collinear handles, lengths
   free), G2 is acceleration continuity (one condition on the lengths, or
   on the angle where the angle is free). Parametric continuity (derivatives
   in the curve parameter) is not used: the parameter is not time, and
   mirrored handles would change PCHIP for a condition the motor cannot
   feel. No wire value names a class: a sender's declaration is
   per knot, an end velocity given or left free (above).
2. **Classes from the chords.** The chord of the span from knot j to knot
   j+1 is d(j) = (p(j+1) - p(j)) / (t(j+1) - t(j)); at knot i, dIn =
   d(i-1) and dOut = d(i). A knot is an end (the first or last knot of a
   render), a hold edge (a position change of at most 0.005 of the window
   span on either side, the reference's hold tolerance), a crest (the
   chords change sign) or a through point (the same sign both sides). The
   classification is the hub's and needs the next knot; the angle rules
   need more (PCHIP's start angle one knot on each side, Makima's two,
   and the G2 solve couples every through point of the render), all
   within the stream's lookahead (RFC-105), so a new knot can change
   angles back to the committed horizon and never before it. In a stream
   the ends are not a script's:
   - The first knot of a render is the origin, the committed state at
     the reaction horizon (RFC-105 (bb), (gg)). Its angle is the live
     velocity, kept as an authored angle is and never solved; the live
     acceleration is carried into the first piece by its start length
     where that stays legal, else by a ramp at `jmax` ahead of the piece.
     The origin never moves.
   - The last knot of a render is the newest knot. With an `unspecified`
     end velocity it rests (angle 0; [§9.6](#s9-6): no scheduled successor, rest)
     until a successor arrives; the next render classifies and solves it
     as an inner knot, and the part of the piece into it already inside
     the committed horizon does not change.
   - The previous knot's actual position (rule 5) is its RENDERED
     position: its authored position plus its own trim, or the origin's
     position for the first piece. It is where the machine is commanded
     to be at that knot's time.
3. **Two styles, the two ends of the hub's `smoothness`** (RFC-108 item
   6). A style is the angle and continuity rule for FREE knots (end
   velocity `unspecified`, [§5.4](wire-format.md#s5-4)), the part of the curve the sender did
   not name.
   - `pchip`, the default, which every hub with this renderer MUST
     render: ends, crests and hold edges take angle 0 and are G1 with
     both lengths a third (flat tops and holds, PCHIP's monotone rule); a
     through point starts from PCHIP's angle and is G2 by its angle,
     solved in closed form, held to the monotone band and to `vmax`. A
     piece between two knots that are each an end, a crest or a hold edge is
     PCHIP's piece exactly while its lengths stay a third; a through
     point carries its G2 angle, not PCHIP's.
   - `smooth`, OPTIONAL for a hub (RFC-106 item 9): ends, crests and
     hold edges take angle 0, extrema never passed; ends are G1, and a
     crest or a hold edge is G2 by its lengths where the two sides' end
     accelerations agree in sign, else G1 (an exact hold has no end
     acceleration on its flat side, so a hold edge stays G1 in practice).
     Only a through point takes an angle: it starts from Makima's angle
     and is then G2 by its angle exactly as under `pchip`. In a render of
     three knots or fewer Makima is not used: a through point starts from
     PCHIP's angle. A hub without `smooth` bounds `smoothness` to 0.
   - The rules, normative so that a second implementation and a client's
     drawing match the hub:
     - PCHIP's start angle (Fritsch-Butland): with h1 and h2 the spans
       before and after the knot, w1 = 2 h2 + h1 and w2 = h2 + 2 h1, the
       angle is (w1 + w2) / (w1 / dIn + w2 / dOut), and 0 when
       dIn * dOut <= 0.
     - Makima's angle: w1 = |d(i+1) - d(i)| + |d(i+1) + d(i)| / 2 and
       w2 = |d(i-1) - d(i-2)| + |d(i-1) + d(i-2)| / 2; the angle is
       (w1 d(i-1) + w2 d(i)) / (w1 + w2), or (d(i-1) + d(i)) / 2 when
       both weights are 0. It needs two chords on each side; past a
       render's ends the missing chord is extrapolated, d(-1) =
       2 d(0) - d(1) and d(n-1) = 2 d(n-2) - d(n-3) for n knots, and the
       angle re-solves when the real chord arrives.
     - The monotone band (Fritsch-Carlson): a free through angle lies in
       [0, 3 min(|dIn|, |dOut|)] when the chords rise and in
       [-3 min(|dIn|, |dOut|), 0] when they fall.
     - The through angle s: with the knot's lengths lIn and lOut, the
       spans TL and TR and the travels DL and DR on its two sides, the
       neighbors' angles sL and sR and their facing lengths lL (the left
       neighbor's outgoing) and lR (the right neighbor's incoming), the
       left piece ends at acceleration AL + BL s and the right piece
       starts at AR + BR s, where cL = 2 / (3 lIn^2 TL^2),
       cR = 2 / (3 lOut^2 TR^2), AL = cL (-DL + sL lL TL),
       BL = cL TL (1 - lL), AR = cR (DR - sR lR TR) and
       BR = -cR TR (1 - lR). G2 is s = (AR - AL) / (BL - BR), held to the
       band and then to `vmax` in magnitude.
     - The length match (`smooth`, a crest or a hold edge of angle s):
       XL = 2 / (3 TL^2) (-DL + s TL (1 - lL) + sL lL TL) and
       XR = 2 / (3 TR^2) (DR - s TR (1 - lR) - sR lR TR); when
       XL XR > 0, with r = sqrt(XR / XL), lIn = (1/3) / sqrt(r) and
       lOut = (1/3) sqrt(r), each held to [0.05, 0.95] (the product stays
       a ninth before the hold); otherwise the lengths stay.
     - The order: every angle is set first (authored, the style's start
       angle, or 0) and held to `vmax` in magnitude, and every length is
       a third; then four sweeps in knot order solve each free G2 through
       angle and, under `smooth`, each crest's and hold edge's lengths,
       each step using its neighbors' current values (Gauss-Seidel).
       Parity is with the four sweeps, not with an exact solve of the
       coupled system.
   - Monotonicity. The band is sufficient for a monotone piece only while
     both of the piece's lengths are at most one third. In chord units
     (m = D / T, alpha = s0 / m, beta = s1 / m, A = alpha l0,
     C = beta l1, the angles zero or of the chord's sign) a piece is
     monotone if and only if A + C - sqrt(A C) <= 1, and max(A, C) <= 1
     suffices; the band gives alpha, beta <= 3, so lengths at or under a
     third keep every band-legal piece monotone. When the ceilings
     lengthen a handle past a third (rule 4), nothing further bounds the
     angle: it stays held to the band and to `vmax`, the piece may
     overshoot its end knot or reverse inside the span (alpha, beta =
     3, 0 at a length of 0.5 overshoots by 8% of the chord), and only the
     window ceiling judges it.
   - An end velocity that is not `unspecified` is an authored angle under
     either style: kept, never solved or banded, held to `vmax` as today
     (`EndVelClamped`), the lengths the hub's. Under `pchip` an authored
     knot is G1 with both lengths a third, so an authored cubic
     renders exactly where the ceilings allow; under `smooth` an authored
     crest or hold edge also takes the length match.
   - Between the styles. A free knot renders at the hub's `smoothness`
     s (0 to 1): its angle and both lengths are (1 - s) times the
     `pchip` solution plus s times the `smooth` one, each solved by the
     rules above, and an authored crest or hold edge takes s times
     `smooth`'s length match; the ceilings then fit and trim the lerped
     curve (rules 4 and 5). At 0 and at 1 the render is the style's
     exactly. Overshoot grows continuously with s.
4. **The ceilings bound the lengths.** Per piece, in knot order, both
   lengths scale by one factor, the nearest to one that is legal: the
   factors 0.2 to 2.0 in steps of 0.05 are tried nearest one first (1,
   0.95, 1.05, 0.90, ... 0.2, then 1.85 to 2.0; the lower first on a
   tie), each scaled length held to [`handle_floor`, 0.95], and the first
   legal factor is taken. `handle_floor` is the feel floor, a planner
   option for RFC-105's table, default 0.15 of the span. Speed caps the
   length from above (a shorter handle lowers the peak toward the mean),
   acceleration and jerk floor it (a shorter handle sharpens the ends as
   one over the length squared). The window is a ceiling like the others.
   The judge samples a piece at 161 points evenly spaced in u
   (u = k / 160), with v, a and j the exact time derivatives there; the
   piece's worst ratio is the largest of peak |v| / `vmax`, peak |a| /
   `amax`, peak |j| / `jmax` and 1 plus the excursion past the window as
   a share of its span; a worst ratio of at most 1.001 is legal. A G2
   knot whose adjoining piece scales generally loses the match, and the
   acceleration step is then rule 6's.
5. **Amplitude gives, time never.** When no factor is legal, the later
   knot of the piece moves toward the previous knot's rendered position
   (rule 2) by the least that is legal. The full move is judged first:
   the whole chord, bounded by the maximum trim (`trim`, a planner option
   for RFC-105's table, default the window span, so by default the whole
   chord). If it is legal, 16 bisection steps between no move and the
   full move keep the least legal move found. A knot whose piece is legal
   untrimmed does not move in that round. A hold after a trimmed knot
   (its authored chord within the hold tolerance) moves with it and stays
   flat. Every knot after the origin may move, the newest included; the
   reference model renders a finished script and keeps its final knot,
   which a stream render does not. The render runs three rounds: solve
   (rule 3), then fit and trim every piece (rules 4 and 5); then twice,
   solve again on the trimmed chords, then fit and trim again from the
   authored positions; the last round is rendered. Each trimmed knot (a
   hold that moves with one is not reported again) is reported on the
   `events.anomaly` channel ([§9.4](#s9-4)) as the kind `knot_trimmed` (the
   reference hub's kind 3, labeled per [§9.4](#s9-4); RFC-108), its detail
   the share of the chord kept (0..1). The lateness budget of RFC-105's options defaults to zero.
    **The terminal rule.** When even the full move is illegal, the knot
    takes the least-over of the untrimmed position and 25, 50, 75 and 100%
    of the full move (the smaller move on a tie), the piece renders there
    as it is, over a ceiling, and it is reported on `events.anomaly` as
    `piece_over_ceiling` (the reference hub's kind 6, labeled per [§9.4](#s9-4); a
    device-authored kind, so no registry number), its detail the piece's
    worst ratio. This renderer never drops a knot, so the reference has
    no dropped-knot kind (RFC-108). A hold piece is never trimmed: one that is illegal
    renders as it is and is reported the same way. The knot is never
    dropped (RFC-105 (t) does not apply to this renderer). This is the one
    exception to RFC-105's promise 3: the promise holds on the judge's grid
    (161 points per piece, within 0.1% of every ceiling and of the window
    span) for every piece not reported `piece_over_ceiling`, and between
    the grid's points it is not separately bounded; a `piece_over_ceiling`
    report is the hub stating, on the wire, that a piece broke the promise
    and by what ratio.
6. **The jerk ceiling on top.** At a G1 knot the acceleration step is
   rounded by the corner ramp of |Δa| / `jmax`. A G0 knot (an authored
   corner: linear or step senders) is rendered as the tightest rounding
   the acceleration ceiling allows. G2 knots need nothing.
7. **The solve order and parity.** The reference is Kinetic
   `include/kinetic2/handles.hpp` and its model.
   - Angles first, at a third. Every angle is set with every length a
     third: an authored angle kept and a free one the style's (rule 3),
     each held to `vmax`, the origin's live velocity kept exactly; then
     the four G2 sweeps. Every round solves its angles at a third again: a
     length the ceilings scaled never feeds back into an angle.
   - Then the lengths, per piece in knot order, on the k grid: the 37
     factors 0.2 to 2.0 in steps of 0.05, tried nearest one first with the
     lower first on a tie (1, 0.95, 1.05, 0.90, 1.10, ... 0.20, 1.80, then
     1.85, 1.90, 1.95, 2.0); the first legal factor is taken (rule 4), and
     when none is legal the knot trims (rule 5).
   - The rounds. The first solves on the authored chords; two more solve
     on the trimmed chords and fit and trim again from the authored
     positions; the last is rendered. A last round that caps an angle or
     asks an end acceleration earns one more round, at most four. The cap
     is the fastest angle whose zero-stroke piece over the knot's outgoing
     span is legal at some factor, set when the piece out of a moving knot
     is still over after its trim; the ask is the end acceleration the
     next piece's start needs from the piece before the knot, set when
     that start's corner ramp has no room.
   - The engine's slack passes. A built piece over a ceiling as the 1 ms
     grid reads it (its lead ramp, start correction and corner ramps,
     which the render does not see) tightens that ceiling for its piece
     and the window renders again, at most three more times; what is still
     over is reported `piece_over_ceiling`.
   - G2 degradation. Angles are solved with the lengths a third, so a G2
     knot whose adjoining piece scales loses the match and renders as G1:
     its acceleration step is rounded by rule 6's corner ramp at `jmax`.
   - Monotonicity at `smoothness` 0 (`pchip`), which tightens rule 3's
     Monotonicity paragraph. A piece whose travel is more than the hold tolerance and
     whose two angles are band-legal for its own chord (zero or of its
     sign, at most 3 (1 + 0.001) times it) stays monotone at its scaled
     lengths: a factor whose piece travels backward (overshoots its end
     knot or reverses inside the span) by more than 0.001 of its chord is
     illegal, ranked 1 plus that share. With A and C as in rule 3 and
     B = 1 - A - C, the piece reverses only when B < 0 and B^2 > A C, and the
     backward travel is the position between the two roots of dp/du. A
     piece with an angle outside the band is not judged: an authored
     overshoot at a third is the author's cubic, and a start angle against
     the chord (the origin's live velocity) would make every factor and
     every partial trim illegal. `smooth` keeps its freedom; the window
     judges it.
   - The terminal rule stays reachable. The full move is a zero stroke,
     illegal while the knot before heads into the span faster than the
     span can turn it (the cap lands the round after), and a partial move
     is often legal then: over 5000 random scripts the final round took
     rule 5's terminal rule 108 times, 99 of them on a legal partial move,
     and without the rule the reference's property suite reported
     `piece_over_ceiling` 472 times instead of 48. Bounding every angle up
     front is what would make it unreachable.
   - Parity with the reference (Kinetic
     `tests/test_kinetic2_handles.cpp`): every knot's trim within 1e-4 of
     the window span, renderer against model, with no allowance; the
     engine's position on the 1 ms grid within 0.5% of the window span and
     its trims within 1e-4, both past the corner-ramp allowance (the lag a
     corner ramp at `jmax` puts on its piece, the piece's end knot and the
     next piece: the piece's peak speed times the ramp's time, halved);
     every ceiling within 0.1%.


**The client onramp (RFC-044, corrected 2026-07-27).** The onramp is ordered by how little an *existing* ecosystem client must change to reach a Valence hub at all, and its easiest rung is a **CLIENT-SIDE adapter, not a hub-side mode**. **TCode passthrough** means a client that already generates TCode pipes it through a small local shim — a reference implementation ships as a Phosphor kernel module, with a C# helper planned for MFP-class apps — that translates the client's own TCode into native segments (or samples) locally, before anything reaches the wire. **The hub never parses TCode and no Valence channel carries it.** From the hub's side the adapted traffic is ordinary native motion, so the gain — a session's identity, deadman bookkeeping, source ownership and the safety taxonomy — comes for free with zero protocol surface. This is unrelated to [§15.1](legacy.md#s15-1)'s legacy text-edge synthetic-session mechanism, which stays the only place a hub itself ever sees TCode bytes, and only because those bytes arrive over a transport (serial, BLE-NUS) that was never a Valence frame to begin with. **Native segments** is the next rung, trading a small format change for `{target, duration, end_velocity}`'s deadline-honoring precision. **Native samples** is the dense-streaming rung a client graduates to only when it wants that. The strategy this encodes: Valence is meant to win by being the easiest protocol in the room to adopt, never by requiring a client to rewrite its motion pipeline before it is allowed to connect. A hub MUST NOT require a client to skip a rung to participate at all.

## 9.7 The oscillator *(RFC-103)* {#s9-7}

A hub MAY carry an **oscillator**: a hub-side periodic motion generator, **additive on the commanded position of whatever owns the rail** — a stroke, a jog, a stream, a hub generator, or rest — bounded by the travel window and the ceilings exactly as every other motion is. It exists because a script's rapid section (30 to 50 Hz) streamed as segments is a hundred planned trajectories a second for motion that is one periodic function, and every hub caps segment ingress ([§10.5](qos.md#s10-5)) somewhere below that. **It is an additional feature.** A script's rapid motion on the main axis is rendered by the planner as well as it can in any case; nothing routes vibration to the oscillator on the hub's own initiative, and only an author who opts in (the script axes, below) gets the oscillator on top.

**The intent.** The oscillator is one INTENT entry whose schema fields carry the `osc.*` roles (registry `field_roles`), each found by role, never by name or key: `osc.enabled` (bool); `osc.frequency` (f32, Hz, `0` .. `osc_max_hz`); `osc.amplitude` (f32, a share of the travel window, `0` .. `1`: the **peak** displacement from the planned position, so the swing is twice it; a client shows millimeters); `osc.shape` (a select over registry `osc_shapes`: `0` `sine`, `1` `square`, `2` `saw`, `3` `saw_reverse`); `osc.dwell_crest` and `osc.dwell_trough` (f32, two decimals, `0` = no hold: the share of the moving cycle held at that extreme, added to it as RFC-095's dwells add to a stroke, so the period becomes `(1 + dwell_crest + dwell_trough) / frequency` and the moving halves keep their speed; a square with dwells is a pulse-width control). Writes are ordinary intents ([§9.3](#s9-3)): `control` floor, clamped, echoed post-clamp, published on the entry's STATE twin. **`osc_max_hz`** is a WELCOME `limits` key (7, [§6.3](session.md#s6-3)): the highest frequency the hub renders, from its own measurement, never a registry constant; `osc.frequency` is clamped to it. A hub without an oscillator carries neither the entry nor the key. `osc.enabled` is never persisted: a hub boots with it false.

**Shapes.** Every period starts at the trough, rising. Every shape is band-limited by construction: a square's edges and a saw's flyback are jerk-limited quintic ramps, and a dwelled sine renders its halves as rest-to-rest quintics so a hold is reached at rest in acceleration. A saw arrives at its extremes moving, so it has no rest to hold: the saw shapes ignore both dwells, a constraint of the shape rather than an option. `saw` rises over most of its period and flies back; `saw_reverse` is its mirror in time.

**Driven parameters.** `osc.frequency` and `osc.amplitude` each carry a drive and four map bounds on sibling fields of the same entry: `osc.frequency.drive`, `osc.frequency.in_min`, `osc.frequency.in_max`, `osc.frequency.out_min`, `osc.frequency.out_max`, and the same five under `osc.amplitude`. The drive is a select over registry `osc_drives`: `0` `fixed` (the parameter is its own field's value; the bounds are unused), `1` `speed` (the magnitude of the commanded speed the oscillator rides, in the unit of the hub's `telemetry.velocity` field), `2` `position` (the commanded position it rides, in the unit of `telemetry.target`), `3` `axis` (the external axis, below). A driven parameter is `L(in)` of [§8.11](catalog.md#s8-11)'s `linear_clamp`, with the same clamp rule and `in_min ≠ in_max`, the output finally clamped into the parameter's own range. The drives read the planned motion, never measured telemetry, so no drive closes a loop through the plant.

**The external axis.** `axis` reads a c2h `samples`-kind STREAM entry carrying the channel role `osc.drive` (registry `channel_roles`; the reference hub names its entry `osc-drive`), whose layout the role fixes: `amplitude` (f32, `0` .. `1`) then `frequency` (f32, `0` .. `1`), each mapped through its own parameter's bounds. A client publishes it under the ordinary grant rules ([§6.2](session.md#s6-2), [§10.5](qos.md#s10-5)), and its bundles are timed as any `samples`-kind c2h bundle ([§5.4](wire-format.md#s5-4)). It carries no `input.target`, so it is never motion input and never owns the rail. Once the stream has been quiet for `stream_quiet_release_ms`, an `axis`-driven parameter reads `0`: silence ends the oscillation as silence stills every stream.

**Scripts.** The Valence script conventions reserve funscript axes **`V8`** (oscillation amplitude) and **`V9`** (oscillation frequency) for the oscillator; until the script standard is written, this paragraph is the reservation's home. A player publishes those two axes as the `osc.drive` stream with `shape` fixed at `sine` and drives nothing else of the oscillator from a script. It is safe by construction: a script is open-loop data, the stream has the token bucket, the deadman and the quiet release of every stream, and the oscillator is bounded by the window and the ceilings. The reference consumer is Phosphor's funscript player.

**The sum, and who yields.** The oscillator sums with every source, a running stream included: a 50 Hz script section on the main axis under a 50 Hz oscillator is the author's double count, not the hub's to prevent. The sum is bound to the accel and jerk ceilings by construction because **the oscillator yields first**: at every instant the planned motion keeps its amplitude and the oscillation is shed, the rendered amplitude being the largest that keeps the sum under every ceiling, down to nothing under a full-speed stroke. The oscillator **never leaves the travel window**: its amplitude is bounded by the planned position's distance to either bound, never cut at the bound, and override ([§11.1](safety.md#s11-1)) does not lift this — an oscillation outside the window is never wanted.

**Telemetry.** The entry's STATE twin carries `osc.active` (bool: enabled and rendering a nonzero amplitude this instant) and `osc.amplitude_effective` (f32, window share: the amplitude the ceilings and the window left after shaping, `0` while inactive), so a client shows what the machine is doing rather than what was asked. Where shaping cut the amplitude, the plan's `clamped` flag (`plan.flags` bit2, RFC-100) is set.

**Ownership and safety.** The oscillator owns nothing: it rides whichever source owns the rail and stops when the rail goes idle — unless it is `enabled` while the rail is idle, in which case it oscillates about the rest position and holds a `control-owner` slot as a jog does (`source_kinds` `jog`, [§11.4](safety.md#s11-4)), released when it is disabled. **PAUSE and ESTOP zero it** ([§11.1](safety.md#s11-1)): under either latch it renders nothing — `osc.amplitude_effective` reads `0`, `osc.active` reads false and the phase restarts at the trough — its parameters untouched, and it renders again when the rail moves again, with whatever owns the rail then. **A deadman disables it**: when the session that last set `osc.enabled` ends by any [§6.9](session.md#s6-9) door, the deadman included, the hub clears `osc.enabled` (a hub-side change, published on the STATE twin, `cfg_gen` advanced) as it releases every source that session held, so no oscillation outlives the hand that enabled it.
