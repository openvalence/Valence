---
title: JavaScript client guide
description: >-
  How to write a Valence client in JavaScript.
status: stub
---

# JavaScript client guide

!!! warning "This page is not written yet"

    This page is a stub. It lists what it will cover and the source material.

    Content is written after the v1.0 tag.

## What belongs on this page

The browser client. Cover `WebSocket` binary frames, the subprotocol, CBOR in the browser, and the prohibition on optimistic interface state.

Source material: `clients/js/`, this repo's own v1.0 reference
implementation (see the [Quickstart](../quickstart.md#javascript) for a
worked example), and `tools/valence_probe.py` for wire parity.

> DEMO-CANDIDATE: a live connect-and-subscribe walkthrough in the browser,
> HELLO to rendered STATE, one frame at a time.

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
- [Plugin guide](../plugins.md): wiring a client into a host application.
- [CLI guide](../cli.md): graph the motion your client produced.
