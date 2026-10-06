---
title: Governance
description: >-
  The rules that govern Valence: implementations, number allocation, feature
  scope, and the authority of the specification and registry.
---

# Governance

This page states the rules that govern Valence implementations, number
allocation, feature scope, and the authority of the specification and the
registry.

## Principles

**Implementations.** Nucleus is the first implementation: Valence was written
there and is tested on its hardware. It has no special status under the
specification; every conforming hub has the same standing.

**Number allocation.** The registry allocates numbers through public pull
requests, judged on technical grounds. It has no vendor-reserved ranges, no
paid ranges and no private extension space. The device-defined ranges are open
to every device.

**Feature scope.** A feature is accepted when the protocol needs it in
general. A proposal that benefits only one product is refused, and the refusal
is recorded with its reasoning.

**Specification and library.** [The specification](../spec/index.md) defines
Valence. The C++ library is its reference implementation. Where they disagree,
the library has a defect.

**The registry is the single source of truth.** Where any document, any
library and any table disagree about a number, the registry is correct. CI
enforces this: the C++ constants and every table on this site are generated
from the registry, and a stale copy fails CI.

**Released numbers are never reused and never renumbered.** Tidiness,
renaming and regrouping are not grounds for renumbering. A number retired with
its feature is never reallocated. A peer built against an older version then
fails visibly on an unknown value, instead of misreading a reused
value.

**Published defects.** The fuzz gate's first campaign found three
memory-safety bugs before release; each is documented, with its regression
test, in [Security](../understand/security.md).

## Exclusions

- Valence does not require a specific motor driver, motion planner, transport
  or cloud service.
- Valence does not gate any part of the wire protocol behind registration,
  certification or a fee.
- Valence does not add a capability that only one machine can implement,
  unless the capability is optional and its absence is discoverable.
- Valence does not describe how a client should look; the catalog has no
  widget field.

## Changing this page

A change to this page is an RFC like any other. See
[the RFC process](rfc-process.md).

## See also

- [Ecosystem and compatibility](../understand/ecosystem.md): how existing
  firmware and clients relate to these rules.
- [Contributing](contributing.md).
