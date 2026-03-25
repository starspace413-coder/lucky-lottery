#!/usr/bin/env bash
set -euo pipefail

cd /home/starspace413/.openclaw/workspace
export MINIMAX_API_HOST="${MINIMAX_API_HOST:-https://api.minimax.io}"
export MINIMAX_API_KEY="${MINIMAX_API_KEY:-}"

if [[ -z "${MINIMAX_API_KEY:-}" ]]; then
  echo 'MINIMAX_API_KEY is required for official image API' >&2
  exit 1
fi

python3 scripts/minimax_image_generate.py "$@"
