# Vibes Desktop — closed beta setup (0.1.x)

**Audience:** people who already run [Vibes](https://github.com/HappyMonkeyAI/vibes) (or `vibes-tui`) and a local OpenAI-compatible LLM. This is **not** a self-contained download-and-go product.

**Requires:** Windows x64 · Node 22+ (dev) or the NSIS installer · Vibes checkout with `src/mcp/server.ts` · LAN/local model endpoint (e.g. Ollama).

## 1. Install

- **Installer:** run `Vibes Desktop Setup 0.1.1.exe` (NSIS; choose install dir).
- **From source:** `npm install` → `npm run dev` (or `npm run dist` then install the built exe).

## 2. Point at Vibes

On first launch, a short setup wizard asks for the Vibes path and a default model endpoint (you can Skip and configure later).

Settings → **General** → **Vibes Checkout Path** = absolute path to a vibes repo that contains `src/mcp/server.ts`.  
(Dev alternative: set env `VIBES_PATH` before launch.)

## 3. Configure Roles

Roles tab — at minimum **Default** (or Executor):

| Field | Example |
|-------|---------|
| Base URL | `http://127.0.0.1:11434` (app appends `/v1` if needed) |
| Model | your local model id |
| Context window | e.g. `32768` (optional; → vibes `CONTEXT_WINDOW`) |
| API key | only if the endpoint requires one |

Use **Test connection**, then **Save Configuration**.

## 4. Runtime (optional)

Settings → **Runtime**: max steps, YOLO, thinking, compaction, triage observer, local memory. Values write into the mission workspace `.vibes/config.json` on spawn.

## 5. First mission

1. Operations → pick a **workspace** folder (git repo or empty project dir).
2. Enter a short mission request (or hold-to-talk if Voice is set up).
3. **Start** — watch the ledger / depth panel for tasks.

Stop cancels the child cleanly. Only one mission runs at a time.

## 6. Optional: Decision → Needs You

Settings → Decision MCP URL + bearer (e.g. Unsloth Studio `http://host:8888/mcp/` + API key).  
When configured, escalate / low confidence can open **Needs You** (Retry step / Skip / Fail).

Without Decision, missions still run; intervene gate stays off.

## 7. Optional: Voice

Default: builtin Whisper (downloads ONNX on first talk). Alternatives: OpenAI-compatible ASR server, or legacy yapsnap + ffmpeg.

## Known limits (beta)

- Windows only; installer is **unsigned** (SmartScreen may warn). Signing for public beta: [PACKAGING.md](PACKAGING.md).
- Full Needs You / Decision story needs your LAN Decision MCP.
- Codex RAG paths and multi-MCP marketplace UI are out of scope for 0.1.x.
- Bring your own models — nothing is bundled except optional Whisper weights on first use.
- Live Decision smoke requires `KEV_MCP_URL` + token (or Settings) and a reachable MCP — skipped when those are absent.

## Verify

```bash
npm test
npm run typecheck
# live mission (dev): VIBES_LIVE=1 npm test -- tests/live-mission.e2e.test.ts
# decision shadow: VIBES_DECISION_LIVE=1 … (URL + token in Settings or env)
```

Issues: note OS build, vibes commit, model endpoint, and whether Decision was on.
