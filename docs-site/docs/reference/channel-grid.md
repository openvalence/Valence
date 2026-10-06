---
title: Channel grid
description: >-
  The 0xCDSS channel numbering convention: class, domain, family, and member.
status: stub
---

# Channel grid

!!! warning "Static summary"

    This page summarizes `spec/CHANNEL-GRID.md`, which holds the full detail.
    An earlier interactive version read a live device catalog. Its generator,
    `docs-site/tools/gen_channel_grid_page.py`, stayed in Nucleus, the machine
    repo, because it parses that machine's device catalog. An interactive grid
    that reads a hub-agnostic catalog is a parked work item.

Valence recommends a numbering convention for device-defined channel ids.
This page summarizes it.

## Channel id digits

A device-defined channel id (`0x0080`-`0x7FFF`) reads as four hex digits:
class, domain, family, member.

| Digit | Name | Meaning |
|---|---|---|
| C | class | 1 STATE, 2 STREAM, 3 INTENT, 4 EVENT, 5 STORE |
| D | domain | the device subsystem (motion, machine, pattern, and so on) |
| F | family | a related cluster of channels in that domain |
| M | member | one channel in that family |

`0x2101` reads as STREAM, domain 1, family 0, member 1.

## The mirror rule

A STATE channel and its INTENT writer differ only in the class digit.
`0x1120` is the STATE channel and `0x3120` is its INTENT writer.

## Family and member

Member 0 is the family's own STATE or roster channel, or its one INTENT
verb. Every other member is a related channel: a tuning card, a modifier
lane, a preset slot. Each family leaves 15 member slots unused, and each domain
leaves families unused, for later additions.

## Family 0xF

Family 0xF is the admin family in every domain. A domain's `0x_F0` slot
holds that domain's clear fault, save, and scan operations.

## Reserved domains

Domains 3, 4, and 5 are reserved for future subsystem categories. Domains 8
through F are reserved for a future multi-axis convention. Range
`0x7000`-`0x7FFF` is experimental and vendor space, and a shipped catalog
must not use it.

## Spec-core channels

`0x0001` through `0x000E` are fixed and spec-governed. No hub allocates
them. [Channels](registry/channels.md) is the generated, authoritative list.

## Worked example

Each hub documents its own device-range allocations; this repository holds
none. Nucleus's `CHANNEL-MAP.md`, in its own repository, is the worked
example.
