#!/usr/bin/env bash
set -euo pipefail

cd /home/starspace413/.openclaw/workspace
mkdir -p data/minimax
curl -fsSL https://platform.minimax.io/docs/llms.txt -o data/minimax/llms.txt
printf 'Saved %s\n' "$(pwd)/data/minimax/llms.txt"
