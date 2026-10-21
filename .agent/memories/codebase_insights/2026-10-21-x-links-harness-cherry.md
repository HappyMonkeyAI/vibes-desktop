# X links cherry-pick — 2026-10-21

Source posts in [LINKS.md](../../../LINKS.md). Neo MCP was down; content pulled via Nitter mirrors + arXiv/GitHub. Claims unverified.

## Fit with Vibes Desktop

Desktop = thin control plane over vibes MCP. Prefer UX + settings + ledger improvements here; recursive harness / skill loops in the **vibes checkout**.

---

### 1. Harness² (Google) — highest leverage idea

**What:** Agent edits its own harness (prompt/tools/memory/skills), runs candidates, keeps what works by comparing trajectories — no task grader required; lessons carry to the next task. Weights fixed.

**Cherry-pick for us**
| Idea | Where | Priority |
|------|--------|----------|
| Post-mission “what harness change would have helped?” note | vibes → `.vibes/` or Adapter; desktop shows in depth / Retry seed | High (extends T31 forget-except-best) |
| Candidate re-run on failure (narrow: prompt/guidance only, not full swarm) | vibes scheduler / intervention retry | Medium — after T21 live |
| Parallel candidate harnesses | Out of scope for desktop v1 (cost/latency) | Later |

**Do not:** implement Harness² inside Electron.

---

### 2. Xpress (@sudoingX) — UX + local-first loops

**What:** Personal Rust harness; auto-discovers local model; web images rendered **under** the answer; self-rewriting skills; keys stay local.

**Cherry-pick for us**
| Idea | Where | Priority |
|------|--------|----------|
| Artifacts under the narrative (images / file previews next to chat or depth logs) | Future **Chat** tab + Operations depth | High for Chat phase-1 polish |
| Auto-detect OpenAI-compatible localhost on Roles Test / first mission | Desktop Roles / Settings | Medium |
| Self-writing skills mid-run | vibes only (Hermes-like); desktop may list skill files later | Low for desktop |

Rust rewrite of vibes: **reject** (ADR-0001).

---

### 3. Lisa harness (@amigus)

**What:** “Harness kernel, SDK, and runtime” OSS release.

**Cherry-pick:** Architecture read for vibes (tool registry, run lifecycle) — **not** a second engine in desktop. Spike: skim README for intervention / permission patterns we lack. Priority: Low–Medium research only.

---

### 4. ProPerAgent (Meta / DAIR) — intervention gating

**What:** Proactive assistant accuracy jumps when a **separate gate** decides whether retrieved memory justifies speaking *now*; silence is a first-class outcome. Ablation: remove gate → large drop. Paper: arXiv `2610.22671`.

**Cherry-pick for us**
| Idea | Where | Priority |
|------|--------|----------|
| Before `intervention_required` / TTS announce: decision step “escalate vs stay quiet” | KEV MCP (T26) + vibes triage | High — aligns with existing Decision Settings |
| Suppress duplicate / premature “Needs you” | Desktop metric strip + ledger classification | Medium |
| Graph memory of user prefs | Later; Adapter / vibes MEMORY — not Electron DB | Later |

---

### 5. PaperLeet (@HaiyuWu1)

**What:** Implement core ideas from papers; graded exercises; community.

**Cherry-pick:** Weak product fit for Mission Control. Optional: human learning / eval of AgentWorld-style world models; not a desktop feature. Priority: **Ignore/defer** for vibes-desktop (same bucket as Hy Memory).

---

## Suggested next actions (ordered)

1. **T26 + ProPerAgent gate** — when Decision MCP is configured, use it (or a thin System One client) to score “intervene vs continue” before escalating to the user / TTS.
2. **Chat tab artifacts** — when Chat lands, show downloads/images under assistant turns (Xpress pattern), not only ledger text.
3. **Harness²-lite lessons** — after failed missions, append one structured lesson into Retry seed (extend `buildRetryRequest`); optionally persist to `.vibes/harness-lessons.jsonl`.
4. **Lisa / Harness² repo skim** — one research afternoon in vibes; ticket any concrete protocol diffs; no Electron port.

## Explicit non-goals

- Replacing vibes with Lisa / Xpress / Harness² runtime.
- Autonomously editing production prompts without operator visibility.
- PaperLeet as in-app content.
