---
title: Conformance
description: >-
  Valence clause 17: conformance profiles, golden vectors and the fixture
  freeze, behavioral checklists, and the fuzzing totality gate.
generated: true
---

<!-- ==========================================================
     GENERATED FILE — DO NOT EDIT.
     Source of truth: spec/SPEC.md
     Generator:       docs-site/tools/gen_spec_pages.py
     Regenerate:      python docs-site/tools/gen_spec_pages.py
     CI gate:         python docs-site/tools/gen_spec_pages.py --check
     Normative text is copied verbatim. Hand edits are overwritten
     and fail the docs build. Edit the specification instead.
     ========================================================== -->

# 17. Conformance *(normative)* {#s17}

## 17.1 Profiles {#s17-1}

| Profile | MUST implement | MAY omit |
|---|---|---|
| **hub** | everything not explicitly optional; ≥ `conformance_min_clients` concurrent sessions; all five channel classes it declares; retained STATE; the readiness gate; grants and the [§10.4](qos.md#s10-4) shedding table; [§11](safety.md#s11) complete; [§6.9](session.md#s6-9) teardown equivalence; at least one [§12.3](security.md#s12-3) association mode; on radio-bearing silicon, BLE GATT is SHOULD and MUST where config mode is offered ([§13.1](transports.md#s13-1)'s hardware-hub profile, RFC-043, RFC-056); conformance is over duties, never topology ([§13.0](transports.md#s13-0)) | probe; TLS; bindings its hardware lacks (a base-profile hub — sim, host, relay — needs only one); hub signing ([§12.5](security.md#s12-5)); stores ([§8.7](catalog.md#s8-7)) if it declares none |
| **client-watch** | HELLO/WELCOME, catalog possession (dynamic or static) and CATALOG_READY, STATE adoption, seq rules, SYNCING/READY/LIVE distinction, ESTOP *send* | intents, streams, probe, crypto |
| **client-control** | client-watch, plus INTENT/ECHO with idempotent reconcile and the absolute-value rule, pairing, deadman-aware liveness, [§11.4](safety.md#s11-4) ownership behavior | probe, hub-signature verification |
| **client-configure** | client-control, plus the [§12.7](security.md#s12-7) administration surface and the [§8.9](catalog.md#s8-9) rendering checklist | stores it does not use |
| **constrained-client** | the [§8.5](catalog.md#s8-5) static profile including declared mismatch behavior, prefix parsing, canned-template correctness, CATALOG_READY with a stale etag | dynamic catalog, general CBOR decode, all crypto |
| **relay** | [§14](transports.md#s14) complete: dual-queue forwarding, the segment exception, ESTOP fast path, one of the [§14.3](transports.md#s14-3) timestamp rules | everything session-layer |
| **accessory** | [§17.1](#s17-1).1: a hub whose only peer is its accessory host over the [§13.3](transports.md#s13-3).1 spoke | the session layer and everything listed absent in [§17.1](#s17-1).1 |
| **accessory-host** | a hub duty set, [§17.1](#s17-1).1: required of any hub that sets BEACON `accessory_host` | nothing in [§17.1](#s17-1).1 |

Every profile, without exception, MUST satisfy [§5.8](wire-format.md#s5-8) (parser totality). A client is not exempt because it is "only" a client.

#### 17.1.1 The accessory profiles *(RFC-078)*

**`accessory`.** An accessory MUST:

- satisfy parser totality ([§5.8](wire-format.md#s5-8)) and encode its frames golden-vector exact ([§5.1](wire-format.md#s5-1) header, [§5.3](wire-format.md#s5-3) CBOR profile, [§5.4](wire-format.md#s5-4) layouts);
- declare itself as a [§8.1](catalog.md#s8-1) catalog with relative ids, `safe` values and the [§8.10](catalog.md#s8-10) validation rules, and serve it as blob namespace 0 over BLOB_REQ/BLOB_CHUNK with [§8.4](catalog.md#s8-4) pacing;
- answer every INTENT with ECHO or NACK, post-clamp and key-complete ([§9.3](channels.md#s9-3)), keeping idempotency over at least its most recent `intent_id` (stop-and-wait allows one outstanding control frame per direction);
- accept c2h STREAM bundles on its declared stream channels, validating the [§5.4](wire-format.md#s5-4) caps and dropping violators whole, and apply a bundle's samples on arrival keeping their relative offsets (`t_off`): it runs no CLOCK and the spoke has no time sync;
- push each declared STATE channel to its host at its declared `max_rate_hz` (on change for 0) with no SUBSCRIBE: the host is its sole, implicit subscriber;
- carry the registered **accessory-status** STATE at relative id `0x01`: `{state u8, fault u8, beacon_seq u16}` = 4 bytes (registry `accessory_status`), `state` an `accessory_states` value (0 `live`, 1 `safe_joined`, 2 `safe_deadman`, 3 `safe_goodbye`, 4 `safe_estop`, 5 `safe_fault`), `fault` device-defined (0 none), `beacon_seq` the header seq of the last BEACON it accepted; pushed on change and at least every `spoke_beacon_interval_ms`;
- honor every [§13.3](transports.md#s13-3).1 duty (channel follow, the deadman and the safe state, clamping, the 250-byte budget, no ESTOP rebroadcast), and keep a durable `accessory_id` and join per [§13.3](transports.md#s13-3).2.

**Absent, never required of an accessory:** HELLO/WELCOME and the rest of the session layer, the readiness gate, SUBSCRIBE/UNSUBSCRIBE/GRANT/PUBLISH, PROBE, CLOCK, access tiers, pairing tokens, AUTH, HUB_SIG, the trust ledger, every core channel, control ownership (its host is its only caller), multiple peers, BLE GATT, WebSocket, discovery, and the rendering annotations (`category`, `rank` and the rest stay optional).

**`accessory-host`.** A hub that sets BEACON `accessory_host` MUST beacon, answer probes and broadcast ESTOP ([§13.3](transports.md#s13-3).1); run the join, declaration fetch, validation, persistence and sticky slices with the three accessory core channels ([§8.10](catalog.md#s8-10), [§13.3](transports.md#s13-3).2); grow its catalog per [§8.6](catalog.md#s8-6) and advertise its capacity; run the relationship engine ([§8.11](catalog.md#s8-11)) and the interlock ([§11.6](safety.md#s11-6)); and:

- **proxy, never expose.** Clients never address an accessory. The host serves client subscriptions to accessory STATE from its retained copy. It forwards a client INTENT on an accessory channel only after its own checks (tier, declared range, relationship ownership, the interlock), under its own spoke `intent_id`, and answers the client with an ECHO carrying the **accessory's** applied values: the accessory is the ground truth ([§1.2](foundations.md#s1-2)), not the forward. No answer after [§13.3](transports.md#s13-3)'s retransmits: NACK `ACCESSORY_OFFLINE`. c2h bundles are forwarded the same way under the client's publication grant.
- **The sole-caller rule extends to accessories** ([§11.4](safety.md#s11-4)): the host is the only thing that commands one.
- **Never widen access.** An actuating accessory channel is at least `control` in the host's catalog whatever its declaration says; the host MAY raise any declared floor further.

## 17.2 Golden vectors {#s17-2}

Byte-exact vectors live in `vectors/` (manifest plus generated bytes). Determinism requirements this places on implementations: an implementation MUST accept an **injected clock**, an **injected RNG** (session ids, boot ids, nonces, tokens) and an **injected crypto delegate** (HMAC, signing, verification, constant-time compare); the deterministic CBOR profile ([§5.3](wire-format.md#s5-3)) does the rest. A vector is: fixed inputs → exact expected bytes (encode direction) and exact expected decoded model plus actions (decode direction). Implementations MUST pass every vector for their profile.

**Fixture freeze.** The conformance mini-catalog and every hand-derived golden byte array are **frozen at the v1.0 tag**. Its pinned values are: encoded length **805 bytes**, `catalog_etag` **`8C 5D 68 F4 1A D0 32 5E`** (chunked at 192 bytes → 5 chunks of 192/192/192/192/37). Earlier pins are superseded: v1-draft 733 bytes / `21 CB 26 C9 4F B3 88 B5`, moved to 775 / `F4 A2 8F BB 58 CE D1 6A` by the appended safety `modes` bitfield of [§11.1](safety.md#s11-1), then to 805 / `8C 5D 68 F4 1A D0 32 5E` by RFC-037's key 18 `size`, which the reference encoder now emits on every layout field ([§5.4](wire-format.md#s5-4)); the fixture source itself did not change. From the v1.0 tag forward, changing a frozen fixture is a protocol break, not a refactor.

**Amendment (C-6, operator ruling 2026-10-02).** Before the first tag, a frozen pin MAY be re-pinned by operator ruling: nobody consumes the vectors yet, and the RFC queue is the audit trail. The ruling and the old and new values are recorded here and in `spec/vectors/manifest.yaml`. From the v1.0 tag forward this amendment no longer applies.

## 17.3 Behavioral checklists {#s17-3}

Beyond byte vectors, per-profile behavioral tests run against the in-process binding ([§13.6](transports.md#s13-6)) with fault injection: the reconnect-reconcile flow ([§6.8](session.md#s6-8)); newest-wins under reorder ([§7.3](time.md#s7-3)); readiness gating of **both** planes and the READY timeout ([§6.4](session.md#s6-4)); retained-push-then-LIVE gating ([§2.2](foundations.md#s2-2)); duplicate-intent re-echo ([§9.3](channels.md#s9-3)); `cfg_gen` non-advance on a value-identical write and advance on a machine-originated change ([§4.2](foundations.md#s4-2)); shed-order correctness including the segment exception ([§10.4](qos.md#s10-4)); deadman policies per source type ([§11.3](safety.md#s11-3)); **teardown equivalence across all six session-end paths, back-to-back with no restart in between** ([§6.9](session.md#s6-9)); takeover flows ([§11.4](safety.md#s11-4)); ESTOP repeat-until-latch under 30 % loss ([§11.2](safety.md#s11-2)); role-exempt safety ops from a `watch` session ([§11.2](safety.md#s11-2)); static-profile degraded mode ([§8.5](catalog.md#s8-5)).

The traces in [Appendix E](appendices.md#appendix-e) double as the narrative form of this checklist: every step cites the normative rule it exercises, and **a step with no rule to cite is a spec bug**.

## 17.4 Fuzzing *(the totality gate)* {#s17-4}

Golden vectors prove correctness. **Fuzzing proves totality**, and [§5.8](wire-format.md#s5-8) is not testable any other way.

A conformance suite ships a **structure-aware fuzz corpus**: valid vectors per frame type plus mutations, run under a coverage-guided fuzzer with address and undefined-behavior sanitizers, against the decode surfaces of **both** roles. The release gate for a reference implementation is a stated CPU-hour budget with **zero crashes and zero sanitizer findings**.

Two lessons from building this gate, recorded because they generalize:

1. **A length check must be written as `declared ≤ remaining`, never as `start + declared ≤ size`.** The latter overflows and passes. The bug it produced was reachable from every message decoder *and from the skip path for unknown keys* — that is, from the exact bytes a forward-compatible decoder is required by [§4.3](foundations.md#s4-3) not to understand.
2. **An intra-object overflow is invisible to a heap sanitizer.** A write that spills from one array into the next member of the same struct reports nothing; only a write long enough to leave the whole enclosing object is caught. One such bug survived a multi-million-execution campaign and was found by reading the code. **Never conclude "the fuzzer would have caught it"** for a bug between two arrays of one object.

Honest scope: a decoder fuzz gate proves decoder totality. It does not drive hub and client through stateful protocol sequences, does not exercise transport adapters, and says nothing about semantic correctness — that is what [§17.2](#s17-2) and [§17.3](#s17-3) are for.
