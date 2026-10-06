---
title: Security model and the audit
description: >-
  The Valence threat model: what is defended, what is not, the known ceilings, and what the pre-release fuzz campaign found.
---

# Security model and the audit

This page states the v1 threat model, the deployment rules that follow from it, and the results of the pre-release fuzz campaign and review.

## Threat model

**The v1 model is casual and drive-by prevention on a trusted local network.**
It stops a device on your network from controlling your machine by accident or
on a whim. It does not stop a determined attacker who is already inside that
network with capture and injection tooling.

Unauthorized control of a motion machine is a physical-safety issue. This page
states the model's limits exactly, because people deploy against what the
documentation claims.

## What is defended

| Defense | How it works |
|---|---|
| **Casual and accidental control** | Watching is open. Anything that moves the machine needs a [token](../reference/dictionary.md#token) earned through a [pairing](../reference/dictionary.md#pairing) ceremony |
| **Cross-machine mix-ups** | A token binds to one machine and one [instance id](../reference/dictionary.md#instance-id). Two hubs in range never share credentials |
| **A wrong or stale client** | Roles are scoped per channel. A `watch` session cannot own a motion source, whatever it sends |
| **Privilege creep during approval** | An approver may grant up to its own tier and no further. Asking for more is refused, never silently reduced |
| **A device you no longer trust** | Revocation is protocol, from any `configure` session, and takes effect at that device's next handshake |
| **Invisible presence** | The [trust ledger](../reference/dictionary.md#trust-ledger) names every paired device, its tier and its token presentation mode; session-events broadcast joins and leaves as they happen |
| **A changed client** | An observed version change drops a paired device to recognized-pending. See the [change tripwire](../reference/dictionary.md#change-tripwire), and its honesty clause below |
| **Browser-borne attacks** | The [served-page token](../reference/dictionary.md#served-page-token) endpoint sets no cross-origin headers. A page from anywhere else can send the request and cannot read the answer |
| **Unauthenticated queue flooding** | Every queue a stranger can fill is bounded: the pending-pairing list, admission control, ingress [token buckets](../reference/dictionary.md#token-bucket), and slow-consumer eviction |
| **Protocol-level memory safety** | [Parser totality](../reference/dictionary.md#parser-totality) is a conformance obligation in both directions, and the [fuzz gate](../reference/dictionary.md#fuzz-gate) enforces it |
| **Losing the stop control** | `stop` and `estop` are role-exempt. No authorization state blocks a stop |
| **An evil twin machine** | An optional hub signature over client-supplied entropy. A clone can copy every identifying string but cannot produce the signature |

Two rules need their rationale.

**Role-exempt stop.** Any session, or none, may send `stop` or `estop`; starting
motion needs the `control` tier. A credential requirement would block a stop
from a person who has no session.

**Watching is open by default.** Locking the view would push people toward
sharing one control credential, which is worse. A hub may still require a
token for viewing where the deployment calls for it.

## What is not defended

- **An active attacker on your LAN.** Someone running capture and injection
  tooling on the same network is outside the model. They can observe, replay
  in the window before a nonce rotates, and interpose.
- **A native process on your LAN.** Any local program can request the
  served-page token, because same-origin policy binds browsers and nothing
  else. That attacker class already defeats the cleartext ceiling below, so
  the mechanism loses nothing to it and is capped at `control` anyway.
- **A passive sniffer on the wire.** v1 transports are cleartext. A bearer
  token in a handshake is readable by anyone watching the network. Proof
  presentation prevents credential theft: a sniffer captures a one-time proof,
  never the token. It does not encrypt anything else.
- **Physical access.** Physical access grants full control by design. A factory-fresh hub
  boots claimable, and the power-cycle gesture re-opens pairing. That is a
  deliberate usability decision, and it is why factory reset must be a
  harder gesture than opening pairing.
- **Denial of service.** Someone in radio range can jam the radio. No protocol
  can prevent radio jamming.
- **A malicious update to a paired client.** See the tripwire clause below.

### Known ceilings

**The PIN proof is offline-brute-forceable, by design.** Four digits is ten
thousand HMACs. A passive observer of a pairing exchange can compute all of
them.

This is acceptable for the stated threat model, and
[the specification](../spec/index.md) states it as an honesty clause. It is
also one reason
[knock-and-approve](../reference/dictionary.md#knock-and-approve) is the
recommended ceremony: its approval surface shows the knocker's identity on
hardware the attacker does not control. A password-authenticated key exchange
is the reserved upgrade. It is not in v1 because browsers have no such
primitive, and mandating one would exclude browser clients.

**The version tripwire is not attestation.** The client version is
self-reported. It catches an honest update and asks you to re-approve it. A
deliberately malicious update reports whatever version it likes and keeps its
token. What bounds a hostile client is role scoping, immediate revocation,
trust-ledger visibility, and the fact that safety operations are role-exempt
for everyone.

**The protocol's ESTOP is not the hardware path.** It is fast, role-exempt,
latched and repeated until observed, but it runs in software over a network, and
the hardware emergency-stop path remains the guarantee of last resort.

**Firmware update is outside this model entirely.** Update rights are never
derivable from any access tier, so a `configure` compromise cannot flash the
machine.

### Deployment rules

1. **Never expose the Valence port to the wider internet.** The protocol is
   designed for a local network only.
2. **Prefer knock-and-approve.** It needs no PIN and no display, and it shows
   you who is asking.
3. **Use proof presentation if your client can compute an HMAC.** Browsers,
   desktop apps and every ESP32 can. It costs one round trip.
4. **Keep `configure` rare.** It is the tier that approves other devices.
5. **Revoke devices you no longer use.** The trust ledger lists every paired
   device for revocation.

## The audit

All defects below were found and fixed before the release tag.

### The fuzz campaign

Every Valence parser must map *any* byte string to accept-or-reject. Golden
vectors check that valid input decodes correctly; fuzzing checks that every
input is accepted or rejected without a fault. Both directions are in scope,
because a client that auto-connects to a discovered machine can parse bytes
from an untrusted hub, and the catalog is the largest client-side parser
surface in the protocol.

<div class="ss-facts" markdown>

| | |
|---|---|
| **Targets** | 7, one per parser surface: CBOR reader, catalog, frame and reassembly, packed layouts, stream bundles, blob transfer, and all control-plane decoders |
| **Executions** | 2,291,021,252 in the first campaign, 600 s per target, single worker each, so the counts compare |
| **Instrumentation** | libFuzzer with AddressSanitizer and UndefinedBehaviorSanitizer, with undefined-behavior recovery disabled |
| **Result** | Zero crash, leak, timeout or out-of-memory artifacts after the three fixes below |
| **Seeds** | Generated by the library's own encoders, so the mutator starts inside the accepting region instead of being rejected at the first byte |

</div>

Three memory-safety bugs were found and fixed, each with a regression test.

| # | Where | What |
|---|---|---|
| 1 | The CBOR reader's string handling | A length check computed `start + len`, which **overflows**. A header claiming 2⁶⁴−1 bytes wrapped the sum past the check and returned a view of that claimed length into a nine-byte buffer. Reachable from **every** message decoder, and from the skip-unknown-key path |
| 2 | The blob chunk reassembler | A transfer correctly **refused** for exceeding capacity still stored the attacker's numbers, and two later calls used them without checking whether the transfer was active. The fix discards a refused transfer's parameters |
| 3 | The fragment reassembler | One unbounded copy into a fixed buffer: the single write in the class that did not go through the bounds-checking path |

**Intra-object overflow.** Finding 3 survived a 7.8-million-execution fuzz
run and was then found by hand. Its overflow lands in the very next member of
the same structure, and an intra-object overflow is invisible to
AddressSanitizer. Only a write long enough to leave the whole enclosing object
reports. An overflow between two members of one struct needs review by hand;
AddressSanitizer-instrumented fuzzing does not detect it.

### Authorization gaps

Neither gap was reachable in a released build.

**The blob transfer verb had no role check.** The catalog is client-invariant
and deliberately readable by anyone who can connect. The
[trust ledger](../reference/dictionary.md#trust-ledger) requires `configure`
access; without a gate, a `watch` session could enumerate every paired device
on the machine. The fix is the rule subscription already uses: the declaring
catalog entry's access level is the floor. Every future store inherits it. A
store nobody declared answers "unavailable" rather than "denied", so a refusal
does not reveal whether a store exists.

**A pairing knock could be filed under somebody else's identity.** Approval is
by instance id. A connected client could therefore queue a knock in another
device's name, and trick an operator into authorizing a stranger under a
familiar label. The fix is one comparison: a session may only knock for its
own instance id.

### What the gate does not cover

A passing fuzz run does not cover:

- **Stateful protocol sequences.** The targets fuzz decoders and the two
  stateful reassemblers. They do not drive a hub and a client through session
  lifecycles, so session-lifecycle bugs are out of reach here. That class is
  covered by a manual pattern. See
  [Local testing](../build/local-testing.md).
- **Firmware transports.** The library boundary is where fuzzing stops.
  Whatever a transport adapter does to a buffer before it calls in is unproven
  by this gate.
- **Concurrency.** The harnesses are single-threaded and do not exercise
  concurrency.
- **Timing, rate limits and deadman policy.** Reachable in principle through a
  stateful harness; not attempted.
- **Semantic correctness.** Fuzzing says nothing about whether a decoded value
  is the *right* value. That is the golden vectors' job.

## Related pages

- [Capabilities and custom hardware](capabilities.md): pairing on hardware
  with no screen, no LED and no buttons.
- [Local testing](../build/local-testing.md): run the harnesses, and the
  regression pattern that catches what fuzzing cannot.
- [Pairing modes](../reference/registry/pairing.md): the generated table,
  including token presentation modes and trust states.
