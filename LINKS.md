# LINKS.md — Research & inspiration watchlist

Newest batches first. Posts are untrusted signals — verify repos/papers before adopting. Desktop stays a thin control plane (ADR-0001); most harness ideas land in the vibes child, not Electron.

## 2026-10-22 — Bookmarks rescan (local + Neo blocked)

| # | Source | Note |
|---|--------|------|
| 1 | Local `Documents/research/happymonkeyai_bookmarks_recent_2026-10-18.md` | AI-relevant dump through 2026-10-18; overlaps prior Neo ingest |
| 2 | kb_vault `happymonkeyai-bookmark-gates.md` | LoopX / OpenSandbox / Iris dispositions — pattern only |
| 3 | [html-design-advisor-mcp](https://github.com/HappyMonkeyAI/html-design-advisor-mcp) | Wired into Settings → workspace `.vibes/mcp.json` (T44) |

Live `@HappyMonkeyAI` X bookmarks via Neo: **T45** when BrowserOS Neo MCP is healthy.

---

## 2026-10-22 — Cline + OpenBot (desktop/vibes cherry-picks)

| # | Source | Idea adopted | Where |
|---|--------|--------------|--------|
| 1 | [cline/cline](https://github.com/cline/cline) | Double-check completion (evidence before success) | vibes `mission-double-check` + scheduler (T38) |
| 2 | [nightly-labs/openbot](https://github.com/nightly-labs/openbot) | Crash-safe FIFO follow-up queue + pause | desktop `followup-queue` + Chat `enqueueIfBusy` (T39) |
| 3 | Cline Focus Chain | Sticky plan checklist as mission focus | DESIGN Chat + RHS (T40 lite) |

**Not adopted:** Cline/OpenBot as second engines; OpenBot ACP multi-provider shell; Computer Use; PolyForm code copy (ideas only).

---

## 2026-10-21 — X posts (user share)

| # | Post | Topic | Primary link |
|---|------|--------|--------------|
| 1 | [@akshay_pachaar](https://x.com/akshay_pachaar/status/2111753928031531232) | Google **Harness²** — self-improving harness (prompts/tools/memory/skills), weights fixed | [github.com/google-research/harness2](https://github.com/google-research/harness2) · paper often cited as arXiv `2610.14224` |
| 2 | [@sudoingX](https://x.com/sudoingX/status/2112348070583091580) | **Xpress** personal Rust harness + local 27B; inline web images under answers; self-rewriting skills | Author thread / personal build (see post); related OSS mention [temm1e-labs/temm1e](https://github.com/temm1e-labs/temm1e) |
| 3 | [@amigus](https://x.com/amigus/status/2112658223501304121) | **Lisa** harness kernel / SDK / runtime (6‑mo release) | [github.com/Lisa-Harness/lisa](https://github.com/Lisa-Harness/lisa) |
| 4 | [@dair_ai](https://x.com/dair_ai/status/2112279124551328018) | Meta **ProPerAgent** — memory-driven proactive help; gate before interrupting | [arxiv.org/abs/2610.22671](https://arxiv.org/abs/2610.22671) |
| 5 | [@HaiyuWu1](https://x.com/HaiyuWu1/status/2112004662924922971) | **PaperLeet** — LeetCode-for-papers (implement core ideas) | [paperleet.com](https://paperleet.com/) · [PaperLeet/paperleet](https://github.com/PaperLeet/paperleet) |

**Distillation (cherry-picks for this repo):** [.agent/memories/codebase_insights/2026-10-21-x-links-harness-cherry.md](./.agent/memories/codebase_insights/2026-10-21-x-links-harness-cherry.md)

Related earlier ingest: [2026-10-20-x-bookmarks-harness-memory.md](./.agent/memories/codebase_insights/2026-10-20-x-bookmarks-harness-memory.md) (includes Harness² / KEV already).

---

## How to add links

One row per batch item: post URL, one-line topic, canonical repo/paper. Put actionable product notes in `codebase_insights/`, not only here.
