# Features — Vibes Desktop 0.1.1

Operator-facing map of what ships in **0.1.x** (public-beta path toward **0.2.x**). Closed beta setup: [BETA.md](BETA.md). Packaging: [PACKAGING.md](PACKAGING.md). Design intent lives in [DESIGN.md](../DESIGN.md); acceptance criteria in [SPEC.md](../SPEC.md); release notes in [CHANGELOG.md](../CHANGELOG.md).

## First-run wizard

Vibes checkout (Browse + `src/mcp/server.ts` check) → default model (optional Test connection) → optional workspace (seeds Operations). Skip anytime; Settings can finish the same path later.

## Mission Control (Operations)

| Capability | Where | Notes |
|------------|--------|--------|
| Launch / Start / Stop | Dispatch bar + Launch tile | Optional Review Plan; single mission at a time |
| Metric strip | Needs You / Running / Upcoming / Recent | Click filters cards |
| Depth panel | Checklist, detail, live logs | From ledger only — no fabricated streams |
| Retry | Depth actions | Seeds prior failure + harness lesson into next request |
| Needs You | Metric + depth + Chat | Escalate / triage / fail gate → Retry step / Skip / Fail |

## Chat

| Capability | Notes |
|------------|--------|
| Send → plan → launch | Auto-starts after plan accept path |
| Steer mid-run | `mission:steer` → vibes `steer_mission` |
| Follow-up queue | FIFO when busy; Pause / Resume / Clear |
| Needs You actions | Same resolve path as Operations |

## Settings

### Roles

Per-role base URL / model / **context window** (tokens) / API key (encrypted at rest). Test connection probes the OpenAI-compatible endpoint. Writes merge into workspace `.vibes/config.json` — executor’s context window (else Default’s) becomes vibes’ global `CONTEXT_WINDOW`.

### Runtime

Settings → **Runtime** passes TUI harness knobs into `.vibes/config.json` on mission spawn: `MAX_STEPS`, `MAX_CONCURRENT_TASKS`, `YOLO_MODE`, `THINKING_MODE`, `CONTEXT_COMPACTION_ENABLED`, `SMALL_MODEL_PROFILE`, triage (`TRIAGE_ENABLED` / `INTERVAL` / `AUTO_STEER`), memory (`MEMORY_ENABLED`, `LOCAL_MEMORY`), plus completion gates `ENABLE_DOUBLE_CHECK_COMPLETION` and `ENABLE_ADVERSARIAL_AUDIT`. Codex paths stay TUI-or-file for now.

### Decision (intervene gate)

| Field | Purpose |
|-------|---------|
| MCP URL | e.g. Unsloth Studio `http://<host>:8888/mcp/` or KEV `http://<host>:8765/mcp` |
| Bearer token | Encrypted; also injectable as env for live tests |

When both are set, missions get Decision config. The **vibes child** (not only the desktop probe) calls:

1. **`system_one`** — Unsloth Studio System One / **Laya** English (preferred for `:8888` / unsloth hosts)
2. **`kev_evaluate`** — classic HappyMonkey KEV

(T53: do not add a separate Laya MCP into the desktop; enrich questions on `system_one` instead. See `2026-10-24-laya-decision-probe.md`.)

Outcomes: continue / escalate / skip. Escalate (near-tie / abstention / **low System One confidence** &lt; 0.35) surfaces as **Needs You**. Classic KEV answers without a confidence field are unchanged.

Probe: Settings → Test decision MCP. Live e2e: `VIBES_DECISION_LIVE=1` (+ URL/token in env or Settings).
One-shot persist (dev): `KEV_MCP_URL=… KEV_MCP_AUTH_TOKEN=… npx electron scripts/set-decision-settings.mjs`.

### Mission MCP tools

Toggle **HTML Design Advisor** and/or a **Custom MCP server** (stdio command/args or HTTP URL) to seed/remove entries in workspace `.vibes/mcp.json` when a mission spawns. Thin registry — not a full marketplace.

### Voice

| Engine | Use |
|--------|-----|
| Builtin Whisper | In-process / bundled path |
| Server ASR | OpenAI-compatible speech URL |
| yapsnap | Legacy CLI + ffmpeg |

Optional **Agent Voice announce**: daemon URL + token; soft `POST /v1/announce` on mission terminal states. Test button in Settings.

## Reliability helpers

- **Soft-pass:** malformed / unverified Owner adversary review does not false-FAIL (explicit `approved: false` still fails).
- **Double-check completion:** optional evidence re-check (`ENABLE_DOUBLE_CHECK_COMPLETION` via config).
- **Harness lesson:** on failure, writes `.vibes/harness-lesson.json`; Retry injects Keep/Avoid guidance (v2 schema).

## Packaging

`npm run dist` → Windows NSIS installer (`Vibes Desktop Setup <version>.exe`). App version = `package.json` `version`.

## Out of scope (0.1)

Bark STT, Flint, full Agent S4 MCP marketplace UI, Hy Memory as product store, non-Windows installers.
