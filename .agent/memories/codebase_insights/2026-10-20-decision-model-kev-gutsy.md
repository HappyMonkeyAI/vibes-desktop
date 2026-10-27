# Decision-model spike — KEV / GUTSY (not generic Jev)

Date: 2026-10-20. Grounds Part A §1 against HappyMonkeyAI’s local stack.

## What we already have

| Piece | Repo / location | Role |
|-------|-----------------|------|
| **Kev** (Jev-compatible System One) | [jaredpalmer/kev](https://github.com/jaredpalmer/kev); local `~/Documents/development/kev` | Pointer-head decision model; `/v1/systemone` choice / noul / score |
| **kev-docker** | [HappyMonkeyAI/kev-docker](https://github.com/HappyMonkeyAI/kev-docker) | GPU Docker serve on `:8008` (`KEV_RUN` / `kev-4b` default) |
| **kev-decision-mcp** | [HappyMonkeyAI/kev-decision-mcp](https://github.com/HappyMonkeyAI/kev-decision-mcp); local checkout | FastMCP tools: `kev_evaluate`, `kev_permute`, `kev_separate`, `kev_select_tool`, `kev_custom_decision` → HTTP Kev |
| **Gutsy** | [kouhxp/gutsy](https://github.com/kouhxp/gutsy) (researched in SmartKeyboard docs) | Smaller English 0.8B GGUF System One–style runtime; mobile/edge experiment, not the primary LAN server |

Prior notes: `SmartKeyboard/docs/DECISION-MODEL-RESEARCH-2026-10-12.md`, `virtual-office` Kev crypto advisory work, EchoesOfAion `MCP.md` (`kev_157` / shadow tool select).

**GUTSY** in local experiments = the lighter decision endpoint (GGUF / llama.cpp path). **KEV** = the HappyMonkeyAI-served pointer-head family + MCP adapter. Both speak (or approximate) System One; do not treat bookmark “Vega / pplx-decider / d1” as the default integration target while this stack exists.

## Fit for Vibes Desktop (thin control plane)

Desktop already maps a **triage** role → `TRIAGE_MODEL` / `TRIAGE_BASE_URL` / `TRIAGE_API_KEY` in `.vibes/config.json`. That is an OpenAI-compatible *chat* endpoint today. Kev is **not** a chat model — it is typed `/v1/systemone` with probabilities.

So the spike is **not** “point TRIAGE_MODEL at kev-4b and hope”. Options:

1. **Preferred — MCP path (aligns with T26):** register `kev-decision-mcp` as an MCP tool server for the vibes child; triage/approval/tool-choice call `kev_evaluate` / `kev_select_tool` / `kev_custom_decision`. Desktop Settings only stores `KEV_API_BASE_URL` (+ optional key) and “use decision MCP”.
2. **Alt — HTTP helper in vibes:** small client in the vibes checkout that posts System One questions for intervention / escalate / done-gates; desktop writes URL into config.
3. **Reject:** stuffing Kev into `OLLAMA_*` chat completions.

Gutsy stays a **fallback / laptop-CPU** experiment if Docker GPU Kev is down — same question schemas via its `/v1/systemone` if compatible; measure latency + calibration separately.

## Spike acceptance (when we run it)

- [x] Kev reachable for clients — via **MCP** `http://192.168.5.157:8765/mcp` (direct `:8008` not on LAN).
- [x] One packed `kev_evaluate` for a synthetic triage case: escalate vs continue vs skip; record `probabilities`, wall `latency_ms`.
- [x] Shadow `kev_select_tool` smoke (fixture tools); ≥20 real-step agreement study still open.
- [x] Decision lean: integrate via **MCP (T26)**; defer vibes-native HTTP helper; do not use TRIAGE chat swap.
- [x] Do **not** auto-fail missions on Kev abstention; operator / existing intervention path remains source of truth.

### Probe log

| When | Result |
|------|--------|
| 2026-10-20 ~16:04 UTC+1 | `http://127.0.0.1:8008/v1/models` — **unreachable** (connection refused). |
| 2026-10-20 ~17:00 UTC+1 | Host `192.168.5.157` ping OK. **TCP 8008/8009 closed on LAN** (model APIs localhost-only on the server). **TCP 8765 open** — MCP is the LAN entry. |
| 2026-10-20 ~17:00 UTC+1 | MCP `http://192.168.5.157:8765/mcp` (Bearer `KEV_MCP_AUTH_TOKEN`): tools `kev_evaluate`, `kev_list_models`, `kev_permute`, `kev_review_trade`, `kev_select_tool`, `kev_separate`. Serving **kev-4b@139fdd94…** on CUDA (`kev-latest` / `jev-latest`). |
| 2026-10-20 ~17:00 UTC+1 | Synthetic triage `kev_evaluate` → choice **`escalate`** (p=0.3875 vs continue 0.3732 / skip 0.2393), confidence 0.0813, wall **~4.5 s** (model `latency_ms` 4518). |
| 2026-10-20 ~17:00 UTC+1 | Shadow `kev_select_tool` → **`__no_tool__`** top (0.4294); ask_operator 0.2786; wall **~80 ms**. Advisory only. |
| 2026-10-20 ~17:00 UTC+1 | Gutsy `:8009` not LAN-reachable from this workstation (same bind pattern as Kev API). Use Gutsy MCP if/when published separately; do not point desktop at `:8009` over LAN. |

**Topology for Vibes:** desktop / vibes child → **MCP `192.168.5.157:8765/mcp`** → (docker network) Kev `:8008`. Never require LAN clients to hit `:8008` directly.

**2026-10-21:** Unsloth Studio on `http://192.168.5.157:8888` serves OpenAI chat (`/v1/models`, `/v1/chat/completions`) for AgentWorld etc. `GET/POST /v1/systemone` on that host → **404**. Do not treat Unsloth `:8888` as the Decision model; Decision remains KEV MCP `:8765` (or a real System One port when published).

**Integration lean:** prefer **T26 MCP registration** of `kev-decision-mcp` (HTTP) over stuffing System One into `TRIAGE_MODEL` chat. Thresholds must use `probabilities`, not `confidence` (0.08 confidence with ~0.39 top here).

**Settings (T34):** Settings → General → **Decision model (KEV)** stores `decisionMcpUrl` + encrypted bearer. On only when both are present (`isDecisionModelConfigured` / `resolveDecisionMcpConfig`). Empty URL ⇒ decision calls skipped. `.env` `KEV_MCP_*` hydrates the view when settings file is empty.

## Explicit non-goals

- Replacing the planner/executor LLM with Kev.
- Shipping Gutsy inside the Electron installer.
- Using bookmark Decision 3.0 / Vega as the first LAN target.
