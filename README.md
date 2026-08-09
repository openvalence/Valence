# SlopSync - Pre-Release

SlopSync is a hub-and-spoke **device-shadow protocol** for intimate hardware:
one hub (a machine's main controller) holds the single canonical machine
state; any number of clients — browser UIs, hardware remotes, mobile apps,
bridges, simulators, streaming-application plugins — connect over
heterogeneous transports, announce who they are and what they can do, and
thereafter stay in continuous, truthful sync with that state. Clients submit
**intents**; the hub applies, clamps, and echoes what was *actually applied*;
every subscriber observes the same reality.

Full scope, non-goals, and design philosophy: [`spec/SPEC.md`](spec/SPEC.md)
§1.

## Layout

| Path | What |
|---|---|
| `spec/` | The protocol specification: `SPEC.md` (normative), `RENDERING.md` (UI/rendering constitution), `CHANNEL-GRID.md` (the 0xCDSS channel-space convention), `RFC-QUEUE.md` (change history), `registry/registry.yaml` (single source of truth for every wire number), `schema/`, `vectors/`, `examples/`, `reviews/` |
| `lib/slopsync/` | The reference C++20 implementation: header-only, hardware-free, zero external dependencies |
| `clients/js/` | The JavaScript reference client |
| `clients/mfp/` | The Multi Function Player (MFP) reference client plugin |
| `hub/slopbench/` | SlopBench, a machine-agnostic reference hub for exercising the protocol without hardware |
| `tools/` | Verification and authoring tools: `slopsync_probe.py` (wire-level conformance probe), `slopscope.py`, `slopsoak.py`, `gen_registry_header.py`, `slopsync_lint.py` |
| `test/` | The native conformance suite (`test/native/test_slopsync_*`) and the fuzz gate (`test/fuzz/`) |
| `docs-site/` | The Material for MkDocs documentation site |

## Quickstart

- Read the spec: [`spec/SPEC.md`](spec/SPEC.md), or build the docs site
  (`cd docs-site && pip install -r requirements.txt && mkdocs serve`).
- Point a probe at a running hub: `python tools/slopsync_probe.py --ip <ip> --port <port>`.
- Stand up a hub with no hardware: `hub/slopbench/` (see its `README.md`).
- Embed the library: `lib/slopsync/` is header-only C++20 — drop it in, no
  build system integration required beyond an include path.

## License

- Code (`lib/`, `clients/`, `hub/`, `tools/`, `test/`, `docs-site/` tooling):
  **MIT** — see [`LICENSE`](LICENSE).
- Specification documents (`spec/`): **CC-BY 4.0** — see
  [`LICENSE-SPEC`](LICENSE-SPEC).
- The name "SlopSync" is reserved for conformant implementations — see
  [`NOTICE`](NOTICE).

## Provenance

Extracted from SlopDrive-32 @ `458fba076e05b2d26610467b84256380109673a4`.
SlopSync started life as the sync protocol for a single machine (SlopDrive-32)
and was pulled out into its own repository to be the first-class source of
truth once it stood on its own. Fresh git history — no filter-repo surgery.

## Relationship to SlopDrive-32

SlopDrive-32 is the reference *hub* implementation: a real ESP32-S3-based
motion machine that consumes SlopSync (this repo, pinned to a version) rather
than defining it. SlopDrive-32 also owns the device-specific channel
allocations for its own hardware — SlopSync defines the channel-space
*convention* (`spec/CHANNEL-GRID.md`) that any hub, including SlopDrive-32,
allocates its own device channels within.
