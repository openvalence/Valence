---
title: Plugin guide
description: >-
  How to write an app integration that speaks Valence, using a shipped plugin as the worked example.
status: stub
---

# Plugin guide

!!! warning "This page is not written yet"

    This page is a stub. It lists the topics that belong here and where the
    source material is.

    Content follows the v1.0 tag.

## Scope

This page will walk through a shipped plugin, `clients/mfp/`, from start to finish.

Topics the example covers:

- [Discovery](../reference/registry/discovery.md), and the requirement that a
  manual address still works.
- Choosing between dense
  [samples](../reference/dictionary.md#sample) and sparse
  [segments](../reference/dictionary.md#segment), and what each costs.
- Holding a session open through a [pause](../reference/dictionary.md#pause):
  the segments stop, the
  [liveness pings](../reference/dictionary.md#liveness-ping) continue, and the
  machine settles instead of tripping its
  [deadman](../reference/dictionary.md#deadman).
- A divergence watchdog that warns, without switching modes, when the host
  app's output for the axis differs from the script's prediction.
- Byte-for-byte wire parity with the [probe (the reference verifier)](cli.md#the-probe),
  checked by a test.
- Running the same session twice back to back **without rebooting the device**.
  This pattern is mandatory for [anything touching session lifecycle](local-testing.md#the-pattern-that-is-mandatory).

## Source material

- `clients/mfp/`: the shipped plugin. The guide must separate shipped files
  from development-only files.
- `spec/V1-READINESS.md` §2.5: the client work items, including the limits of
  the host application's extension surface.

## Where to go next

- [Quickstart](quickstart.md): the seven-step session this guide's example
  builds on.
- [CLI guide](cli.md): verify wire parity with the probe.
- [Local testing](local-testing.md): the back-to-back-sessions pattern.
