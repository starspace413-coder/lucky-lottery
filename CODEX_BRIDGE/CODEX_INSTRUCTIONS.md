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
3. 同時建立 `working/<task-id>.log`
4. 讀取 JSON 任務內容
5. 在指定 `cwd` 內執行任務
6. 完成後在 `done/` 寫回結果 JSON
7. 如果失敗，寫到 `error/`

## 任務欄位
- `id`: 任務 ID
- `cwd`: 工作目錄
- `goal`: 任務目標
- `expected_output`: 期望輸出
- `constraints`: 約束條件陣列
- `timeout`: 秒數
- `priority`: `low | normal | high`
- `retryCount`: 已重試次數
- `createdAt`: 建立時間

## 重要原則
- 一定要用 move/rename，避免重複撿取同一個任務
- 不要覆寫原始 task 檔，結果請另外寫到 `done/` 或 `error/`
- 若任務需要產生檔案，請在 `artifacts` 欄位列出相對路徑
- `working/<task-id>.log` 用來記錄處理過程與錯誤

## 結果格式
參考：`result.example.json`

建議輸出路徑：
- `done/<task-id>.json`
- `error/<task-id>.json`
- `working/<task-id>.log`
