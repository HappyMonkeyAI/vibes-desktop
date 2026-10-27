# MCP.md — Intent → Service Routing

How this project reaches external capabilities. Listed ≠ mounted: verify a service before claiming it; record gaps for the human rather than guessing.

## Intents

| Intent | Service | How to reach | Notes |
|--------|---------|--------------|-------|
| Session warm-start / project memory | Spine MCP | Cursor `mcp.json` → `spine` (`session_brief`, `get_section`, `recall`, `checkpoint`, `record_memory`); registry name `vibes-desktop` | Prefer over reading PROGRESS.md whole. Fallback: `spine brief` CLI. |
| Running UI inventory / design drift | Spine Design MCP | Cursor `mcp.json` → `spine-design` (`design_brief`, `ensure_capture`, `check_design`); Electron adapter when needed | Complements BrowserOS neo; pixels optional. |
| Agent runtime (plan/execute/review missions) | vibes MCP server | child process, JSON-RPC over stdio (`npx vibes-tui mcp-server` or checkout `npm run mcp-server`) | The core dependency. Env allowlist: OLLAMA_*, model keys, CONTEXT_WINDOW. |
| LLM inference for all four roles | Ollama / OpenAI-compatible endpoint on LAN | HTTP from the vibes child process (not from this app) | Per-role endpoints configured in Roles tab → `.vibes/config.json`. This app never calls an LLM directly. |
| Live browser / X / signed-in sites (agent tooling) | BrowserOS neo | Streamable HTTP MCP `http://127.0.0.1:9010/mcp` (Cursor `mcp.json` → `browseros-neo`) | Operator/agent browser only — **not** the Decision MCP and **not** mounted into the vibes mission child (SSE client ≠ Neo streamable-HTTP). |
| Decision intervene gate | KEV decision MCP | Settings → Decision URL + bearer → child env / `.vibes/config.json` | Typical LAN `:8765/mcp` or `:8766/mcp` (Gutsy). Do not point this at Neo `:9010`. |
| HTML design advice (optional mission tools) | html-design-advisor | Settings → Mission MCP tools → workspace `.vibes/mcp.json` stdio | T44. |
| Speech-to-text | yapsnap / builtin Whisper / speech server | Settings → Voice | See ADR-0002. |
| Audio capture | Electron mic (renderer MediaRecorder or main-process capture) | in-app | Push-to-talk; wav written to temp, deleted after transcription. |
| Config persistence | electron-store + OS safeStorage | in-app | apiKey encrypted via `safeStorage`; never returned decrypted over IPC. |

## Machine-local overlay

Create `MCP.local.md` (gitignored) for this machine: vibes checkout path or package version, Ollama endpoint(s), yapsnap install location, model cache dir. Never put API keys in either file — keys live in safeStorage / `.env` (see `.env.example`).

## Discovery checklist (run at session start if state is unknown)

1. Is a vibes checkout configured? (`MCP.local.md` → `vibes_path`, else `npx -y vibes-tui --version`)
2. Is the Ollama endpoint reachable? (`curl -s <base>/v1/models` from the machine, short timeout)
3. Are ffmpeg + yapsnap on PATH? (`where ffmpeg`, `where yapsnap` / `pip show yapsnap`)
4. Record any gap in PROGRESS.md as an open question — do not silently substitute a cloud service.
