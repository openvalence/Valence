---
title: Valence
description: >-
  Valence is an open device-shadow and capability-negotiation protocol for
  motion machines. A hub publishes a catalog of its channels, and a client
  builds its interface from that catalog and shows the values the hub reports.
---

# Valence

Valence is an open protocol between a motion machine and its client apps. One
client works with any firmware that implements it, and it displays the values
the machine applied.

A hub publishes a catalog describing its channels, and a client builds its
interface from that catalog without being compiled against the firmware.

<div class="ss-doors" markdown>

<div class="ss-door" markdown>
### Understand
Read the mental model first. What a catalog is, what the five channel classes
do, and why motion planning stays on the machine.

[Start here](understand/index.md)
</div>

<div class="ss-door" markdown>
### Build with it
Connect a client, write an app integration, or make your own firmware a
conforming hub.

[Start building](build/index.md)
</div>

<div class="ss-door" markdown>
### Specification
The normative clauses, the conformance suite, and every registered wire
number in generated tables.

[Read the spec](spec/index.md)
</div>

</div>

## What it does

<div class="ss-facts" markdown>

| | |
|---|---|
| **Catalog** | A hub publishes a catalog. A client reads it and knows every channel, type, unit, limit and access level, without a firmware-specific driver. |
| **Retained state** | State channels carry full snapshots. The hub retains the latest one and pushes it the moment a client connects. A client adopts the retained state when it connects. |
| **Applied-value echo** | An echo reports the value the machine applied, after clamping. A client's shadow updates from the hub, not from its own request. |
| **Emergency stop** | ESTOP is role-exempt, jumps every queue, and latches. A motion source that goes silent trips its deadman, and the hub releases its ownership. |
| **Client floor** | The mandatory client floor is one parser, no crypto and 24 bytes of stored identity. A coin-cell remote can be a conforming client. |

</div>

## Scope

Valence does not replace a machine's firmware. A firmware adopts it as a
compatibility layer so that one client works across firmwares. See [Ecosystem and compatibility](understand/ecosystem.md).

Valence does not plan motion. A client sends intent, and the hub decides how
to execute it.

The v1 threat model is casual and drive-by prevention on a trusted local network, and the specification marks each weak
defense with an honesty clause. See [Security model](understand/security.md).

## Governance

Valence does not favor any firmware, vendor or product. The full statement is on its own page:
[Governance](community/governance.md).

## Registry-generated numbers

Every frame type, CBOR key, NACK code, channel id and limit on this site is
generated from one registry file. Every wire-number table is generated from the
registry, and the docs build fails when a table is out of date.

[Registry reference](reference/registry/index.md){ .md-button }
[The Dictionary](reference/dictionary.md){ .md-button }
