# TASKS.md — Task Board

Status: `todo` → `doing` → `review` → `done`. One task per line; evidence links in PROGRESS.md.

## P0 — Scaffold
- [x] T1 Electron + Vite + React skeleton with three-process boundaries (main/preload/renderer) and a contextBridge channel map — SPEC S7 ✅ 2026-10-13
- [x] T2 Local quality gates: vitest config, typecheck script, `npm test` / `npm run typecheck` / `npm run build` working — SPEC S7 ✅ 2026-10-13 (8/8 tests green)

## P1 — Bridge + Ledger
- [x] T3 JSON-RPC stdio transport (request/response + notifications, timeout, crash detection) — SPEC S2 ✅ 2026-10-13 (jsonrpc.ts; 6 tests: correlate, error, timeout, non-JSON log, exit-reject-all, partial-line buffer)
- [x] T4 VibesBridge: spawn vibes MCP server with env allowlist; plan + task lifecycle events — SPEC S2 ✅ 2026-10-13 (vibes-bridge.ts; buildChildEnv allowlist + [TASK_STATUS] parser tested; initialize handshake per dashboard)
- [ ] T5 LedgerStore: append-only JSONL in appData, snapshot + subscribe over IPC — SPEC S3
- [ ] T6 Ledger view: port mission-control operations UI (status accents, grouping, pagination, "All quiet" empty state) — SPEC S1, S3

## P2 — Roles & Config
- [ ] T7 Roles tab: per-role baseUrl/model/apiKey forms with encrypted key storage — SPEC S4
- [ ] T8 Test-connection probe (GET /models or 1-token completion) — SPEC S4
- [ ] T9 `.vibes/config.json` writer in vibes' native format — SPEC S4

## P3 — Voice
- [ ] T10 Mic capture: push-to-talk → wav on disk; delete after transcription — SPEC S5
- [ ] T11 yapsnap transcriber: CLI child process, `--lang auto`, stdout parsing — SPEC S5
- [ ] T12 yapsnap-doctor: ffmpeg + yapsnap presence check with install hints; graceful errors — SPEC S5

## P4 — Lifecycle & Packaging
- [ ] T13 Stop/cancel mission: clean child termination, in-flight tasks → blocked — SPEC S6
- [ ] T14 Single-mission guard (second start rejected) — SPEC S6
- [ ] T15 electron-builder Windows installer; live pass of S1–S3 on a clean machine — SPEC S8
