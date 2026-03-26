# OpenClaw 使用方式

## 丟任務給桌面 Codex

```bash
cd /home/starspace413/.openclaw/workspace/CODEX_BRIDGE
python3 openclaw_submit_task.py "分析 OpenClaw 為何會把舊 config 寫回去"
```

可選參數：

```bash
python3 openclaw_submit_task.py "修 Hole Web build 問題" code /home/starspace413/.openclaw/workspace/hole-web
```

## 結果查看
- 成功：`done/`
- 失敗：`error/`
- 處理中：`working/`

## 給 Codex 讀的說明
請讓桌面 Codex 讀：
- `CODEX_INSTRUCTIONS.md`
- `task.example.json`
- `result.example.json`
