# SPEC.md — Vibes Desktop Acceptance Criteria

Each criterion is independently verifiable. Evidence type noted: unit | integration | e2e | live.

## S1 — App launches with the mission-control surface
- [ ] `npm run dev` opens an Electron window rendering the Mission Control page (operations ledger + roles tab), React 19 + Arco, no console errors. *(live)*
- [ ] First launch shows "All quiet" empty state — never an "activity incomplete" error banner. *(e2e)*

## S2 — Vibes runtime bridge
- [ ] Main process spawns the vibes MCP server (`vibes-tui` package or a configured checkout) as a child process with JSON-RPC over stdio, minimal env allowlist (OLLAMA_BASE_URL/MODEL/API_KEY, CONTEXT_WINDOW, per-role model keys). *(integration)*
- [ ] Child exit/crash is surfaced in the ledger as `failed` with the stderr tail; app does not crash. *(e2e)*
- [ ] A mission started from the UI returns a plan (milestones → tasks) and streams task lifecycle events into the activity log in real time. *(live, against a local LLM endpoint)*

## S3 — Activity ledger
- [ ] Every agent event appends to an append-only JSONL file in appData; the renderer receives a snapshot on load and subscribes to new lines over IPC. *(integration)*
- [ ] Ledger rows carry: status (running/verifying/failed/zombie/blocked/pending/done/idle), source (vibes-mission), title, detail, timestamps, retry info where applicable. *(unit)*
- [ ] Status grouping matches the fork's ledger semantics: needs-you / running / upcoming / recent. *(unit)*

## S4 — Per-role endpoint configuration
- [ ] Roles tab exposes default/planner/executor/reviewer/triage, each with baseUrl + model + optional apiKey (stored encrypted or in OS keychain; never returned decrypted over IPC). *(e2e)*
- [ ] "Test" button probes the endpoint (GET /models or a 1-token completion) and reports reachable/unreachable. *(integration)*
- [ ] Saved config is written to the workspace's `.vibes/config.json` in vibes' native format (PLANNER_MODEL, REVIEWER_MODEL, TRIAGE_MODEL, OLLAMA_BASE_URL, CONTEXT_WINDOW, ...) so the TUI and the app stay interchangeable. *(integration)*

## S5 — Voice input via yapsnap
- [ ] Push-to-talk records mic audio to a temporary wav; on release the file is transcribed by `yapsnap <file> --lang auto` (CLI child process) and the text lands in the mission request field. *(live)*
- [ ] Transcription runs fully offline after the first model fetch; no network STT call is made (verifiable with the network disabled). *(live)*
- [ ] The wav is deleted after transcription. *(e2e)*
- [ ] Missing ffmpeg or missing yapsnap produces a clear, actionable error message, not a crash. *(e2e)*

## S6 — Mission lifecycle controls
- [ ] Start mission: request text + workspace folder → planner emits plan → executor runs tasks with live ledger updates. *(live)*
- [ ] Stop/cancel a running mission terminates the child process cleanly and marks in-flight tasks `blocked`. *(e2e)*
- [ ] Only one mission runs at a time; a second start is rejected with an "already running" notice. *(unit)*

## S7 — Quality gates (every PR)
- [ ] `npm test` (vitest) passes, coverage of the bridge + ledger modules ≥ 80%. *(unit/integration)*
- [ ] `npm run typecheck` clean; three-process import boundaries enforced (no Node APIs in renderer, no DOM in main). *(V1)*

## S8 — Packaging
- [ ] `npm run build` produces a Windows installer (electron-builder) that launches and passes S1–S3 live checks on a machine with only the vibes package + yapsnap installed. *(live)*
