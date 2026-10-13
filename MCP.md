# MCP.md — Intent → Service Routing

How this project reaches external capabilities. Listed ≠ mounted: verify a service before claiming it; record gaps for the human rather than guessing.

## Intents

| Intent | Service | How to reach | Notes |
|--------|---------|--------------|-------|
| Agent runtime (plan/execute/review missions) | vibes MCP server | child process, JSON-RPC over stdio (`npx vibes-tui mcp-server` or checkout `npm run mcp-server`) | The core dependency. Env allowlist: OLLAMA_*, model keys, CONTEXT_WINDOW. |
| LLM inference for all four roles | Ollama / OpenAI-compatible endpoint on LAN | HTTP from the vibes child process (not from this app) | Per-role endpoints configured in Roles tab → `.vibes/config.json`. This app never calls an LLM directly. |
| Speech-to-text | yapsnap CLI | `yapsnap <wav> --lang auto` child process | CPU-only, offline after first model fetch (~80MB/language). Requires ffmpeg on PATH. |
| Audio capture | Electron mic (renderer MediaRecorder or main-process capture) | in-app | Push-to-talk; wav written to temp, deleted after transcription. |
| Config persistence | electron-store + OS safeStorage | in-app | apiKey encrypted via `safeStorage`; never returned decrypted over IPC. |

## Machine-local overlay

Create `MCP.local.md` (gitignored) for this machine: vibes checkout path or package version, Ollama endpoint(s), yapsnap install location, model cache dir. Never put API keys in either file — keys live in safeStorage / `.env` (see `.env.example`).

## Discovery checklist (run at session start if state is unknown)

1. Is a vibes checkout configured? (`MCP.local.md` → `vibes_path`, else `npx -y vibes-tui --version`)
2. Is the Ollama endpoint reachable? (`curl -s <base>/v1/models` from the machine, short timeout)
3. Are ffmpeg + yapsnap on PATH? (`where ffmpeg`, `where yapsnap` / `pip show yapsnap`)
4. Record any gap in PROGRESS.md as an open question — do not silently substitute a cloud service.
