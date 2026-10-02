#!/bin/sh
# RFC gate, git side (rfc-5rv): a commit whose staged paths include
# spec/SPEC.md or spec/registry/registry.yaml needs an accepted-family RFC,
# found by the same lookup .claude/hooks/rfc-gate.sh uses: a branch name
# containing rfc-NNN, else RFC-NNN in .claude/.rfc-ticket; that RFC's Status
# line in spec/RFC-QUEUE.md must read Accepted or Landed. Called from
# .beads/hooks/pre-commit, so scripted writes (python, sed, heredoc) that
# never pass the editor hook are still checked at commit time.
#
# POSIX sh, git + grep + awk only: no python, nothing that opens a console.
# Exit 0 = allowed, 1 = refused (message on stderr).

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0

# GIT_INDEX_FILE is honored, so `git commit -- <paths>` and private-index
# commits are checked against what is actually being committed.
STAGED=$(git diff --cached --name-only -- spec/SPEC.md spec/registry/registry.yaml)
[ -z "$STAGED" ] && exit 0

QUEUE="$ROOT/spec/RFC-QUEUE.md"
BRANCH=$(git branch --show-current 2>/dev/null)
REF=$(printf '%s' "$BRANCH" | grep -oiE 'rfc-[0-9]+' | head -n 1)
if [ -z "$REF" ] && [ -f "$ROOT/.claude/.rfc-ticket" ]; then
    REF=$(grep -oiE 'rfc-[0-9]+' "$ROOT/.claude/.rfc-ticket" | head -n 1)
fi

if [ -z "$REF" ]; then
    printf 'RFC-GATE (pre-commit): staged %s without an RFC reference. Draft the change in spec/RFC-QUEUE.md; once the operator accepts it, commit on a branch named rfc-NNN or write RFC-NNN into .claude/.rfc-ticket.\n' \
        "$(printf '%s' "$STAGED" | tr '\n' ' ')" >&2
    exit 1
fi

REF=$(printf '%s' "$REF" | tr '[:lower:]' '[:upper:]')
STATUS=""
[ -f "$QUEUE" ] && STATUS=$(awk -v ref="$REF" '
    /^#+ *RFC-[0-9]+/ {
        h = toupper($0)
        i = index(h, ref)
        inrfc = (i > 0 && substr(h, i + length(ref), 1) !~ /[0-9]/)
    }
    inrfc && /[Ss]tatus:/ { print; exit }
' "$QUEUE")

if printf '%s' "$STATUS" | grep -qiE 'accepted|landed'; then
    exit 0
fi
printf 'RFC-GATE (pre-commit): %s is not accepted-family (%s). A normative change needs an Accepted RFC; get the ruling and update its Status line in spec/RFC-QUEUE.md first.\n' \
    "$REF" "${STATUS:-no Status line found}" >&2
exit 1
