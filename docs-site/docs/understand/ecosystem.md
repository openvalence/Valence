---
title: Ecosystem and compatibility
description: >-
  How Valence relates to OSSM, ossm-rs, fray-d lite and other open motion
  firmwares: a compatibility layer each of them can adopt alongside its own
  protocol.
---

# Ecosystem and compatibility

This page covers how Valence relates to existing open motion firmwares, what a
firmware keeps when it adopts Valence, and what adoption costs.

OSSM, **ossm-rs**, **fray-d lite** and similar projects established open
firmware for these machines, and Valence builds on their work.

Valence does not replace or supersede any of these firmwares. A firmware can
adopt it as a compatibility layer so that one client works across all of them.

## The integration problem

Every firmware in this space solved the same three problems separately:

- Capability discovery: what the machine can do.
- Live position: how an app reads it.
- Command confirmation: how an app learns what happened after a command.

There was no shared answer to adopt. An app author who wants to support three
firmwares writes three integrations, tests against three machines, and
maintains all three. Most authors support one firmware, and owners of other machines cannot use
that app.

## Benefits by party

**For an app author.** One client instead of one per firmware. A machine
describes itself, so a new device works with the app without an app update.

**For a firmware author.** A firmware works with every Valence client without its
author writing client code. The machine appears in tools it was never
integrated with because those tools are written against the protocol.

**For an owner.** The remote, the phone app, the desktop plugin and the web
page all agree about what the machine is doing, because they all read the same
declared state.

<p class="ss-point" markdown>**The point.** Adoption is additive: a firmware keeps its interface, planner and identity.</p>

## What a firmware keeps

- **Its own interface.** The catalog says what a value **is** and does not say how
  it should **look**. The catalog has no widget field.
- **Its own motion planning.** The machine owns motion. The protocol carries
  intent, and the hub decides how to execute it.
- **Its own protocol.** A hub can speak Valence alongside whatever it already
  speaks. Adding the Valence binding removes no existing protocol.
- **Its own identity.** Its name, its brand, its community, its release
  cadence. Conformance does not depend on who built the hub.
- **Its own product decisions.** Feature set, defaults, hardware support and product
  decisions stay with the project.

## Adoption cost

- The **hub floor** is a checklist, and every item on it is something a
  firmware already does internally. It is on
  [Capabilities and custom hardware](capabilities.md).
- The **client floor** is one parser, no required cryptography, and 24 bytes
  of stored identity.
- The **frame budget** is 242 bytes for every mandatory message, because the
  weakest transport sets the limit.
- **No language is imposed.** The reference implementation is header-only
  C++20, and nothing requires using it. The registry and the
  [golden vectors](../reference/dictionary.md#golden-vector) are the contract.
  Implement it in the language the firmware is already written in.
- **No transport is imposed.** A binding is four operations plus a declaration
  of what it can do. Implement the ones the hardware has.

Report a spec rule your firmware cannot meet through the
[RFC process](../community/rfc-process.md). The rule is in
[the specification](../spec/index.md).

## Working with specific projects

These notes were written without input from the projects named. A maintainer's
description of their own project outranks this page; corrections are pull
requests.

**OSSM** and **ossm-rs**: an open machine controller and a Rust
implementation in the same family. Open mapping questions:

- Snapshot-shaped values: which of the machine's values already are.
- Absolute commands: which commands are already absolute rather than relative.
- The firmware's arbiter: where it already decides who is driving.

Where those exist, a binding is mostly declaration. Where they differ, the
difference needs understanding before code is written. A Rust hub conforms on the same terms as any other implementation.

**fray-d lite**: a hub binding has to fit how that project already models a
session and a running pattern.

**Apps and bridges.** An application that already speaks a device protocol can
add a Valence client without dropping anything it supports today. The first
external client written against this protocol was a plugin for an existing
desktop application, and it kept every other integration that application had.

**Anyone else.** Maintainers of a firmware, remote, app or bridge in this
space can open an issue to work out the mapping.

## Governance stance

Valence does not favor any firmware, vendor or product.

- **No firmware is the reference firmware.** Nucleus is where Valence
  was written and where it is proven on hardware. It is the first
  implementation and has no special standing.
- **No vendor gets a reserved number.** The registry allocates in the open, by
  pull request, on technical merit. No range is private.
- **The specification is normative.** The library is its reference
  implementation. Where they disagree, the specification wins and the library
  has a bug.

The full statement lives on the [Governance](../community/governance.md) page.

## Where to go next

- [What it replaces](what-it-replaces.md): what Valence takes over and what it
  leaves alone.
- [Capabilities and custom hardware](capabilities.md): the floor a firmware
  would be adopting.
- [Governance](../community/governance.md): the stance in full, and what it
  forbids.
