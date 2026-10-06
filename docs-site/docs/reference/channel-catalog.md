---
title: Channel catalog reference
description: >-
  What a real Valence device catalog looks like, entry by entry, with every field explained.
status: stub
---

# Channel catalog reference

!!! warning "This page is not written yet"

    This page lists what it will cover and the source material for it.

    This page is written after the v1.0 tag and describes the v1.0 release.

## What belongs on this page

The [spec-core channels](registry/channels.md#spec-core-channels) are already
generated and authoritative. This page documents one **real device
catalog**, entry by entry, as a worked example of catalog authoring.

For each entry: its class, its access level, its layout or schema field by
field, the units and scales, and the reason its fields share one channel.

It also covers these authoring rules:

- A STATE payload must fit 242 bytes unfragmented. A group that does not fit
  is split into separate channels when the catalog is authored; the hub does
  not split it at runtime.
- Layouts evolve append-only. A changed or removed field means a new channel
  id.
- A setting category spans channels, so a settings tab can exceed what one
  snapshot holds.
- [Field roles](registry/catalog-vocabulary.md#field-roles): a client may use a field role
  to pick a better control, and may ignore it. A client that ignores every
  field role still renders every channel.

## Source material

- [Appendix D](../spec/appendices.md#appendix-d) of `spec/SPEC.md`: the worked catalog sketch.
- Nucleus's `include/comms/ValenceCatalog.h` (machine repo): the
  catalog a real device publishes. Where it differs from Appendix D, this
  header is correct, because it is the catalog the firmware publishes.
- [Catalog schema (CDDL)](../spec/schema.md): the normative catalog encoding,
  published from `spec/schema/catalog.cddl`.
- `lib/valence/include/valence/conformance/catalog_check.hpp`: the rules a
  catalog is mechanically checked against. This page explains each check in it.

> Planned: fetch a live device's catalog over the wire and render it
> entry by entry next to this page's worked example.
