---
title: Community
description: >-
  How Valence is governed, how to contribute, and how protocol changes are proposed and decided.
---

# Community

This section covers how Valence is governed, how to contribute to the documentation, and how protocol changes are proposed and decided.

| Page | Covers |
|---|---|
| [Governance](governance.md) | Neutrality rules, number allocation, and the authority of the specification and registry |
| [Contributing to the documentation](contributing.md) | Building the site, the rule that wire numbers are generated and never typed, generated pages, and stubs |
| [RFC process](rfc-process.md) | How a protocol change is proposed, argued and decided |

## Principles

[The Specification](../spec/index.md) defines Valence. The C++ library is its
reference implementation.

The registry is the single source of truth for every wire number. Every table
and C++ constant is generated from it.

A number released in a tagged version is never reused or renumbered.

## Where discussion happens

Protocol changes are made in public pull requests against the registry and the
specification. A refused proposal is recorded with its reasoning.
