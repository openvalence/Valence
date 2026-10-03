# Valence Provision

A public, install-free page that puts a Valence hub on WiFi from a browser:
connect over USB (Web Serial) or Bluetooth (Web Bluetooth), walk the hub's
`setup` category, send `wifi_join`. One static page, vanilla ES modules, no
build step.

| File | Job |
|---|---|
| `index.html` | the page and its styles |
| `app.js` | DOM glue: link choice, the walk, the join form |
| `link.js` | the two byte pipes as WebSocket ducks for `createSession`: Web Serial with SPEC §13.5 COBS framing, Web Bluetooth with SPEC §13.4 one-value-per-frame |
| `walk.js` | pure: catalog entries to setup steps (RFC-079), the `wifi_join` value map and its checks (SPEC §13.9), outcome text |
| `test/provision.test.mjs` | node suite: the codec, the walk, and both ducks end to end against `createLocalHub` |

The protocol is `../js` (the reference JS client) imported as ES modules; this
directory adds no wire knowledge of its own beyond the registry's
`ble_identity` (transcribed; the codegen emits no JS for it, and the suite
checks the copy against `spec/registry/registry.yaml`).

## What it does

1. **Connect.** USB: the port chooser, then COBS frames on the CDC. The port's
   RTS drops before DTR, because on an ESP USB-Serial/JTAG port DTR low with
   RTS high resets the chip and a reset leaves config mode (§13.4.1).
   Bluetooth: the chooser filtered to the Valence GATT service; the
   advertisement's `ble_adv_flags` is read where the browser allows it
   (`watchAdvertisements`, behind a flag in Chrome today).
2. **Knock.** A session below `configure` sends a bare PAIR_REQ (§12.3). In
   config mode the hub grants `configure` to the first knock.
3. **Walk.** One step per `setup` entry in catalog order: settings steps write
   through their setting channel and show the hub's reported values; the
   network step is core channel 0x000F, bound by id as §13.9 intends.
4. **Join.** SSID and passphrase go out once in a `wifi_join` INTENT. The
   answer arrives when the join concludes: ECHO with the hub's new address and
   Valence port, or NACK `NETWORK_JOIN_FAILED` (the hub keeps its prior
   network).

The passphrase is read at the moment of the send and the field is cleared at
once. Nothing is stored: no form submit (no password-manager save), no
`localStorage`, an in-memory catalog cache, a per-load instance id.

## Browsers

Chrome and Edge on desktop have both APIs; Chrome on Android has Web
Bluetooth only. Firefox and Safari have neither, and the page says so. Both
APIs need a secure context: https, or `http://localhost`.

## Running it locally

Serve the **repository root** (the page imports `../js/...`), then open
`/clients/provision/`:

```
python -m http.server 8000      # from the Valence repo root
# http://localhost:8000/clients/provision/
```

## Hosting

The page is meant to ship with the docs site (`docs-site/`, GitHub Pages via
`mike`, rfc-0y5 for the custom domain, which should land first so the URL
printed on hardware never changes). The deploy must publish `clients/provision/`
and `clients/js/` side by side under one prefix, because the imports are
relative (`../js/session.js`); copying only `provision/` breaks the page. The
docs workflow does not do that copy yet. No server logic is involved: any
static host over https works.

## Tests

```
node clients/provision/test/provision.test.mjs
```

Exits 1 on any failure. **Web Bluetooth and Web Serial cannot run headless**,
so the browser objects are fakes with the APIs' shapes (a `SerialPort` with
streams and `setSignals`, a `BluetoothDevice` with a GATT service and
characteristics), bridged to `createLocalHub` plus a §13.9 answer for
0x000F. What a fake cannot show (the choosers, DTR/RTS on a real CDC port,
the negotiated GATT MTU, a hub's real join) is owed on hardware; the Nucleus
bench item is val-9u0.23 in that repo.
