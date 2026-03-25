#!/usr/bin/env bash
set -euo pipefail

cd /home/starspace413/.openclaw/workspace

export MINIMAX_API_KEY="${MINIMAX_CODING_PLAN_API_KEY:-${MINIMAX_API_KEY:-}}"
export MINIMAX_API_HOST="${MINIMAX_CODING_PLAN_API_HOST:-${MINIMAX_API_HOST:-https://api.minimax.io}}"

if [[ -z "${MINIMAX_API_KEY:-}" ]]; then
  echo "MINIMAX_CODING_PLAN_API_KEY or MINIMAX_API_KEY is required" >&2
  exit 1
fi

node scripts/minimax_mcp_client.js "$@"
