# Valence — MultiFunPlayer plugin

Streams a [MultiFunPlayer](https://github.com/Yoooi0/MultiFunPlayer) (MFP) axis to a
**Nucleus** machine over its native **Valence** protocol — the device-shadow +
capability-negotiation sync protocol the firmware speaks on a binary WebSocket.

This is the first external client implementation of Valence. Its wire bytes are a
faithful mirror of the live-verified reference client `tools/valence_probe.py`.

Instead of TCode-over-serial/UDP, the plugin feeds the machine one of two ways,
selected by the **Mode** setting:

- **Samples** (default) — reads the axis position at a fixed rate and pushes it onto
  the `motion-input` stream channel (`0x2100`, RFC-047 grid; was `0x0084`): target
  position *and* a handoff velocity, so the machine plans smooth motion between the
  dense samples.
- **Segments** — reads the funscript's own keyframes and sends **one timed command
  per action** on the `motion-segment` channel (`0x2101`; was `0x0085`): `{target, duration,
  end_velocity}`. That is ~2–4 packets/second instead of 50, and the machine renders
  the sender's *native* stroke waveform (a C² quintic over the commanded duration)
  rather than reconstructing it from point samples.

---

## Install

MFP compiles plugins itself (Roslyn, at runtime) — you do **not** build anything to
install this.

1. Create a folder `Valence` under your MFP `Plugins` directory:
   `…\MultiFunPlayer\Plugins\Valence\`
2. Copy **`Valence.cs`** and **`Valence.xaml`** into it.
3. Start MFP. The plugin appears in the plugin list; open its tab.

Only those two files ship. `Valence.csproj`, `WireSelfTest.cs`/`.csproj`, and
`LiveWireTest.cs`/`.csproj` are dev-only (compile-check, golden-byte self-test, and
live device wire test) and must **not** be copied into the Plugins folder.

---

## Usage

1. In the plugin tab, set **Address** (the machine's IP, default `192.168.1.229`) and
   **Port** (`82`). Or hit **Discover** to find machines on the LAN via mDNS and pick
   one from the list — it fills Address/Port for you. Manual entry always works;
   discovery is a convenience.
2. Confirm **Axis** (default `L0`), **Rate** (default `50` Hz), and **Mode**
   (`Samples` or `Segments` — see below). Mode is locked while connected.
3. Press the **▶ toolbar button** to connect. It streams until you press it again
   (which shows as ■). Connect/disconnect is also bindable from MFP's **Shortcuts** as
   `Valence::Connection::Toggle` / `::Connect` / `::Disconnect` (mirroring a native
   output target's action naming; Connect/Disconnect are idempotent).

### The panel

Laid out by what you actually touch mid-session. Everything set-once lives behind a
toolbar button, so the panel costs about half the height it used to.

**Toolbar** — connect/disconnect (▶/■), **Home** (INTENT `0x0103` op 1), the **mode
toggle**, **limits**, and **setup**. The mode button's icon *is* the mode: a **bezier
curve** for Segments (the machine renders the sender's own continuous waveform per
stroke) and a **staircase** for Samples (discrete position points at a fixed rate).
It shows the mode that is *active*; pressing it switches and, if you are connected,
**re-negotiates the session** —
stream mode is settled in HELLO (different channels, different rates, and Segments
declares a `curve_family`) and there is no frame that changes it on a live session. The
machine stops receiving for the length of the reconnect and its deadman covers the gap,
so it is safe, but it *is* a visible interruption mid-scene.

* **LIVE** (always visible) — granted rate, session, uptime, bundles/segments, STATE
  count, NACK + rate-limited counts, clock offset/RTT, and the Segments-mode divergence
  warning.
* **THE RAIL** — the machine's travel drawn to scale, with the stroke window on it and
  three markers. The colors are the machine's own WebUI language:
  * **blue (`reality`)** — the **measured carriage position**, plus the window band. This
    is decoded STATE: where the machine actually is.
  * **purple (`intent`)** — commanded and not-yet-confirmed. Two of these: the machine's
    own **setpoint**, and a ghosted marker for **where MFP last asked the axis to be**
    (mapped through the device's window exactly as the machine's range mapper does).
    Overlaying the request on the result is the whole point — the gap between them is
    what the planner and the clamps did to what you sent.
  * **Drag the two purple handles** to set the window, or type in the two boxes under the
    track. A drag moves a dashed *draft* outline only; the solid band stays where the
    machine says it is until you press **Apply** — and **Apply/Revert only appear once the
    draft actually differs**, so there is never a lit button with nothing to do. The status
    line then reports the **applied, post-clamp** value the device echoed back, or the NACK
    that refused it, correlated by `intent_seq`. Handles snap to whole millimetres, which
    is the device's own declared step for these fields.
  * The rail hides entirely on a hub that advertises no travel roles (drawing it would
    mean inventing the scale every marker is measured against); the numeric window editor
    appears on its own in that case.
* **Limits** (toolbar) — read-only machine-driven speed / accel / jerk. Reads
  "not advertised" on a hub that declares none of those roles, rather than guessing.
* **Setup & discovery** (toolbar) — Address/Port/Discover, the discovered-device list,
  Axis/Rate/Mode/PIN, and the adopted catalog's channel count, role count and etag.
  Everything here except Mode is locked while connected.

The machine **must be homed** before it will actually move. If it is not, the firmware
accepts and counts your samples but drops them at the safety gate (correct behavior) —
you will see bundles climbing but no motion. Home it from the machine's own WebUI/app.

### Settings (persisted by MFP)

| Setting | Default | Meaning |
|---|---|---|
| **Address** | `192.168.1.229` | Machine IP / hostname. |
| **Port** | `82` | Valence WebSocket port. |
| **Rate (Hz)** | `50` | How often the axis is sampled and streamed. Clamped 10–250; the machine may grant a *lower* rate (its channel cap is 333 Hz) and the plugin streams at the **granted** rate, not the wish. |
| **Axis** | `L0` | Which MFP `DeviceAxis` to stream (`L0`, `L1`, `R0`, …). |
| **Mode** | `Samples` | `Samples` = 50 Hz dense points on `0x2100` (was `0x0084`). `Segments` = one timed command per funscript action on `0x2101` (was `0x0085`). Locked while connected. See *Samples vs Segments* below. |
| **PIN** | *(empty)* | Pairing PIN. Sent in HELLO's token field. The firmware currently accepts any client (LAN-trust), so this is forward-compatibility plumbing — leave it empty unless the device asks for it. |

### Samples vs Segments — which to use

**Samples** is the safe default and works with *anything* MFP can put on an axis:
motion providers, SmartLimit, sync/auto-home, live-driven axes, scripts, all of it. It
samples the *final* axis output at the Rate you set and streams point+velocity — the
machine never sees the script, only where the axis is right now.

**Segments** wins for **plain funscript playback**: it sends the script's authored
keyframes as native timed strokes, so the machine plans each leg as one smooth quintic
over exactly the commanded duration. The wire traffic drops from ~50 packets/s to a
handful, and the motion is *better* (it is the sender's real waveform, not a
reconstruction). Each segment carries an **end velocity** for slope continuity between
strokes — a reversal (peak/trough) ends at rest, a straight-through keyframe hands off
its outgoing velocity, and a gap or script-end leaves the end velocity unconstrained.

Requires a device that advertises the `motion-segment` channel (`0x2101`; was `0x0085`); if the hub
does not grant it, connecting in Segments mode errors instead of silently degrading.

**Caveat — Segments sends the *authored* script, not the transformed axis output.**
The plugin replicates MFP's two cheap deterministic transform stages (Script Scale and
Invert Script) so scaled/inverted scripts stream correctly, but it **cannot** replicate
the deeper stages — motion-provider blend, SmartLimit, Speed Limit, sync, auto-home. If
one of those is active on the axis, what the machine does will differ from what MFP's UI
shows. The plugin watches for this: while in Segments mode it compares the axis' actual
output against its own script prediction once a second, and if they diverge persistently
it surfaces a warning in the LIVE panel — it keeps streaming the authored script (it
never silently switches modes), but the warning is your cue to use Samples mode for that
axis. Live-driven axes and heavy motion-provider setups belong on Samples.

---

## What it does on the wire (protocol summary)

All of this mirrors `tools/valence_probe.py` and `spec/SPEC.md`.

1. **Connect** — WebSocket to `ws://addr:port/`, subprotocol `valence.v1`, binary frames.
2. **HELLO → WELCOME** — identifies (stable 8-byte instance id), wishes to *publish*
   on channel `0x2100` (was `0x0084`) at the configured rate, **and (v1.0) carries its `subscriptions`
   wish list and any cached `catalog_etag`** — §6.2 exists so a simple client can finish
   setup in one round trip. The hub replies WELCOME with a session id and a
   `granted_publishes` entry (CBOR key 36) confirming the applied publish rate. No
   grant ⇒ the plugin surfaces an error and retries.
2b. **CATALOG_READY (`0x19`) — the §8.4 / RFC-015 readiness gate.** Until the session
   declares *which* catalog it decodes against, the hub emits **no** data-plane frame
   (no retained STATE, no STREAM) and NACKs every INTENT `NOT_READY`; a session that
   never declares is GOODBYE'd with `READY_TIMEOUT` after 15 s. Two paths:
   * **cached etag matched** ⇒ already ready at WELCOME. Zero extra frames, zero
     transfer. This is every reconnect after the first (the cache is per-host and lives
     for the MFP session).
   * **otherwise** ⇒ `BLOB_REQ` (`0x1A`, empty CBOR map = "all of blob namespace 0, the
     catalog") → `BLOB_CHUNK` (`0x1B`, 14-byte identity header) reassembly → verify the
     SHA-256[:8] **locally** → `CATALOG_READY` carrying the etag just proved. A transfer
     that does *not* verify declares the digest of what is actually held, so the hub can
     flag the mismatch instead of being misled. Missing chunks are repaired selectively
     (`chunks` key 27) on the 500 ms gap cadence.

   `CATALOG_REQ`/`CATALOG_CHUNK` (`0x09`/`0x0A`) are **retired and their numbers burned**.
3. **SUBSCRIBE** — `safety` (`0x0003`) and `motion` (`0x0080`) already rode in HELLO. What
   is left is the channel this hub happens to carry the **kinematic field roles** on,
   which is only knowable once the catalog is decoded — see *Machine limits readback*.
4. **CLOCK sync** (§7.1) — a few `0x05` exchanges; keeps the best-RTT offset. All STREAM
   timestamps are **hub time**, so the plugin converts local µs → hub µs using this offset,
   and re-syncs every ~10 s (drift between syncs is taken from a monotonic `Stopwatch`).
5a. **Samples STREAM loop** — at the granted rate: reads the axis (0..1), derives velocity
   `(x − x_prev)/dt` with a light EMA, and sends a single-sample bundle on `0x2100` (was
   `0x0084`). The
   4-byte sample is `{target_norm: u16 = clamp01(pos)×10000, vel_norm: i16 = clamp(vel,±32.767)×1000}`,
   little-endian, stamped with the current hub time. It keeps streaming even when the value
   is static — a constant target is a valid *hold*, and the device deadman (§11.3) handles a
   truly vanished source. (50 Hz traffic is its own deadman keepalive.)

5b. **Segments engine** — HELLO wishes *both* `0x2100` (fallback; was `0x0084`) and `0x2101`
   (was `0x0085`) @ 10 Hz. An
   event-driven cursor walks the funscript keyframes as MFP reports media position; crossing
   into a new inter-keyframe span emits **one** 6-byte segment on `0x2101`:
   `{target_norm: u16 ×10000, duration_ms: u16, end_vel_norm: i16 ×1000}`. `duration_ms` is
   the remaining wall-clock time from the machine's actual position to the next keyframe
   (÷ media speed); `end_vel_norm` is the outgoing-slope handoff (INT16_MIN sentinel = "no end
   velocity"). Seeks and play-resume hard-resync the cursor and emit a fresh segment from the
   current position (the device replans from its real state); pause stops emitting (the machine
   finishes its in-flight segment and settles); gaps emit nothing (the machine holds).
   Emissions arrive on MFP's event thread and are handed to the connection task through a
   thread-safe queue — a single writer owns the socket (`ClientWebSocket` forbids concurrent
   sends). **PING keepalive:** because segments are sparse, the connection task sends a raw
   empty PING (§6.5) whenever the link has been silent ≥ 400 ms, keeping the hub's 600 ms
   deadman from firing between strokes.
6. **Inbound** — one receive loop routes CLOCK replies, answers PING with PONG, decodes
   STATE payloads against the adopted catalog layout, surfaces ECHO `applied` values, and
   counts NACKs (surfacing `RATE_LIMITED` separately). NACK's `intent_seq` (key 41,
   RFC-001) is read and correlated. EVENT's kind-specific fields live in the `body` (40)
   sub-map, whose integer keys come from the *channel's* catalog schema, not the global
   key space; the plugin logs events and acts on none. New v1.0 frame types (PUBLISH
   `0x18`, CATALOG_READY `0x19`, BLOB_REQ `0x1A`, BLOB_CHUNK `0x1B`, AUTH `0x1C`,
   HUB_SIG `0x1D`) are named and tolerated; anything else is unknown-means-ignore.
   Malformed frames are logged and skipped, never fatal.
7. **Operator INTENTs** — the Home button sends `0x0103 {1: 1}`; the stroke-window editor
   sends the role-resolved config INTENT (`0x0101 {1: min, 2: max}` on this device).
   Both are queued by the UI thread and sent by the connection task, which owns the
   socket. **`header.seq` is set to `intent_id`** — the hub stamps a NACK's `intent_seq`
   from the *inbound frame header's* seq, so making the two the same number is what turns
   RFC-001's correlation key into a usable one.
8. **Reconnect** — an unexpected drop retries with 2 s → 5 s → 10 s backoff until you
   disconnect; the status shows "Reconnecting".

### Machine limits readback — found by field ROLE, not by channel number

The plugin displays the machine's stroke window, its **input** (machine-driven) speed,
accel and jerk ceilings, and the rail's live position. It finds them the RFC-006(b) way:
by scanning the fetched catalog for the registry `field_roles` values `window.min`,
`window.max`, `limit.input.speed`, `limit.input.accel`, `limit.input.jerk`,
`telemetry.position`, `telemetry.target`, `telemetry.velocity`, `geometry.max_travel`,
`geometry.measured_travel` — and *only* those. The rail's roles cost **no extra
subscription**: on this firmware position/target/velocity live on `motion` (`0x0080`),
which already rides in HELLO. `geometry.measured_travel` is preferred over
`geometry.max_travel` for the rail's length because it is what a real home measured, and
a zero there is treated as "no home yet", never as a measurement. The
channel number appears nowhere in the plugin source. On this firmware they resolve to
`0x0081` fields at byte offsets 0/4/16/20/28, writable through `0x0101` keys 1/2/5/6/7;
on a hub that declares those roles elsewhere the same code works unchanged, and on a hub
that declares none of them the panel reads **"not advertised"** and no extra SUBSCRIBE
is sent. The catalog is also the *decoder ring*: a STATE payload is a flat packed struct
with no self-description, so the layout the hub published is the only honest way to read
it. There is deliberately no fallback layout table.

**This readback creates no obligation whatsoever on the plugin.** It does not map, clamp,
scale, or pre-adapt anything to these numbers, and there is no code path that could.
MFP plays a funscript; it cannot make authored content more machine-compatible, and it
must not try. The plugin ships the sender's intent **as authored** and the machine plays
back whatever it is fed as well as it possibly can (RFC-008 — the machine owns motion
processing). The limits are shown to the operator. Full stop.

### Wire numbers used (all from `spec/registry/registry.yaml`)

- **Frame types:** HELLO `0x00`, WELCOME `0x01`, PING `0x03`, PONG `0x04`, CLOCK `0x05`,
  SUBSCRIBE `0x06`, GRANT `0x08`, STATE `0x0B`, STREAM `0x0C`, INTENT `0x0D`, ECHO `0x0E`,
  EVENT `0x0F`, NACK `0x10`, GOODBYE `0x11`, PUBLISH `0x18`, CATALOG_READY `0x19`,
  BLOB_REQ `0x1A`, BLOB_CHUNK `0x1B`, AUTH `0x1C`, HUB_SIG `0x1D`.
  (`0x09`/`0x0A` — CATALOG_REQ/CATALOG_CHUNK — are **retired**, numbers burned.)
- **Frame header:** 8 bytes little-endian `[type:u8][flags:u8][channel:u16][seq:u16][len:u16]`.
  On an INTENT, `seq` carries the `intent_id` (see RFC-001 note above).
- **CBOR keys:** proto_ver 1, client_kind 2, client_name 3, instance_id 4, token 5,
  session_id 6, boot_id 7, catalog_etag 8, cfg_gen 9, subscriptions 10, publishes 11,
  rate_hz 12, priority 13, granted_rate_hz 14, channel_id 15, code 16, detail 17,
  intent_id 18, applied 19, value 20, roles 23, deadman_ms 24, deadman_policy 25,
  chunks 27, event_kind 33, grants 35, granted_publishes 36, blob 38, body 40,
  intent_seq 41.
- **`blob` (38) sub-keys:** ns 1, store_id 2, slot 3, generation 4, chunk_index 8,
  chunk_count 9, total_bytes 10. Namespaces: catalog 0, store 1.
- **BLOB_CHUNK raw header (14 B, LE):** `ns u8 | store_id u8 | slot u8 | reserved u8 |
  generation u16 | chunk_index u16 | chunk_count u16 | total_bytes u32`. The reserved
  byte is ignored, never validated.
- **Channels:** safety `0x0003` (9 B since the `modes` byte was appended), motion `0x0080`,
  motion-input `0x2100` (STREAM·motion·00, STREAM c2h, ≤333 Hz; was `0x0084` pre-RFC-047),
  motion-segment `0x2101` (STREAM·motion·01, STREAM c2h,
  ≤50 Hz, 6-byte `{target u16, duration_ms u16, end_vel i16}`; was `0x0085`), home `0x0103` (INTENT,
  op 1 = home). The **config** channel and the **limits/window** STATE channel are NOT
  listed here on purpose — they are resolved from catalog field roles at runtime.
- **CBOR profile:** deterministic (§5.3) — definite lengths, shortest-form ints,
  float32-only (`0xFA` + big-endian binary32), map keys ascending.

---

## Developer notes

### Compile check
```
dotnet build clients/mfp/Valence.csproj
```
`Valence.csproj` is a dev-only project that compiles `Valence.cs` standalone against a
local MFP install. **Edit its `HintPath`s** if your MFP is not at
`C:\Users\Atlan\Downloads\MultiFunPlayer-1.34.5-patreon-SelfContained.10.0.300\`.
It needs the `net10.0` SDK. The `#:` directives at the top of the plugin are legal because
MFP (and this project, via `<Features>FileBasedProgram</Features>`) compile in
file-based-program mode.

### Wire self-test (golden bytes)
```
dotnet run --project clients/mfp/WireSelfTest.csproj
```
Byte-compares the C# encoder against hex derived by running `valence_probe.py`'s own
CBOR primitives (HELLO in five shapes, CLOCK, STREAM/SEGMENT bundles, SUBSCRIBE, GOODBYE,
BLOB_REQ, CATALOG_READY, BLOB_CHUNK header decode, INTENT + frame seq). Exits 0 on
all-pass. The codec in `WireSelfTest.cs` is a deliberate copy of `Valence.cs`'s — if you
change one, mirror the other and re-run.

**The HELLO goldens moved at v1.0 and that coupling is intentional.** Adding RFC-006's
`subscriptions` wish to HELLO changes its bytes; this file is where that is enforced. The
old publish-only golden is kept as a regression guard alongside the new shapes.

### Live wire test (against Valence Bench, a simulator, or a real device)

**Requires a running hub to connect to** — this is the one test in this repo
that is not self-contained. `hub/bench/` (this repo) or Nucleus's
`sim/valencesim` (machine repo, real device catalog) both work with no hardware;
against real hardware, see the safety gate note below.

```
dotnet run --project clients/mfp/LiveWireTest.csproj -- 127.0.0.1 82
```
Compiles `Valence.cs` itself (the plugin's real codec/client/catalog/discovery classes —
no copies) into a console harness and runs the full session: mDNS discovery,
HELLO→WELCOME publish grant, **BLOB_REQ catalog fetch + local SHA-256 verify +
CATALOG_READY**, **RFC-006(b) role lookup and live role-value decode**, CLOCK sync, a
role-resolved stroke-window INTENT round trip (**simulator only**), 5 s of STREAM @ 50 Hz,
then diffs the target's `/api/vmotion` ingress counters.

**Safety gate.** On real hardware it reads `/api/status` and **refuses to run if the
machine is homed or e-stopped** (unhomed = every sample is dropped at the HOMED safety
gate, so the wire is exercised with zero motion risk). valencesim has no `/api/status`; the
`sim: true` flag in `/api/capabilities` is an explicit waiver, and a target that is
neither readable nor a declared sim is an **abort** — "unknown machine state" never
passes. The config-writing INTENT block and everything that could move an axis is gated
on `sim`; the Home intent is never sent by this harness at all.

**Run it TWICE back-to-back without restarting the target.** That is the
source-ownership-release regression check, and it exists because a real field bug hid for
months behind deploys that rebooted between runs (fw ≥ 2.1.44).

Pass `--segments` to exercise the `0x2101` path instead (was `0x0085`): it wishes both channels,
requires the segment grant, and sends 5 timed segments over ~5 s (alternating target
0.3/0.7, duration 900 ms) with the 400 ms PING keepalive, then diffs the same ingress
counters. Same safety gate applies.

---

## Troubleshooting

- **"no publish grant"** — the hub did not grant channel `0x2100`. Confirm the firmware
  advertises `features.valence` and the motion-input channel (`curl http://<ip>/api/capabilities`).
- **Bundles climb but nothing moves** — the machine is not homed, or another source owns
  motion. Home it; check the machine's own UI for the active control source.
- **NACK `RATE_LIMITED` counting up** — you are asking for more than the granted rate.
  Lower **Rate**; the plugin already streams at the granted rate, so this usually means a
  transient. Persistent overage can get the session evicted.
- **Won't connect** — wrong IP/port, machine off Wi-Fi, or mid-crash. Verify with
  `curl http://<ip>/api/capabilities`. Discovery finding nothing does not mean the machine
  is down — some networks block multicast; just type the address in.
- **Motion feels laggy or jerky** — raise the rate (up to what the device grants) for a
  denser stream. Velocity handoff (`vel_norm`) already feeds the planner's feedforward.
