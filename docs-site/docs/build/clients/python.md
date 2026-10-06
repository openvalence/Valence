---
title: Python client guide
description: >-
  How to write a Valence client in Python.
status: stub
---

# Python client guide

!!! warning "This page is not written yet"

    This page is a stub. It lists the planned content and the source
    material.

    Content is written after the v1.0 tag.

## Planned content

The tooling and test client: a minimal session, and using generated constants instead of numeric literals.

Source material: `tools/valence_probe.py`, the reference verifier.

> DEMO-CANDIDATE: the probe's own minimal session (see the
> [Quickstart](../quickstart.md#python)) run live, one decoded frame printed
> per line.

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
- [CLI guide](../cli.md): the probe and Valence Trace, in depth.
- [Local testing](../local-testing.md): run the client against the simulator
  before running it against hardware.
