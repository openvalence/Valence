---
title: CLI guide
description: >-
  Valence Trace, which records and graphs motion-pipeline telemetry, and valence_probe.py, the reference verifier: what each one proves, how to run it, and how to read what it prints.
---

# CLI guide

Valence ships three command-line tools: Valence Trace, the probe, and the generators.

| Tool | Answers |
|---|---|
| [Valence Trace](#valence-trace) | Did the machine do what the app asked, and if not, where did the difference come from? |
| [The probe](#the-probe) | Does this hub answer a full scripted session correctly? |
| [The generators](#the-generators) | Do the generated files match the registry and the specification? |

Valence Trace and the probe are Python and need the `websocket-client`
package. Both run against [the simulator](local-testing.md#the-simulator) as
they run against hardware.

## Valence Trace

`tools/valence_trace.py` records and graphs motion-pipeline telemetry.

### Purpose

Valence Trace graphs commanded motion against achieved motion to show where they diverge.

Valence Trace graphs the raw commanded input as it arrives over Valence, scaled
into the [stroke window](../reference/dictionary.md#stroke-window), against
what the planner did with it. Quintic shaping, chase lag, guard
fallbacks and handoff bounding appear as separate lines.

### Three lines

Every graph carries the same three position series, all in millimeters.

| Series | What it is |
|---|---|
| [Asked](../reference/dictionary.md#asked) | The demand as it landed, before planning |
| [Planned](../reference/dictionary.md#planned) | Where the motion core is driving to right now |
| [Achieved](../reference/dictionary.md#achieved) | Measured carriage position |

The two gaps measure different things.

**Planned minus achieved** is tracking error: a gap here is the actuator falling behind its plan.

**Asked minus planned** is shaping: the planner does not chase a demand
instantly. In [waveform](../reference/dictionary.md#waveform)
mode this gap is the travel still to come inside the commanded
duration, so a large number is normal. In
[chase](../reference/dictionary.md#chase) mode the same gap is lag.

A third layer sits underneath: the plan envelope, drawn from the planner's own
current segment, plus the velocity plane and the engine's
[anomaly](../reference/dictionary.md#motion-anomaly) events marked on the time
axis.

### Read-only access

Valence Trace connects at the [watch](../reference/dictionary.md#watch) tier. It
only subscribes: it sends no
[intent](../reference/dictionary.md#intent), publishes no
[stream](../reference/dictionary.md#stream), carries no `publishes` wish in
its HELLO, and has no intent builder. This is fixed in the code and cannot be configured. Use another client to drive the machine.

### record

`record` captures a trace, and can render it in the same run.

```bash
python tools/valence_trace.py record --ip 127.0.0.1 --port 82 \
    --seconds 26 --out run.jsonl --render run.html
```

| Flag | What it does |
|---|---|
| `--ip`, `--port` | Where the hub is. Port 82 is the Valence plane |
| `--http-port` | Where to read `/api/capabilities` for the firmware version. Optional |
| `--seconds` | Capture length. `0` runs until ctrl-c |
| `--out` | Trace file. Defaults to `valence_trace-<stamp>.jsonl` |
| `--render` | Also write the HTML graph here |
| `--theme`, `--palette` | Passed to the renderer. See [color](#color) |
| `--window MIN:MAX` | Escape hatch for a hub whose catalog declares no window role. Recorded as an operator override, never as machine truth |

It prints how it found every channel:

```text
[valence_trace] connected ws://127.0.0.1:82/ (subprotocol valence.v1)
[valence_trace] WELCOME session=1200999484 roles=1 (watch tier is all this tool needs)
[valence_trace] catalog 10617 B, 26 entries, etag VERIFIED
  resolve window      field_role window.min/window.max -> channel 0x0081 'machine-config' fields 'window_min'/'window_max'
  resolve achieved    field_role telemetry.position -> 0x0080 'motion' field 'pos_10um'
  resolve velocity    field_role telemetry.velocity -> same channel, field 'speed'
  resolve planned     field name match on 0x0080 layout -> 'tgt_10um'
  resolve asked       field name match on 0x0080 layout -> 'raw_10um'
[valence_trace] grants: safety=on-change, motion=60.0Hz, machine-config=on-change,
            plan-strip=45.0Hz, kinetic-diag=1.0Hz, motion-anomaly=on-change
[valence_trace] captured 26.0s: 1305 motion, 724 plan, 27 diag, 3 anomaly -> run.jsonl
```

The tool hardcodes no channel numbers. Positions and the window come from
[field roles](../reference/registry/catalog-vocabulary.md#field-roles); the rest
comes from the catalog's own names and layouts. It therefore works with a hub that numbers its channels
differently.

### live

`live` prints a terminal dashboard while it captures. Add `--out` to record at
the same time.

```bash
python tools/valence_trace.py live --ip 127.0.0.1 --port 82 --seconds 18
```

```text
Valence Trace live  ·  127.0.0.1:82  ·  fw valencesim-0.2.0  ·  watch tier, subscribe-only
------------------------------------------------------------------------------
window   0.0 .. 500.0 mm  (span 500.0)   limits input.accel=8000 input.jerk=2e+06
         input.speed=550 user.accel=200 user.speed=50

rates    motion  52.7Hz  plan   0.0Hz  diag   1.0Hz  anom   0.0Hz

position asked   150.00   planned   150.00   achieved   150.00   vel     0.00

divergence  asked-vs-achieved   mean  32.32 mm  p95 194.02  max 200.00
            asked-vs-planned    mean  31.00 mm  p95 193.40  max 200.00

planner  plans 0        failures 0      anomalies 3       plan_us last/max/avg 0/0/0.00
anomaly  settle=1  endvel_clamped=1  waveform_fallback=1
ingress  bundles=12  samples=12  enqueued=12  dropped=0  seg_bundles=12

recent anomaly EVENTs (3 total)
   t=   2.02s  endvel_clamped     target=0.70     detail=1.10
   t=   2.02s  waveform_fallback  target=0.70     detail=1.17
   t=   2.92s  settle             target=0.70     detail=1.10
```

Use `live` while you change something on the machine. Use `record` when you
want to compare two runs, or keep the evidence.

### render

`render` turns a trace into one self-contained HTML file.

```bash
python tools/valence_trace.py render run.jsonl --out run.html --theme light --palette cvd
```

The page inlines its data, SVG and script, makes no network requests, works offline and supports zoom. `render` needs no network and no `websocket-client`: its output depends only on the trace file, so anyone with the file can render it.

The page carries a toolbar: each series on or off, the plan envelope, the
anomaly marks, palette, theme and reset-zoom. Under the graph are three
collapsed tables: trace metadata, the anomaly log, and a series summary.
Every value on the graph is reachable in those tables without relying on color.

### The trace format

A trace is JSONL. One header record, then one record per frame, then a footer
that repeats the header with the final window, limits and record counts.

The header carries:

- the hub identity: session id, boot id, `cfg_gen`, `deadman_ms`;
- the catalog [etag](../reference/dictionary.md#etag), the catalog size, and
  whether the etag was verified against the bytes received;
- the firmware version and whether the target was simulated;
- the [stroke window](../reference/dictionary.md#stroke-window) and the whole
  [limit set](../reference/dictionary.md#limit-set);
- the CLOCK offset and round-trip time;
- the full layout of every recorded channel: every field's name, type, unit,
  scale, role, description, bit names and option labels;
- a `resolution` block saying **how** each thing was found.

```json
{"rec":"header","tool":"valence_trace","trace_format":1,
 "hub":{"catalog_etag":"0458eec408a43692","catalog_etag_verified":true,"deadman_ms":600},
 "window":{"min_mm":0.0,"max_mm":500.0,"span_mm":500.0},
 "limits":{"limit.input.speed":550.0,"limit.input.accel":8000.0,"limit.user.speed":50.0},
 "series":{"planned":{"channel":128,"field":"tgt_10um","unit":"mm"}}}
```

Each value keeps its name, unit and scale, so a trace stays readable after the firmware layout changes, without the tool
version that wrote it.

`render` needs no network, and re-rendering an old trace with a newer Valence Trace gives the same graph.

Frame record keys: `r` names the kind (`m` motion, `p` plan
strip, `c` machine config, `d` diagnostics, `a` anomaly, `s` safety), `t` is
seconds since capture start, `th` is the hub-clock estimate, and `v` is the
decoded sample with catalog field names as keys.

### A worked example: segments against chase {#worked-example}

This example compares two captures on one unrestarted simulator instance,
driven by the probe.

```bash
# terminal 1 — the machine
valencesim machine --homed --headless --duration 150

# terminal 2 — the recorder
python tools/valence_trace.py record --ip 127.0.0.1 --port 82 --seconds 26 --out seg.jsonl

# terminal 3 — the driver: timed segments, one per second
python tools/valence_probe.py --ip 127.0.0.1 --port 82 --segments 20
```

Then the same again with `--stream 20`, which sends bare points at 50 Hz
instead.

The machine has a 500 mm stroke window and a 550 mm/s input speed ceiling. Each
capture holds about 1200 motion samples in the mode of interest.

| Measured over the capture | Segments (waveform) | Points (chase) |
|---|---|---|
| Mean \|planned − achieved\| | 7.2 mm | 31.1 mm |
| Median \|planned − achieved\| | 1.3 mm | 37.9 mm |
| 95th percentile | 10.0 mm | 48.9 mm |
| Mean speed | 173 mm/s | 399 mm/s |
| Samples at the speed ceiling | 0% | 61% |
| Anomalies counted | 3 | 669 |
| Samples dropped on ingress | 0 | 0 |

In the segment run, the median tracking error is 1.3 mm on a 500 mm stroke window. Each funscript action arrives as one timed segment, becomes one
[quintic](../reference/dictionary.md#quintic) over exactly the commanded
duration, and the machine follows it. Peak speed stayed at 517 mm/s, under the
550 ceiling, so the demand fitted inside the machine's envelope. The three
anomalies are the first handoff at the start of the run.

In the chase run, achieved position falls behind the plan. The driver streams
`0.5 + 0.35·sin(2π·0.8·t)`, which on a 500 mm window peaks at 880 mm/s of
source velocity. The demand exceeds the machine's 550 mm/s input ceiling, and speed stays at the ceiling for 61% of
the capture. 566 of the anomalies are
`endvel_clamped`: the engine refusing an end velocity that the window could not
absorb.

Read the gap together with the speed line. A gap with speed headroom left is a tracking or
tuning question. A gap while speed is at the ceiling means the demand exceeds the machine's limits. Fix it in the app, the script or the limits, not in the planner.

### Color {#color}

The colors match the WebUI and these docs.

| Series | Meaning |
|---|---|
| Purple | Commanded, not yet confirmed. **Asked** |
| Deep blue | The hub's accepted target. **Planned** |
| Blue | Measured position. **Achieved** |
| Amber, red | Safety only. Never a data series |

Planned is drawn as a deeper step of the reality blue rather than a fourth hue.
The planner's target has already passed arbitration, clamping and the window,
so it belongs to the reality family; the darker step marks it as accepted but not yet
executed.

!!! warning "Two of these lines are not distinguishable by color"

    The reality and intent pair is ΔE 1.1 under
    deuteranopia, against 11.4 under normal vision.

    Color is therefore not the only encoding. Every series also carries its own
    dash pattern, a legend key drawn in that pattern, a direct end-label on the
    line, and a named readout under the crosshair. The series-summary table
    gives every value in text.

    If you cannot separate the lines, press **palette** in the toolbar. The
    `cvd` palette re-steps the same semantic families to a set that passes.
    `--palette cvd` makes it the default for a rendered file.

### Limits

**The simulator's actuator is an ideal follower.** It runs the real motion
engine, the real hub and the real catalog, so *asked* and *planned* match
the device. *Achieved* is closer to the plan than hardware achieves: there is no step
quantization, no current limit, no encoder lag and no mechanical compliance.
Use the simulator for protocol, planning and shaping questions. Confirm
tracking numbers on hardware.

**`plan_us_*` is always zero on a host build.** Plan time is measured where it
runs, on the device. A host measurement would not reflect the device.

The worked-example numbers apply only to that machine, limit set and driver. Capture your own traces for comparison.

## The probe

`tools/valence_probe.py` is the reference verifier. It runs a scripted session
against a live hub and prints a pass-or-fail transcript per stage.

It hand-rolls its own encoder against the registry instead of importing the
library. A hub that passes the probe therefore agrees with an independent
implementation. It is also a complete, readable v1.0 client, which is why the
[Quickstart](quickstart.md) is built from it.

### What it verifies

The session walks the whole protocol in order: connect and subprotocol, HELLO
and WELCOME with every required key, the
[ready gate](../reference/dictionary.md#ready-gate), catalog transfer over
BLOB and its etag, subscriptions and grants, retained STATE, each telemetry
channel's layout, an intent and its post-clamp ECHO, the CLOCK exchange, stream
and segment ingress with counters, safety ops, the anomaly feed, and GOODBYE.

```bash
python tools/valence_probe.py --ip 127.0.0.1 --port 82 --segments 20
```

```text
  ✓  intent                 PASS
  -  stream                 SKIP
  ✓  segment_clock          PASS
  ✓  segment_send           PASS
  ✓  segment_counters       PASS
  ✓  motion_anomaly         PASS
  ✓  goodbye                PASS

  46 passed, 0 failed, 3 skipped
```

A failure names its stage. Stage names match the protocol's steps, which identifies the clause to read.

| Flag | What it does |
|---|---|
| `--stream <seconds>` | Stream bare samples on the motion-input channel at 50 Hz |
| `--segments <seconds>` | Stream timed segments instead: one bundle per second |
| `--pair` | Run the pairing and trust scenario instead of the motion session |
| `--estop` | Assert a client-side emergency stop, then clear it |
| `--bench-home` | Exercise the bench homing operations |
| `--no-motion`, `--listen-only` | Skip every step that commands motion |

Two flags change the machine's state. `--estop` latches
the machine and leaves it unhomed. `--bench-home` asserts a stroke window
nothing measured, and is for motorless rigs. Neither is on by default.

Motion steps are dropped by the hub's homed gate on an unhomed machine. That is
correct behavior, and the wire path is still fully exercised. An unhomed
run therefore tests the wire path without moving the machine.

### Back-to-back runs

!!! danger "Two runs, back to back, with nothing restarted between them"

    Run the probe. Then run it **again**, against the same hub, without
    rebooting, reflashing or restarting anything.

    A hub can leak [source ownership](../reference/dictionary.md#source-ownership)
    after a session ends, refusing every later client as a conflict. A reboot
    between runs clears the leak and hides it. Detecting it requires two consecutive runs without a restart.

The full reasoning, and three related patterns, are on
[Local testing](local-testing.md#the-pattern-that-is-mandatory).

## The generators

Every number this site publishes is generated from the registry or the
specification. Both generators take `--check`, which exits non-zero when a
generated file no longer matches its source.

```bash
python tools/gen_registry_header.py --check          # the C++ constants
cd docs-site
python tools/gen_docs_tables.py --check              # the registry tables + Dictionary
python tools/gen_spec_pages.py --check               # the Specification tier
```

Run the plain form to regenerate, then commit the source and the output
together. Never hand-edit a generated file: the banner at the top of each one
says so, and `--check` enforces it.

## Related pages

- [Local testing](local-testing.md): the simulator, the fuzz harnesses, and
  the regression patterns.
- [Quickstart](quickstart.md): a minimal session, built from the
  probe.
- [The Dictionary](../reference/dictionary.md): every term used here.
