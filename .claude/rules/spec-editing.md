---
paths:
  - "spec/**"
---

# Spec editing: the RFC lifecycle

Truth is RATIFIED here, never discovered here. Discovery happens in the
reference implementation (Nucleus, sibling checkout) and arrives as an
RFC. Never edit the spec to match code; that collapses the review gate.

## The gate

- `spec/SPEC.md` and `spec/registry/registry.yaml` are normative. Direct edits
  are blocked by `.claude/hooks/rfc-gate.sh` unless an Accepted RFC is
  referenced (branch `rfc-NNN`, or `RFC-NNN` in `.claude/.rfc-ticket`).
- The RFC queue is the front door and is never gated: a proposal is a bead
  on this repo's board (type `rfc`, id `rfc-NNN` = its number, body = the
  entry), the operator rules approve/deny/modify, and only then does the
  normative edit happen, citing the RFC. `spec/RFC-QUEUE.md` is the
  GENERATED human-readable view of those beads (`python tools/rfc_queue.py
  export`), committed with every change and checked by the lint; never
  hand-edit it (operator ruling 2026-10-05).
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
- The board IS the queue: `bd show rfc-NNN` is an entry, `bd update rfc-NNN
  --body-file draft.md` edits one, `python tools/rfc_queue.py new NNN "title"`
  opens one, and `export` regenerates the file; the entry's own
  `- **Status:** ...` line stays the record of its state and the bead's
  `status:*` label and open/closed state mirror it. Review and landing work
  are ordinary task beads that depend on the entry. The hand-written
  preamble (header, dispositions, historical indexes) lives in
  `spec/rfc/preamble.md`.

## After a ruling

Land the accepted RFC as one commit: SPEC.md text + registry.yaml numbers +
codegen (`python tools/gen_registry_header.py`) + golden vectors if bytes
changed + the RFC's Status line, together.
