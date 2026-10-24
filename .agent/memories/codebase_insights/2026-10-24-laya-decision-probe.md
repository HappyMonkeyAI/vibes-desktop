# T53 — Laya vs Unsloth Decision / Vibes intervene (2026-10-24)

Source: X bookmark (Nandakishor / Laya) + [github.com/NandhaKishorM/laya](https://github.com/NandhaKishorM/laya) + live Unsloth Studio MCP `http://192.168.5.157:8888/mcp/`.

## What Laya is

Non-autoregressive **System 1** typed-decision engine (`choice` / `score` / `noul`), ~33 ms class claims, Apache-2.0. Optional `laya[mcp]` exposes tools like `laya_predict`, `laya_preset` (triage / **guard** / moderation / router), `laya_decide`, batch/shortlist/tournament. Presets include prompt jailbreak/injection guardrails.

## What we already have

Unsloth Studio Agent MCP tool **`system_one`** is the same API shape. Live call returned `model: "laya-english"` with structured `answers.action.{choice,probabilities,confidence}`. Desktop + vibes already prefer `system_one` on `:8888` then `kev_evaluate`.

Unsloth MCP does **not** expose native Laya tools (`laya_preset`, `laya_guard`, …) — only Studio ops + `system_one` (+ chat/media/train).

## Live probe (2026-10-24)

| Check | Result |
|-------|--------|
| `tools/list` | 23 tools; Decision path = `system_one` only |
| `studio_status` | Chat loaded `MiniCPM-V-4.7-35B-A3B-GGUF`; VRAM ~23.5/23.9 GB; GPU util ~99% |
| `system_one` css_orphan triage | `continue` 0.62 / `escalate` 0.29 / `skip` 0.08; **confidence 0.22** (low) |
| Fail-closed | Empty/parse failure → our gate escalates (safe) |

Script: `scripts/t53-laya-probe.mjs` (`KEV_MCP_URL` + `KEV_MCP_AUTH_TOKEN`).

## Disposition (ADR-0001)

| Idea | Verdict |
|------|---------|
| Second Decision stack / embed `laya-mcp-server` in Electron | **Reject** |
| Keep Unsloth `system_one` as Laya front-door | **Keep** (current) |
| Enrich intervene / future tool-approve questions (allow/deny/escalate) on same `system_one` | **Accept** when vibes has a pre-tool hook |
| Optional LAN `laya-serve` + `laya_preset` for guardrails | **Defer** — only if Unsloth never grows presets |
| Escalate when `confidence` below threshold | **Candidate T54** — Laya documents `min_confidence`; our probe showed continue-win with conf 0.22 |

## Explicit non-goals

- Importing Laya runtimes, LangGraph guard nodes, or jailbreak middleware into the desktop process.
- Replacing KEV on HappyMonkey hosts that still speak `kev_evaluate`.
