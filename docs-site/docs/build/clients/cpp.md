---
title: C++ client guide
description: >-
  How to write a Valence client in C++.
status: stub
---

# C++ client guide

!!! warning "This page is not written yet"

    This page is a stub. It lists the planned contents and the source
    material.

    Content is written after the v1.0 tag, when the normative section
    describes the shipped protocol.

## Planned contents

The embedded and native client: the header-only library, the injected clock and randomness, and the transport interface a caller implements.

Source material: `lib/valence/README.md` (how to vendor the library), `lib/valence/include/valence/client.hpp`, and `examples/valence_demo/demo.cpp`.

> DEMO-CANDIDATE: `examples/valence_demo/demo.cpp` walked step by step as a
> live connect-and-print session.

## Common outline

Every client guide covers these seven steps in this order.

1. Open the transport and complete the handshake.
2. Handle the catalog: fetch, cache by
   [etag](../../reference/dictionary.md#etag), or pin it.
3. Pass the [ready gate](../../reference/dictionary.md#ready-gate).
4. Adopt retained STATE before rendering anything.
5. Send an [intent](../../reference/dictionary.md#intent) and render the
   [echo](../../reference/dictionary.md#echo), never the request.
6. Keep the session alive, and honor the
   [deadman](../../reference/dictionary.md#deadman) if you own a source.
7. Handle NACKs, including the range fallback for a code you do not know.

## Where to go next

- [Quickstart](../quickstart.md): a worked example, end to end.
- [Hub implementer guide](../hub.md): using the same library to build a hub,
  making firmware a conforming hub instead of a client.
- [CLI guide](../cli.md): graph the motion your client produced.
