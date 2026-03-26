#!/usr/bin/env python3
import argparse
import json
from pathlib import Path
from datetime import datetime

BASE = Path('/home/starspace413/.openclaw/workspace/CODEX_BRIDGE')
INBOX = BASE / 'inbox'
INBOX.mkdir(parents=True, exist_ok=True)

parser = argparse.ArgumentParser(description='Submit a task to CODEX_BRIDGE inbox')
parser.add_argument('--cwd', required=True, help='Working directory for Codex task')
parser.add_argument('--goal', required=True, help='Task goal')
parser.add_argument('--expected-output', required=True, dest='expected_output', help='Expected output description')
parser.add_argument('--constraint', action='append', default=[], help='Constraint line (repeatable)')
parser.add_argument('--timeout', type=int, default=1800, help='Timeout in seconds')
parser.add_argument('--priority', default='normal', choices=['low', 'normal', 'high'], help='Task priority')
parser.add_argument('--retry-count', type=int, default=0, dest='retryCount', help='Retry count')
args = parser.parse_args()

ts = datetime.now().strftime('%Y%m%d-%H%M%S')
task_id = f'task-{ts}'
payload = {
    'id': task_id,
    'cwd': args.cwd,
    'goal': args.goal,
    'expected_output': args.expected_output,
    'constraints': args.constraint,
    'timeout': args.timeout,
    'priority': args.priority,
    'retryCount': args.retryCount,
    'createdAt': datetime.now().astimezone().isoformat(timespec='seconds'),
}
path = INBOX / f'{task_id}.json'
path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
print(path)
