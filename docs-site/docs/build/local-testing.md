---
title: Local testing
description: >-
  The Valence simulator, the probe, the golden vectors, the fuzz harnesses, and the back-to-back-sessions pattern for session-lifecycle bugs.
---

# Local testing

You can test a Valence client or a Valence hub with no machine on the bench.
This page covers the simulator, the probe, golden vectors, the fuzz harnesses,
and the back-to-back-sessions pattern.

| Instrument | Answers |
|---|---|
| [The simulator](#the-simulator) | Does my client work against a real hub, with no hardware? |
| [The probe](#the-probe) | Does my hub answer a full scripted session correctly? |
| [Golden vectors and the suites](#golden-vectors-and-the-native-suites) | Do my encoded bytes match the golden vectors? |
| [The fuzz harnesses](#the-fuzz-harnesses) | Does any byte string crash my parser? |
| [Back-to-back sessions](#the-pattern-that-is-mandatory) | Is session state released when its session ends? |

## The simulator

`hub/bench` (Valence Bench) is a desktop binary that behaves like a hub.

Valence Bench embeds the hub library behind a WebSocket server that speaks
the same subprotocol as conforming hardware hubs. A bug found against it is a
bug in the library code that hubs built on `lib/valence` run. Unlike a single
machine's own simulator, Valence Bench has no fixed catalog and no motion
engine of its own. It serves whatever catalog a `.bench` config file
describes. This makes it useful for testing a client against catalog shapes no
single hub happens to produce (extra archetypes, alien channel domains,
deliberately slow echoes).

Everything a client can reach goes through the protocol. Valence Bench has no
HTTP plane.

### Build

```bash
# Any C++20 host toolchain plus CMake and Ninja. On Windows this project
# uses WinLibs GCC; put your compiler on PATH first.
cmake -S hub/bench -B hub/bench/build -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build hub/bench/build
```

Dependencies are pinned and fetched by CMake. The binary is statically linked
and needs no installed runtime libraries.

### Usage

```bash
bench hub/bench/configs/tiny-axis.bench                 # interactive terminal UI
bench hub/bench/configs/kitchen-sink.bench --headless --duration 30   # scripted, for CI
```

Useful flags: `--port` for the protocol socket, `--headless` for no
terminal UI, and `--duration` to exit after a fixed time. See
`hub/bench/README.md` for the config file grammar and the three
example configs.

### Device simulators {#a-real-devices-own-simulator}

A specific hub implementation may also ship its own device-fidelity
simulator, embedding that machine's real motion engine and real device
catalog behind the same wire protocol. Nucleus's `sim/valencesim` is that
project's own instrument (its own repository, not this one). Use it
when you need to test against one exact machine's behavior rather than the
protocol in general.

### Wire recording

Valence Trace shows how a hub executed your motion. A simulator with
recording (Valence Bench's session log, or a device-fidelity simulator's own
trace) also records **what arrived on the wire**, raw values beside
decoded values, at the point of decoding.

Use wire recording to locate client bugs. When a client produces motion its
author did not intend and the hub executes it faithfully, the recorded wire
content shows the fault is in the client. Export the recorded stream and
compare it against what your client believed it sent.

> DEMO-CANDIDATE: an embedded Valence Bench terminal a reader can drive from the
> page, with the raw wire trace scrolling beside it.

## The probe

`tools/valence_probe.py` is a standalone Python client. It runs a scripted
session against a live hub and prints a pass-or-fail transcript per stage.

Use it as a conformance smoke test for a hub under development. It hand-rolls
its own encoder against the registry rather than importing the library, so a
hub that passes the probe has agreed with an independent implementation.

```bash
python tools/valence_probe.py --ip <hub-ip> --port <port>
python tools/valence_probe.py --ip <hub-ip> --no-motion      # observe only
python tools/valence_probe.py --ip <hub-ip> --pair           # pairing scenario
```

| Flag | What it does |
|---|---|
| `--ip`, `--port` | Where the hub is |
| `--timeout` | Per-step reply timeout, in seconds |
| `--no-motion`, `--listen-only` | Skip every step that commands motion |
| `--stream <seconds>` | Stream samples on the motion-input channel |
| `--segments <seconds>` | Stream timed segments instead of bare samples |
| `--estop` | Assert a client-side emergency stop, then clear it |
| `--bench-home` | Exercise the bench homing operations |
| `--pair` | Run the pairing and trust scenario instead of the motion session |
| `--pair-state <file>` | Keep the administrator's identity, so a second run reconnects as the same device |

Motion steps are dropped by the hub's homed gate on an unhomed machine. This
is correct behavior and still proves the whole wire path. Use `--no-motion`
when you only want the protocol checked. Point the probe at the simulator
before you point it at hardware; the transcript has the same stages.

## Golden vectors and the native suites

A [golden vector](../reference/dictionary.md#golden-vector) is a byte-exact
recorded frame. Every implementation must produce those bytes and decode them
to the same model. The deterministic encoding profile gives each message one
valid encoding.

Time and randomness are injected. A conforming library takes
its clock and its random source as parameters, rather than reading the
platform.

Determinism is a conformance requirement. Session
ids, boot ids, nonces and timestamps all appear in vector bytes. An
implementation that reads the system clock cannot reproduce a vector, and
cannot pass the vector tests.

The same requirement enables the
[in-process binding](../reference/dictionary.md#in-process-binding). It
connects a hub and a client inside one process, with injected loss, reorder,
duplication, latency and jitter, plus a seeded mode where a run reproduces bit
for bit.

Behavioral checks run against it: reconnect and reconcile, newest-wins under
reordering, the ready gate, duplicate-intent re-echo, shedding order, deadman
policy per source type, takeover, and emergency stop repeated under heavy
loss.

```bash
# The host suites. Your host C++ toolchain must be on PATH.
pio test -e native
```

<div class="ss-facts" markdown>

| | |
|---|---|
| **Known trap** | The test runner misreports the framework's output. It prints "0 test cases" and can report a spurious interrupt on failure. |
| **What to trust** | The exit code. Or run the built test binary directly for the real summary. |

</div>

## The fuzz harnesses

`test/fuzz/` holds seven libFuzzer targets, one per parser surface. They test for
[parser totality](../reference/dictionary.md#parser-totality): any byte string
maps to accept-or-reject, with no out-of-bounds read, no unbounded allocation
or recursion, and no undefined behavior.

Both directions are in scope. A client that auto-connects to a discovered
machine parses whatever that machine sends, so a hostile hub must not be able
to crash a conforming client.

### Build and run commands

The fuzz gate needs clang and libFuzzer. On Windows, run it under WSL2.
Build into a Linux-local directory and compile against the repo over the
mount. Building on the mount is slow.

```bash
# inside WSL, with $R pointing at the repository
mkdir -p ~/fuzz && cd ~/fuzz

for t in fuzz_cbor fuzz_catalog fuzz_frame fuzz_packed \
         fuzz_bundle fuzz_blob fuzz_messages; do
  clang++ -std=c++2b -O1 -g -fno-omit-frame-pointer -Wall -Wextra \
    -Wno-unused-private-field \
    -I $R/lib/valence/include -I $R/test/fuzz \
    -fsanitize=fuzzer,address,undefined -fno-sanitize-recover=undefined \
    $R/test/fuzz/$t.cc -o build/$t
done

# regenerate the seed corpus using the library's own encoders
clang++ -std=c++2b -O1 -g -I $R/lib/valence/include -I $R/test/fuzz \
  -fsanitize=address,undefined -fno-sanitize-recover=undefined \
  $R/test/fuzz/gen_seeds.cc -o build/gen_seeds
./build/gen_seeds corpus

# soak: 600 seconds per target
export ASAN_SYMBOLIZER_PATH=/usr/bin/llvm-symbolizer
export UBSAN_OPTIONS=print_stacktrace=1:halt_on_error=1
bash $R/test/fuzz/run.sh 600 ~/fuzz/build ~/fuzz/corpus ~/fuzz/work
```

The cheap check, after any change to a decoder: replay the committed
corpus without mutation.

```bash
./build/fuzz_catalog $R/test/fuzz/corpus/catalog -runs=0
```

Reproducing and shrinking one crash file:

```bash
ASAN_SYMBOLIZER_PATH=/usr/bin/llvm-symbolizer ./build/fuzz_cbor ./crash-<hash>
./build/fuzz_cbor -minimize_crash=1 -runs=100000 ./crash-<hash>
```

### Harness rules

1. **Never assert on decoder semantics.** A decoder rejecting something a
   human thinks is valid is a golden-vector question, not a fuzz finding. Assert
   only totality invariants, because they are memory-safety statements.
2. **Touch every zero-copy view a decoder returns.** A view that escaped its
   input buffer is only a finding if something reads it. That is how the worst
   bug in the first campaign was caught.
3. **Bound fuzzer-derived indices in the harness, not the library.** Otherwise
   a harness bug and a library finding look identical.

Do not lower the maximum input length in CI. It is large because an
intra-object overflow (a write that stays inside the enclosing struct) is
invisible to AddressSanitizer, and only a long write escapes the object and
gets reported.

The results of the first campaign, and the bugs it found, are on
[Security model and the audit](../understand/security.md).

## Back-to-back sessions {#the-pattern-that-is-mandatory}

!!! danger "Two sessions, back to back, with no restart between them"

    Run your scenario. Then run it **again**, against the same running hub,
    without rebooting, reflashing or restarting anything in between.

    This pattern is mandatory for anything that touches session lifecycle.

<p class="ss-cap" markdown>The six session exit paths, the shared teardown routine, and the repeat loop this pattern tests.</p>

```mermaid
flowchart TD
    START["▶ START<br/>A session owns motion"]:::wish
    START --> END{"How does the<br/>session end?"}:::party
    END -->|"polite goodbye"| LP["The one loss-policy<br/>routine"]:::truth
    END -->|"rude disconnect"| LP
    END -->|"slow-consumer eviction"| LP
    END -->|"administrative eviction"| LP
    END -->|"re-handshake into<br/>the same slot"| LP
    END -->|"deadman silence<br/>window elapses"| LP
    LP --> FREE["The slot's ownership<br/>is released"]:::truth
    FREE -->|"a new client connects,<br/>nothing restarted"| NEXT["A new session<br/>may be granted"]:::wish
    NEXT -.->|"back to back: run the<br/>same scenario again,<br/>still nothing restarted"| END

    classDef wish fill:#8158d82e,stroke:#8158d8
    classDef truth fill:#3183cc2e,stroke:#3183cc
    classDef party fill:none,stroke:#8a8f98
```

<p class="ss-point" markdown>All six exit paths call one teardown routine. If any exit path releases ownership through separate code, ownership can leak (see below). The dashed loop is the back-to-back-sessions pattern: a single pass does not detect the leak, because a reboot between runs also clears it.</p>

A hub tracks which session currently owns motion. Constraints:

- The deadman pump, the code that watches an occupied session slot for
  silence, was the only code that released ownership. Every other way a
  session can end resets that slot first: a polite goodbye, a rude
  disconnect, both kinds of eviction, and a re-handshake into the same slot.
  The pump then had nothing left to watch, so the departed session's id owned
  motion until reboot, and every later client was refused as a conflict.
- The leak was invisible to every test run for months, because each
  deployment rebooted the device between runs. The reboot cleared the leaked
  ownership before the next test could see it.
- A hub releases ownership from one teardown routine on all six exit paths:
  polite goodbye, rude disconnect, slow-consumer eviction, administrative
  eviction, re-handshake into the same slot, and deadman silence. The routine
  runs the full loss policy, identical to the deadman's.
- The regression test is three sessions in one process with no restart.

**Apply this to anything session-scoped:** ownership, pending pairing knocks,
idempotency rings, subscriptions, rate-limit buckets, deadman timers. For state
created with a session, verify it is released when the session ends, across two
consecutive sessions with no restart.

### Related patterns

**Connect while the machine is in a latched state.** Latch an emergency stop,
then connect a fresh client. It must adopt the latch before it can act on user
input. This proves the retained snapshot is seeded at startup rather than only
on the first change. A hub that does not seed the snapshot passes other tests
and fails only when a client connects after a fresh boot.

**Rude disconnect.** Close the socket without GOODBYE, or pull the cable. Some
teardown paths are reachable only this way. Transports usually end without
GOODBYE.

**Run against a mismatched catalog.** Point a client compiled against one
catalog at a hub serving a different one. A conforming client either degrades
with its unverifiable controls suppressed, or refuses and says so. Running with
full controls and no warning is non-conformant.

## Where to go next

- [Capabilities and custom hardware](../understand/capabilities.md): the
  checklist your hub is being tested against.
- [Security model and the audit](../understand/security.md): what the fuzz
  campaign found, and what it does not cover.
- [The Dictionary](../reference/dictionary.md): every term used here, with
  one definition each.
