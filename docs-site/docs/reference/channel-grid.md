---
title: Channel grid
description: >-
  The 0xCDSS channel numbering convention: class, domain, family, and member.
register: STE
status: stub
---

# Channel grid

!!! warning "This page is a static summary, not the interactive grid"

    An earlier interactive version of this page read a live device catalog.
    That generator (`docs-site/tools/gen_channel_grid_page.py`) stayed in
    Valence Drive, the machine repo, because it parses that machine's own
    device catalog. Rebuilding an interactive grid on the protocol side
    (reading a hub-agnostic catalog instead of one machine's) is a parked
    work item.

    Full detail lives in `spec/CHANNEL-GRID.md`, alongside this directory
    in this repository. This page is a summary of it.

## The convention

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

A STATE channel and its INTENT writer share domain, family, and member.
Only the class digit differs. `0x1120` and `0x3120` are the same
domain/family/member pair, read and write.

## Family and member

Member 0 is the family's own STATE or roster channel, or its one INTENT
verb. Every other member is a related channel: a tuning card, a modifier
lane, a preset slot. Every family reserves 15 unused members. Every domain
reserves unused families.

## Family 0xF

Family 0xF is the admin family in every domain. A domain's `0x_F0` slot
holds that domain's clear fault, save, and scan operations.

## Reserved domains

Domains 3, 4, and 5 wait for future subsystem categories. Domains 8 through
F wait for a future multi-axis convention. Range `0x7000`-`0x7FFF` is
experimental and vendor space. A shipped catalog must never use it.

## Core channels

`0x0001` through `0x000E` are fixed and spec-governed. No hub allocates
them. See [Channels](registry/channels.md) for the generated, authoritative list.

## Worked example

This repository holds no single hub's device map. Each hub publishes its
own. Valence Drive's `CHANNEL-MAP.md`, in its own repository, is the worked
example.
