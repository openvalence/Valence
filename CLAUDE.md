# Valence -- THE SPEC REPO

Protocol truth is RATIFIED here, never discovered here. Discovery happens in
the reference implementation (Nucleus, sibling checkout) and arrives as
RFCs in `spec/RFC-QUEUE.md`, ruled by the operator: approve / deny / modify.

Law of the land:

- `spec/SPEC.md` is normative. `spec/registry/registry.yaml` wins any numeric
  conflict (SPEC §5.7). Appendices A/B/G and everything under `generated/` are
  generated views: regenerated via `python tools/gen_registry_header.py`,
  never hand-edited.
- Normative changes require an accepted RFC, never a direct edit. The
  RFC-gate hook enforces this; `.claude/rules/spec-editing.md` explains the
  lifecycle. Never edit the spec to match code.
- Wire numbers come only from the registry. Never invent one; when unsure,
  read.
- American English (British spellings get nuked on sight). No em dashes; use
  "--" or restructure. Comments state constraints, not stories.
- Skills: `valence-canon` (distilled spec, citation-anchored),
  `registry-workflow` (allocation/regen/tagging), `advisor` (read-only design
  counsel). Beads board here is the RFC BOARD (`rfc-` prefix): RFC lifecycle
  tracking only, no implementation dev work (that lives on Nucleus's
  dev board).

## Compact Instructions

When compacting this session, always preserve: operator decisions and their
rationale, files modified, open RFC ids and their current statuses, registry
numbers touched or allocated, and any pending operator rulings.
