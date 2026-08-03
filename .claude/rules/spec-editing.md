---
paths:
  - "spec/**"
---

# Spec editing: the RFC lifecycle

Truth is RATIFIED here, never discovered here. Discovery happens in the
reference implementation (SlopDrive-32, sibling checkout) and arrives as an
RFC. Never edit the spec to match code; that collapses the review gate.

## The gate

- `spec/SPEC.md` and `spec/registry/registry.yaml` are normative. Direct edits
  are blocked by `.claude/hooks/rfc-gate.sh` unless an Accepted RFC is
  referenced (branch `rfc-NNN`, or `RFC-NNN` in `.claude/.rfc-ticket`).
- `spec/RFC-QUEUE.md` is the front door and is never gated: proposals are
  drafted there, the operator rules approve/deny/modify, and only then does
  the normative edit happen, citing the RFC.
- SPEC.md Appendices A, B, G are generated views of registry.yaml (SPEC §5.7).
  Regenerate, never hand-edit. On any numeric conflict the registry wins.

## Queue process (spec/RFC-QUEUE.md header is the law; this is the pointer)

- Statuses: Draft -> Accepted / Rejected -> Landed (v1.0), plus the two honest
  qualifiers Partially landed and Deferred. Nothing is marked Landed that is
  not actually in the tree.
- Entries are append-only and numbered once; a rejected RFC keeps its number.
- Every entry names its origin (fw version / probe run / client). Proposals
  born from measured behavior outrank aesthetic ones.
- Number allocation happens in registry.yaml by PR; numbers are never reused
  or renumbered once released in a tagged spec version (SPEC §5.7). The
  never-renumber rule binds from the v1.0 tag FORWARD; there are zero tags
  today and the freeze is written but NOT ARMED.
- The Beads board in this repo (`bd`, prefix `rfc-`) mirrors queue state for
  work tracking. spec/RFC-QUEUE.md stays the normative record; on conflict
  the queue file wins and the board gets fixed.

## After a ruling

Land the accepted RFC as one commit: SPEC.md text + registry.yaml numbers +
codegen (`python tools/gen_registry_header.py`) + golden vectors if bytes
changed + the RFC's Status line, together.
