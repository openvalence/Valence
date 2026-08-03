# SlopSync -- THE SPEC REPO

Protocol truth is RATIFIED here, never discovered here. Discovery happens in
the reference implementation (SlopDrive-32, sibling checkout) and arrives as
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
- Skills: `slopsync-canon` (distilled spec, citation-anchored),
  `registry-workflow` (allocation/regen/tagging), `advisor` (read-only design
  counsel). Beads board here is the RFC BOARD (`rfc-` prefix): RFC lifecycle
  tracking only, no implementation dev work (that lives on SlopDrive-32's
  dev board).

## Compact Instructions

When compacting this session, always preserve: operator decisions and their
rationale, files modified, open RFC ids and their current statuses, registry
numbers touched or allocated, and any pending operator rulings.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
