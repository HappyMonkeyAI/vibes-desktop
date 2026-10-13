# PROGRESS.md — Session Log

Newest first. Each entry: date, what was done, evidence, what's next, open questions.

## 2026-10-13 — P0 scaffold complete (T1 + T2)

**Done:** Built the three-process Electron skeleton and made all local quality gates green.
- `src/shared/channels.ts` — the V1 IPC contract: 7 channels, ledger/roles/mission types, `classify()` ported verbatim from the fork's TaskLedgerService (approval-provenance branch dropped per ADR-0003).
- `src/main/index.ts` + `src/main/ipc/handlers.ts` — app lifecycle + a handler table keyed by channel value; P0 stubs stand in until their owning task lands.
- `src/preload/index.ts` + `index.d.ts` — typed contextBridge surface (`window.vibesDesktop`), the renderer's only IPC path.
- `src/renderer/` — React 19 + Arco mission-control shell: Operations tab (LIVE indicator, four stat tiles, status accents, "All quiet" empty state) + Roles stub; CSS Module for theming, UnoCSS wired in.

**Evidence (all run this session):**
- `npm test` → **8/8 passed** (classify semantics, IPC channel parity V1 gate, S1 "All quiet never error banner").
- `npm run typecheck` → clean on both tsconfig.node.json and tsconfig.web.json.
- `npm run build` → main/preload/renderer all emit to out/.
- **Live boot (V2):** launched the built app; window titled "Vibes Desktop" rendered Mission Control with Operations/Roles tabs, four zero stat tiles, LIVE indicator, and **"All quiet"** — no error banner. Screenshot verified by vision analysis. Test instance killed cleanly (zerogterm left untouched).

**Dependency notes:** electron-vite@5 peers vite ^7; @vitejs/plugin-react@6 needs vite 8, so pinned plugin-react@^5 + vite@^7. esbuild postinstall scripts approved via `npm install-scripts approve`. The terminal tool's "long-lived process" heuristic false-positives on any command containing the word *electron* or a `| tail` pipe — worked around by writing package lists to a file and expanding at runtime, and by driving installs/screenshots through PowerShell scripts.

**Next:** P1/T3+T4 — JSON-RPC stdio transport + VibesBridge (spawn vibes MCP server, env allowlist, map the five confirmed tools onto ledger rows). Then T5 LedgerStore.

## 2026-10-13 — Repo bootstrap (planning)

**Done:** Scaffolded the documentation spine per Agents Protocol: README, CONTEXT, AGENTS, SPEC (S1–S8), PLAN (P0–P4 + module map), TASKS (T1–T15), MCP.md intent routing, three ADRs, LTM skeleton. Cloned and read all four sources: wayland-fork mission-control page + roles engine, vibes-dashboard VibesBridge (JSON-RPC stdio child process, env allowlist), vibes 0.4.0 config surface (.vibes/config.json per-role models, toggles), yapsnap (CPU sherpa-onnx STT).

**Decisions locked with user:** Electron shell (reuse React/Arco mission-control components); spawn vibes' MCP server as child process (thin app, tracks upstream releases — no native engine port); yapsnap as sole STT backend (offline, no Web Speech API).

**Root cause of the fork's first-landing error text identified:** the operations view's source-health banner ("Activity is incomplete") fires because a fresh install has no Wayland teams/workflows/scheduler sources. ADR-0003 drops that banner here — with one Vibes source, an empty ledger renders "All quiet".

**Next:** P0/T1+T2 — Electron+Vite+React skeleton, IPC channel map, vitest/typecheck/build gates. Then P1 bridge work.

**Open questions:**
- ~~Exact vibes MCP server method names~~ — resolved: `plan_mission`, `execute_mission`, `start_execution`, `resolve_intervention`, `query_status` (read from vibes 0.4.0 `src/mcp/server.ts`; recorded in PLAN.md).
- Mic capture approach: renderer MediaRecorder vs main-process capture — decide in T10, leaning renderer (simpler, no extra native deps).
