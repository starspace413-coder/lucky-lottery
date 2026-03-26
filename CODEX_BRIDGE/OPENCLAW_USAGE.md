# OpenClaw 使用方式

## 丟任務給桌面 Codex

```bash
cd /home/starspace413/.openclaw/workspace/CODEX_BRIDGE
python3 openclaw_submit_task.py \
  --cwd /home/starspace413/.openclaw/workspace/token-dashboard \
  --goal "修正首頁圖表載入失敗" \
  --expected-output "能正常顯示圖表，並說明改了什麼" \
  --constraint "不要刪除使用者現有修改" \
  --constraint "不要做對外操作"
```

## 結果查看
- 成功：`done/`
- 失敗：`error/`
- 處理中：`working/`
- 執行 log：`working/<task-id>.log`

## 給 Codex 讀的說明
請讓桌面 Codex 讀：
- `CODEX_INSTRUCTIONS.md`
- `task.example.json`
- `result.example.json`
