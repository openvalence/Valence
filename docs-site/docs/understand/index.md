---
title: Understand Valence
description: >-
  The mental model behind Valence, what it does and does not replace, how it fits the existing ecosystem, and what its security defends.
---

# Understand Valence

This section covers the catalog, channel classes, ground truth, safety,
capabilities, the existing ecosystem and security. Wire numbers live in the
generated [registry reference](../reference/registry/index.md).

| Page | Covers |
|---|---|
| [How it works](how-it-works.md) | Catalog, channel, shadow, intent |
| [Anatomy of a frame](anatomy.md) | Frame header and the two payload encodings |
| [Capabilities and custom hardware](capabilities.md) | Mandatory and optional hub and client features |
| [What it replaces](what-it-replaces.md) | What Valence takes over and what it leaves alone |
| [Ecosystem and compatibility](ecosystem.md) | How Valence fits alongside existing firmwares |
| [Security model and the audit](security.md) | What is defended, what is not, and what the fuzzing found |
| [For everyone](for-everyone.md) | What Valence means for a machine owner |

## Core principles

**Self-description.** The hub publishes a catalog: every channel,
type, unit, limit and access level it has. A client reads it and builds its
interface from it.

**Hub authority.** A client sends intent. The hub applies
what it can and echoes what it applied. A client's shadow updates from the
hub, never from its own request.

**Deadman and ESTOP.** A session that owns a motion source and goes silent trips its deadman, and the hub releases the source. ESTOP is role-exempt, jumps every queue and latches until it is explicitly
cleared.
