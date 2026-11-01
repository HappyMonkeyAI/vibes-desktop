# HappyMonkeyAI bookmarks — Neo delta (2026-11-01)

Source: BrowserOS Neo → X History → **Bookmarks** (`https://x.com/i/history`). Logged in as Happy Monkey AI.  
Window: **2026-10-22 → 2026-10-31** (~55 unique articles across scrolls). Claims unverified.

Prior: `2026-10-22-bookmarks-neo-delta.md` (through ~Oct 21).

---

## Highest fit for Vibes Desktop / vibes child

| Signal | Why | Disposition |
|--------|-----|-------------|
| **single-agent-loop-kit** (Anthropic) — companion to “Building agents”; when multi-agent should collapse to one loop ([@Ryrenz](https://x.com/Ryrenz/status/2115339284018266362) · [anthropics/single-agent-loop-kit](https://github.com/anthropics/single-agent-loop-kit)) | Roles already planner/executor/reviewer; kit helps decide consolidation vs fan-out | **Vibes research:** skim for role-merge heuristics. **Not** Electron. |
| **Elephant-Goldfish** (Google) — no code until plan survives; no self-grading; fight mid-feature context collapse ([@awe0_io](https://x.com/awe0_io/status/2114666959786983759) · [@thisguyknowsai](https://x.com/thisguyknowsai/status/2116453452977152209) · [google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model)) | Aligns with mission double-check / evidence-before-done (T38) and first-run clarity | **Cherry-pick ideas** into vibes verify ladder / focus checklist — not a second engine. |
| **Hermit** — harness evolution / continual adapters without changing base model ([@haizhong_zheng](https://x.com/haizhong_zheng/status/2114769723879464983) · [Infini-AI-Lab/hermit](https://github.com/Infini-AI-Lab/hermit)) | Same family as Harness² / OO-Harness | Research for `.vibes/harness-lesson` evolution; operator-visible only. |
| **Self-improving harness limits** — full harness rewrites ≈ +2.8 held-out; confidence weak ([@omarsar0](https://x.com/omarsar0/status/2114050042705379461)) | Counters hype for autonomous harness rewrite | **Keep:** no auto-evolve production prompts/tools. |
| **Wavestone “7 building blocks”** — agent = model + harness across 11 coding agents ([@Arindam_1729](https://x.com/Arindam_1729/status/2114026631941574741)) | Names the ADR-0001 split | Cite in CONTEXT/docs when explaining thin shell. |
| **OpenDuet** — proactive agent + HITL + any harness ([@ataiiam](https://x.com/ataiiam/status/2115097056394240293) · [CopilotKit/OpenDuet](https://github.com/CopilotKit/OpenDuet)) | Thematic cousin of Needs You / Decision | Ideas only; **reject** import (ADR-0001). |
| **“Is Complex Agentic Memory Always Needed?”** / **Obelisk** — queryable past sessions without heavy KG extract ([@QuantumTransf](https://x.com/QuantumTransf/status/2116463876594434496) · [tommy0103/obelisk](https://github.com/tommy0103/obelisk)) | Spine/ledger already lean; resists overbuilding memory | Prefer append-only ledger + recall over fancy agent memory stacks in desktop. |
| **LEANN** — local RAG storage ~97% smaller ([@MarioNawfal](https://x.com/MarioNawfal/status/2114775314572157182) · [StarTrail-org/LEANN](https://github.com/StarTrail-org/LEANN) · arXiv `2506.08276`) | Local memory/RAG without GPU cloud | Watchlist for vibes LTM if we ever ship on-disk retrieval. |
| **HarnessRouter** — one API for Codex/Claude Code sessions ([@trendtech33566](https://x.com/trendtech33566/status/2114215413571842219) · [HarnessRouter/harnessrouter](https://github.com/HarnessRouter/harnessrouter)) | Mirrors Roles multi-endpoint shape | Pattern note only; desktop already has per-role baseUrl. |
| **Graphify** — codebase knowledge graph so agents stop re-grepping ([@DivyanshT91162](https://x.com/DivyanshT91162/status/2113669209645572177)) | Mission context efficiency | Vibes-child research; not Electron. |
| **NVIDIA instruction-hierarchy rubrics** ([@HuggingPapers](https://x.com/HuggingPapers/status/2113671989059584047)) | System vs user conflict — Decision / Needs You | Eval dataset watchlist; do **not** displace KEV. |
| **LFM3** (Liquid, 2B-class agents + multimodal) ([@helloiamleonie](https://x.com/helloiamleonie/status/2115138207339720904)) | Tiny parallel agents / local roles | Model watchlist. |
| **Liquid d1.1** decision model ([@liquidai](https://x.com/liquidai/status/2113678429040304354)) | Decision theme | Watchlist only; keep KEV/GUTSY. |
| **Qwenputer** — Gated DeltaNet as RAM / RISC-V in weights ([@QwenDevs](https://x.com/QwenDevs/status/2115404434503344238)) | Exotic “memory in model” | Curiosity; no product path. |
| **Microsoft agent-framework** — durability / recover mid-run ([@TiagerBao](https://x.com/TiagerBao/status/2116473163819430294)) | Ghost-done / evidence handoff theme | Idea alignment only. |
| **RSIHub** / **Octopus OS** — composable RSI; agent edits harness mid-task | Continual harness themes | Research; **no** silent self-mod in production. |

---

## Explicit rejects / wrong product

| Item | Reason |
|------|--------|
| **dsh-superagent**, Cindy, Meridian, thinkrail, Autopilot | Second engines / computer-use shells — ADR-0001 |
| **Hinoki**, ALIENS EYE | Offensive / doxxing — out of scope |
| **Explee** | Outreach SaaS — not product |
| **Qwen3.5-4B-3D-Coder**, Ludra, PixelFX, PhysAg3D, game cheatsheet | GameForge / Three.js lane, not vibes-desktop control plane |
| **Clover dLLM**, FilmCraft, FigCraft, short-drama stacks | Adjacent OSS noise |

---

## Suggested next (ordered)

1. ~~Skim elephant-goldfish + single-agent-loop-kit~~ → **T81** done (`2026-11-01-elephant-goldfish-single-agent-loop.md`).
2. Keep **LEANN** / **Obelisk** / **LFM3** / Liquid **d1.1** on **T51** watchlist; do not add a vector DB to desktop.
3. **T79** constitutions shipped; **T80** overlay+compose still open. **T62** Decision live unchanged.

## Non-goals

- Auto-evolving harness mid-mission without operator visibility.
- Importing OpenDuet / Hermit / agent-framework runtimes into Electron.
