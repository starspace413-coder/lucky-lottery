# OpenClaw Cheatsheet（給 Canner）

> 目的：把你最常用、最有用的 CLI 操作整理成「真的跑得動」的版本。

---

## 0) 你的環境專用（最常用 5 行）

### A) 先確認你用的是新版 openclaw（避免撞到 `/usr/bin/openclaw` 舊版）
```bash
which openclaw
openclaw --version
~/.npm-global/bin/openclaw --version
```

### B) 目前穩定配置（2026-02-11）
- 因 google-antigravity OAuth 額度滿：已把 embedded agent **primary 暫時切到** `openai-codex/gpt-5.2`
- 若要看目前生效設定：
```bash
openclaw gateway call config.get --params '{}'
```

### C) 快速排查（90% 時候先跑這三個）
```bash
openclaw gateway status
openclaw gateway probe
openclaw logs --limit 200
```

---

> ⚠️ 注意：我在這個環境跑 `openclaw --help` 時有看到提示「CLI 版本較舊（2026.2.6-3），config 是 2026.2.9 寫的」。這通常代表 **路徑上還有舊的 `/usr/bin/openclaw`**。你之前已用 `~/.bashrc` alias 指到 `~/.npm-global/bin/openclaw` 解掉；若你在非互動 shell 又看到舊版，記得用完整路徑執行：
> 
> ```bash
> ~/.npm-global/bin/openclaw --version
> ```

---

## 1) Gateway（服務）

### 狀態 / 啟停 / 重啟
```bash
openclaw gateway status
openclaw gateway start
openclaw gateway stop
openclaw gateway restart
```

### 快速健檢
```bash
openclaw doctor --non-interactive
openclaw gateway probe
```

---

## 2) 日常觀測

### 全系統狀態（channels + 最近收件人）
```bash
openclaw status
```

### 看 gateway logs（最常用）
```bash
openclaw logs --limit 200
openclaw logs --follow
openclaw logs --follow --json
```

---

## 3) Config（你這台實際會用到的：config.patch）

### 看目前生效 config（走 gateway RPC）
```bash
openclaw gateway call config.get --params '{}'
```

### Patch（局部更新 + 自動 restart）
- 你可以用我這邊 tool 的 `gateway config.patch` 做；CLI 端對應通常是：
```bash
openclaw gateway call config.patch --params '<JSON>'
```

> 實務上：先 `config.get` 拿 hash，再 patch；避免覆蓋別人更新。

---

## 4) Cron（提醒 / 定時工作）

```bash
openclaw cron status
openclaw cron list
openclaw cron runs <jobId>
openclaw cron run <jobId>
openclaw cron disable <jobId>
openclaw cron enable <jobId>
openclaw cron rm <jobId>
```

---

## 5) Models（模型設定）

> 你目前最常用的方式是直接改 `openclaw.json` 裡的：
> - `agents.defaults.model.primary`
> - `agents.defaults.model.fallbacks`
>
> CLI 端還有 `openclaw models ...` 一整套（list/set/auth/status），但不同版本細節可能差異大；需要時我再針對你這版輸出「可直接跑」的指令。

---

## 6) Channels / Message（你目前用 Telegram）

### 探測 channel 是否健康
```bash
openclaw channels status --probe
```

### 看 channel logs
```bash
openclaw channels logs --channel telegram
```

---

## 7) Browser（可用時）

```bash
openclaw browser start
openclaw browser tabs
openclaw browser open <url>
openclaw browser screenshot
```

> Power Apps Studio 的 DOM 很不穩；通常用「你操作 + 我看截圖/你貼公式」比較快。

---

## 8) Debug 小抄（你現在常遇到的）

### A) 發現自己跑到舊版 openclaw
```bash
which openclaw
openclaw --version
~/.npm-global/bin/openclaw --version
```

### B) Gateway restart 後想確認設定有吃到
```bash
openclaw gateway status
openclaw gateway call config.get --params '{}'
```

---

## 9) Sessions（找子代理 / 最近活躍對話）

> 這版 CLI 的 sessions 是「列出已存的 session」；要更細（history/send）通常走 Gateway tool 或 UI。

```bash
openclaw sessions
openclaw sessions --active 120
openclaw sessions --json
```

---

## 10) Agents（多代理：建立/列出/刪除）

```bash
openclaw agents list
openclaw agents add <name>
openclaw agents set-identity <agentId>
openclaw agents delete <agentId>
```

---

## 11) Memory（檔案型記憶：index/search/status）

> 用於把 `memory/*.md`、`MEMORY.md` 做索引後快速搜尋。

```bash
openclaw memory status
openclaw memory index
openclaw memory index --force
openclaw memory search "關鍵字" --max-results 10
openclaw memory search "Power Apps 條碼" --max-results 10 --min-score 0.3
```

---

## 12) Models（CLI 常用指令：列出/狀態/切換/備援/alias/auth）

```bash
openclaw models list
openclaw models list --all
openclaw models status --plain
openclaw models status --probe

openclaw models set <modelId-or-alias>

openclaw models fallbacks list
openclaw models fallbacks add <modelId>
openclaw models fallbacks remove <modelId>
openclaw models fallbacks clear

openclaw models aliases list
openclaw models aliases add <alias> <modelId>
openclaw models aliases remove <alias>

openclaw models auth add
openclaw models auth login
openclaw models auth paste-token
```

> 你這台目前最穩的實務仍是：用 `gateway config.patch` 改 `agents.defaults.model.primary/fallbacks`。
