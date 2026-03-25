#!/usr/bin/env bash
set -euo pipefail

cd /home/starspace413/.openclaw/workspace

python3 scripts/minimax_capability_check.py

echo

echo '=== coding-plan text probe ==='
python3 - <<'PY'
import os, requests, json
key = os.environ.get('MINIMAX_CODING_PLAN_API_KEY')
if not key:
    print(json.dumps({'error':'MINIMAX_CODING_PLAN_API_KEY not set'}, ensure_ascii=False, indent=2))
    raise SystemExit(0)
r = requests.post('https://api.minimax.io/v1/text/chatcompletion_v2', headers={'Authorization': f'Bearer {key}', 'Content-Type':'application/json'}, json={
  'model':'MiniMax-M2.7',
  'messages':[{'role':'system','content':'You are concise.'},{'role':'user','content':'Reply with exactly: OK'}],
  'max_completion_tokens':16,
  'temperature':0.1,
}, timeout=120)
try:data=r.json()
except Exception:data={'raw':r.text[:500]}
base=data.get('base_resp') or {}
print(json.dumps({'http_status':r.status_code,'status_code':base.get('status_code'),'status_msg':base.get('status_msg'),'has_choices':bool(data.get('choices'))}, ensure_ascii=False, indent=2))
PY
