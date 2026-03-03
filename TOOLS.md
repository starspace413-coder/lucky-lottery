# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

---

## Web / 即時資訊搜尋（Canner 偏好）

- **即時資訊/新聞/社群**：優先用 `skills/minimax-mcp/`
  - `web_search`：取代未配置 Brave API key 的內建 `web_search`
  - `understand_image`：Threads 等 JS 動態站抓不到時，改用「截圖 → 圖片理解」
- `web_fetch`：用來抓「可直接讀取」的文章正文做摘要（遇 JS 站常失效）
