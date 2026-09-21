# Valence Tool manifest schema (v1)

A repo declares its tools in `valencetool.toml` at its root. Valence Tool reads
manifests and spawns processes; it knows nothing else. Governing rules are
Valence Drive `docs/canon/DOCTRINE.md` §10 — the short form:

* Adding a tool is a manifest entry and **zero** lines of Valence Tool code.
* Every tool stays runnable from a plain shell. The `run` array IS that
  command — if it does not work when typed by hand, the entry is wrong.
* A result is evidence only while its `inputs` are unchanged.

TOML because it is comment-friendly, hand-editable, and already the format
the Rust side parses natively. No YAML: the surprising-type-coercion class is
not worth re-learning here.

## File shape

```toml
schema = 1
repo   = "Valence"

[toolchain.python]
probe   = ["python", "--version"]
unlocks = "lints and codegen checks"

[[tool]]
id     = "valence-lint"
name   = "Valence lint"
group  = "gates"
run    = ["python", "tools/valence_lint.py"]
inputs = ["lib/valence/**", "spec/**", "tools/valence_lint.py"]
needs  = ["python"]
order  = 10
```

## Top level

| key | required | meaning |
|---|---|---|
| `schema` | yes | manifest format version. Bump only on a breaking change. |
| `repo` | yes | display name. Never used for logic — see DOCTRINE §10. |

## `[toolchain.<id>]`

How to detect a host dependency. Data, not code, so a repo can require a
toolchain Valence Tool has never heard of.

| key | required | meaning |
|---|---|---|
| `probe` | yes | array of argv **candidates**. Each is tried in order; the first to exit 0 wins and becomes the toolchain's resolved command. |
| `unlocks` | no | plain-English list of what appears when it is installed. Shown on the first-run screen. |

### Candidates exist because "on PATH" is not the same as "installed"

Measured on the primary dev host 2026-07-30: `pio --version` fails while
PlatformIO is fully installed at
`%USERPROFILE%\.platformio\penv\Scripts\platformio.exe`, and `mkdocs` lives
inside `docs-site/.venv`. A single-command probe reports both as missing and
sends a developer to reinstall tools they already have — the exact failure
this whole program exists to prevent.

**Resolution rule:** when a toolchain id appears as `argv[0]` of a tool's
`run`, Valence Tool substitutes the resolved candidate. So `run = ["pio", ...]`
stays exactly what a developer types when `pio` is on PATH, and silently
works when it is not. This is the ONLY substitution Valence Tool performs;
there is no template language, and adding one would be a 🚩 flag.

**Path resolution in candidates**, both load-bearing and both learned the hard
way while writing this file: a candidate containing a `/` is a PATH-relative
or absolute path, resolved **from the repo root** and never from the user's
shell cwd (a bare `docs-site/.venv/Scripts/mkdocs.exe` probed from the wrong
directory reports a present toolchain as missing). A leading `~/` expands to
the user's home directory — PlatformIO's real install location is only
expressible that way.

## `[[tool]]`

| key | required | meaning |
|---|---|---|
| `id` | yes | stable key. Results are stored against it, so renaming loses history. |
| `name` | yes | display label. |
| `group` | yes | UI grouping, free text (`gates`, `suites`, `fuzz`, `docs`). |
| `run` | yes | argv array, run from the repo root. |
| `inputs` | no | globs whose hash fingerprints the result. **Omitted means the result can never be trusted stale-free** — it will always read as unverified rather than green. |
| `needs` | no | toolchain ids. Missing one makes the tool *unavailable*, not failed. |
| `cwd` | no | working directory relative to repo root. Default: the root. |
| `os` | no | `["windows"]` / `["posix"]`. An OS-specific script is a *separate entry*, not a per-OS branch inside one. |
| `success_exit` | no | exit codes meaning pass. Default `[0]`. |
| `error_exit` | no | exit codes meaning **could not run** — reported distinctly from a real failure, so a broken environment never reads as a defect. |
| `order` | no | sort key within a group. |
| `unlocks` | no | what passing this enables. Reserved for the onboarding flow. |
| `description` | no | one line. Reserved for the onboarding flow. |

### Why argv and not a shell string

Quoting rules differ between `cmd.exe`, PowerShell, and POSIX shells, and a
string invites a repo to embed `&&` and pipes — which is a second, worse
scripting language living inside a config file. An argv array spawns
identically everywhere. A tool that genuinely needs shell composition owns a
script file, and the manifest runs *that*.

### Why `order` and `unlocks` exist before the onboarding flow does

They are what a guided flow reads: what to attempt first, and what each step
buys. Adding them now is free; adding them later is a schema break across
every manifest in the ecosystem.

## Result states

`pass` · `fail` · `error` (could not run) · `stale` (inputs moved since the
run) · `unavailable` (a `needs` toolchain is absent) · `never run`.

`stale` is not a failure — it means *no longer evidence*, which is CANON C-4
applied by machine instead of by memory. A stale pass is never shown as a pass.
