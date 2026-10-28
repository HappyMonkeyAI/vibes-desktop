# Vibes Desktop — operator setup (BYO stack)

**Audience:** people installing the Windows app who already (or will) run [Vibes](https://github.com/HappyMonkeyAI/vibes) and a local OpenAI-compatible LLM. This is **not** a self-contained download-and-go product — the installer is the shell only.

## What you need

| Bring | Example |
|-------|---------|
| Windows x64 | NSIS Setup, or Node 22+ from source |
| Vibes checkout | Clone [HappyMonkeyAI/vibes](https://github.com/HappyMonkeyAI/vibes) — must contain `src/mcp/server.ts` |
| Local LLM | LM Studio `http://127.0.0.1:1234` or Ollama `http://127.0.0.1:11434` |
| Optional Decision | Unsloth `:8888/mcp/` + `sk-unsloth-…`, or classic KEV `…/mcp` + token |
| Optional Voice | Builtin Whisper (default) or Speech ASR server |

Packaging / SmartScreen / signing: [PACKAGING.md](PACKAGING.md).

## 1. Install

- **Installer:** run `Vibes Desktop Setup <version>.exe` (NSIS). If SmartScreen warns on an **unsigned** build: **More info** → **Run anyway** ([PACKAGING.md](PACKAGING.md)).
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
| Classic KEV | `http://<lan-host>:<port>/mcp` | KEV MCP auth token |

**Port collision:** Settings → Speech often defaults to local `:8765` (qwen3-asr `/v1/audio/transcriptions`). That is **not** Decision. Classic KEV may historically have used `:8765/mcp` on a LAN box, but it is a different service — paste an MCP `…/mcp` URL, never the ASR path.

A classic KEV token will **not** work on Unsloth `:8888`. Settings → Test always runs a real Decision tools/call (not a bare GET) so wrong hosts/tokens fail clearly.

When configured, escalate / low confidence can open **Needs You** (Retry step / Skip / Fail).

Without Decision, missions still run; intervene gate stays off.

## 7. Optional: Voice

Default: builtin Whisper (downloads ONNX on first talk). Alternatives: OpenAI-compatible ASR server, or legacy yapsnap + ffmpeg.

## Known limits (beta)

- Windows only; installer is **unsigned** (SmartScreen may warn). Signing for public beta: [PACKAGING.md](PACKAGING.md).
- Full Needs You / Decision story needs your LAN Decision MCP.
- Codex RAG paths and full MCP marketplace UI are out of scope for 0.1.x (one custom MCP seed is supported in Settings).
- Bring your own models — nothing is bundled except optional Whisper weights on first use.
- Live Decision smoke requires `KEV_MCP_URL` + token (or Settings / `UNSLOTH_API_KEY` for `:8888`) and a reachable MCP.

## Public beta (0.2.x) readiness

| Gate | Status |
|------|--------|
| MIT license (Stephen Phillips) | Done (`LICENSE`) |
| First-run (Vibes path → model → workspace) | Done (T60–T64) |
| First mission without tribal knowledge | Live-proven on LM Studio `:1234` (T65; re-verified 2026-10-28) |
| Branded NSIS installer | Done (icon); **unsigned** until `CSC_*` cert — SmartScreen path documented (T71) |
| BYO-stack stranger docs | Done — BETA checklist + PACKAGING + first-run clone hint (T71) |
| Packaging appId / CONTRIBUTING | Done — `com.stephenphillips.vibesdesktop` + PRs→`main` (T72) |
| CI on PR/`main` | Done — typecheck + hermetic tests (T73) |
| Decision / Needs You when configured | Blocked — Unsloth `:8888` / classic KEV MCP down (2026-10-28); probe rejects Speech ASR URLs (T70) |
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
