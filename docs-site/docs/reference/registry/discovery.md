---
title: Discovery
description: Generated tables of the Valence BLE GATT identity, its advertising flags, and the UDP discovery probe/reply (RFC-046).
generated: true
---

<!-- ==========================================================
     GENERATED FILE. DO NOT EDIT.
     Source of truth: spec/registry/registry.yaml
     Generator:       docs-site/tools/gen_docs_tables.py
     Regenerate:      python docs-site/tools/gen_docs_tables.py
     CI gate:         python docs-site/tools/gen_docs_tables.py --check
     Hand edits are overwritten and fail the docs build.
     ========================================================== -->

# Discovery

A client finds a hub two ways before it has a session. One is a pinned
BLE GATT identity. The other is a UDP broadcast probe for WS-side
clients without BLE. Both are read-only identity surfaces. Neither
carries a control plane.

## BLE GATT identity

Every conformant BLE hub advertises the **same** service UUID, so a client
scans for exactly one thing. The first three groups spell the project name
in ASCII, deliberately, so the UUID is greppable rather than an opaque v4.

| Role | UUID |
|---|---|
| Service | `56414C45-4E43-4531-8000-000000000001` |
| Write characteristic (c2h) | `56414C45-4E43-4531-8000-000000000002` |
| Notify characteristic (h2c) | `56414C45-4E43-4531-8000-000000000003` |

The scan-response flags record is Manufacturer-Specific Data under company id `0xFFFF`: `company_id:u16le + flags:u8`.

## BLE advertising flags

A legacy (≤31 B) advertising payload can spare one byte for flags,
after the service UUID and a shortened hub name. Bits not listed are
zero.

| Mask | Bit | Name | Notes |
|---|---|---|---|
| `0x01` | `bit 0` | `pairing_window_open` | a §12.3 association window is open right now (same meaning as the 0x17 BEACON pairing-open flag, ESP-NOW's equivalent) |
| `0x02` | `bit 1` | `ws_available` | the hub currently has a live IP and a listening WebSocket port: RFC-043's signal that a BLE-connected client SHOULD auto-upgrade to WS. The endpoint itself rides WELCOME `ws_port`/`ipv4` (cbor_keys 46/47), not this byte: a single bit cannot carry a port and an address, and the upgrade hop happens post-HELLO anyway. |
| `0x04` | `bit 2` | `config_mode` | RFC-079 (§13.4.1): the hub booted with its pairing control held and is in config mode: BLE + USB serial provisioning, no WiFi association, no WebSocket, no softAP, first knock granted configure. A client SHOULD mark the hub 'needs setup' and open on ui_categories 15 setup. |

## ESP-NOW BEACON flags

The `flags` byte of the pinned BEACON (`0x17`) payload, the accessory
spoke's heartbeat (SPEC §13.3.1). Bits not listed are zero.

| Mask | Bit | Name | Notes |
|---|---|---|---|
| `0x01` | `bit 0` | `pairing_window_open` | a §12.3 association window is open (the original BEACON pairing flag) |
| `0x02` | `bit 1` | `datagram_estop` | this hub accepts ESTOP frames from any peer on its channel (the RFC-053 item 2b mirror bit, ratified by RFC-075) |
| `0x04` | `bit 2` | `accessory_host` | RFC-075: this hub runs the ESP-NOW spoke and accepts accessory joins (§13.3.1, §8.10) |
| `0x08` | `bit 3` | `estop_latched` | RFC-075: this hub's safety snapshot (0x0003) shows ESTOP latched right now; an accessory hearing it enters safe_estop. The 1 Hz loss-recovery path for an accessory that missed every ESTOP repeat. |

## UDP discovery

This is the canonical WS-side discovery path for a LAN client without
BLE. It uses plain UDP sockets on both ends. It is immune to the
multicast, mesh-AP and Android failure modes that make mDNS unreliable
in real homes.

| Property | Value |
|---|---|
| Port | `22096` |
| Magic | `VLNC` |
| Reply rate limit | 1 / source / second |

The probe and reply frames themselves, `DISCOVER_PROBE` (`0x1E`) and
`DISCOVER_REPLY` (`0x1F`), are frame types. See [Frame types](frames.md).
A reply carries `magic + nonce + hub_name + hub_id + proto_ver + ws_port +
fw_version + catalog_etag + flags`. A passive observer of a normal
WELCOME could already learn all of it.

## UDP discovery reply flags

The `flags` byte closing the `DISCOVER_REPLY` (`0x1F`) payload. Bits
not listed are zero.

| Mask | Bit | Name | Notes |
|---|---|---|---|
| `0x01` | `bit 0` | `pairing_window_open` | a §12.3 association window is open right now (the 0x17 BEACON flag's meaning, plus the endpoint) |
| `0x02` | `bit 1` | `datagram_estop` | RFC-053 item 2b: this hub honors an ESTOP frame on this UDP port right now (the setting's live value), so a sessionless sender learns at setup whether its ESTOP will be heard; the BEACON bit1 mirror |

> DEMO-CANDIDATE: send a live UDP probe to a real hub and decode its reply on the page.
