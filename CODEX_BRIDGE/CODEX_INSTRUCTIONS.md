# CODEX Bridge Instructions

你是桌面 Codex。請把 `/home/starspace413/.openclaw/workspace/CODEX_BRIDGE` 當成共享橋接資料夾。

## 目錄規則
- `inbox/`：待處理任務
- `working/`：已撿起、處理中
- `done/`：完成結果
- `error/`：失敗結果
- `archive/`：可選封存

## 你該做什麼
1. 定期輪詢 `inbox/`（建議 5–15 秒）
2. 撿到任務後，立刻把檔案移到 `working/`
3. 讀取 JSON 任務內容
4. 在指定 `cwd` 內執行任務
5. 完成後在 `done/` 寫回 `result.json`
6. 如果失敗，寫到 `error/`

## 重要原則
- 一定要用 move/rename，避免重複撿取同一個任務
- 不要覆寫原始 task 檔，結果請另外寫到 `done/` 或 `error/`
- 若任務需要產生檔案，請在 `artifacts` 欄位列出相對路徑

## 任務格式
參考：`task.example.json`

## 結果格式
參考：`result.example.json`

## 建議輸出
`done/<task-id>.json`

內容示例：
```json
{
  "id": "task-20260326-001",
  "status": "done",
  "summary": "已完成...",
  "artifacts": ["some/file.txt"],
  "finishedAt": "2026-03-26T23:30:00+08:00"
}
```
