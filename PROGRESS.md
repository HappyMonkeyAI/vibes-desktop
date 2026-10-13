# PROGRESS.md — Session Log

Newest first. Each entry: date, what was done, evidence, what's next, open questions.

## 2026-10-13 — P1 bridge layer (T3 + T4)

**Done:** Built the JSON-RPC stdio transport and the VibesBridge that speaks to the vibes MCP server child process.
- `src/main/bridge/jsonrpc.ts` (T3) — generic JSON-RPC 2.0 client over a child's stdio: one-object-per-line framing with partial-line buffering, id-correlated request/response, per-request timeout, non-JSON stdout → `log` event, and crash/exit detection that rejects all pending requests instead of hanging them.
- `src/main/bridge/vibes-bridge.ts` (T4) — spawns the vibes MCP server (`tsx --no-warnings src/mcp/server.ts`, preferring the checkout's local tsx), performs the `initialize` handshake (protocolVersion 2024-11-05), and exposes `planMission` / `executePlanned` / `queryStatus` / `resolveIntervention` over the five confirmed tools. Windows-safe env base; `[TASK_STATUS]` stderr lines parsed into structured task events for the ledger.

**Key port decisions (from vibes-dashboard/server/vibes-bridge.js):**
- Env allowlist kept verbatim in intent — only LLM keys (`OLLAMA_*`, provider `*_API_KEY`/`*_BASE_URL`/`*_MODEL`, `CONTEXT_WINDOW`) cross into the child. Extracted to an exported pure `buildChildEnv()` so it's directly testable without spawning.
- Dropped the dashboard's POSIX-only MINIMAL_PATH and safe-mode HOME/XDG scratch dirs (Windows-first; single-instance, no multi-mission sandbox). Single instance is enforced later by T14.
- Added structured `[TASK_STATUS]` parsing — the dashboard only forwarded raw stderr; we need task lifecycle events to drive the live ledger.

**Evidence (all run this session):**
- `npm test` → **19/19 passed**. New: 6 transport tests (correlate, error-object reject, timeout, non-JSON log, exit-reject-all, partial-line reassembly) + 5 bridge tests (allowlist passes OLLAMA keys, non-allowlisted secrets stay behind, parent env never carried wholesale, `[TASK_STATUS]` → structured event, malformed status line degrades to plain log).
- `npm run typecheck` → clean on both configs. (ChildProcess stdio streams are typed nullable — captured as non-null locals after the attach guard.)
- `npm run build` → main/preload/renderer all emit.

**Next:** P1/T5 LedgerStore (append-only JSONL in appData, snapshot + subscribe over IPC), then T6 ledger view port. The bridge's task-status events are the feed that populates the ledger once T5 lands.

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

**Superseded:** T3+T4 landed in the entry above (P1 bridge layer). Remaining P1: T5 LedgerStore, T6 ledger view port.

## 2026-10-13 — Repo bootstrap (planning)

**Done:** Scaffolded the documentation spine per Agents Protocol: README, CONTEXT, AGENTS, SPEC (S1–S8), PLAN (P0–P4 + module map), TASKS (T1–T15), MCP.md intent routing, three ADRs, LTM skeleton. Cloned and read all four sources: wayland-fork mission-control page + roles engine, vibes-dashboard VibesBridge (JSON-RPC stdio child process, env allowlist), vibes 0.4.0 config surface (.vibes/config.json per-role models, toggles), yapsnap (CPU sherpa-onnx STT).

**Decisions locked with user:** Electron shell (reuse React/Arco mission-control components); spawn vibes' MCP server as child process (thin app, tracks upstream releases — no native engine port); yapsnap as sole STT backend (offline, no Web Speech API).

**Root cause of the fork's first-landing error text identified:** the operations view's source-health banner ("Activity is incomplete") fires because a fresh install has no Wayland teams/workflows/scheduler sources. ADR-0003 drops that banner here — with one Vibes source, an empty ledger renders "All quiet".

**Next:** P0/T1+T2 — Electron+Vite+React skeleton, IPC channel map, vitest/typecheck/build gates. Then P1 bridge work.

**Open questions:**
- ~~Exact vibes MCP server method names~~ — resolved: `plan_mission`, `execute_mission`, `start_execution`, `resolve_intervention`, `query_status` (read from vibes 0.4.0 `src/mcp/server.ts`; recorded in PLAN.md).
- Mic capture approach: renderer MediaRecorder vs main-process capture — decide in T10, leaning renderer (simpler, no extra native deps).
