# PROGRESS.md — Session Log

Newest first. Each entry: date, what was done, evidence, what's next, open questions.

## 2026-10-13 — Repo bootstrap (planning)

**Done:** Scaffolded the documentation spine per Agents Protocol: README, CONTEXT, AGENTS, SPEC (S1–S8), PLAN (P0–P4 + module map), TASKS (T1–T15), MCP.md intent routing, three ADRs, LTM skeleton. Cloned and read all four sources: wayland-fork mission-control page + roles engine, vibes-dashboard VibesBridge (JSON-RPC stdio child process, env allowlist), vibes 0.4.0 config surface (.vibes/config.json per-role models, toggles), yapsnap (CPU sherpa-onnx STT).

**Decisions locked with user:** Electron shell (reuse React/Arco mission-control components); spawn vibes' MCP server as child process (thin app, tracks upstream releases — no native engine port); yapsnap as sole STT backend (offline, no Web Speech API).

**Root cause of the fork's first-landing error text identified:** the operations view's source-health banner ("Activity is incomplete") fires because a fresh install has no Wayland teams/workflows/scheduler sources. ADR-0003 drops that banner here — with one Vibes source, an empty ledger renders "All quiet".

**Next:** P0/T1+T2 — Electron+Vite+React skeleton, IPC channel map, vitest/typecheck/build gates. Then P1 bridge work.

**Open questions:**
- ~~Exact vibes MCP server method names~~ — resolved: `plan_mission`, `execute_mission`, `start_execution`, `resolve_intervention`, `query_status` (read from vibes 0.4.0 `src/mcp/server.ts`; recorded in PLAN.md).
- Mic capture approach: renderer MediaRecorder vs main-process capture — decide in T10, leaning renderer (simpler, no extra native deps).
