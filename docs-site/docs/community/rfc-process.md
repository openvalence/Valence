---
title: RFC process
description: >-
  How a change to the Valence protocol is proposed, argued, and either bound into the specification or refused.
status: stub
---

# RFC process

!!! warning "This page is not written yet"

    This page is a stub. It lists what belongs here and where the source
    material is.

    Content follows the v1.0 tag and describes what shipped.

## What belongs on this page

This page will document the RFC process as it runs today.

- **Changes that need an RFC:** a new wire number, a change to normative
  behavior, or a change to the [governance policy](governance.md).
- **Changes that need no RFC:** a new device channel, because the
  [catalog](../reference/dictionary.md#catalog) describes it.
- **Lifecycle:** a proposal is drafted, reviewed and amended, then either
  bound into a base pass or refused with its reasoning recorded.
- **Spec-gap procedure.** When an implementation needs a number
  [the specification](../spec/index.md) lacks, fix the registry and the
  specification **first**, regenerate, and then write code against the
  generated constant. Code does not define a local magic number for anything
  wire-visible. This occurred eleven times during protocol development.
- **Allocation policy:** numbers are added by pull request. A released number
  is never reused or renumbered.
- **Scope after the base pass.** RFCs after the base pass are expected to be
  rare, small additions, such as a new flag. A proposal that changes core structure
  indicates a gap in the base pass and is not folded into it.

## Source material

- `spec/RFC-QUEUE.md`: twenty-nine worked RFCs and a feasibility pass.
- `spec/V1-READINESS.md`: the readiness ledger and its dispositions, which
  record how a proposal is argued to a decision.
- `spec/SPEC.md` §4.4 and §5.7: evolution policy, reserved ranges, and
  registry governance.

## See also

- [Errata](../spec/errata.md): corrections that are not protocol changes.
- [Governance](governance.md).
- [Contributing](contributing.md): building this site, if the RFC needs new
  pages.
