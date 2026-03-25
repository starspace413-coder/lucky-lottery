#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo 'Usage: ./scripts/minimax_docs_search.sh "your query"' >&2
  exit 1
fi

QUERY="$*"
cd /home/starspace413/.openclaw/workspace
INDEX="data/minimax/llms.txt"

if [[ ! -f "$INDEX" ]]; then
  ./scripts/minimax_docs_refresh.sh >/dev/null
fi

printf '=== llms.txt matches ===\n'
if grep -iEn "${QUERY//\//\\/}" "$INDEX" | head -20; then
  true
else
  echo '(no direct llms.txt matches)'
fi

printf '\n=== docs site search fallback ===\n'
./scripts/minimax_mcp.sh web_search "{\"query\":\"site:platform.minimax.io/docs ${QUERY//\"/\\\"}\"}"
