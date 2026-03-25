#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo 'Usage: ./scripts/minimax_docs_search.sh "your query"' >&2
  exit 1
fi

QUERY="$*"
cd /home/starspace413/.openclaw/workspace
./scripts/minimax_mcp.sh web_search "{\"query\":\"site:platform.minimax.io/docs ${QUERY//\"/\\\"}\"}"
