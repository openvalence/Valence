---
title: Safety
description: >-
  Valence clause 11: the stop taxonomy and safety snapshot, ESTOP end to end,
  the deadman, control arbitration, and the invariants under partial failure.
register: IEEE
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

# 11. Safety *(normative)* {#s11}

## 11.1 The stop taxonomy and the safety snapshot {#s11-1}

Two levels, both latched in the `safety` STATE channel, both initiable via the `safety-intents` INTENT channel (RFC-085; STOP and HOLD were retired pre-tag):

| Level | Meaning | Motion behavior | Clears by |
|---|---|---|---|
| **ESTOP** | Emergency stop, latched | Motor power cut where the hub declares `estop_cuts_power`, else a maximum-deceleration halt ([§11.2](#s11-2)); motion prohibited while latched | `release` ([§11.2](#s11-2) preconditions), which lands in PAUSE |
| **PAUSE** | The one latched non-emergency level | Decelerate to zero at configured decel, then actively hold position; every source suspended | `resume` only |

Three op pairs drive the snapshot, each the two states of one control (RENDERING.md law 14): **pause / resume**, **override / return**, **estop / release**.

- **PAUSE suspends every source.** While PAUSE is latched a hub MUST NOT act on c2h motion-input bundles (`samples` or `segments` kind, on any channel the application maps to a source, [§11.4](#s11-4)): each is dropped whole and counted, exactly as [§9.2](channels.md#s9-2)'s ingress drops are, in the hub's existing stream-drop counter where it publishes one (no new registry counter). It is never NACKed: a per-bundle NACK at stream rate is the storm the [§9.2](channels.md#s9-2) carve-outs avoid, and the latched `safety` snapshot is the signal ([§9.4](channels.md#s9-4)) (RFC-074 clauses 1, 2 and 4). A hub-autonomous generator parks at a safe phase. Motion INTENTs are refused `INTERLOCK`, except the home verb (`action.home`, admitted under PAUSE whether or not the hub is unhomed) and, under override, jog. A pause releases no ownership: the owning session keeps its source, suspended.
- **Only `resume` clears PAUSE.** No motion intent, no stream bundle and no PUBLISH clears it; RFC-074's clause 3 re-arm is `resume`, with no PUBLISH side effect and no new op. `resume` is refused `ESTOP_ACTIVE` while ESTOP is latched, `INTERLOCK` while override is latched, and `NOT_HOMED` while the hub is unhomed (`home_required`). A client MUST NOT send `resume` on its own initiative: resuming is an operator act, or PAUSE is decorative.
- **Authorization.** `pause` (op 4) is ROLE-EXEMPT, like `estop` ([§11.2](#s11-2)'s "you may always stop the machine; you may not always start it"): any session, `watch` included, may pause. `resume` (op 5) requires `control`.
- **A hub with a motion source MUST implement PAUSE.** It is half of the persistent strip's mandatory pair. A hub whose application does not implement override (no rail control) NACKs `override` with `UNSUPPORTED_OP` and latches nothing.
- **Causes.** `cause` separates an operator pause (`user`) from `deadman` and `session_loss`. ESTOP's causes are `user`, `fault` and `relay`; session loss and the deadman latch PAUSE, never ESTOP, wherever a hub latches anything for them ([§11.3](#s11-3) unchanged: a command-driven source latches nothing at all).

**The hub latches both levels and the override mode.** Delegate/application acceptance is what triggers the latch; a hub whose application refuses an op latches **nothing**.

The `safety` snapshot carries: the level bits (`word`: bit0 ESTOP, bit3 PAUSE; bits 1 and 2, formerly STOP and HOLD, are retired and zero on send), `cause` (a `safety_causes` value), the owning `session_id` where applicable, `estop_seq`, and the appended **modes** bitfield: bit0 `override`, bit1 `home_required` (set by an ESTOP on a hub declaring `estop_cuts_power`, cleared by a completed home, so the snapshot alone explains a `NOT_HOMED` refusal).

**OVERRIDE and RETURN: one rail-bound mode** (RFC-085; the former `manual_override` and `bypass_limits` modes merged).

- **`override` carries PAUSE.** Accepting `override` latches PAUSE as a side effect if it is not already latched; override never exists without PAUSE. PAUSE alone stops the machine in place; override additionally hands the rail to the operator, lifts the travel window and the hub's soft limits (hardware protection is untouched, H1) and enables **jog**. The hub records the **paused position**, where the machine came to rest.
- **Jog is the operator's hand on the rail.** Under override, a jog (a manual point move at jog speed and jog accel, the `limit.jog.*` roles) is the only motion the hub accepts, inside or outside the travel window as the operator chooses. The suspended source stays suspended, so hand and stream never command position at once.
- **`return`** arms a smooth move back to the paused position at jog speed and accel; jog is refused while it runs. On arrival the override bit clears and the machine is in plain PAUSE awaiting `resume`. Override is held until `return` arrives. Both ops require `control`; return takes no further gate.
- **The travel window stays writable at any time** (the `window.*` roles): while a source owns the rail, while paused, and under override. Only jog is gated.
- **ESTOP drops override.** An ESTOP latch clears the override bit; release lands in plain PAUSE.
- **No per-move bypass.** The per-move `bypass` key on a motion intent is retired: a jog under override is already outside the limits by mode.
- **Bound to the rail.** The pair is an essential binding of the `axis` archetype (RENDERING.md §8.4); a client with no rail control declines it (law 7). It is not a safety-strip control.

Override and `home_required` are latched **modes**, not stop edges, and deliberately have no event kind: giving them one would imply an operator action that a hub-side reconciliation (an e-stop dropping override as a side effect) did not have.

## 11.2 ESTOP end-to-end {#s11-2}

- **Initiation:** any endpoint, any tier, any session state — including *no* session (a paired relay may originate). **Safety outranks authorization by design: you may always stop the machine; you may not always start it.**
- **Two initiation paths, one behavior:**
  1. the raw **ESTOP frame** ([§5.5](wire-format.md#s5-5)) — the deframed-path and relay guarantee, recognizable by a byte scanner without a session;
  2. the **`estop` op** on the `safety-intents` channel — the trivially-implementable client path. A hub MUST treat it **exactly as a valid ESTOP frame**: same latch, `cause = user`, same publish, same edge event. Implementations SHOULD dispatch it through the same function as the frame path, so that "exactly as" is true by construction rather than by a parallel implementation.
  Without path 2, a client's red button silently degrades to a decel-stop — a ground-truth violation on a machine where the difference matters.
- **Latch is the acknowledgment.** The initiator MUST repeat its ESTOP every `estop_repeat_interval_ms` (50 ms), up to `estop_repeat_max` (20), until it observes `safety` STATE with the ESTOP bit latched and `estop_seq ≥ ` its sent seq — or exhausts retries and surfaces a **loud local failure**. There is no ESTOP-ACK frame; the observable latch is the only acknowledgment that means anything. All repeats of one initiation carry the same `estop_seq` ([§5.5](wire-format.md#s5-5)).
- **Hub obligations:** on first valid ESTOP (CRC-checked), stop motion via the driver's e-stop path **before** any protocol bookkeeping; latch; publish `safety` STATE at critical priority to all subscribers; emit the `estop_latched` edge on the safety-events channel.
- **A declared stop category (RFC-085).** A hub DECLARES whether its ESTOP cuts motor power, as the boolean `estop_cuts_power` in WELCOME `identity` (37, sub-key 6): a property of the hub, not of a transport, known before LIVE so a client's first paint labels the control correctly. The declaration is the firmware author's responsibility and is REQUIRED of a hardware-profile hub ([§13.1](transports.md#s13-1)); the spec mandates the declaration, never the mechanism. A client MUST treat an absent key as `false`.
  - **`true`: power cut.** ESTOP opens the motor switch (the H1 path): the machine goes limp, with no holding torque, its position reference is lost, and the hub marks itself unhomed (`home_required`). An IEC 60204-1 category 0 stop, chosen because a person is on the rail.
  - **`false`: halt.** ESTOP is a maximum-deceleration controlled stop, latched exactly as above, with power and home kept.
  - Same op, same frame, same latch, same repeat rule either way; only the label (RENDERING.md law 15) and the release landing differ.
- **Relay obligation:** forward ESTOP ahead of all buffered traffic, immediately, on all attached segments ([§14.2](transports.md#s14-2)) — including *upstream* if relay-originated.
- **HONESTY CLAUSE (H2) — preemption scope.** "Jumps the queue" is a **per-hop** guarantee: each hop's transmit queue admits ESTOP at the front. It is not magic end-to-end latency — TCP bytes already in flight ahead of it still drain first. Worst-case added latency per binding is declared in [§13.1](transports.md#s13-1).
- **HONESTY CLAUSE (H1).** The **hardware** e-stop path remains the guarantee of last resort. Valence's ESTOP is a software convenience layered above it and MUST NOT be presented to a user as a substitute for it.
- **Release:** the `release` op (1, formerly `estop_clear`) requires `control`; the hub MUST refuse with `CLEAR_REFUSED` unless (a) the latched cause is resolved (fault: the fault flag is gone) and (b) motion is at zero velocity. **Release lands in PAUSE, never in motion**: it only re-arms the ability to start, and `resume` is the separate operator act that starts. On a hub declaring `estop_cuts_power`, release restores power with the hub unhomed: the home verb is the one motion accepted, and `resume` is refused `NOT_HOMED` until a home completes. Sequence: estop, Halted, release, PAUSE unhomed, home, resume. On a `false` hub release lands in PAUSE homed. The `estop_cleared` edge says the latch is gone, never that the machine moved.
- **A hub MUST NOT let a catalog authoring error widen safety authorization.** The `control` floor on `release` and `resume` (and on any op whose effect is to re-arm motion) is a hub obligation independent of what the hub's own catalog declares about it. The catalog is the *discovery* surface for per-op access; it is not the only enforcement point for the ops that can start a machine moving again.

## 11.3 Deadman {#s11-3}

The deadman binds to the **active motion source**, not to sessions in general ([§6.6](session.md#s6-6) gives the other regime).

- Every session that owns an active source has a deadman window: `deadman_ms`, default 600, clamped to `[deadman_min_ms, deadman_max_ms]` = 250–5000, negotiated at WELCOME. Silence beyond the window — no frame of any kind, [§6.6](session.md#s6-6) — fires the deadman.
- **The window is negotiable.** HELLO MAY carry `deadman_wish_ms` (44). The hub clamps the wish into `[deadman_min_ms, deadman_max_ms]` — a hub MAY clamp tighter — and the APPLIED value is echoed on WELCOME `deadman_ms` (24), which was already the echo: post-clamp ground truth, zero new response plumbing. It exists because browsers throttle background-tab timers: a client that *knows* its liveness cadence is coarse could not previously ask for a window it can actually honor, and either hacked around eviction or flooded PINGs.
- **RFC-045: the deadman is liveness bookkeeping. It forces no stop, on any source class.** The session that owned the source is torn down exactly as any other teardown ([§6.9](session.md#s6-9)) and the source's ownership is released, unconditionally, so another authorized session may claim it — but *what happens to motion* is decided per source class, never by the deadman itself:
  - **Command-driven sources** (a motion stream, a manual jog, a live remote) latch **nothing**: no PAUSE, no safety-word bit, no `cause=deadman` entry in the `safety` snapshot. The machine only ever moves because something commanded it ([§9.6](channels.md#s9-6)'s closed motion surface: every mode is either a continuously-fed stream or an individually time-bounded segment), so a silent source has nothing left to execute — the last accepted command already runs out and the machine settles to rest with no further input required. A silent client is, by construction, not commanding motion; forcing a STOP on top of that converts an unremarkable absence of new commands into a manufactured, operator-visible safety edge for a machine that was never out of control.
  - **Hub-autonomous sources** (a pattern generator running on the hub, or any future on-hub script/scene player) are the one real exception, because for these "the client that pressed start went quiet" genuinely does not imply "motion should stop" — the generator runs *on the hub*. Behavior here is an explicit, catalog-declared per-source setting carrying the registered field role **`source.background_run`** (bool, RFC-048; registry `field_roles` — promoted from this RFC's original unregistered `on_disconnect: stop | continue` framing so a generic client can find the control on *any* hub without hardcoding its channel, the same upgrade `command.*` and `plan.*` already got). Rendered through the ordinary settings metamodel ([§8.8](catalog.md#s8-8)) — this remains device-declared data, not a new protocol frame. **`false` is the default** (conservative, hub-flippable): the generator stops. `true` leaves the generator running in the background, unowned, reachable at any moment by the role-exempt `pause`/`estop` ops ([§11.1](#s11-1), [§11.2](#s11-2)) from **any** connected session including a bare `watch` viewer. **Phase D correction:** an earlier draft of this text said the `false` case latches STOP with `cause = deadman`. It does not, and MUST NOT: the library stays generic here exactly as it does for a command-driven source — `Hub::releaseSessionSources()` only ever calls `onSourceOwnership(source, 0, reason)`, latching nothing, for every source class alike. Whether and how to stop calling into the generator is entirely the FIRMWARE DELEGATE's decision inside that one hook, symmetric with a command-driven source settling with no safety edge: an autonomous generator that stops being driven is, in the same sense, "already stopped" — manufacturing a safety-word edge for it would be the identical mistake [§11.3](#s11-3)'s own "why this changed" note already rejects for streams. A hub wanting an operator-visible edge for this case MAY still publish one through its own STATE/EVENT surface; the protocol does not manufacture it. Streaming sources are explicitly out of scope for this role — a dead stream leaves the machine still by construction (SETTLE, above), so no switch exists or is wanted for them; continuation only ever needs an explicit, visible choice where a live source keeps generating its own motion. Rendering rules (placement, confirm-gating, the unattended-and-moving indicator) are normative in `RENDERING.md` §10.1. The recourse for autonomous motion was never "wait for its owner" — it was always "anyone in the room can stop it."
  - Ownership release is **unconditional** either way ([§11.4](#s11-4)) — that half of the deadman's job is unchanged.
- **Legacy edges get synthetic sessions with equivalent timeouts** ([§15.1](legacy.md#s15-1)). There is **no unmonitored path to motion** — releasing ownership on silence, unconditionally, is what makes that true; forcing a stop was never required to make it true.

*Why this changed (informative).* An earlier design forced a STOP latch on every command-driven deadman fire. Under a clocked interpolator that had a real job: a starved generator could plausibly keep commanding motion on its own. Under an intent-based planner — one command produces one bounded plan, and execution never invents motion between commands ([§9.6](channels.md#s9-6)) — that hazard does not exist: a plan that runs out of fresh input already settles to rest by construction, so the forced latch only ever converted a graceful settle into a spurious, operator-visible STOP edge (auto-cleared the moment a resuming stream's first bundle landed) on a machine that had never actually left the operator's control. Treating the window as a hard safety deadline was also never physically honest: browsers throttle a backgrounded tab's timers to roughly one callback per **minute**, so no value legal under the 250–5000 ms clamp could survive a locked screen, and a value fast enough to matter as a safety limit is far too fast to avoid punishing an operator who merely alt-tabbed. The deadman keeps its liveness job — slot/ownership bookkeeping, `control-owner` accuracy — and sheds the safety job it was never actually doing for command-driven sources.

## 11.4 Control arbitration {#s11-4}

A machine's arbiter assigns priorities *between source types*. Valence adds the layer an arbiter cannot provide: arbitration *within* a type.

- **The sole-caller rule is a protocol obligation.** Valence sessions submit intents to the machine's motion arbiter, which is the only component permitted to command the driver. A hub that lets any session reach the driver by another path is non-conformant.
- **Exclusive ownership.** Each source has at most one owning session at a time, published in the `control-owner` STATE channel. The first authorized session to activate a source owns it; a second session's activating intent gets NACK `SOURCE_CONFLICT`.
- **STREAM channels mapped to a source** participate on the same machinery: the **first accepted bundle** acquires the source, each subsequent accepted bundle refreshes the deadman window ([§6.6](session.md#s6-6): any received frame is proof of life), and a bundle from a non-owner while the source is owned is dropped — with the [§9.2](channels.md#s9-2) `SOURCE_CONFLICT` signal so the producer is not left guessing. Data-plane bundles carry no takeover flag; a would-be taker acquires through an intent.
- **TAKEOVER:** re-issuing the activating intent with `takeover: true` (32) transfers ownership if the requester's tier ≥ the owner's. The hub emits a takeover EVENT and a `control-owner` STATE update; the dispossessed session's UI MUST reflect loss of control immediately — it is subscribed to the same channel as everyone else, so this requires no message addressed to it. Takeover *between* source types remains the arbiter's priority logic, with one exception (RFC-085): **a jog never takes the rail from a source.** While any source owns the rail and override is not latched, a jog intent is REFUSED `SOURCE_CONFLICT`; override ([§11.1](#s11-1)) is the only way the operator takes the rail from a source. A manual point move on an idle, unpaused, unowned rail is an ordinary source activation under the rules above.
- **Release** happens on every teardown path identically ([§6.9](session.md#s6-9)), on deadman fire, and on an explicit release intent. **Post-deadman reacquisition requires a fresh activating intent** ([§6.8](session.md#s6-8)) — never a silent resume.
- **Tiers gate the door.** Activating any source requires `control`. A `watch` session cannot own a source, full stop — but it can still stop the machine ([§11.2](#s11-2)).

## 11.5 Invariants under partial failure {#s11-5}

Whatever dies — a client, a relay, a transport, the network — all of the following MUST hold:

1. Motion driven by a vanished command-driven source runs out of fresh commands and settles to rest on its own within its deadman window (RFC-045) — no protocol-forced stop is needed for this to hold, because [§9.6](channels.md#s9-6)'s closed motion surface bounds every mode a source can use.
2. The ESTOP latch, once set, survives every reconnect and is adopted by every arriving client **before it can act** — retained STATE plus the readiness gate ([§6.4](session.md#s6-4)) plus the LIVE gate ([§2.2](foundations.md#s2-2)) together guarantee this, which is why the readiness gate covers the intent plane and not only the data plane.
3. A relay's death makes its clients *silent*, which triggers the same deadman path as client death. The hub cannot distinguish them and does not need to.
4. No failure mode results in a client displaying motion as stopped while the machine moves, because displays render only adopted hub state and go visibly stale when the link dies.
5. Every session-end path releases ownership identically ([§6.9](session.md#s6-9)), so no departed session can hold a source hostage.

## 11.6 Accessories under the stop taxonomy *(RFC-078)* {#s11-6}

The accessory interlock is hub policy and never depends on a client session, exactly as the relationships it governs ([§8.11](catalog.md#s8-11)). An accessory host MUST:

- **While ESTOP is latched** in `safety` (`0x0003`): disarm every relationship; drive every relationship target to its `safe` value (accessories also self-safe on the broadcast ESTOP frame, [§13.3](transports.md#s13-3).1); refuse client writes to actuating accessory fields with `ESTOP_ACTIVE`.
- **On PAUSE latching:** disarm every relationship and drive every target to its `safe` value, once. PAUSE does not refuse later direct client writes: under pause they are the operator's own act, allowed.
- **Arming is `resume`.** The `resume` op, the one explicit operator act that clears PAUSE ([§11.1](#s11-1)), arms every enabled relationship, the same operator-act principle [§11.1](#s11-1) applies to streams. Nothing else arms one: an ESTOP release lands in PAUSE and arms nothing ([§11.2](#s11-2), applied to accessories), a reboot leaves every relationship disarmed, and saving an enabled relationship arms it only at the next `resume`.
