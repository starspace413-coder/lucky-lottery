---
name: minimax-mcp
description: 使用 MiniMax Coding Plan MCP 進行網路搜尋和圖片理解。當用戶需要搜尋最新資訊、分析圖片、或用中文查詢時使用此技能。
---

# MiniMax MCP 技能

現在改成**泛用 MCP client**：先用 `--list` 看目前 server 暴露哪些工具，再呼叫對應 tool。

目前已知常見工具：
- `web_search`
- `understand_image`
- `search_mini_max_api_docs`（MiniMax 官方文件 MCP 搜尋）

## 先列出可用工具

```bash
cd ~/.openclaw/workspace
MINIMAX_API_KEY="$MINIMAX_CODING_PLAN_API_KEY" MINIMAX_API_HOST="https://api.minimax.io" node scripts/minimax_mcp_client.js --list
```

## web_search

搜尋網路資訊（中文支援好）。

```bash
cd ~/.openclaw/workspace
MINIMAX_API_KEY="$MINIMAX_CODING_PLAN_API_KEY" MINIMAX_API_HOST="https://api.minimax.io" node scripts/minimax_mcp_client.js web_search '{"query":"你的搜尋問題"}'
```

## understand_image

分析圖片內容。

```bash
cd ~/.openclaw/workspace
MINIMAX_API_KEY="$MINIMAX_CODING_PLAN_API_KEY" MINIMAX_API_HOST="https://api.minimax.io" node scripts/minimax_mcp_client.js understand_image '{"prompt":"你的問題","image_url":"圖片網址或路徑"}'
```

## search_mini_max_api_docs

搜尋 MiniMax 官方 API / MCP 文件。

```bash
cd ~/.openclaw/workspace
MINIMAX_API_KEY="$MINIMAX_CODING_PLAN_API_KEY" MINIMAX_API_HOST="https://api.minimax.io" node scripts/minimax_mcp_client.js search_mini_max_api_docs '{"query":"MCP server setup"}'
```

## 使用時機

- 用戶問「搜尋...」
- 用戶問「查一下...」
- 用戶傳圖片並問「這是什麼」
- 需要最新資訊時
