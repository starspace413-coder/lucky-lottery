#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from datetime import datetime

BASE = Path('/home/starspace413/.openclaw/workspace/CODEX_BRIDGE')
INBOX = BASE / 'inbox'
INBOX.mkdir(parents=True, exist_ok=True)

if len(sys.argv) < 2:
    print('Usage: openclaw_submit_task.py "task text" [mode] [cwd]', file=sys.stderr)
    sys.exit(1)

task_text = sys.argv[1]
mode = sys.argv[2] if len(sys.argv) > 2 else 'analysis'
cwd = sys.argv[3] if len(sys.argv) > 3 else '/home/starspace413/.openclaw/workspace'

ts = datetime.now().strftime('%Y%m%d-%H%M%S')
task_id = f'task-{ts}'
payload = {
    'id': task_id,
    'source': 'openclaw',
    'task': task_text,
    'cwd': cwd,
    'mode': mode,
    'createdAt': datetime.now().astimezone().isoformat(timespec='seconds'),
}
path = INBOX / f'{task_id}.json'
path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
print(path)
