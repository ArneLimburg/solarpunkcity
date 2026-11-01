#!/usr/bin/env bash
# PostToolUse hook: format files edited by Claude with the project's prettier.
set -u

file_path=$(jq -r '.tool_input.file_path // empty')
[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

prettier="$CLAUDE_PROJECT_DIR/node_modules/.bin/prettier"
[ -x "$prettier" ] || exit 0

"$prettier" --write --ignore-unknown --log-level warn "$file_path" >&2 || true
exit 0
