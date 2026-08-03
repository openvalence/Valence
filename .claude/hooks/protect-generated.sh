#!/usr/bin/env bash
# PROTECT-GENERATED (PreToolUse, Edit|Write): generated views are regenerated,
# never hand-edited. Covers the codegen outputs of tools/gen_registry_header.py
# and the docs-site build product. SPEC.md Appendices A/B/G are generated views
# too, but they live inside SPEC.md, which rfc-gate.sh already gates whole.
set -u
IN=$(cat)
FILE=$(printf '%s' "$IN" | python -c "import json,sys;print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null || true)
[ -z "$FILE" ] && exit 0
NORM=$(printf '%s' "$FILE" | tr '\\' '/' | tr '[:upper:]' '[:lower:]')
case "$NORM" in
  */generated/* | */docs-site/site/*)
    >&2 printf 'PROTECT-GENERATED: %s is a generated view. Edit spec/registry/registry.yaml (via an accepted RFC) and regenerate: python tools/gen_registry_header.py. Never hand-edit codegen output.\n' "$FILE"
    exit 2
    ;;
esac
exit 0
