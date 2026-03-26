# CODEX_BRIDGE MVP

共享資料夾式 bridge，讓 OpenClaw 與桌面 Codex 透過檔案佇列互通。

## 目錄
- `inbox/`：待處理任務
- `working/`：Codex 已撿起處理中的任務
- `done/`：完成結果
- `error/`：失敗結果
- `archive/`：可選，歷史封存

## 基本流程
1. OpenClaw / 人工 丟一個 JSON 任務到 `inbox/`
2. Codex polling `inbox/`
3. Codex 撿起任務後移到 `working/`
4. 完成後寫結果到 `done/`；失敗寫到 `error/`

## 任務檔格式（範例）
```json
{
  "id": "task-20260326-001",
  "source": "openclaw",
  "task": "分析 OpenClaw 為什麼會把舊 config 寫回 openclaw.json",
  "cwd": "/home/starspace413/.openclaw/workspace",
  "mode": "analysis",
  "createdAt": "2026-03-26T23:15:00+08:00"
}
```

## 結果檔格式（範例）
```json
{
  "id": "task-20260326-001",
  "status": "done",
  "summary": "root cause ...",
  "artifacts": [],
  "finishedAt": "2026-03-26T23:18:00+08:00"
}
```

## 建議
- polling 間隔先用 5–15 秒
- 一定要用 `rename/move` 搬進 `working/`，避免重複處理
- 任務結果不要直接覆蓋原檔，寫入 `done/` 或 `error/`
