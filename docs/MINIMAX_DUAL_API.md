# MiniMax Dual API 模式

目前採用雙 API 分工：

## 1. Coding Plan / Token Plan（`sk-cp-...`）

環境變數：`MINIMAX_CODING_PLAN_API_KEY`

用途：
- `MiniMax-M2.7` 文字模型
- MiniMax Coding Plan MCP
- `web_search`
- `understand_image`

已驗證：
- `MiniMax-M2.7` text chat: ✅
- `image-01` image generation: ❌ `2061 not support model`

## 2. Official API（`sk-api-...`）

環境變數：`MINIMAX_API_KEY`

用途：
- Official API 路線
- `image-01` image generation
- 未來其他 official multimodal API

已驗證：
- text / image 請求可到達 official API
- 目前兩把 `sk-api-...` 均回：❌ `1008 insufficient balance`

## 建議分工

- 文字 / MCP / 搜尋 / 看圖 → `MINIMAX_CODING_PLAN_API_KEY`
- 生圖 / official multimodal → `MINIMAX_API_KEY`

## 自檢

```bash
cd ~/.openclaw/workspace
./scripts/minimax_status.sh
```

## 相關腳本

- `scripts/minimax_mcp.sh`
- `scripts/minimax_docs_search.sh`
- `scripts/minimax_image_official.sh`
- `scripts/minimax_capability_check.py`
- `scripts/minimax_status.sh`
