#!/usr/bin/env bash
# RFC-GATE (PreToolUse, Edit|Write): spec/SPEC.md and spec/registry/registry.yaml
# are normative. A direct edit is blocked unless an approved RFC reference is
# present for this branch/session:
#   1. current branch name contains "rfc-NNN", or
#   2. .claude/.rfc-ticket (gitignored, session-scoped) names "RFC-NNN"
# and that RFC exists in spec/RFC-QUEUE.md with an accepted-family status
# (Accepted / Landed / Partially landed). Drafting RFCs in RFC-QUEUE.md is
# never gated; that file is the front door.
set -u
IN=$(cat)
FILE=$(printf '%s' "$IN" | python -c "import json,sys;print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null || true)
[ -z "$FILE" ] && exit 0
NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr '[:upper:]' '[:lower:]')
case "$NORM" in
  */spec/spec.md | spec/spec.md | */spec/registry/registry.yaml | spec/registry/registry.yaml) ;;
  *) exit 0 ;;
esac

ROOT="${CLAUDE_PROJECT_DIR:-.}"
QUEUE="$ROOT/spec/RFC-QUEUE.md"

REF=""
BRANCH=$(git -C "$ROOT" branch --show-current 2>/dev/null || true)
REF=$(printf '%s' "$BRANCH" | grep -oiE 'rfc-[0-9]+' | head -1 || true)
if [ -z "$REF" ] && [ -f "$ROOT/.claude/.rfc-ticket" ]; then
  REF=$(grep -oiE 'rfc-[0-9]+' "$ROOT/.claude/.rfc-ticket" | head -1 || true)
fi

if [ -n "$REF" ] && [ -f "$QUEUE" ]; then
  # Entry header through next header; accept only accepted-family statuses.
  STATUS=$(awk -v ref="$(printf '%s' "$REF" | tr '[:lower:]' '[:upper:]')" '
    BEGIN { inrfc = 0 }
    /^#+ *RFC-[0-9]+/ {
      inrfc = (index(toupper($0), ref) > 0)
    }
    inrfc && /[Ss]tatus:/ { print; exit }
  ' "$QUEUE")
  if printf '%s' "$STATUS" | grep -qiE 'accepted|landed'; then
    exit 0
  fi
  >&2 printf 'RFC-GATE: %s found but its status is not accepted-family (%s). A normative edit needs an Accepted RFC. Get the ruling first, update the Status line in spec/RFC-QUEUE.md, then retry.\n' "$REF" "${STATUS:-no Status line found}"
  exit 2
fi

>&2 printf 'RFC-GATE: normative change requires an RFC-QUEUE entry -- draft the RFC in spec/RFC-QUEUE.md, do not edit the spec directly. Once the operator accepts it, reference it via a branch named rfc-NNN or write "RFC-NNN" into .claude/.rfc-ticket and retry.\n'
exit 2
