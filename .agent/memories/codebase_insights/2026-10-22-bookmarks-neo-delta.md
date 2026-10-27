# HappyMonkeyAI bookmarks — Neo delta (2026-10-22)

Source: BrowserOS Neo → X History → **Bookmarks** tab (`https://x.com/i/history`, Bookmarks selected). Logged in as Happy Monkey AI.  
Captured ~25 unique articles after scroll (newest ~2026-10-21 17:50Z). Claims unverified.

Prior desktop Neo dump: 2026-10-20. This pass emphasizes **Oct 20 evening → Oct 21**.

---

## Highest fit for Vibes Desktop / vibes child

| Signal | Why | Disposition |
|--------|-----|-------------|
| **OO-Harness** (Google Cloud AI Research) — class hierarchy of specialized harnesses + design lessons + router; arXiv `2610.28380` ([@omarsar0](https://x.com/omarsar0/status/2112911038098317422)) | Same family as Harness² / T35 lessons; inheritance beats flat copies | **Vibes research:** extend harness-lesson schema with “helped / failed” + optional router hint. **Not** Electron. |
| **Evolving agent interfaces / Agent S4** (Simular) — meta-agent writes tools from unlabeled trajectories; arXiv `2610.28601` ([@dair_ai](https://x.com/dair_ai/status/2112914561590546695)) | Reinforces MCP tool registry (T44) over hand-built computer-use | Keep growing **allowlisted** workspace MCP tools; no autonomous tool soup in desktop. |
| **Underdog Bark 3.0** STT — 163MB, claims beat Whisper large-v3 ([@UnderdogAI](https://x.com/UnderdogAI/status/2112733007484518470)) · [underdog.ai/bark](http://underdog.ai/bark) | Voice path already multi-engine | **Watchlist** for Settings → Speech (after license + local bench vs Whisper/yapsnap). |
| **Flint** (Recursive SI / Eureka) — fast local coding weights ([@RichardSocher](https://x.com/RichardSocher/status/2112944385415426249)) | Roles / executor model option | Watchlist only until HF id + license verified. |
| **LFM2.5-24B-A2B** / **Spark-X2.6-4B** | Local agent models | Already on Oct-20 model watchlist; no new ticket. |
| **d3-turbo** multimodal decision ([@XunzhuoLiu](https://x.com/XunzhuoLiu/status/2112343603209261092)) | Decision theme | Do **not** displace KEV/GUTSY. |
| **Épi** persistent research agent; arXiv `2610.24944` | RSI / multi-session science | Out of scope for desktop control plane. |
| **Lisa** harness ([@amigus](https://x.com/amigus/status/2112658223501304121)) | Already in LINKS 2026-10-21 | Research skim in vibes only. |
| **ProPerAgent** / **Harness²** / **PaperLeet** | Already ingested | No change. |
| **LiteLLM 1.107.0 compromise** ([@SocketSecurity](https://x.com/SocketSecurity/status/2112907732877775016)) | Supply-chain | Ops hygiene if any path uses LiteLLM; not a product feature. |
| **OpenUI** / **PandaCode** / **ai-maestro** | Generative UI / alt agent shells | **Reject** as second engine (ADR-0001). |

---

## Suggested next tickets (ordered)

1. **T46 (vibes):** OO-Harness-inspired lesson fields — `helped` / `failed` + optional `harnessClass` hint on `.vibes/harness-lesson.json` (extends T35).
2. Optional Voice spike: Bark 3.0 local bench vs builtin Whisper (defer until owner wants STT swap).
3. No new Electron features from this batch beyond T43/T44 already shipped.

## Explicit non-goals

- Auto-evolving production prompts/tools without operator visibility.
- Importing OO-Harness / Agent S4 / Épi runtimes into Electron.
