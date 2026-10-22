# TASKS.md — Task Board

Status: `todo` → `doing` → `review` → `done`. One task per line; evidence links in PROGRESS.md.

## P0 — Scaffold
- [x] T1 Electron + Vite + React skeleton with three-process boundaries (main/preload/renderer) and a contextBridge channel map — SPEC S7 ✅ 2026-10-13
- [x] T2 Local quality gates: vitest config, typecheck script, `npm test` / `npm run typecheck` / `npm run build` working — SPEC S7 ✅ 2026-10-13 (8/8 tests green)

## P1 — Bridge + Ledger
- [x] T3 JSON-RPC stdio transport (request/response + notifications, timeout, crash detection) — SPEC S2 ✅ 2026-10-13 (jsonrpc.ts; 6 tests: correlate, error, timeout, non-JSON log, exit-reject-all, partial-line buffer)
- [x] T4 VibesBridge: spawn vibes MCP server with env allowlist; plan + task lifecycle events — SPEC S2 ✅ 2026-10-13 (vibes-bridge.ts; buildChildEnv allowlist + [TASK_STATUS] parser tested; initialize handshake per dashboard)
- [x] T5 LedgerStore: append-only JSONL in appData, snapshot + subscribe over IPC — SPEC S3 ✅ 2026-10-13 (store.ts; replay on load, idempotent upsert by title, classify() grouping, live push wired into handlers + renderer upsert. 7 store tests + 1 live-push test)
- [x] T6 Ledger view: port mission-control operations UI (status accents, grouping, pagination, "All quiet" empty state) — SPEC S1, S3 ✅ 2026-10-13 (useActivityPagination + PaginationControls ported from fork's useCatalogPagination; window-first then per-group filter, true totals in headers. 5 hook tests: windowing, hide-controls, page nav, clamp, reset-key)

## P2 — Roles & Config
- [x] T7 Roles tab: per-role baseUrl/model/apiKey forms with encrypted key storage — SPEC S4 ✅ 2026-10-13 (store.ts cipher-injected + safeCipher.ts; view reduces key to presence flag, empty-key-means-keep on save. 5 store tests incl. corrupt-file tolerance)
- [x] T8 Test-connection probe (GET /models or 1-token completion) — SPEC S4 ✅ 2026-10-13 (test-connection.ts bounded fetch to /chat/completions, 10s abort, Authorization header only when key present. 6 tests: validation, ok, URL trim, auth-header, error parse, network failure)
- [x] T9 `.vibes/config.json` writer in vibes' native format — SPEC S4 ✅ 2026-10-13 (vibes-config.ts pure mapper + config-writer.ts merge; default+executor collapse onto OLLAMA_*, per-role PLANNER/REVIEWER/TRIAGE keys, empties omitted so a save never blanks untouched keys. 7 tests: mapping, fallback, omitEmpty, create, merge, corrupt-fresh)

## P3 — Voice
- [x] T10 Mic capture: push-to-talk → webm buffer; base64 to main, deleted after transcription — SPEC S5 ✅ 2026-10-13 (VoiceInput.tsx MediaRecorder hold-to-talk; onTranscript appends to mission field. 3 tests: not-ready tag, record→transcribe→deliver with base64 payload, error path)
- [x] T11 yapsnap transcriber: CLI child process, `--lang auto`, transcript read from output file — SPEC S5 ✅ 2026-10-13 (transcribe.ts injectable CliRunner; reads -o file, cleans up input+output. 6 tests: happy path + cleanup, arg shape, non-zero error, missing-file, empty-text, runner-throws)
- [x] T12 yapsnap-doctor: ffmpeg + yapsnap presence check with install hints; graceful errors — SPEC S5 ✅ 2026-10-13 (doctor.ts bounded 5s spawn each; actionable winget/pip hints. 4 tests: ready, missing-ffmpeg hint, missing-yapsnap hint, non-zero exit)

## P4 — Lifecycle & Packaging
- [x] T13 Stop/cancel mission: clean child termination, in-flight tasks → blocked — SPEC S6 ✅ 2026-10-13 (service.ts stopMission ends the child via endBridge then store.markInFlightBlocked rewrites running/verifying mission tasks to blocked. Live verify: Stop button appears only while a mission runs; kill tree confirmed clean termination. markInFlightBlocked test + stop no-child/with-child tests)
- [x] T14 Single-mission guard (second start rejected) — SPEC S6 ✅ 2026-10-13 (service.ts state==='running' check at the top of startMission, before any await; returns {started:false, alreadyRunning:true}. Live verify: Start disabled while a mission runs. already-running guard test)
- [x] T15 electron-builder Windows installer; live pass of S1–S3 on a clean machine — SPEC S8 ✅ 2026-10-13 (electron-builder@^26 NSIS x64 target in package.json build config + `dist` script. Built `Vibes Desktop Setup 0.0.1.exe` (115 MB) + win-unpacked/. Live pass: launched the PACKAGED exe directly — S1 verified by vision analysis (Mission Control renders, "All quiet" empty state, no error banner, four zero stat tiles, LIVE indicator, Operations+Roles tabs); app created userData Chromium runtime data without crashing. Clean-machine pass against a live LLM endpoint for S2/S3 e2e remains the one outstanding item.)

## P5 — Hybrid C awareness UI (DESIGN.md)
- [x] T16 Always-on dispatch bar (workspace + mission + voice + Start/Stop) above the card grid; Start can run without Review; Launch modal still offers Generate Tasks → Review Plan ✅ 2026-10-20
- [x] T17 Metric strip from ledger `classify()` groups: Needs You / Running / Upcoming / Recent (click filters cards) ✅ 2026-10-20
- [x] T18 Mission depth panel (split when wide): status, workspace, `LedgerEntry.detail` diagnostics, live task checklist, Retry/Terminate/Archive ✅ 2026-10-20
- [x] T19 Live logs pane in depth panel — append from ledger entry events only (honest empty state; no fabricated streams) ✅ 2026-10-20
- [x] T20 Footer telemetry + dark theme tokens aligned with DESIGN.md ✅ 2026-10-20
- [x] T21 V0 typecheck/tests ✅ 2026-10-20 (99/99); V3 live mission pass still owed

## P6 — Voice settings (ADR-0002 amend)
- [x] T22 Settings → Voice: engine pick (builtin Whisper | server | yapsnap legacy), language, doctor/warm ✅ 2026-10-20
- [x] T23 Optional OpenAI-compatible speech server (qwen3-asr URL/model/key) + probe; route `voice:transcribe` by engine ✅ 2026-10-20
- [x] T25 Seed reviewed plan tasks into ledger (0/N progress); mark open tasks failed on mission fail; hide Mission Scheduler from checklist ✅ 2026-10-20
- [x] T27 Expandable mission/step failure detail in depth panel; child emits task error on TASK_STATUS ✅ 2026-10-20
- [x] T28 Dark Mission Control default + Stitch sky accent; light toggle retained ✅ 2026-10-20

## P7 — Roadmap (next session)
- [x] T26 Decision intervene gate (KEV): Settings URL+token → child env + `.vibes` config; before operator interrupt, `kev_evaluate` continue/escalate/skip (probabilities + margin); escalate on abstention/near-tie. html-design-advisor / general MCP registry still later. ✅ 2026-10-22
- [x] T35 Harness²-lite: distill one post-failure harness lesson → `.vibes/harness-lesson.json` + Retry seed (extends T31) ✅ 2026-10-22
- [x] T36 Chat tab (phase 1): request → plan RHS → auto-launch → ledger summary → done comment — `ChatView` + DESIGN.md ✅ 2026-10-21
- [x] T41 Chat phase 2 steering: mid-run `mission:steer` → vibes `steer_mission` / `injectSteer` ✅ 2026-10-22
- [x] T37 Completion gate: soft-pass malformed/`unverified` Owner adversary review (explicit `approved:false` still fails) — vibes + planner; mission `75c45024` false FAIL ✅ 2026-10-21
- [x] T38 Double-check completion (Cline): deterministic evidence re-check + owner prompt newline fix + `ENABLE_DOUBLE_CHECK_COMPLETION` — vibes + planner + desktop config ✅ 2026-10-22
- [x] T39 Crash-safe follow-up queue (OpenBot): FIFO in userData, `enqueueIfBusy`, drain on natural completion, Chat queues when busy ✅ 2026-10-22
- [x] T40 Focus chain (lite): DESIGN + Chat RHS sticky plan as mission focus until next send ✅ 2026-10-22
- [x] T21 V3 live mission pass — `VIBES_LIVE=1` e2e 3/3 (done file on disk; bad model → failed; reviewer path) ✅ 2026-10-22; Chat UI header re-run optional
- [x] chore: commit desktop T38–T40 + vibes `ag/completion-gates` + planner gate mirror ✅ 2026-10-22
- [x] T24 Agent Voice TTS announce on mission done/failed — Settings → Voice → daemon URL/token; soft `POST /v1/announce` ✅ 2026-10-22
- [x] T42 Decision shadow live gate — `VIBES_DECISION_LIVE=1` e2e + offline fixture ✅ 2026-10-22
- [x] T43 Chat queue chrome: list waiting follow-ups + Pause/Resume/Clear ✅ 2026-10-22
- [x] T44 Mission MCP registry seed: Settings → HTML Design Advisor → workspace `.vibes/mcp.json` on spawn ✅ 2026-10-22
- [x] T45 Live HappyMonkeyAI bookmark delta via BrowserOS Neo ✅ 2026-10-22 — OO-Harness / Agent S4 / Bark / Flint; see LINKS + neo-delta memory
- [x] T46 OO-Harness-lite: harness-lesson v2 helped/failed + harnessClass → Retry seed Keep/Avoid ✅ 2026-10-22
- [x] T47 Needs-You escalate UI: vibes `intervention` TASK_STATUS → ledger needsHuman; Ops/Chat Retry step / Skip / Fail → `resolve_intervention` ✅ 2026-10-22
- [x] T42 Decision shadow live (Unsloth): `8888/mcp/` + `system_one` + English model ✅ 2026-10-22 (also works with classic KEV `kev_evaluate`)

## P9 — Release hygiene
- [x] T48 Version + changelog + feature map — bump `0.1.0`, `CHANGELOG.md`, `docs/FEATURES.md`, README spine ✅ 2026-10-22
- [x] T49 Tag `v0.1.0` + NSIS `dist/Vibes Desktop Setup 0.1.0.exe` (~219 MB) ✅ 2026-10-22
- [x] T50 Needs-You + Unsloth Decision wired end-to-end ✅ 2026-10-22 — Settings Decision → Unsloth `:8888/mcp/`; vibes + desktop `system_one`; mission-service intervention→resolve unit; live decision shadow green
- [ ] T51 Optional: Kev 4B in Unsloth Decision picker; Bark STT watchlist (bookmark delta)
- [x] T50b Live Needs-You UI ✅ 2026-10-22 — mission `8b9c0e46` completion-gate → blocked+needsHuman; CDP clicked **Skip step**; vibes completion-gate→intervene + desktop `clearNeedsHuman` shipped. Follow-up: vibes scheduler deadlock (0/1 pending) on repeat orphan drills
- [ ] T52 Vibes scheduler deadlock: pending task with empty deps never runs (`Completed 0/1`) — seen on T50b re-runs

## P8 — Part A (harness / memory research → product)
- [x] T29 Decision spike (probe): LAN **KEV MCP** `http://192.168.5.157:8765/mcp` — list_models + triage `kev_evaluate` (escalate ~4.5s) + shadow `kev_select_tool` (~80ms). APIs `:8008`/`:8009` not LAN-published (localhost on host). Notes in `2026-10-20-decision-model-kev-gutsy.md` ✅ 2026-10-20
- [x] T34 Settings → Decision model (KEV): optional MCP URL + encrypted bearer; on only when both present; Test probe IPC (HTTP 400/405/406 = reachable); `resolveDecisionMcpConfig` for future mission use ✅ 2026-10-20
- [x] T30 Docs spike: Hy Memory vs vibes MEMORY/CODEX + Adapter — **ignore/defer**; one-pager in `.agent/memories/codebase_insights/2026-10-20-hy-memory-vs-vibes.md` ✅ 2026-10-20
- [x] T31 Retry seed: forget-except-best (prior failure + best done steps) when Retry from depth panel — `buildRetryRequest` / `cleanMissionTitle` ✅ 2026-10-20
- [x] T32 Mission ID on card + MISSION log lines — ✅ 2026-10-20
- [x] T33 Vibes regression: evidence-handoff failure requeues instead of ghost-done deadlock — test in `local-ai-planner` + **ported to Settings checkout `development/vibes`** (`requeueOrFailGate`, evidence-requeue test green) ✅ 2026-10-20
