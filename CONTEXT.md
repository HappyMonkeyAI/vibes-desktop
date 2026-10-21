# CONTEXT.md — Vibes Desktop

## Stack / nature

Electron desktop app (main + preload + renderer, three process types). The app is a thin control plane over the Vibes TUI harness: it never re-implements planning/execution/review logic. That lives in the `vibes` package and runs as an MCP server child process speaking JSON-RPC over stdio.

| Layer | Choice | Notes |
|---|---|---|
| Shell | Electron 3x + electron-builder | Windows first; macOS/Linux later |
| UI | React 19 + Arco Design (`@arco-design/web-react`) + UnoCSS | Ported from wayland-fork mission-control page |
| Build | Vite (renderer) + tsc (main/preload) | Bun optional for dev speed |
| Realtime | Electron IPC (contextBridge), no socket.io | Single local user, no server |
| Agent runtime | `vibes` MCP server (checkout via Settings `vibesPath` / `VIBES_PATH`, or packaged path) | Spawned **per mission** via tsx on `src/mcp/server.ts`; JSON-RPC over stdio |
| Voice input | Builtin Whisper ONNX (default); optional OpenAI-compatible ASR server; yapsnap legacy | Hold-to-talk; see ADR-0002 |
| Decision (optional) | Settings `decisionMcpUrl` + encrypted bearer | On only when both set; probe IPC; **not yet** wired into mission tool calls (T26) |
| Config storage | JSON in appData (+ safeStorage for secrets) | Per-role endpoints mirror `.vibes/config.json` keys |

## Architecture decisions

| ADR | Summary |
|-----|---------|
| [ADR-0001](docs/adr/0001-electron-thin-control-plane.md) | Electron + MCP child process; no native engine port, no TUI embedding. |
| [ADR-0002](docs/adr/0002-yapsnap-stt-backend.md) | yapsnap is the sole STT backend; Web Speech API rejected (Chrome-only, cloud-dependent). |
| [ADR-0003](docs/adr/0003-ledger-source-health.md) | Activity ledger sources are Vibes events only; a missing source never renders as an error banner. |

## Rules (high signal)

- Three process types, never mixed: `src/main/` (no DOM), `src/preload/` (contextBridge only), `src/renderer/` (no Node APIs). All cross-process traffic goes through the IPC bridge in preload.
- Voice default is local Whisper ONNX (download on first talk). Optional ASR server sends audio only to the URL the user configured. No Web Speech API.
- Scheduler ghost-done: evidence handoff must requeue (not leave `done` without `completedTasks`). Live checkout is whatever Settings/`VIBES_PATH` points at — keep that tree in sync with `local-ai-planner` scheduler fixes.
- The Vibes child process gets a minimal env (allowlist of OLLAMA_*/model keys) and its own cwd = the mission workspace. Never inherit the whole app environment.
- Activity log entries are append-only JSONL in appData; the UI reads a snapshot + subscribes to new lines. No database.
- Per-role endpoint config (default/planner/executor/reviewer/triage, each: baseUrl/model/apiKey) mirrors `.vibes/config.json` semantics so the app and the TUI stay interchangeable.
- The "Activity is incomplete" banner from the wayland fork is NOT ported: with a single Vibes source, an empty ledger renders as "All quiet", never as an error.

## What not to do

- Port the four-role engine natively (that was the wayland-fork path; here we spawn vibes' MCP server and track upstream releases).
- Add socket.io or any HTTP server — it's a desktop app with one user.
- Show raw JSON-RPC errors in the UI; map them to the ledger status vocabulary (running/verifying/failed/zombie/blocked/pending/done/idle).
- Record audio longer than needed; stop capture on silence timeout and delete the wav after transcription.
- Bundle vibes' models or weights — yapsnap fetches its own ~80MB per language into its cache on first use.

## Sources (research)

- `wayland-fork/docs/local-first-roles-plan.md` — role engine + mission-control UI provenance
- `vibes-dashboard/server/vibes-bridge.js` — JSON-RPC child-process pattern, env allowlist
- `vibes/.vibes/config.json` + `README.md` — current option surface (per-role models, CONTEXT_WINDOW, MAX_CONCURRENT_TASKS, MEMORY/CODEX/THINKING/STREAMING toggles, VIBES_LAUNCH_DIR)
- `yapsnap` README — CPU-only sherpa-onnx transcription, `--lang auto`, offline after first run
