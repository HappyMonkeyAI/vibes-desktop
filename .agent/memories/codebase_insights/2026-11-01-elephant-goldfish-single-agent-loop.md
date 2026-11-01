# T81 — Elephant-Goldfish + single-agent-loop-kit (research)

Claims unverified; no runtime import. Sources from HappyMonkeyAI X bookmarks (2026-11-01 delta).

## Elephant-Goldfish (Google)

Repo: [google/elephant-goldfish-model](https://github.com/google/elephant-goldfish-model)  
Posts: [@awe0_io](https://x.com/awe0_io/status/2114666959786983759), [@thisguyknowsai](https://x.com/thisguyknowsai/status/2116453452977152209)

**Core idea:** stop shipping sloppy agent code by process, not by a smarter model.

| Rule (paraphrase) | Vibes / desktop mapping |
|-------------------|-------------------------|
| No code until the plan survives | Review Plan / plan accept before execute |
| No AI grading its own homework | Double-check completion + adversarial audit (reviewer role); Decision Needs You |
| Fight mid-feature context collapse | Sticky focus / harness lessons on Retry; constitutions (T79) stay fixed SoT |

**Product takeaway:** strengthen verify-ladder language and operator gates — do not import the Google skill pack into Electron.

## Anthropic single-agent-loop-kit

Repo: [anthropics/single-agent-loop-kit](https://github.com/anthropics/single-agent-loop-kit)  
Post: [@Ryrenz](https://x.com/Ryrenz/status/2115339284018266362)

**Core idea:** companion to Anthropic’s “Building agents” guidance — decide when a multi-agent fan-out should collapse into one agent loop.

**Vibes mapping:** we already have planner / executor / reviewer / triage. Use the kit as a **design checklist** when adding roles or MCP tools:

- Prefer one loop + tools over a new role unless the role has a distinct model/endpoint job.
- Reviewer stays separate (non-self-grading), aligned with Elephant-Goldfish.
- T80 overlays refine a mission; they must not invent new standing roles silently.

## Explicit non-goals

- Vendoring either repo into vibes-desktop.
- Auto-rewriting role constitutions from agent output (see T82 / ADR-0001).
