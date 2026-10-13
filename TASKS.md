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
- [ ] T15 electron-builder Windows installer; live pass of S1–S3 on a clean machine — SPEC S8
