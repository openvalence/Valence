---
title: Catalog vocabulary
description: Generated tables of packed field types, field roles, setting categories, setting flags and procedure phases.
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

# Catalog vocabulary

The catalog describes what a hub's channels **are**. These are the
registered words it uses to do that.

## Packed field types

A packed layout has static field offsets. Every type below is
fixed-width, which is what makes append-only evolution safe.

| Value | Type | Notes |
|---|---|---|
| `0` | `u8` |  |
| `1` | `i8` |  |
| `2` | `u16` |  |
| `3` | `i16` |  |
| `4` | `u32` |  |
| `5` | `i32` |  |
| `6` | `f32` |  |
| `7` | `bitfield8` | bit meanings enumerated in catalog entry |
| `8` | `str16` | 16 bytes, zero-padded UTF-8 (RFC-026). The default string width: session-roster names, device names, secret settings. |
| `9` | `str32` | 32 bytes, zero-padded UTF-8 (RFC-026) |
| `10` | `str64` | 64 bytes, zero-padded UTF-8 (RFC-026). 26% of a 242 B snapshot: use deliberately. |

STREAM sample layouts stay string-free. The motion path never pays for
text.

## Field roles

A role is the semantic tag on a catalog field. It is a text string, not
a number, because action roles carry a device-chosen suffix.

Roles are **opportunities, never requirements**. A client that
recognizes a role may render a bespoke widget. A client that does not
must render it generically instead, by type and constraints. An unknown
role is never an error.

| Role | Meaning |
|---|---|
| `limit.jog.speed` | speed ceiling of the JOG (manual) limit set: jog moves and the override `return` run at it. CEILING, never a target. RFC-085 renamed it from limit.user.speed. |
| `limit.jog.accel` | accel ceiling of the jog limit set. RFC-085 renamed it from limit.user.accel. |
| `limit.input.speed` | speed ceiling of the INPUT (machine-driven: patterns, streams, TCode) limit set |
| `limit.input.accel` | accel ceiling of the input limit set |
| `limit.input.jerk` | jerk ceiling of the input limit set |
| `geometry.max_travel` | the configured travel ceiling: how far the machine's rail geometry allows it to search/move (0x0081 max_rail is the worked example: also the sensorless-homing search sweep bound). Distinct from window.min/max, which is the operator-chosen SUB-range within this travel. |
| `geometry.measured_travel` | the usable travel a real home actually measured between the two hard stops, as opposed to geometry.max_travel's configured ceiling. Zero/absent-of-meaning until the first successful home this session; a client MUST NOT treat zero as a real measurement. |
| `window.min` | stroke window lower bound. Limits normalized against the window are window-relative and therefore MOVE when it does: which is exactly why this is a STATE field and not a one-shot WELCOME value. |
| `window.max` | stroke window upper bound |
| `telemetry.position` | live actuator position |
| `telemetry.target` | RFC-032: the position the machine is currently COMMANDED to, as opposed to telemetry.position which is where it measurably is. Lag is deliberately NOT a role: it is target - position, computed client-side: registering a third field for a subtraction would invite two sources of truth for one number. |
| `telemetry.velocity` | live actuator velocity |
| `telemetry.current` | motor/drive current |
| `telemetry.power.bus` | DC bus voltage or power |
| `telemetry.temp` | a temperature reading; the field's own name/unit says which |
| `telemetry.uptime` | hub uptime |
| `identity.name` | the writable machine-name setting (RFC-026 tier 2, str16/str32). Its READ-ONLY twin is WELCOME identity.hub_name. |
| `meta.enabled_mask` | RFC-009.4: a bitfield8 field whose bit i gates the i-th setting-annotated field of the SAME layout. On-change, retained, conflated: every client grays from one ground truth. Disabled means GRAY, never hide. |
| `meta.trial_pending` | RFC-099 (§8.8): a bitfield8 field whose bit i marks the i-th setting-annotated field of the SAME layout as holding a TRIAL value (cbor_keys 51), any session's: indexed exactly as meta.enabled_mask. On-change, retained. A set bit means the effective value shown is not the stored one and reverts when its trial ends. |
| `meta.reset_gen` | RFC-019: increments on every applied reset in this counter group, so ALL subscribers observe the reset, not just the sender who asked for it. |
| `pattern.running` | whether the built-in (classic) pattern generator is currently driving the machine. The advanced generator has its own advgen.running (RFC-093). |
| `pattern.select` | which built-in pattern the generator plays; options are the device's pattern names, index-aligned with the wire value |
| `pattern.speed` | pattern generator speed knob, as a percentage of its own range |
| `pattern.depth` | pattern generator depth knob: how far into the stroke window it reaches |
| `pattern.stroke` | pattern generator stroke-length knob, as a percentage of the available depth |
| `pattern.sensation` | pattern generator character knob; what it changes depends on the selected pattern |
| `command.position` | RFC-032: INTENT field carrying a commanded ABSOLUTE target position in the channel's own unit. A client that finds it MAY render a positional control (rail, tape, slider) and send the value on that field's channel. |
| `axis.flipped` | RFC-088 (§9.6): a stored, writable bool (or two-option select) setting: the rail's direction flip. On, position 0 is the far end; the hub mirrors telemetry, the travel window and every c2h target against geometry.measured_travel. A change is refused SOURCE_CONFLICT while a source owns the rail, NOT_HOMED while unhomed, INTERLOCK under override or in motion. Rendered as the confirm-gated Flip toggle on the axis control row. |
| `input.target` | RFC-071: the commanded position of a motion-input sample or segment, in the field's own unit and scale. REQUIRED on a c2h STREAM entry that accepts motion. |
| `input.velocity` | RFC-071: a samples-kind point's instantaneous velocity hint. Optional; a client that does not understand it leaves the field at its unspecified sentinel (§5.4). |
| `input.duration` | RFC-071: a segments-kind sample's commanded time extent |
| `input.end_velocity` | RFC-071: a segments-kind sample's velocity at its end (the §9.6 handoff); its type minimum means unspecified (RFC-058) |
| `plan.start` | normalized start position of the segment in flight |
| `plan.end` | normalized end position of the segment in flight |
| `plan.current` | normalized current position along the plan |
| `plan.velocity` | current planned velocity |
| `plan.elapsed` | elapsed time within the segment in flight |
| `plan.duration` | total duration of the segment in flight |
| `plan.latency` | RFC-059: optional live telemetry twin of a grant's schedule_latency_us (cbor key 49), for diagnostics and generic renderers. Not required for conformance. |
| `plan.style` | which planning style produced the segment; options are the device's style names, index-aligned with the wire value |
| `plan.flags` | RFC-100 (§8.8): bitfield8, bits per plan_flags: set when a segment plans, from that plan, cleared when the next segment plans clean, zero while no plan is in flight. A segment planned ahead of its start sets it then, up to one schedule horizon early. A client reads the plan as infeasible when any of bits 0-3 is set; there is no plan.feasible role (one field, one source of truth). |
| `advgen.running` | RFC-093: bool, the advanced generator's own run/stop (essential binding of generator-advanced). The advanced generator is a separate §11.4 source: starting it while the classic generator (pattern.running) owns the rail is refused SOURCE_CONFLICT until that one stops, and vice versa. No auto-handoff. |
| `advgen.master` | RFC-081: overall rate scale of the advanced program, percent of its own range |
| `advgen.depth_max` | RFC-081: the deep stroke bound the program swings to, percent of the stroke window |
| `advgen.depth_min` | RFC-081: the shallow stroke bound the program swings to, percent of the stroke window |
| `advgen.speed_in` | RFC-081: inward stroke speed base |
| `advgen.speed_out` | RFC-081: outward stroke speed base |
| `advgen.accel_in` | RFC-081: inward acceleration base |
| `advgen.accel_out` | RFC-081: outward acceleration base |
| `advgen.dwell_crest` | RFC-095: hold at the deep bound (advgen.depth_max) after the inward half completes and before the reversal, unit strokes (the period of one stroke as the clock, two decimals), 0 = no hold. Additive: the stroke period grows by the dwell, the moving halves keep their speed and acceleration, and one stroke on the modulators' clock (RFC-066) is the whole cycle, both dwells included. A modulator whose mod_target is a dwell varies it per stroke. Optional binding of generator-advanced. |
| `advgen.dwell_trough` | RFC-095: hold at the shallow bound (advgen.depth_min) after the outward half completes and before the reversal, unit strokes (the period of one stroke as the clock, two decimals), 0 = no hold. Additive, as advgen.dwell_crest. Optional binding of generator-advanced. |
| `mod.amount` | RFC-066: how far the modulator swings its target, in the target's terms; 0 = no modulation |
| `mod.rise` | RFC-066: duration of the rising leg of the cycle (field unit: strokes or seconds) |
| `mod.hold` | RFC-066: dwell at the top of the cycle (field unit: strokes or seconds) |
| `mod.fall` | RFC-066: duration of the falling leg of the cycle (field unit: strokes or seconds) |
| `mod.rest` | RFC-066: dwell at the bottom of the cycle (field unit: strokes or seconds) |
| `mod.phase` | RFC-066: offset of this modulator's cycle start (field unit: strokes or seconds) |
| `mod.shape` | RFC-066: optional select naming the cycle shape; absent = the cycling trapezoid (rise, hold, fall, rest) |
| `osc.enabled` | RFC-103: bool, the oscillator runs. Never persisted (false at boot); cleared by the hub when the session that set it ends by any §6.9 door, the deadman included. |
| `osc.frequency` | RFC-103: f32, Hz, 0 .. WELCOME limits osc_max_hz (key 7), clamped. The moving part of one cycle takes 1 / frequency; dwells stretch the period beyond it. Driven by osc.frequency.drive. |
| `osc.amplitude` | RFC-103: f32, a share of the travel window, 0 .. 1: the PEAK displacement from the planned position (the swing is twice it). The client shows millimeters. What the ceilings and the window leave of it is osc.amplitude_effective. Driven by osc.amplitude.drive. |
| `osc.shape` | RFC-103: select over osc_shapes (0 sine, 1 square, 2 saw, 3 saw_reverse); the wire value is the table value. Every period starts at the trough, rising; every shape is band-limited by construction (§9.7). |
| `osc.dwell_crest` | RFC-103: f32, two decimals, 0 = no hold: the share of the moving cycle (1 / frequency) held at the crest, added to it as RFC-095's dwells add to a stroke, so the period becomes (1 + dwell_crest + dwell_trough) / frequency and the moving halves keep their speed. A dwelled sine renders its halves as rest-to-rest quintics. The saw shapes ignore both dwells (a saw arrives at its extremes moving). |
| `osc.dwell_trough` | RFC-103: f32, two decimals, 0 = no hold: the share of the moving cycle held at the trough, as osc.dwell_crest. A square with dwells is a pulse-width control. |
| `osc.frequency.drive` | RFC-103: select over osc_drives: what sets osc.frequency. fixed = the field's own value (the bounds unused); speed, position = the planned motion the oscillator rides; axis = the osc.drive stream's frequency field. The other three map the drive's input through osc.frequency.in_min/in_max/out_min/out_max as §8.11's linear_clamp, the output clamped into 0 .. osc_max_hz. |
| `osc.frequency.in_min` | RFC-103: f32, the drive's input at which osc.frequency reads out_min (the drive's own unit: telemetry.velocity's for speed, telemetry.target's for position, 0 .. 1 for axis) |
| `osc.frequency.in_max` | RFC-103: f32, the drive's input at which osc.frequency reads out_max; in_min != in_max |
| `osc.frequency.out_min` | RFC-103: f32, Hz, the frequency at in_min |
| `osc.frequency.out_max` | RFC-103: f32, Hz, the frequency at in_max |
| `osc.amplitude.drive` | RFC-103: select over osc_drives: what sets osc.amplitude, as osc.frequency.drive; axis = the osc.drive stream's amplitude field; the output clamped into 0 .. 1. |
| `osc.amplitude.in_min` | RFC-103: f32, the drive's input at which osc.amplitude reads out_min (the drive's own unit, as osc.frequency.in_min) |
| `osc.amplitude.in_max` | RFC-103: f32, the drive's input at which osc.amplitude reads out_max; in_min != in_max |
| `osc.amplitude.out_min` | RFC-103: f32, window share, the amplitude at in_min |
| `osc.amplitude.out_max` | RFC-103: f32, window share, the amplitude at in_max |
| `osc.active` | RFC-103: STATE bool: the oscillator is enabled and rendering a nonzero amplitude this instant. False under PAUSE and ESTOP. |
| `osc.amplitude_effective` | RFC-103: STATE f32, window share: the amplitude the ceilings and the window left after shaping (the oscillator yields first), 0 while inactive. Where shaping cut it, plan.flags bit3 clamped (RFC-100) is set. |
| `store.slot` | RFC-089 (§8.7): uint, the item's slot in the writer's store. Required by load, delete and rename; optional on save (absent, the hub picks a free slot and ECHO `applied` carries it; no free slot is INVALID_VALUE with a detail naming the store full). Binds within the entry carrying the action.store op select. |
| `store.name` | RFC-089 (§8.7): text, the item's name, fitting the store's name_max. Required by save and rename. Binds within the entry carrying the action.store op select. |
| `store.item` | RFC-089 (§8.7): byte string carrying one whole store-item document (the blob_keys map: slot, name, kind, payload, optional digest), never the bare payload. Optional on save (absent, the hub captures live state; a store with no live state to capture requires it). Its slot and name MUST equal store.slot and store.name, else INVALID_VALUE. One frame: an item past the binding's max_frame is FRAME_TOO_LARGE. Binds within the entry carrying the action.store op select. |
| `color.red` | RFC-083: writable numeric red channel of one color group; color.red/green/blue together trigger the `color` archetype (all three essential) |
| `color.green` | RFC-083: writable numeric green channel of one color group |
| `color.blue` | RFC-083: writable numeric blue channel of one color group |
| `datetime.moment` | RFC-083: a scheduled moment in HUB TIME: whole seconds in the hub's §7.1 timebase (unit_ids hub_s), never Unix epoch. Valid for the current boot_id; a client re-arms after a hub reboot. Triggers the `datetime` archetype. |
| `datetime.start` | RFC-083: interval start, hub time seconds (as datetime.moment); with datetime.end in one group triggers the `datetime` archetype |
| `datetime.end` | RFC-083: interval end, hub time seconds (as datetime.moment) |
| `source.background_run` | bool, `setting_key`-annotated: whether THIS autonomous source keeps running when its owning session ends. false (DEFAULT) = the source stops when its controlling session ends. true = the source deliberately continues in the background, reachable only by the role-exempt pause/estop ops (§11.1, §11.2) from any session. Applies to any hub-autonomous source, never to a command-driven one. |

Two conventions extend the list without registering entries:

- `<role>.peak` is the peak companion of any telemetry role.
- `action.<name>` marks an INTENT field as a verb, not a value.

## Channel roles

A channel role is the entry-level `role` (catalog entry key 18). It
names the purpose of a whole channel, where a field role names one
field. The same doctrine applies: unknown roles render generically.

| Role | Meaning |
|---|---|
| `events.anomaly` | EVENT entry: edges reporting the machine did something other than what it was asked (a clamped command, a planner fallback, a rejected plan). A client giving anomalies a dedicated surface MUST bind by this role or core identity, never by name. |
| `anomaly.summary` | STATE entry: the latched counters twin of an events.anomaly channel (§9.4 duality rule), so the event log and its counters bind together. |
| `osc.drive` | RFC-103: c2h samples-kind STREAM entry, the external axis driving the oscillator. The role fixes the layout: amplitude (f32, 0 .. 1) then frequency (f32, 0 .. 1), each mapped through its parameter's own bounds where that parameter's drive is axis. Carries no input.target, so it is never motion input and never owns the rail. Quiet for stream_quiet_release_ms, an axis-driven parameter reads 0. The reference hub names its entry osc-drive. |

## Setting flags

| Mask | Bit | Name | Notes |
|---|---|---|---|
| `0x01` | `bit 0` | `advanced` | hide behind an 'advanced' affordance by default; NEVER remove from the surface |
| `0x02` | `bit 1` | `restart_required` | the applied value takes effect on the next boot (distinct from RFC-020's reboot_in_ms, which is the hub rebooting ITSELF to commit) |
| `0x04` | `bit 2` | `secret` | NORMATIVE (RFC-009.5): the value NEVER appears in STATE. The snapshot carries only a set/unset presence bit. Writes ride the paired INTENT normally and ECHO confirms application WITHOUT echoing the value: the applied key carries the CBOR value `true` in its place (RFC-069), and a client MUST accept `true` for a secret key whatever the field's type. A WiFi password must never ride a retained snapshot that open-access `watch` sessions receive. |
| `0x08` | `bit 3` | `destructive` | RFC-063: on a schema field with an `action.*` role, invoking the verb loses state the operator cannot restore from the client (configuration, stored items, counters, sessions, uptime); on a writable layout field, writing it has that effect. Rendering metadata only: a client MUST confirm-gate (RENDERING.md §8.4 `trigger`), a hub MUST NOT change wire behavior on it. Per-option form: schema-field `destructive_options` (SPEC §8.8). |

## Plan flags

The bits of the `plan.flags` field role (SPEC §8.8): how the planner
bent a segment in flight. Any of bits 0 to 3 means infeasible.

| Mask | Bit | Name | Notes |
|---|---|---|---|
| `0x01` | `bit 0` | `shaped` | the planner shortened the commanded stroke, or flattened its shape, to hold the deadline |
| `0x02` | `bit 1` | `stretched` | the segment runs past the commanded deadline |
| `0x04` | `bit 2` | `fallback` | the planner substituted its fallback method for the segment |
| `0x08` | `bit 3` | `clamped` | a ceiling or the travel window changed the command |

## Procedure phases

Only the lifecycle phases are registered. Any generic client can render
these without knowing the procedure. Values 128 to 255 are device-defined
intermediate steps. A client that does not recognize one renders it as
`running`.

| Value | Phase | Notes |
|---|---|---|
| `0` | `idle` | not running; the reconnect-safe resting value |
| `1` | `running` | started and in progress; `progress` 0-100 is advisory |
| `2` | `succeeded` | terminal, ok. Also EVENTed (RFC-020). |
| `3` | `failed` | terminal, error: `result` u16 carries a nack_codes value or a device code |
| `4` | `aborted` | terminal, canceled or superseded |

## Curve families

The `curve_family` sub-key is CBOR key 45, inside a `publishes` or `granted_publishes` entry. It names which smoothness class a segment stream's sender means. The wish rides on HELLO or PUBLISH. The grant echoes the effective family, so a client can tell honored from downgraded.

| Value | Family | Notes |
|---|---|---|
| `0` | `unspecified` | the compatible default: the hub behaves exactly as it did before RFC-030. What every pre-RFC-030 client is. |
| `1` | `c1_cubic` | velocity-continuous cubic (Linear/Pchip/Makima/monotone-cubic senders). Acceleration lawfully STEPS at knots; a follow-client hub reconstructs C1 and does NOT smooth the corner the author put there. |
| `2` | `c2_quintic` | curvature-continuous; the sender means the smoothness. A follow-client hub may use its C2 reconstruction (backward-difference af estimation is valid here: the quantity exists). |
| `3` | `step` | held value with instantaneous transitions (step/none interpolation). The family says intent, the machine owns feasibility as always. RFC-049a: NUMBER KEPT, never renumbered, but status is `reserved`: the reference engine has no step renderer, so a `step` declaration renders as `c2_quintic` and the GRANT echo reports exactly that effective family (§9.6, §18-20). Declarable again when a step renderer exists in the reference engine; only the delegate's mapping changes when it does. |

## Oscillator shapes

The `osc.shape` select of the hub-side oscillator (RFC-103, SPEC §9.7). Every period starts at the trough, rising.

| Value | Shape | Notes |
|---|---|---|
| `0` | `sine` | -cos: trough at phase 0, crest at the half cycle. With a dwell, each half is a rest-to-rest quintic. |
| `1` | `square` | a rising quintic edge at phase 0, the crest held, a falling edge at the half cycle, the trough held; with dwells, a pulse-width control |
| `2` | `saw` | a linear rise over most of the period, then a quintic flyback whose slope matches the ramp at both ends. Ignores the dwells. |
| `3` | `saw_reverse` | saw mirrored in time: the flyback rises, the ramp falls. Ignores the dwells. |

## Oscillator drives

The `osc.frequency.drive` and `osc.amplitude.drive` selects (RFC-103, SPEC §9.7): what sets the parameter. A driven parameter maps its source through `linear_clamp` (SPEC §8.11) with the entry's `in_min`/`in_max`/`out_min`/`out_max` fields.

| Value | Drive | Notes |
|---|---|---|
| `0` | `fixed` | the parameter is its own field's value; the bounds are unused |
| `1` | `speed` | the magnitude of the commanded speed the oscillator rides, in the unit of the hub's telemetry.velocity field |
| `2` | `position` | the commanded position the oscillator rides, in the unit of the hub's telemetry.target field |
| `3` | `axis` | the osc.drive stream's field of the same name (amplitude or frequency), 0 .. 1; 0 once the stream has been quiet for stream_quiet_release_ms |

