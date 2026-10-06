---
title: C# client guide
description: >-
  How to write a Valence client in C#.
status: stub
---

# C# client guide

!!! warning "This page is not written yet"

    This page is a stub. It lists the planned content and the source
    material.

    Content is written after the v1.0 tag, when the normative section
    describes the shipped protocol.

## Planned content

The desktop-app client. Cover `ClientWebSocket`, the byte-for-byte builders, and running a session against a real device.

Source material: `clients/mfp/ValenceConnect.cs`, a shipped external client. Its `LiveWireTest` harness compiles the plugin file into a console program and runs it against hardware.

> DEMO-CANDIDATE: a minimal HELLO/WELCOME round trip built from
> `LiveWireTest`'s own session code, run live against a device.

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
- [Plugin guide](../plugins.md): the shipped-plugin worked example that is the
  source material for this guide.
- [CLI guide](../cli.md): graph the motion your client produced.
