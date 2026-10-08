# Valence Connect — the MultiFunPlayer plugin

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

1. Create a folder `ValenceConnect` under your MFP `Plugins` directory:
   `…\MultiFunPlayer\Plugins\ValenceConnect\`
2. Copy **`ValenceConnect.cs`** and **`ValenceConnect.xaml`** into it.
3. Start MFP. The plugin appears in the plugin list; open its tab.

Only those two files ship. `ValenceConnect.csproj`, `WireSelfTest.cs`/`.csproj`, and
`LiveWireTest.cs`/`.csproj` are dev-only (compile-check, golden-byte self-test, and
live device wire test) and must **not** be copied into the Plugins folder.

---

## Usage

1. Open **Link setup** (the cog in the **Link** row) and set **Address** (default
   `192.168.1.229`) and **Port** (`82`), or press **Discover** to find hubs by the §13.8
   UDP probe and pick one; it fills Address/Port. Manual entry always works. **Axis**
   (default `L0`), **Rate** (default `50` Hz) and the paired token live there too, all
   locked while connected.
2. Pick the stream mode with the toolbar **mode** button (`Samples` or `Segments`, see
   below).
3. Press the **▶ toolbar button** to connect. It streams until you press it again
   (which shows as ■). Connect/disconnect is also bindable from MFP's **Shortcuts** as
   `ValenceConnect::Connection::Toggle` / `::Connect` / `::Disconnect` (mirroring a native
   output target's action naming; Connect/Disconnect are idempotent).

### The panel

Five groups, every row a fixed height: an answer, a refusal or a reconnect fills its
own slot and never moves a control.

**Toolbar**: connect/disconnect (▶/■) and the **mode** button. Its icon *is* the
active mode: a **bezier curve** for Segments (the machine renders the sender's own
continuous waveform per stroke) and a **staircase** for Samples (discrete position
points at a fixed rate). Pressing it while connected **re-negotiates the session**:
stream mode is settled in HELLO (different channels, different rates) and no frame
changes it on a live session. The machine stops
receiving for the length of the reconnect and its deadman covers the gap, so it is
safe, but it *is* a visible interruption mid-scene.

* **Link**: the session line (`Streaming L0 @ 50 Hz`, the granted rate), the endpoint,
  and the **Link setup** button. While connected a second line shows the device, the
  session id and uptime. The setup dialog also shows the adopted catalog's channel
  count, role count and etag.
* **Home**: runs the catalog's `action.home` verb (the op whose option label is
  `home`) and shows the hub's answer in the same row: `accepted: home` (the op the ECHO
  carries), or `refused <NACK name>`, followed by the hub's §16.1 `detail` text when it
  sends one. Grayed on a hub that labels no `home` op.
* **Window**: the min/max draft boxes over **the rail**, the machine's travel drawn to
  scale with the stroke window on it and three markers in the machine WebUI's colors:
  * **blue (`reality`)**: the **measured carriage position**, plus the window band. This
    is decoded STATE: where the machine actually is.
  * **purple (`intent`)**: commanded and not yet confirmed. Two of these: the machine's
    own **setpoint**, and a ghosted marker for **where MFP last asked the axis to be**
    (mapped through the device's window exactly as the machine's range mapper does). The
    gap between them is what the planner and the clamps did to what you sent.
  * **Drag the two purple handles** or type in the boxes. A drag moves a dashed *draft*
    outline only; the solid band stays where the machine says it is until **Apply**, and
    **Apply/Revert appear only once the draft differs**. The answer line under the rail
    then shows the **applied, post-clamp** values the ECHO carried, or
    `refused <NACK name>` plus any `detail`, correlated by `intent_seq`. Handles snap to
    whole millimeters, the device's declared step for these fields.
  * On a hub with no travel roles the track stays empty (a scale would be invented) and
    the boxes still work.
* **Limits**: read-only machine-driven speed / accel / jerk; `n/a` for a role the hub
  does not declare.
* **Readback**: the status line `pos … · tgt … · vel … · window …`, every value decoded
  by field role from STATE and printed in the catalog field's own unit (`--` before the
  first value, `n/a` for a role the hub does not declare). Under it: bundles or segments
  sent, STATE count, NACK and rate-limited counts, CLOCK RTT and offset, the **lag** row
  (see *The lag meter* below), and in Segments mode the divergence warning.

The machine **must be homed** before it will actually move. If it is not, the firmware
accepts and counts your samples but drops them at the safety gate (correct behavior):
you will see bundles climbing but no motion. Home it from the **Home** row, or from the
machine's own UI when the hub refuses the op (a board with no drive answers
`UNSUPPORTED_OP`).

### Settings (persisted by MFP)

| Setting | Default | Meaning |
|---|---|---|
| **Address** | `192.168.1.229` | Machine IP / hostname. |
| **Port** | `82` | Valence WebSocket port. |
| **Rate (Hz)** | `50` | How often the axis is sampled and streamed. Clamped 10–250; the machine may grant a *lower* rate (its channel cap is 333 Hz) and the plugin streams at the **granted** rate, not the wish. |
| **Axis** | `L0` | Which MFP `DeviceAxis` to stream (`L0`, `L1`, `R0`, …). |
| **Mode** | `Samples` | `Samples` = 50 Hz dense points on `0x2100`. `Segments` = one timed command per funscript action on `0x2101`. Set with the toolbar mode button; switching while connected re-negotiates the session. See *Samples vs Segments* below. |
| **Paired token** (`PairingPin`) | *(empty)* | A paired 16-byte token as 32 hex characters, sent in HELLO's token field. Anything else is ignored. Empty: the plugin mints a single-use control token from the hub's `/uitoken` on every connect; with neither, it connects at watch tier (telemetry and e-stop work, playback does not). |

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

### The lag meter

The **Lag** row in LIVE answers the question this plugin could not answer before:
*how far behind the timeline MFP meant is the machine actually moving?* It reads
`+18 ms · amp 1.00`, or `idle` while nothing is moving enough to measure.

It is the only instrument that can answer it, because it is the only place that
knows both halves: the **intended hub time** of every segment it sent (the
segment's END: `t_base + t_off + duration`; for Samples mode, the sample's own
stamp) and the **rendered position** coming back on the motion STATE channel,
mapped onto the stroke window the same way a target is mapped onto it. Both
series are stamped in **hub microseconds** through the clock offset the plugin
already maintains, so there is one time base and no second clock to agree with.

Once a second it resamples the last ~3 s of both series onto a 10 ms grid and
finds the shift in ±300 ms (5 ms steps) that maximizes their cross-correlation.
Positive means the rendered motion arrives *after* it was intended. The
amplitude ratio beside it is the least-squares gain of rendered against intended
at that shift -- below 1.0 means the machine is not reaching the full stroke it
was asked for. Cross-correlation rather than a sine fit is what makes it
**arbitrary-script-safe**: it reads a real funscript as well as a bench sine.

**It is a METER, never a controller.** Nothing it produces reaches the
scheduler, the lookahead, or your sync offset. Setting that offset stays your
call -- showing you the true number is the entire point. It also logs at INFO
once every 10 s.

Next to it, `hub:` is the hub's OWN declared scheduling latency. It reads `n/a`
today: [RFC-059](../../spec/RFC-QUEUE.md) proposes `schedule_latency_us` on the
`granted_publishes` entry and is still a draft, so no hub can send it and this
plugin will not invent the key.

---

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
3. **SUBSCRIBE** — `safety` (`0x0003`) already rode in HELLO. What is left is the
   channels this hub happens to carry the **telemetry and kinematic field roles** on,
   which are only knowable once the catalog is decoded — see *Machine limits readback*.
   The `telemetry.position` channel is subscribed at a rate, elevated priority.
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
7. **Operator INTENTs**: the Home button sends the catalog field whose role is
   `action.home`, with the op value whose option label is `home`. A hub that labels no
   `home` op grays the button. `force_home` is never sent from this plugin: it releases
   the e-stop latch. The stroke-window editor writes `window.min` / `window.max` on each
   role's `setting_key` through the paired `setting_channel`, value map keys ascending.
   Both are queued by the UI thread and sent by the connection task, which owns the
   socket. The answer each row shows is the ECHO (`applied`, post-clamp; for Home the
   echoed op's label) or the NACK's registry name plus its §16.1 `detail` (key 17) when
   the hub sends one. **`header.seq` is set to `intent_id`**: the hub stamps a NACK's
   `intent_seq` from the *inbound frame header's* seq, so making the two the same number
   is what turns RFC-001's correlation key into a usable one.
8. **Reconnect** — an unexpected drop retries with 2 s → 5 s → 10 s backoff until you
   disconnect; the status shows "Reconnecting".

### Machine limits readback — found by field ROLE, not by channel number

The plugin displays the machine's stroke window, its **input** (machine-driven) speed,
accel and jerk ceilings, and the rail's live position. It finds them the RFC-006(b) way:
by scanning the fetched catalog for the registry `field_roles` values `window.min`,
`window.max`, `limit.input.speed`, `limit.input.accel`, `limit.input.jerk`,
`telemetry.position`, `telemetry.target`, `telemetry.velocity`, `geometry.max_travel`,
`geometry.measured_travel` — and *only* those. The rail's roles usually share one motion
channel, subscribed at a rate because it carries a moving value. `geometry.measured_travel` is preferred over
`geometry.max_travel` for the rail's length because it is what a real home measured, and
a zero there is treated as "no home yet", never as a measurement. The
channel number appears nowhere in the plugin source; LiveWireTest prints where a given
hub resolves each role. On a hub that declares none of them the panel reads `n/a` and
no extra SUBSCRIBE is sent. The catalog is also the *decoder ring*: a STATE payload is a flat packed struct
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
- **Channels:** safety `0x0003` (9 B since the `modes` byte was appended),
  motion-input `0x2100` (STREAM·motion·00, STREAM c2h, ≤333 Hz; was `0x0084` pre-RFC-047),
  motion-segment `0x2101` (STREAM·motion·01, STREAM c2h,
  ≤50 Hz, 6-byte `{target u16, duration_ms u16, end_vel i16}`; was `0x0085`). The **motion**, **home**, **config** and
  **limits/window** channels are NOT listed here on purpose: they are resolved from
  catalog field roles at runtime.
- **CBOR profile:** deterministic (§5.3) — definite lengths, shortest-form ints,
  float32-only (`0xFA` + big-endian binary32), map keys ascending.

---

## Developer notes

### Compile check
```
dotnet build clients/mfp/ValenceConnect.csproj
```
`ValenceConnect.csproj` is a dev-only project that compiles `ValenceConnect.cs` standalone against a
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
BLOB_REQ, CATALOG_READY, BLOB_CHUNK header decode, and the two operator INTENTs as a
Nucleus catalog resolves them by role: Home, the stroke window, the window value map's
key order, and header seq == intent_id). Exits 0 on all-pass. The codec in
`WireSelfTest.cs` is a deliberate copy of the one in `ValenceConnect.cs`: change one,
mirror the other and re-run.

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
dotnet run --project clients/mfp/LiveWireTest.csproj -- 127.0.0.1 8802 --http 8809 --sim
```
`--http N` is the target's HTTP port (valencesim's `--http`, for `/uitoken`); `--sim`
declares a simulator that serves no `/api/capabilities`. Compiles `ValenceConnect.cs`
itself (the plugin's real codec/client/catalog/discovery classes, no copies) into a
console harness and runs the full session: UDP-probe discovery, HELLO→WELCOME publish
grant, **BLOB_REQ catalog fetch + local SHA-256 verify + CATALOG_READY**, **RFC-006(b)
role lookup and live role-value decode**, CLOCK sync, 5 s of STREAM @ 50 Hz, then a diff
of the target's `/api/kinetic` ingress counters (skipped on a declared simulator, since
valencesim serves none; missing on hardware is a failure). On a simulator it also writes the stroke window through the role-resolved
setting channel and restores it, checking both ECHOs and that the role-decoded window
readback follows them, and sends Home on the `action.home` locator, checking that the
hub answers with an ECHO or a named NACK.

**Safety gate.** On real hardware it reads `/api/status` and **refuses to run if the
machine is homed or e-stopped** (unhomed = every sample is dropped at the HOMED safety
gate, so the wire is exercised with zero motion risk). valencesim has no `/api/status`; the
`sim: true` flag in `/api/capabilities` (or `--sim`) is an explicit waiver, and a target
that is neither readable nor a declared sim is an **abort**: "unknown machine state" never
passes. The window write and the Home intent are gated on `sim`; on real hardware this
harness sends neither.

**Run it TWICE back-to-back without restarting the target.** That is the
source-ownership-release regression check, and it exists because a real field bug hid for
months behind deploys that rebooted between runs (fw ≥ 2.1.44).

Pass `--discovery-selftest` to check the UDP discovery probe bytes and reply decode against
a synthesized 76-byte DISCOVER_REPLY -- no hub, no socket opened.

Pass `--lag-selftest` to check the `LagMeter`'s correlation math against a known
40 ms shift and 0.80 gain -- no hardware, no network, no socket opened.

Pass `--lag` for the **lag-meter live check**: it force-homes (home op 2 with a
stroke) and config-sets a 0..50 mm window through the role-resolved config channel,
then streams a 0.8 Hz sine for 14 s as 100 ms segments scheduled 120 ms ahead -- the
plugin's own shape -- feeding the plugin's own `LagMeter` from both ends and printing
it once a second. **This mode deliberately MOVES the machine** (a lag meter pointed
at a parked machine measures nothing), so it does not take the unhomed safety gate
above. Cross-check it against Nucleus's `tools/lag_probe.py --segments --force-home
50 --window 0 50`, which measures the same quantity by a sine fit.

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
