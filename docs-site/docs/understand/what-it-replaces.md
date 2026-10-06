---
title: What it replaces, and what it does not
description: >-
  What Valence takes over and what it leaves alone, including TCode's role as compatibility ingest.
---

# What it replaces, and what it does not

This page covers the surfaces Valence replaces, the surfaces it leaves alone, and its non-goals.

## TCode compatibility

Valence does not deprecate TCode, and there is no cutover date; existing
TCode setups keep working.

A hub keeps its TCode edges as **compatibility ingest**. It wraps each active
edge in a [synthetic session](../reference/dictionary.md#synthetic-session):
an internal session object that appears in the roster, owns its arbiter
source, and carries a [deadman](../reference/dictionary.md#deadman) equal to
that edge's existing quiet timeout. A TCode sender receives no Valence
frames. The wrapping is entirely hub-side bookkeeping.

This is a safety rule: there is no unmonitored path to motion.

Native Valence motion streaming is the optional **upgrade path**. A
native stream carries timestamps, a rate
[grant](../reference/dictionary.md#grant),
[source ownership](../reference/dictionary.md#source-ownership) and the
deadman as protocol, rather than as conventions each firmware reimplements.

## What it replaces

Surfaces Valence replaces:

| Replaced | With | Result |
|---|---|---|
| A bespoke HTTP or WebSocket API per device | One catalog, one frame grammar | A client is not tied to one firmware |
| Hand-written client code per device | Rendering from the catalog | A control added in firmware appears in existing clients |
| Hardcoded interface layouts | Catalog-driven controls with unit, limit and [`setting_key`](../reference/dictionary.md#setting_key) | The layout cannot drift from the firmware it renders |
| A hand-copied table of command schemas | The catalog the client already decodes | The client keeps no hand-copied schema table |
| Polling an endpoint for status | STATE channels with [retained values](../reference/dictionary.md#retained-value) | A client adopts the retained value on connect instead of polling |
| Per-feature chunked transfer machinery | One blob verb, with namespaces | Catalogs, presets and ledgers all move the same way |
| A device log endpoint | A log channel | Clients that are not browsers can see the logs |
| A client list and a kick endpoint | Session-events for joins and leaves, plus an admin evict intent; the roster snapshot itself is specified, not yet built | Session administration is part of the protocol |
| A capabilities endpoint | [Capability discovery](../reference/dictionary.md#capability-discovery) | The feature list is the catalog, so the two cannot drift |

Each of these surfaces becomes a catalog channel that any client can read.

<p class="ss-point" markdown>**The point.** Each replacement removes a second copy of information the firmware already declares (the hand-written table, the hardcoded layout, the parallel feature list), so no second copy exists to drift.</p>

## What it does not replace

### TCode

Covered above. It stays, as compatibility ingest, under the same safety
obligations as any native session.

### Motion planning

The machine owns motion: a client sends intent, and the hub decides how to
execute it safely, with its own planner, its own limits, and its own knowledge
of where the carriage is.

A client cannot know the machine's live position, its acceleration headroom,
or which limit set applies at this instant, so motion planning stays on the
hub.

A client sends the intended motion, and the hub executes it within its own
limits. Valence carries intent and does not make the client responsible for
feasibility.

### Firmware update

Update transport lives outside the protocol, on its own credential plane.
Update rights are never derivable from any
[access level](../reference/dictionary.md#access-level), `configure` included.

A firmware update replaces the code that enforces these rules, so no access
tier inside the protocol can authorize one.

### Intiface and WSDM

Where a hub dials out to an application protocol, that outbound client is an
adapter the hub owns, and it materializes as a synthetic session like any other
legacy edge. Exposing Valence to those stacks directly is out of scope.

### Any firmware's own interface, protocol or identity

A hub can speak Valence **alongside** whatever it already speaks. Nothing
here asks a project to retire its own control surface, its own app or its own
name. See [Ecosystem and compatibility](ecosystem.md).

### The hardware emergency-stop path

The protocol's ESTOP is not the hardware path: it is fast, role-exempt and
latched, but it runs in software over a network. The hardware emergency-stop
path remains the guarantee of last resort.

## Non-goals

- **No cloud.** Nothing leaves the site. There is no telemetry, no account
  service, and no remote dependency of any kind.
- **No broker.** The hub is the only authority. There is no message bus to
  deploy and nothing extra to keep running beside the machine.
- **No account system.** Identity belongs to a device. A client is 8
  bytes of durable id plus a token it earned through a physical ceremony.
- **No peer-to-peer.** Clients never talk to each other. All truth flows
  through the hub, so every client observes the same state.
- **No wide-area deployment.** The port is a LAN port. Exposing it to the
  internet is not a supported configuration.

<p class="ss-point" markdown>**The point.** Each non-goal removes a component that would otherwise need to run, be trusted and be updated. Valence is designed for a machine with no internet connection.</p>

## Migration audit

On the machine where Valence was written, migration deleted four surfaces:

- A transport-mode selector that chose between ingest paths. Valence replaced
  the paths it selected between.
- An endpoint that always answered "not cleared". Its only real behavior was a
  side effect available elsewhere.
- A control that posted to a route the firmware never had. It rendered and did
  nothing.
- A panel fed by a data source that had been superseded. It showed gauges fed
  by a dead producer.

All four were found by enumerating every surface for migration. Before
migrating, list every existing surface and map each to a channel. A control
with no channel behind it is a defect, and a display that shows a value the
machine did not apply is a safety defect.

## Where to go next

- [Ecosystem and compatibility](ecosystem.md): how this sits beside the
  firmwares people already run.
- [Capabilities and custom hardware](capabilities.md): what adopting it
  asks of a device.
- [Security model and the audit](security.md): what "LAN-first" defends, and
  what it does not.
