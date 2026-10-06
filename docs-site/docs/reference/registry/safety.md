---
title: Safety codes
description: Generated tables of Valence safety intent operations and safety cause codes.
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

# Safety codes

## Safety intent operations

These are the `value` map key 1 of the [`safety-intents` channel](channels.md#spec-core-channels) (`0x0005`).

**`pause` and `estop` are role-exempt. Any session may send them,
including a `watch` session.** Safety outranks authorization. The wrong
choice here means the person who is in the room cannot stop the
machine. Every other operation requires `control`.

| Op | Name | Meaning |
|---|---|---|
| `1` | `release` | RFC-085 (was estop_clear): release the ESTOP latch (§11.2 preconditions; NACK CLEAR_REFUSED otherwise). Lands in PAUSE, never in motion; on an estop_cuts_power hub, unhomed. Requires `control`. |
| `4` | `pause` | RFC-085: latch PAUSE (§11.1): decelerate, hold position, every source suspended, stream bundles dropped and counted. ROLE-EXEMPT. A hub with a motion source MUST implement it. |
| `5` | `resume` | the only clear of PAUSE (§11.1). Refused ESTOP_ACTIVE while ESTOP is latched, INTERLOCK while override is latched, NOT_HOMED while home_required. Requires `control`. A client never sends it on its own initiative. |
| `6` | `estop` | ASSERT e-stop (RFC-010). ROLE-EXEMPT. The hub treats it exactly as a valid 0xE5 frame: latch, cause=user, publish 0x0003, EVENT twin. The raw 0xE5 frame stays as the deframed-path/relay guarantee; this op is the trivially-implementable client path: without it the red button silently degrades to a decel-stop. |
| `7` | `override` | RFC-085 (was override_on; merges the former bypass): latch the override mode, carrying PAUSE: the rail is handed to the operator, travel window and soft limits lifted, jog enabled, the paused position recorded (§11.1). Requires `control`. An essential binding of the axis archetype. |
| `8` | `return_op` | RFC-085, the `return` op (was override_off; registry identifier `return_op` only because `return` is a C++ keyword in the generated header): a smooth move back to the paused position at jog speed and accel; on arrival override clears and the machine is in plain PAUSE. Requires `control`. |

## Safety causes

One taxonomy has two wire homes. They are the ESTOP frame's `cause`
byte, and the `cause` field of the latched [`safety` STATE snapshot](channels.md#spec-core-channels) (`0x0003`).

| Value | Cause | Meaning |
|---|---|---|
| `0` | `user` | operator-initiated (physical button, UI, safety-intents `estop`/`pause`): §5.5 |
| `1` | `deadman` | §11.3 deadman window actually elapsed (silence timeout, not some other way the session ended: see session_loss) |
| `2` | `fault` | hub/driver-detected fault |
| `3` | `relay` | relay-originated (segment-local safety event): §5.5 |
| `4` | `session_loss` | RFC-022.3: the owning session ended by ANY non-deadman teardown path (GOODBYE, rude detach, either eviction, slot reuse): §6.8 / RFC-005's teardownSession() loss policy. Was misreported as cause=deadman before this value existed. |

`deadman` means the silence window actually elapsed. Every other way a
session ends latches `session_loss`. A closed browser tab is not the
same event as a deadman timeout. An earlier bug reported them as the
same thing. These are two different events.

## Source kinds

What each control-owner slot drives (SPEC §11.4). A slot the hub never declares is `reserved`.

| Value | Name | Notes |
|---|---|---|
| `0` | `jog` | a manual point move. Never takes the rail from another source (RFC-085); released when its move settles. |
| `1` | `stream` | c2h STREAM motion input. Released when its last admitted bundle has played out and nothing arrived for stream_quiet_release_ms (never below the grant's schedule horizon). |
| `2` | `classic` | the hub's classic pattern generator (RFC-093). Released on stop. |
| `3` | `advanced` | the hub's advanced generator (RFC-093). Released on stop. |
| `4` | `remote` | a hand-held remote driving the rail through the hub. Released when its source is quiet. |
| `5` | `reserved` | the slot names no source: never owned, never drawn. |

