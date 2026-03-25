---
name: minimax-mcp
description: 使用 MiniMax Coding Plan MCP 進行網路搜尋和圖片理解。當用戶需要搜尋最新資訊、分析圖片、或用中文查詢時使用此技能。
---

# MiniMax MCP 技能

現在改成**泛用 MCP client + docs 搜尋 workflow**。

目前你本地 `minimax-coding-plan-mcp` server 實測可用工具：
- `web_search`
- `understand_image`

注意：`search_mini_max_api_docs` 是 **MiniMax 官方文件自己的 docs MCP server** 暴露的 tool，
**不是** 目前這個本地 `minimax-coding-plan-mcp` 直接提供的 tool。
所以在現有工作流中，先用：
- `llms.txt` 官方索引
- `web_search + site:platform.minimax.io/docs`

## 先列出可用工具

```bash
cd ~/.openclaw/workspace
./scripts/minimax_mcp.sh --list
```

## web_search

```bash
cd ~/.openclaw/workspace
./scripts/minimax_mcp.sh web_search '{"query":"你的搜尋問題"}'
```

## understand_image

```bash
cd ~/.openclaw/workspace
./scripts/minimax_mcp.sh understand_image '{"prompt":"你的問題","image_source":"圖片網址或路徑"}'
```

## 更新官方 docs 索引（llms.txt）

```bash
cd ~/.openclaw/workspace
./scripts/minimax_docs_refresh.sh
```

## 搜尋 MiniMax 官方文件（整合 llms.txt + fallback）

```bash
cd ~/.openclaw/workspace
./scripts/minimax_docs_search.sh "MCP server setup"
```

`minimax_docs_search.sh` 會：
1. 先查本地 `data/minimax/llms.txt`
2. 再 fallback 到 `web_search site:platform.minimax.io/docs`

## 使用時機

- 用戶問「搜尋...」
- 用戶問「查一下...」
- 用戶傳圖片並問「這是什麼」
- 需要最新資訊時
- 需要查 MiniMax 官方文件、Token Plan、MCP、M2.7 用法時
