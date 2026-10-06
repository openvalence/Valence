---
title: Hub implementer guide
description: >-
  How to make your firmware a conforming Valence hub.
status: stub
---

# Hub implementer guide

!!! warning "This page is not written yet"

    This page is a stub. It lists the intended content and the source
    material.

    Content follows the v1.0 tag.

## What belongs on this page

What a firmware author needs to adopt Valence, and how much work each part takes.

- **Author your catalog.** Catalog authoring is the largest part of the work.
  Cover the 242-byte snapshot budget, the per-entry size cap, and splitting a
  state group across channels when it does not fit.
- **Wire the delegate.** Apply [intents](../reference/dictionary.md#intent)
  through your existing arbitration and safety gates. Do not bypass them.
  The protocol passes intents to your existing motion authority and does not
  replace it.
- **[Echo](../reference/dictionary.md#echo) applied values.**
  Echo the post-[clamp](../reference/dictionary.md#clamp) values read back
  from the driver, not the requested values.
- **Retain and seed.** Keep the latest snapshot of every STATE channel, and
  seed the safety snapshot at construction. A fresh boot that retained nothing
  hands a connecting client an empty [latch](../reference/dictionary.md#latch).
- **One [teardown](../reference/dictionary.md#teardown) path.** Every way a
  session can end runs the same loss policy.
- **Implement a transport** by writing an adapter, outside the library.

## Known traps

The page will cover these failure modes:

- Do not implement `reset()` as whole-object assignment: it builds a
  nine-kilobyte stack temporary and overflows the task stack on every client
  connect. Host tests do not catch it because host thread stacks are megabytes in size.
- Do not place a large service in static memory: it starves the internal heap
  and leaves the network stack without memory, and the linker report does not show it.
- Do not release ownership only from the liveness pump: every other exit path
  leaks ownership. The leak stays hidden while each deploy reboots the device
  between tests.

## Source material

- `spec/SPEC.md` §13.1: the binding contract every transport must satisfy.
- `lib/valence/README.md`: how to vendor the library, and the layering rules.
- `hub/bench/` (this repo): a working, machine-agnostic composition
  root and WebSocket transport adapter, config-file-driven rather than
  wired to real hardware.
- Nucleus's `src/comms/ValenceHubService.*` and `ValenceWsTransport.*`
  (machine repo): a working composition root and transport adapter wired
  to real hardware.

## Where to go next

- [CLI guide](cli.md): verify a hub with the probe and Valence Trace.
- [Local testing](local-testing.md): the simulator, the golden vectors, and
  the back-to-back-sessions pattern that finds teardown bugs.
