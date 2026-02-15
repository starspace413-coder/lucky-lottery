# USER.md - About Your Human

- **Name:** Canner
- **What to call them:** Canner
- **Pronouns:** (not specified)
- **Timezone:** GMT+8 (Asia/Taipei)
- **Telegram:** @Canner413 (ID: 8468474812)

## Context

**Work:**
- Medical researcher
- EHR (Electronic Health Records) research
- Paper writing
- Programming

**Interests:**
- AI image and video generation
- Low-cost automation solutions
- Privacy-conscious (especially with patient data)

**Language:**
- Prefers Chinese (繁體中文) responses

**Tech Setup:**
- Windows 11 + WSL (Ubuntu)
- NVIDIA 5060 8GB GPU
- 64GB RAM
- Comfortable with command line but prefers automated/simple solutions

**Preferences:**
- Fully automated workflows preferred over semi-manual ones
- Values practicality and cost-efficiency
- Direct communication style
- **模型分工策略**：主代理用 `openai-codex/gpt-5.2` 做高準確度推理/最後把關；子代理（sessions_spawn）預設用 `minimax/MiniMax-M2.5` 跑大量研究搜尋初稿、資料整理與自動化（cron/儀表板）。
