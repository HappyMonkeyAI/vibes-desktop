# Vibes Desktop — closed beta setup (0.1.x)

**Audience:** people who already run [Vibes](https://github.com/HappyMonkeyAI/vibes) (or `vibes-tui`) and a local OpenAI-compatible LLM. This is **not** a self-contained download-and-go product.

**Requires:** Windows x64 · Node 22+ (dev) or the NSIS installer · Vibes checkout with `src/mcp/server.ts` · LAN/local model endpoint (e.g. Ollama).

## 1. Install

- **Installer:** run `Vibes Desktop Setup 0.1.1.exe` (NSIS; choose install dir).
- **From source:** `npm install` → `npm run dev` (or `npm run dist` then install the built exe).

## 2. Point at Vibes

On first launch, a short setup wizard asks for the Vibes path, a default model endpoint, and an optional mission workspace (you can Skip and configure later). Use **Browse**, or paste a path — Next checks for `src/mcp/server.ts`. On the model step, **Test connection** probes the endpoint before you continue. A chosen workspace is prefilled on Operations.

Settings → **General** → **Vibes Checkout Path** (Browse + validate on Save) = absolute path to a vibes repo that contains `src/mcp/server.ts`.  
(Dev alternative: set env `VIBES_PATH` before launch.)

## 3. Configure Roles

Roles tab — at minimum **Default** (or Executor):

| Field | Example |
|-------|---------|
| Base URL | `http://127.0.0.1:1234` (LM Studio) or `http://127.0.0.1:11434` (Ollama) — app appends `/v1` if needed |
| Model | your local model id (e.g. `google/gemma-4-e2b`) |
| Context window | e.g. `32768` (optional; → vibes `CONTEXT_WINDOW`) |
| API key | only if the endpoint requires one |

Use **Test connection**, then **Save Configuration**.

Live smoke (dev): `VIBES_LIVE=1 VIBES_PATH=… npm test -- tests/live-mission.e2e.test.ts` (defaults to `127.0.0.1:1234`).

## 4. Runtime (optional)

Settings → **Runtime**: max steps, YOLO, thinking, compaction, triage observer, local memory. Values write into the mission workspace `.vibes/config.json` on spawn.

## 5. First mission

1. Operations → pick a **workspace** folder (git repo or empty project dir).
2. Enter a short mission request (or hold-to-talk if Voice is set up).
3. **Start** — watch the ledger / depth panel for tasks.

Stop cancels the child cleanly. Only one mission runs at a time.

## 6. Optional: Decision → Needs You

Settings → Decision MCP URL + bearer, then **Test decision MCP**.

| Host | URL example | Bearer |
|------|-------------|--------|
| Unsloth Studio | `http://host:8888/mcp/` | Studio API key (`sk-unsloth-…` from Studio → Settings → API) |
| Classic KEV | `http://host:8765/mcp` | KEV MCP auth token |

A classic KEV token will **not** work on Unsloth `:8888` — Settings → Test now runs a real `system_one` call and shows the API-key error instead of a false “reachable” pass.

When configured, escalate / low confidence can open **Needs You** (Retry step / Skip / Fail).

Without Decision, missions still run; intervene gate stays off.

## 7. Optional: Voice

Default: builtin Whisper (downloads ONNX on first talk). Alternatives: OpenAI-compatible ASR server, or legacy yapsnap + ffmpeg.

## Known limits (beta)

- Windows only; installer is **unsigned** (SmartScreen may warn). Signing for public beta: [PACKAGING.md](PACKAGING.md).
- Full Needs You / Decision story needs your LAN Decision MCP.
- Codex RAG paths and multi-MCP marketplace UI are out of scope for 0.1.x.
- Bring your own models — nothing is bundled except optional Whisper weights on first use.
- Live Decision smoke requires `KEV_MCP_URL` + token (or Settings / `UNSLOTH_API_KEY` for `:8888`) and a reachable MCP.

## Public beta (0.2.x) readiness

| Gate | Status |
|------|--------|
| MIT license (Stephen Phillips) | Done (`LICENSE`) |
| First-run (Vibes path → model → workspace) | Done (T60–T64) |
| First mission without tribal knowledge | Live-proven on LM Studio `:1234` (T65) |
| Branded NSIS installer | Done (icon); **unsigned** until `CSC_*` cert |
| Decision / Needs You when configured | Blocked without Unsloth `sk-unsloth-…` or classic KEV `:8765` |
| Version cut `0.2.0` | After Decision smoke + (ideally) signed build |
| GitHub visibility | Repo may stay private until Decision + packaging gates feel ready |

## Verify

```bash
npm test
npm run typecheck
# live mission (dev): VIBES_LIVE=1 npm test -- tests/live-mission.e2e.test.ts
# decision shadow: VIBES_DECISION_LIVE=1 … (URL + token in Settings or env)
```

Issues: note OS build, vibes commit, model endpoint, and whether Decision was on.
