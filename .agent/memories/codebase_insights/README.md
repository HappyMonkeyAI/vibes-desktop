# codebase_insights/ — Semantic memory: facts about this codebase and its dependencies.

## vibes (dependency, v0.4.0)

- Ink 6 + React 19 TUI harness for local LLMs; mission → milestones → tasks DAG scheduler.
- MCP server entrypoint: `src/mcp/server.ts`, run via `npm run mcp-server` (tsx) or the published `vibes-tui` package.
- Config surface in `.vibes/config.json`: OLLAMA_BASE_URL, OLLAMA_MODEL, PLANNER_MODEL, REVIEWER_MODEL, TRIAGE_MODEL, CONTEXT_WINDOW, MAX_CONCURRENT_TASKS, MEMORY_ENABLED, CODEX_ENABLED/TOP_K, THINKING_MODE, MAX_STEPS, LOCAL_MEMORY, ENABLE_NATIVE_TOOLS, ENABLE_STREAMING, TRIPLE_ENABLED/TRIAGE_MODEL.
- Safety features: auto-git snapshots before missions, undo mission (Alt+Z), thrashing detection, deadlock detection on circular depends_on.

## vibes-dashboard (reference for bridge pattern)

- `server/vibes-bridge.js`: spawns tsx MCP server per agent instance; JSON-RPC 2.0 over stdio; env allowlist set; socket.io event fan-out (not ported — we use Electron IPC).
- Voice: Web Speech API + wake word (rejected here, ADR-0002).

## wayland-fork (reference for UI)

- `src/renderer/pages/mission-control/`: operations ledger (status accents, needs-you/running/upcoming/recent grouping, pagination), cost tab, roles tab.
- "Activity is incomplete" banner = source-health aggregation across teams/workflows/scheduler; the first-landing error text we saw. Dropped in ADR-0003.

## yapsnap (STT backend)

- CPU-only sherpa-onnx Zipformer transducer; `yapsnap <file-or-url> [--lang auto|xx] [--timestamps] [--diarize]`.
- Models cache ~80MB/language after first run; fully offline thereafter. Requires ffmpeg on PATH.
