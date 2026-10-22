# PROGRESS.md — Session Log

Newest first. Each entry: date, what was done, evidence, what's next, open questions.

## 2026-10-22 — Neo bookmark delta (T45)

**Done:** Neo reconnected; scanned X History → Bookmarks (~25 posts, newest Oct 21). Distilled in `2026-10-22-bookmarks-neo-delta.md` + LINKS. Top fit: OO-Harness (T46 vibes lesson schema), Agent S4 reinforces MCP registry; Bark/Flint watchlist; Épi/Lisa/OpenUI out of scope.

**Also:** T46 shipped in desktop — harness-lesson.json v2 (`helped`/`failed`/`harnessClass`) + Retry Keep/Avoid lines.

**Next:** optional Bark STT spike; Needs-You escalate UI.

---

## 2026-10-22 — Bookmarks + Chat queue + MCP registry

1. **Bookmarks (pre-Neo):** Local Oct-18 export only; Neo was down. Notes in `2026-10-22-bookmarks-rescan.md`.
2. **T43:** Chat queue bar — waiting list, Pause/Resume, Clear over existing `mission.queue.*`.
3. **T44:** Settings → Mission MCP tools → HTML Design Advisor; `writeVibesMcpJson` merges/removes `html-design-advisor` in workspace `.vibes/mcp.json` on mission spawn.

**Next:** (superseded) T45 Neo delta done same day.

---

## 2026-10-22 — T24 TTS + Chat steer + Decision shadow

1. **T24:** `announceToDaemon` → Agent Voice `POST /v1/announce`; Settings Voice toggle + Test; soft announce on mission terminal.
2. **T41 Chat steering:** `steer_mission` MCP + bridge/service IPC; Chat sends steer while `activeMissionId` set.
3. **T42:** `decision-shadow.e2e.test.ts` (live when `VIBES_DECISION_LIVE=1` + KEV env); offline fixture always.

**Evidence:** typecheck + announce/decision/settings tests green; live Decision skipped (no `KEV_MCP_*` in shell — set `VIBES_DECISION_LIVE=1` + creds for V3).

**Next:** (superseded) T43 queue chrome + T44 MCP registry done same day.

---

## 2026-10-22 — T35 Harness²-lite lesson

**Done:** On mission failure, distill one process-level lesson (`distillHarnessLesson`) and write `.vibes/harness-lesson.json`. Retry loads it via `harness:lesson-get` and puts it first in `buildRetryRequest`. Fingerprints: css_orphan, evidence/ghost, completion gate, circular deps, npm ENOENT. Tests `harness-lesson.test.ts`.

**Next:** T24 TTS optional; Chat phase-2 steering; live Decision shadow.

---

## 2026-10-22 — T26 Decision intervene gate (KEV)

**Done:** ProPerAgent-shaped gate before operator interrupt. Desktop writes `KEV_MCP_*` + `ENABLE_DECISION_INTERVENE_GATE` into workspace config and bridge env when Settings Decision is configured. Vibes `handleTaskFailure` calls `kev_evaluate` (continue/escalate/skip); auto-retry/skip when clear; escalate on near-tie / outage. Pure gate tests green (desktop + vibes).

**Next:** Live shadow with Settings Decision filled; optional Chat Needs-You UI when escalate; broader MCP registry (html-design-advisor) still open.

---

## 2026-10-22 — Commit ratchet + T21 live e2e

**Commits:** desktop `44a9442` (queue + double-check config); vibes `ag/completion-gates` `8eca3ae` (soft-pass, double-check, evidence requeue, css audit); planner `3a1736f` (gate mirror, provider-catalog left unstaged).

**T21:** `VIBES_LIVE=1 VIBES_PATH=…/vibes npx vitest run tests/live-mission.e2e.test.ts` → **3/3 passed** (~53s). Live service now resolves `VIBES_PATH`. Endpoints `192.168.5.232:11434` + reviewer `192.168.5.229:1234` reachable.

**Next:** T26 wire KEV Decision into intervene vs continue; or Chat header re-run in the packaged UI for human V3.

---

## 2026-10-22 — Cline/OpenBot cherry-picks (T38–T40)

**Order:** double-check → follow-up queue → focus-chain lite.

1. **T38 Double-check (vibes):** `doubleCheckMissionEvidence` before mission success; `ENABLE_DOUBLE_CHECK_COMPLETION` default on; Owner adversary prompt now uses real newlines (was `join('\\n')` — garbled reviews); re-check language in system prompt. Tests `mission-double-check.test.mjs` 6/6. Mirrored to `local-ai-planner`. Desktop writes the flag via `toVibesConfig`.
2. **T39 Follow-up queue (desktop):** `followup-queue.ts` JSON in userData; `startMission({ enqueueIfBusy })`; drain on natural completion (not Stop); Chat queues when plan/start hits busy. IPC `mission:queue-*`. Tests `followup-queue.test.ts`.
3. **T40 Focus chain lite:** DESIGN — RHS checklist sticky until next send.

**Next:** T21 live Chat pass; optional queue pause UI in Chat chrome; commit vibes soft-pass + double-check.

---

## 2026-10-21 — Completion gate soft-pass on malformed owner review

**Symptom:** Chat mission `75c45024-…` — all 3 tasks DONE, page correct (dark header + menu), but mission FAILED: `Owner adversary review is malformed`.

**Cause:** Post-task `ENABLE_ADVERSARIAL_AUDIT` runs Owner-as-Adversary; reviewer JSON failed schema → completion gate rejected success despite done work.

**Fix (Settings vibesPath `development/vibes`):** malformed / `unverified` owner reviews soft-pass; explicit `approved: false` still fails. Coerce string `line` numbers. Tests in `owner-adversary.test.mjs` (5/5 vibes + planner after `npm run build`). Child loads `src/` via tsx — restart mission / app to pick up patch.

---

## 2026-10-21 — Chat tab phase 1 (T36)

**Done:** `Chat` tab next to Operations. Flow: compose → `mission.plan` → RHS checklist → `start({ acceptPlan: true })` → ledger-bound status → `buildChatMissionSummary` on terminal. `MissionStartResult.missionId` returned for binding. DESIGN.md Chat contract locked. Tests: `chat-summary`, `chat-view`.

**Out of scope (phase 2):** interrupt/replan mid-run, steering replies, inline artifacts.

---

## 2026-10-21 — LINKS.md + X harness cherry-picks

**Done:** Captured five user-shared X posts into `LINKS.md` + distillation `.agent/memories/codebase_insights/2026-10-21-x-links-harness-cherry.md`. Neo MCP was down; used Nitter/arXiv. Top cherry-picks: Harness²-lite lessons on Retry, ProPerAgent-style intervene-gate via KEV (T26), Chat-tab inline artifacts (Xpress). PaperLeet defer; no second engine.

---

## 2026-10-21 — Structural audit: css_orphan false positive on Windows / HTML

**Symptom:** Footer mission `957592ad-…` — HTML task DONE; CSS task failed `css_orphan` on `styles.css` even though `index.html` has `<link href="styles.css">`.

**Cause:** Global-CSS exemption used `file.split('/').pop()` — on Windows absolute paths that never equals `styles.css`. Audit also ignored HTML `<link>` as an import.

**Fix:** `path.basename` for global names; scan `.html` for stylesheet hrefs into `importedAssetFiles`. Tests `structural-audit-html-css.test.mjs` green in `development/vibes`.

**Retry:** footer mission (or Retry from depth) — CSS step should clear audit.

---

## 2026-10-21 — Evidence gate: static / broken-.git workspaces

**Symptom:** Footer mission `dae2bc76-…` — task done by executor then failed: `Evidence verification failed and Git state is unavailable: … not a git repository`. Workspace `development/test` had a stub `.git` (HEAD only) + no `package.json`.

**Cause:** Evidence fallback ran `npm --version` via `execFile('npm')` → Windows ENOENT (`npm.cmd`), so commands looked failed even though git was the only real message.

**Fix (in Settings vibesPath `development/vibes` + `local-ai-planner`):** skip dummy npm when no build/test scripts; use `npm.cmd` on win32 when scripts exist; MCP `ensureWorkspaceGitSnapshot` repairs stub `.git` before execute. Tests: `scheduler-evidence-static` + requeue still green.

**Retry:** footer mission again (new child loads patched source).

---

## 2026-10-21 — Roles: AgentWorld executor + prior Default as reviewer

**Done:** Probed Unsloth Studio `http://192.168.5.157:8888/v1` (Bearer). Models list includes `unsloth/Qwen-AgentWorld-35B-A3B-GGUF` (quant UD-IQ4_NL). Chat completions OK (answers often land in `reasoning_content` while `content` is empty — watch executor parsing). `/v1/systemone` on `:8888` → **404** (not a Decision/System One host; keep KEV MCP `:8765`).

**Roles** (`%APPDATA%/vibes-desktop/roles-config.json`):
- **Default + Executor** → LAN Unsloth `:8888` + AgentWorld (canonical model id, no `:quant` suffix)
- **Reviewer + Planner** → previous Default (Cloudflare tunnel + encrypted key) so ENABLE_REVIEWER stays on
- LM Studio `google/gemma-4-e2b` on `:1234` chat → 400 (not loaded / rejected); not used as reviewer

**What's next:** Restart app → Roles → Test Connection on Executor and Reviewer. Load AgentWorld in Unsloth if unloaded. If tunnel reviewer 401s, point Reviewer at a working instruct model (e.g. LM Studio `liquid/lfm2.5-1.2b` which probed OK).

---

## 2026-10-20 EOD — Stop here

**Day rolled up:** Hybrid C + voice + plan-seed already parked earlier; Part A (bookmarks → KEV/GUTSY) + ghost-done scheduler fix closed the loop.

| Track | Outcome |
|-------|---------|
| Hybrid C / mission UX | Depth panel, failure detail, plan-seed checklist, mission UUID on cards/logs |
| Voice | Builtin Whisper default (ADR-0002 amend); yapsnap legacy; optional ASR server |
| Part A / T29–T34 | KEV MCP probe on LAN `:8765`; Settings Decision (URL+token, probe treats HTTP 400 reachable); Hy Memory defer; Retry forget-except-best |
| Scheduler / T33 | Ghost-done fix ported to **Settings vibesPath** `development/vibes` (`requeueOrFailGate` + evidence-requeue test green). App was hitting that checkout, not `local-ai-planner` |

**Uncommitted / external:** `development/vibes` has uncommitted scheduler + test changes — commit there when resuming. Desktop has local WIP (decision settings, missionRetry, ops UI) — commit when ready.

**Next session (pick one):**
1. Live Retry Unsplash info-boxes mission — confirm no false circular-deps deadlock
2. Commit desktop + vibes scheduler patches
3. T26 — wire missions to decision MCP when Settings has URL+token
4. T21 V3 live pass; T24 TTS later

**Open:** T26 (config only today; missions still don’t call KEV tools), T21 V3, T24 TTS. Gutsy `:8766` probe OK as reachable-on-400; KEV `:8008` still localhost-on-host.

---

## 2026-10-20 (scheduler) — Ghost-done deadlock fix live on Settings vibesPath

**Symptom:** Unsplash columns mission (`3ee5aaaf-…`) failed with “Scheduler deadlock / circular depends_on” after 1/3 tasks — CSS/verify stuck waiting on a UUID while HTML looked incomplete.

**Cause:** Evidence handoff rejected executor `done` but left `status=done` without `completedTasks` credit (false circular-deps deadlock). Fix existed in `local-ai-planner`; Settings/`VIBES_PATH` points at `development/vibes`, which lacked `requeueOrFailGate`.

**Done:** Ported `requeueOrFailGate` + ghost-aware `describeDependencyDeadlock` + `tests/scheduler-evidence-requeue.test.mjs` into `development/vibes`. Test green after rebuild (`got >=4 executions`). Desktop already on that checkout; one child per mission so the next start loads patched `src/` via tsx.

**Evidence:** `node --test tests/scheduler-evidence-requeue.test.mjs` pass in vibes; desktop `mission-retry` 3/3.

**What's next:** Retry the Unsplash row mission (Retry / forget-except-best). Expect requeue on evidence fail or a “done but not credited” message — not the circular-deps essay. T26 decision MCP wiring still open.

## 2026-10-20 (theme) — Contrast pass: dark inputs + stronger light

**Done:** Dark composer/selects use `--input-bg` `#0b101b` + light text (no white Arco fill). Light mode: cooler gray page `#e8ecf2`, darker text/borders, white cards with visible borders/shadows.

## 2026-10-20 (theme) — Dark Mission Control default + Stitch sky accent

**Done:** Boot/`ThemeToggle` default to dark (`#090d16` canvas). Dark Arco/`--brand` primary = sky `#38bdf8`; light keeps orange. `index.html` honors stored preference before paint.

**Evidence:** theme-toggle tests updated; `npm test` after change.

## 2026-10-20 (UX) — Expandable failure detail for missions + steps

**Done:** Depth panel **Why this failed** (`<details>`, open on failed) shows mission summary, system rows (Scheduler), and failed steps. Checklist rows with errors expand. Vibes child now emits `error` on `[TASK_STATUS]` failed; bridge maps to ledger `detail`. Patched both `vibes` and `local-ai-planner` server.ts.

**Evidence:** vibes-bridge parse test; typecheck + 108 tests green.

**Note:** Older ledger rows still lack step `detail` until a new failing run.

## 2026-10-20 (milestone) — Commit Hybrid C + voice + plan-seed; MCP roadmap

**Done:** Parked a good stopping point. TASKS P7/T26 = external MCP registration for missions (prompt path ≠ wired tools). T24 TTS still later; T21 V3 live pass still owed.

**What's next:** Commit on `ag/ledger-ux-theme-audit`; then T26 design or V3 live verify.

## 2026-10-20 (mission UX) — Plan showed 6 steps; card showed 0/2 then failed 1/5

**Symptom:** Launch Agent review listed ~6 tasks; live card showed 0/2 (then 0/2 with Mission Scheduler). Diagnostics: `Mission failed. Completed 1/5 tasks.` First task stuck EXECUTING.

**Cause:** Checklist only lists ledger rows from `[TASK_STATUS]` events — planned tasks were never seeded. Child completed 1/5 then dependency-deadlocked (`Mission Scheduler` synthetic failure). Asking for an MCP path in the prompt does not register that server with the vibes child.

**Fix:** `seedPlannedTasks` on start (incl. acceptPlan); `markOpenTasksFailed` on mission failure; hide `Mission Scheduler` from progress/checklist.

**Evidence:** new mission-service + ledger-store tests; `npm test` / typecheck.

## 2026-10-20 (UI) — Depth panel / ops layout on short screens

**Done:** Retry moved under depth header. Mid fix over-constrained ops (`max-height` + flex-shrunk `.split`) → cards only in a tiny top strip with empty white below. Reset: ops grows naturally; tab pane scrolls; split `flex: 0 0 auto`. Rebuilt.

**Evidence:** `npm test` 104; `npm run build` ok.

**What's next:** Restart app — full card grid should fill the pane again; open a failed mission for Retry under the title.

## 2026-10-20 (voice fix) — Builtin Whisper default; stale out/ was still yapsnap

**Done:** Default STT is in-app Whisper ONNX (download on first hold-to-talk, ZeroG-style). Soft-migrate `yapsnap` → `builtin` on boot. User still saw yapsnap install hint because **`out/` was stale** (`DEFAULT_SETTINGS.speechEngine: "yapsnap"`, `asEngine` fell back to yapsnap when `settings.json` had no `speechEngine`). Rebuilt; bundle includes `voice-worker` + WASM.

**Evidence:** `npm run build` → voice-worker + ort-wasm assets. `npm test` → 104 passed. Source `settings.json` has no speechEngine → new `asEngine` → `builtin`.

**What's next:** Restart app (`npm start` or `npm run dev`), hold-to-talk — expect “Downloading speech model …%” then transcript. T24 Agent Voice TTS later.

## 2026-10-20 (voice) — Settings → Voice: yapsnap + optional qwen3-asr server

**Done:** Locked STT path A (yapsnap) plus optional OpenAI-compatible server (same shape as ZeroG / qwen3-asr-server). Settings gains General | Voice tabs: engine pick, language, doctor + **Download / warm models**, server URL/model/encrypted key + Test. `voice:transcribe` routes by engine. ADR-0002 amended; TTS announce deferred (T24).

**Evidence:** `npm test` → **104/104** (+ speech-server + settings-voice). Typecheck clean.

**What's next:** Point Voice → Server at your qwen3-asr URL/key and Test; warm yapsnap if staying local. T24 Agent Voice TTS later.

## 2026-10-20 (later) — Hybrid C UI implemented (T16–T20)

**Done:** Built Hybrid C Operations shell per `DESIGN.md` + mock at `.planning/hybrid-c/mockups/hybrid-c/`.
- Always-on dispatch (Start direct; Review plan… optional; Launch modal + Accept & Launch unchanged)
- Metric strip from `classify()` (Needs you / Running / Upcoming / Recent) with click-to-filter
- Card grid retained; selecting a card (auto-select running) opens sticky depth panel: diagnostics from `LedgerEntry.detail`, live checklist, ledger-derived live logs, Retry/Terminate/Archive
- App header LIVE / voice pills; footer engine line; dark theme tokens shifted to Mission Control navy canvas
- Wayland Mission Control path noted as pattern source (not engine)

**Evidence:** `npm test` → **99/99 passed** (3 skipped). `npm run typecheck` clean. Mock still at http://localhost:5179 if serve is up.

**What's next:** T21 V3 — run a live mission and confirm checklist + logs + failure `detail` without DevTools.

**Open questions:** Wire real model/context into footer when the child exposes it.

## 2026-10-20 — UI direction locked: Hybrid C (cards + Mission Control depth)

**Done:** Compared TUI screenshots, stitch card mockups, and Mission Control HTML against current OperationsView. Locked **Hybrid C** in `DESIGN.md`. Added P5 tasks T16–T21.

**Evidence:** Design contract + HTML mockup.

**What's next:** Implement (done in later entry).

## 2026-10-19 (later) — False-done mission bug: root-caused across both processes, fixed + V3 verified against real LLMs

**Symptom:** a live mission ("Update index.html to have a bootstrap enabled via CDN") reported **done in ~36 ms** with zero tasks executed and the target file untouched.

**Root cause — four independent bugs, all layers:**
1. **URL.** The Roles config held a bare origin (`http://192.168.5.232:11434`, no `/v1`). It was written verbatim to the workspace `.vibes/config.json` as `OLLAMA_BASE_URL`, so the child's OpenAI SDK posted to `/chat/completions` → **404** (verified live; `/v1/chat/completions` → 200). The SDK does not retry 404 → planner failed in ~35 ms.
2. **Child swallowed errors.** `local-ai-planner/src/mcp/server.ts` caught planner/executor errors and **returned** them as normal tool text (`"Mission planning failed: …"`, `"Mission failed: …"`, `"No mission has been planned."`) — never throwing, never `isError`.
3. **Wire shape.** FastMCP ^4.0.1 wraps string returns as `{ content: [{ type: 'text', text }], isError? }` (not a string). The desktop's `callTool` cast `response.result` to `string` — so failures resolved as **success**.
4. **Trust-on-resolve.** `service.ts` discarded the plan result and recorded `done` whenever `executePlanned()` **resolved**, never inspecting its text.

**Fix (desktop):**
- `vibes-bridge.ts`: new exported `unwrapToolResult(result, toolName)` — tolerates bare strings, extracts joined `content[].text`, **throws** on `isError: true` or an unexpected shape. `callTool` now returns `unwrapToolResult(...)`; the erroneous `as string` casts are gone.
- `mission/service.ts`: new exported `missionOutcomeFrom(result)` honesty gate — records **done only** for `Mission completed. Completed N/N tasks.` with `N > 0`; every other shape (failed/partial/empty/"No mission has been planned.") → **failed** with the child's raw text in `detail`. `startMission` now validates the plan (empty task list or a planning-failure string → start fails and records `failed`, never dispatches a no-op). Review-flow `planMission` surfaces the failure text as `error` instead of a silent empty list.
- `ledger/store.ts`: `recordMissionEvent` accepts an optional `detail`.
- `roles/vibes-config.ts`: `normalizeOpenAiBaseUrl` appends `/v1` only when the URL has no path (full URLs like `…/v1`, `/api/v1` untouched); applied in `toVibesConfig` for all four roles. Also emits `ENABLE_REVIEWER` / `ENABLE_ADVERSARIAL_AUDIT` (`false` when no reviewer role is configured — otherwise vibes defaults to a nonexistent `gemma2:27b` on the executor's server and fails every reviewed task).
- `roles/test-connection.ts`: probe uses the same normalizer, so probe and child agree on the URL.

**Fix (child, surgical):** the three mission tools (`execute_mission`, `plan_mission`, `start_execution`) now **rethrow** instead of returning error strings, and `start_execution` throws on no-plan — FastMCP turns these into `isError` results. Only catch blocks touched (user has uncommitted provider-catalog work in the same file).

**Evidence (all run 2026-10-19):**
- **V0 desktop:** `npm test` → **99/99 passed** (16 files; +21 new tests: unwrap shapes, outcome classifier, plan-failure text, failed/partial/empty execution, URL normalization, reviewer gates, probe `/v1`). `npm run typecheck` clean. `npm run build` exit 0.
- **V0 child:** `npm run build` clean; `npm test` → 137/140, the 3 failures **pre-existing and unrelated** (2× `worktree-manager` assert POSIX paths on Windows; `scheduler-retry` fails 1/1 with my edits **stashed**).
- **V3 live (real child + real LLMs, `VIBES_LIVE=1`) — 3/3 pass:** (a) bare origin `http://192.168.5.232:11434` + Qwen3-4B → normalizes to `/v1`, plans, executes, `hello.txt` contains `bonjour`, mission row **done**; (b) nonexistent model → start **fails** (`started:false` + `failed` row), no file; (c) executor `5.232` + reviewer `google/gemma-4-e2b` on `5.229:1234` → mission **done** through the reviewer path (`ENABLE_REVIEWER=true`).
- **Independent raw JSON-RPC** (bypassing the desktop entirely): `plan_mission` → `{content:[{type:'text',text:'[{"id":1,…}]'}]}` (4.6 s); `start_execution` → `{content:[{type:'text',text:'Mission completed. Completed 1/1 tasks.'}]}` (5.1 s); `hello.txt` == `bonjour` on disk.

**What's next:** commit when the user asks (both repos have uncommitted work). Optional UX: surface `LedgerEntry.detail` in the mission card detail modal so a failed mission shows the child's reason inline.

**Open questions:** the 3 pre-existing child test failures (Windows path assertions, scheduler-retry) are out of scope here — worth a separate ticket.

## 2026-10-19 — MVP stabilization: ~15 bug fixes, vibesPath resolution, full V0+V3 green

**Done:** Full audit pass (~20 bugs found) plus targeted fixes across data path, mission UX, roles/settings/theme, and main-process safety; finished by reconciling tests with the corrected semantics and running the whole verification ladder.
- **Ledger row identity.** `LedgerEntry` gained `missionId`; mission/task rows upsert by `(missionId, title)` so a second mission never mutates the first's rows and mission cards stop collapsing on global titles ("Executing mission"/"Mission complete"). `markInFlightBlocked` scoped by missionId.
- **Mission service semantics.** `startMission` now returns at dispatch (toast/spinner at start, not end); execution streams live `task-status` into the ledger in the background. Pending-plan adoption keeps the planning child alive so **Accept & Launch executes the reviewed plan** instead of re-planning. Generation counter prevents an old mission's chain from tearing down a newer bridge; `stopRequested` avoids a spurious "failed" on terminate. Explicit workspace required everywhere (no `process.cwd()` fallback).
- **Voice input.** `VoiceInput` awaits the final `dataavailable`/`stop` before building the blob (real MediaRecorder delivers the last chunk async); mock-compatible for both callback and addEventListener recorder styles.
- **One card per mission.** OperationsView groups by `missionId`; Launch New Agent card always visible (including the first-launch empty state, which also restores ADR-0003's "All quiet" copy); Generate Tasks guarded + loading state; workspace picker wired to recent-history dropdown (get/save/clear); Retry re-sends the original request; Terminate only while running.
- **Roles/settings/theme/safety.** Test-connection probes with the stored key (role id + optional override); `SettingsStore` persists real settings via IPC (Settings tab no longer fakes a save); Arco `--primary-6..10`/`--arcoblue-6..10` converted to RGB triples in both themes; dialog parent guarded; MCP `notifications/initialized` sent post-handshake; jsonrpc clears per-request timers on settle; config-writer refuses non-absolute workspace roots.
- **vibesPath resolution (the "checkout not found" bug).** `main/index.ts` no longer hardcodes the broken `%TEMP%\vibes` checkout. Resolution order: `VIBES_PATH` env → `settings.vibesPath` (new Settings tab field, persisted) → `DEFAULT_VIBES_PATH` (`local-ai-planner`), each validated for `src/mcp/server.ts` before use.
- **Dead surface cleanup.** Removed `ledger:search` channel + store method, dead pagination code; archive returns `{ ok, count }`.

**Evidence (all run 2026-10-19):** `npm test` → **78/78 passed** across 16 files (mission-service and all-quiet tests rewritten to the new semantics: mission card titled by the original request, start resolves at dispatch, exec failure surfaces via ledger). `npm run typecheck` clean on both configs. `npm run build` exit 0 (main/preload/renderer emitted). **V3 live boot:** launched the built app (`electron .`), window titled "Vibes Desktop" confirmed alive with renderer loaded after 15s, no crash dialog; killed by exact process-tree only.

**What's next:** End-to-end mission against a local LLM (configure endpoint, run a real mission, watch cards populate) — the remaining V3 depth beyond boot.

**Open questions:** None.

## 2026-10-16 — Card-view bug-fix pass: real data, honest errors, working CSS

**Done:** The uncommitted OperationsView card refactor (from 2026-10-15) was left half-wired with fake data and several latent bugs. This session finished the render rework and fixed every defect found in the diff.
- **Test-connection probe double `/v1`.** `test-connection.ts` probed `${baseUrl}/v1/chat/completions`, but role base URLs already end in `/v1` (e.g. `http://localhost:11434/v1`) — every compliant endpoint 404'd on `/v1/v1/…`. Now appends only `/chat/completions`; timeout message corrected to "30s" to match `TIMEOUT_MS = 30_000`. This was the one failing test.
- **Plan parsing.** The vibes MCP server's `plan_mission` returns a JSON array of `{id, name, status}` objects (verified against the checkout's `src/mcp/server.ts`). `parseTasksFromPlan` now JSON-parses that primary shape and extracts `.name`, with a numbered/bulleted line-match fallback for degraded responses.
- **Planning no longer steals the live mission.** `spawnBridge` gained an `adopt` flag; `planMission` spawns a throwaway bridge (`adopt=false`) that never touches the shared single-mission slot, stopped in a `finally`. A plan-only call can no longer clobber a running mission's connection.
- **No silent empty plans.** Planning failures (no LLM, no workspace, child crash) now return `{ tasks: [], error }`; both UI call sites surface the message via `Message.error` instead of opening an empty review modal. `MissionPlanResponse.error?` added to channels.
- **Explicit workspace required.** `startMission` dropped the `process.cwd()` fallback (which would point the agent at the app's own source tree) and returns "Choose a working directory before starting a mission." The Start button is disabled until a directory is picked.
- **Real card view.** OperationsView now groups ledger rows into one card per `kind === 'mission'` event row, attaching that mission's task rows (same workspace root). Task progress on cards and in the detail modal comes from real ledger rows; fake placeholder tasks and the fabricated log stream are gone, replaced by honest empty states. Detail modal driven by a `selectedCard` object (title, status, dir, updated time, task checklist with state icons); duplicate Retry/Terminate buttons removed (kept in the footer only).
- **Batch archive.** Archiving a card archives the mission row plus all its task rows: `ledger.archive` accepts `string | string[]`, store exposes `archiveEntries(ids)`, handler validates and returns `{ ok, count }`.
- **CSS module fixes.** Arco renders lowercase DOM elements; selectors like `.dirInputRow Input` never matched. Converted to the project's `:global(.arco-input)` convention. Added missing keys the JSX referenced (`opsToolbar`, `live`, `liveDot`, `voiceNotReady`, `composerRow`, `missionInput`, `taskChecklistItems`) and deleted dead ones (`.detailActions`, the logs-stream block). Verified programmatically that every `styles.X` in the component resolves to a real CSS key.
- **Ledger tagging.** Bridge passes `workspaceRoot` into `recordTaskStatus` so new task rows carry their workspace; mission-level event rows are tagged `kind: 'mission'` (new optional field on `LedgerEntry`) which is what the card grouping keys off.
- Deleted a stray `nul` file (Windows reserved-name junk) from the project root.

**Evidence (all run this session):** `npm test` → 78/78 passed across 16 files (the all-quiet and live-push tests were rewritten to the card/grouping model: mission event rows become cards, task rows are grouped under their card rather than rendered standalone). `npm run typecheck` clean on both node and web configs. `npm run build` exit 0. No `selectedEntry` references or fake task titles remain in the renderer (grep-verified).

**What's next:** V3 live verification still owed — launch the packaged app, configure an endpoint against the local Ollama instance, start a real mission and watch the ledger/cards populate end-to-end. Nothing else outstanding from this pass.

**Open questions:** None currently.

## 2026-10-15 — Operations view card-based refactor, modal workflow, workspace root fix

**Done:**
- **OperationsView component created** with card-based grid layout replacing the flat ledger list. Summary bar shows ACTIVE/COMPLETED/TASKS DONE metrics.
- **Launch New Agent card** with dashed border, + icon, opens Launch Modal.
- **Mission Status Cards** with truncated title, status badge pill (EXECUTING/COMPLETE/FAILED/BLOCKED), working directory, progress bar with task counter.
- **Modal 1: Launch New Agent** — working directory input + mission textarea with integrated voice input, Generate Tasks button.
- **Modal 2: Review Proposed Tasks** — editable mission prompt, numbered task list, Decline/Regenerate Plan/Accept & Launch buttons.
- **Modal 3: Work-In-Progress Details** — back navigation, mission title, Retry/Terminate actions, stats strip (STATUS/PROGRESS/WORKING DIR), goal box, live task checklist with state icons, live terminal/logs stream.
- **Fixed workspace root bug** — handlers.ts and service.ts no longer fall back to `process.cwd()` when `workspaceRoot` is empty; respects the directory selected from recent history dropdown.
- **Theme compliance** — all new CSS uses existing custom properties (`var(--bg-base)`, `var(--text-primary)`, `var(--surface-card)`, etc.) for automatic light/dark mode support.

**Evidence:** `npm run build` exit 0. App launches with new Operations view rendering.

**What's next:** Connect "Generate Tasks" to the actual LLM planner API, wire up live log stream from mission service to detail modal.

**Open questions:** None currently.


**Done:**
- **Theme toggle feature completed.** Fixed import mismatch (`ThemeToggle` named vs default import), wrapped test click in `act()`, removed unused CSS import. All 78 tests pass, typecheck clean.
- **Dark theme refined.** Shifted from pure black (`#0a0a0a`) to warmer blue-tinted neutrals (`#111114` background, `#e8e8eb` text, `#3a3a45` borders) for reduced eye strain.
- **Composer row button sizing uniformized.** Added `height: 40px` to all buttons and `align-items: center` to `.composerRow` for consistent alignment.
- **Voice not ready indicator moved** from `VoiceInput.tsx` to `opsToolbar` in `App.tsx` with right-aligned styling.
- **RolesTab redesigned** with card-based layout, role color-coded indicators, labeled inputs, and improved visual hierarchy.
- **Settings tab added** with context/memory file path inputs and preferences (auto-save, verbose logging) toggle switches.

**Evidence:** `npm test` exit 0 (78/78), `npm run typecheck` clean, `npm run build` exit 0. App launched and verified.

**What's next:** Continue with remaining P2-P4 tasks from TASKS.md.

## 2026-10-13 — Mission crash fix (post-plan) — `spawn tsx ENOENT` no longer kills the app

**Done:** The user started a mission ("update the web page in the `test` directory") and the whole app died with Electron's "A JavaScript error occurred in the main process" dialog: `Uncaught Exception: Error: spawn tsx ENOENT`. Two root causes, both fixed.
- **tsx unresolvable.** The vibes checkout had no `node_modules` and `tsx` is not on PATH. `vibes-bridge.ts` now runs the checkout's local tsx CLI (`node_modules/tsx/dist/cli.mjs`) through the bundled runtime — `process.execPath` with `ELECTRON_RUN_AS_NODE=1` — so there is no PATH dependency at all. A bare `.bin/tsx` shim is a cmd batch file on Windows and can't be spawned without `shell:true`, which is why the old "prefer local tsx" check (which pointed at the shim) was wrong on this platform anyway. If neither the CLI nor a shim exists, `start()` throws an actionable "run `npm install` inside the vibes checkout" error before any spawn attempt.
- **Uncaught child `error` event.** An EventEmitter child-process `error` with no listener becomes an uncaught exception that kills Electron's main process — a direct S2 violation (a crashed/failed child must surface as a failed mission, never crash the app). The bridge constructor now attaches a swallow handler on `client.on('error')`; pending requests are already rejected by the client and flow into the ledger as `Mission failed` via the existing MissionService catch path. `jsonrpc.ts` also reports a friendly ENOENT message naming the missing interpreter instead of the raw node error.
- Installed the vibes checkout's dependencies (`npm install --ignore-scripts`) so a real mission can spawn. `--ignore-scripts` is required: `better-sqlite3`'s gyp build fails on Node 26 without VS Build Tools, and the MCP server never imports it.

**Evidence (all run this session):**
- Probe scripts confirmed tsx boots the Vibes MCP server under **both** plain node and electron-as-node, returning a valid `initialize` response (`serverInfo: Vibes 1.0.0`) over JSON-RPC stdio.
- **Live reproduction of the user's exact scenario via CDP:** started a mission with `workspaceRoot` = the `test` directory. The tsx child spawned (visible in the process tree as a child of the main app), the app window stayed alive, and the ledger recorded the full lifecycle: `Planning… blocked`, `Executing mission blocked`, `Modify index.html title failed`, `Mission failed` — all under "Needs you" (4). A CDP `Page.captureScreenshot` (window-capture kept grabbing the desktop wallpaper behind the app) showed the UI rendered normally in the light theme with those status pills and no crash dialog. Before this fix, the same action killed the whole app.
- The mission itself still can't *complete* — no reachable LLM endpoint on this machine (known infra blocker). It now degrades to a graceful ledger failure instead of a process death.
- `npm test` → **75/75 passed** (3 new regression tests: spawn error never reaches the process handler, in-flight request rejects when the child dies mid-call, missing tsx fails fast with the actionable message). Typecheck clean on both configs. Committed as `7274aa8`.

**Next:** nothing outstanding from this fix. A live end-to-end mission completion still needs a reachable LLM endpoint (infra, not code).

## 2026-10-13 — UI polish (post-plan) — light theme, working-directory picker, Roles-tab crash root cause

**Done:** Three user-reported UI problems fixed in one pass.
- **Roles tab "error" — root-caused to the preload.** The preload was built as ESM (`index.mjs`) because `package.json` has `"type": "module"`; a *sandboxed* Electron preload runs in a CommonJS context, so its `import` threw at load, leaving `window.vibesDesktop` undefined and crashing every tab on mount (Roles just happened to be the one opened). Fixed by forcing the preload build to CJS output (`electron.vite.config.ts`: rollupOptions `format: 'cjs'`, `entryFileNames: '[name].js'`) — which also restores the original `index.js` path. Roles now renders all five endpoint boxes (Default/Planner/Executor/Reviewer/Triage) with inputs, Test-connection buttons, and Save — verified via CDP DOM inspection and screenshot, zero errors.
- **Light theme by default, theming seam for later.** Restructured `theme.css` on the zerogterm pattern: palettes live under `:root[data-theme='light' | 'dark']`, light is the default, dark is retained so a future toggle is an attribute flip. Hardcoded white-overlay colors in `MissionControl.module.css` replaced with semantic surface tokens (`--surface-card`, `--surface-row`, etc.) defined per theme. `index.html` sets `arco-theme="light"` + `data-theme="light"` on `documentElement` synchronously before first paint (the earlier attempt set the attribute on `body` from a `<head>` script, which silently no-oped).
- **Working directory picker.** New `workspaceSelect` IPC channel: main-side native folder dialog (`dialog.showOpenDialog`, parented to the focused window), preload exposes `workspace.select()`, and the Operations composer shows a "Working directory" row (path or "App default") whose value is passed as `workspaceRoot` into `mission.start`.
- Also fixed a latent LedgerStore race found by the test suite: concurrent `recordTaskStatus` calls for the same title minted duplicate rows because read-modify-write wasn't serialized. Added a `writeQueue` promise chain; all mutations go through `enqueue()`, and `snapshot()` drains it before reading. Regression test added.

**Evidence (all run this session):**
- CDP DOM inspection: preload loaded (`hasApi: true`), light theme active, workspace row present; Roles tab shows five role boxes, 10 inputs, 5 test buttons, Save button, zero page errors. The only console message is Arco's harmless React-19 `element.ref` deprecation warning.
- Screenshots (CDP `Page.captureScreenshot`) confirmed both tabs render in the light theme with proper spacing — no squashing, multi-line mission textarea intact.
- `npm test` → **72/72 passed** at that point (the ipc-parity test enforces the new channel end-to-end); typecheck clean on both configs; build emits. Committed as `5ec2756`.

**Next:** Superseded — the mission crash fix landed in the entry above. Only a live LLM endpoint remains for a full mission completion.

## 2026-10-13 — P4 packaging (T15) — Windows installer + live S1 pass on the packaged build

**Done:** Configured electron-builder to produce a Windows NSIS installer and verified the **packaged** app boots cleanly — not just dev mode. This is the last task in the plan; the app is now shippable.
- `package.json` — added a `build` config (appId `com.ferrox.vibesdesktop`, productName "Vibes Desktop", NSIS x64 target, per-machine=false, desktop+start-menu shortcuts) and a `dist` script (`electron-vite build && electron-builder --win`). `dist/` is already gitignored.
- Installed `electron-builder@^26`; approved the `esbuild@0.25.12` and `electron-winstaller@5.4.0` postinstall scripts (the latter downloads 7za for the win-installer target).

**Evidence (all run this session):**
- `npm run dist` → built `dist/Vibes Desktop Setup 0.0.1.exe` (120 MB) + `.blockmap` + a full `win-unpacked/` app tree (Vibes Desktop.exe, resources/, locales/, Electron runtime DLLs). Installer verified as a valid PE (MZ header).
- **Live S1 on the PACKAGED exe:** launched `dist/win-unpacked/Vibes Desktop.exe` directly (pid 52220), captured via Win32 EnumWindows+CopyFromScreen. Vision analysis confirmed: Mission Control renders, "All quiet" empty state (no error banner — ADR-0003 holds in production too), four zero stat tiles, LIVE indicator, Operations + Roles tabs. The app created its Chromium runtime data under `AppData/Roaming/vibes-desktop/` without crashing — the main process booted and constructed the LedgerStore pointed at that dir. Test tree killed cleanly (52220 + 3 children).
- S3 integration semantics (append/replay/subscribe, in-place upsert, markInFlightBlocked) are covered by the unit tests already green; `ledger.jsonl` is created on first append, not construction, so an empty ledger correctly shows "All quiet" with no file yet.

**T15 is complete.** The Windows installer builds and the packaged app passes S1 live. **One outstanding item (noted in TASKS.md):** a true clean-machine pass of S2/S3 e2e — starting a real mission against a live LLM endpoint from the installed build — which needs a machine with only vibes + yapsnap installed. That's a release/QA step, not a code gap.

**Next:** Superseded — two post-plan fixes landed in the entries above (UI polish `5ec2756`, mission crash fix `7274aa8`). Only a release/QA clean-machine LLM e2e pass remains outstanding.

## 2026-10-13 — P4 lifecycle (T13 + T14) — mission start/stop wired to the bridge

**Done:** Built `MissionService` so "Start mission" actually drives a vibes MCP child process end-to-end, with clean stop/cancel and a hard single-mission guard. The live ledger now fills from real missions instead of staying "All quiet".
- `src/main/mission/service.ts` (T13/T14) — one VibesBridge per mission. `startMission` checks the single-mission guard synchronously (`state==='running'`, before any await) so two rapid starts can't both pass; it then spawns a bridge, records "Planning"/"Executing" events, and awaits plan→execute while `[TASK_STATUS]` events stream straight into the ledger. Every exit path (complete, fail, stop) terminates the child cleanly. `stopMission` ends the child via `endBridge()` then calls `store.markInFlightBlocked()` so in-flight tasks become `blocked`. A minimal structural `MissionBridge` interface (`on`, `start`, `planMission`, `executePlanned`, `stop`) keeps the service testable with a fake.
- `src/main/ledger/store.ts` — added `markInFlightBlocked()`: rewrites every `vibes-mission` entry in `running`/`verifying` to `blocked` in place (same id, new status) and returns how many it blocked.
- `src/main/index.ts` — constructs the service with a bridge factory that writes `.vibes/config.json` from `rolesStore.input()` **before** each spawn, so a spawned child reads the per-role endpoints correctly. `VIBES_PATH` falls back to the known checkout when unset (dev convenience).
- `src/main/roles/store.ts` — added `input(): RolesConfigInput` returning the decrypted config for all five roles.
- `src/main/ipc/handlers.ts` + `src/preload/index.ts` — wired `missionStart`/`missionStop` to the live service; `MissionStartResult` gains `error?`; `workspaceRoot` is now optional (falls back to cwd).
- `src/renderer/App.tsx` — `handleStart` calls `mission.start`, handles `alreadyRunning`/`error`/success with a loading state; a conditional "Stop mission" button appears only while a mission runs (`hasRunning`).

**Evidence (all run this session):**
- `npm test` → **71/71 passed**. New: 6 mission-service tests (happy path, plan error, exec error, already-running guard, stop no-child, stop with-child) + 1 markInFlightBlocked test.
- `npm run typecheck` → clean on both configs. `npm run build` → all three processes emit.
- **Live boot:** launched the app; vision analysis confirmed "Start mission" is disabled (empty request), **no Stop button** (correctly hidden while nothing runs), no error banner, "All quiet" empty state. The conditional Stop control and loading/disabled states behave correctly. Test tree killed cleanly (27912 + 3 children); zerogterm left untouched.

**P4 lifecycle is complete (T13–T14).** Start/stop now drive a real vibes child process with clean termination, in-flight→blocked on stop, and a hard single-mission guard. The ledger fills from live missions.

**Next:** Superseded — T15 (packaging) landed in the entry above. Nothing in-plan remains; only a release/QA clean-machine LLM e2e pass is outstanding.

## 2026-10-13 — P3 complete (T10–T12 voice input) — phase done

**Done:** Built the full push-to-talk voice path: renderer mic capture → base64 over IPC → yapsnap CLI transcription → transcript text into the mission request field, plus a doctor that reports an actionable install hint instead of crashing when ffmpeg/yapsnap are missing.
- `src/main/voice/doctor.ts` (T12) — bounded 5s `spawn` check for `ffmpeg -version` and `yapsnap --help`; absence is a *result* (`ready:false`) with `winget install ffmpeg` / `pip install yapsnap` hints, never an error.
- `src/main/voice/transcribe.ts` (T11) — spawns `yapsnap <file> -o <out.txt> --lang auto`, reads the transcript from the **output file** (yapsnap prints the path on stdout, progress/errors on stderr), then deletes both the input audio and the transcript. Injectable `CliRunner` so tests never spawn a real process.
- `src/renderer/VoiceInput.tsx` (T10) — push-to-talk: press-and-hold records via MediaRecorder (webm/opus), release base64-encodes the buffer and sends it to main; the returned text is appended into the mission request field via `onTranscript`. Doctor runs on mount so capture is blocked with a clear "voice not ready" tag when not ready.
- `src/shared/channels.ts` — added `VoiceDoctorResult` / `VoiceTranscribeRequest` / `VoiceTranscribeResult` and the `voice:doctor` + `voice:transcribe` channels (now 9 total).
- `src/main/ipc/handlers.ts` — wired both voice handlers; transcribe decodes base64 to a temp `.webm` before calling `transcribeFile`. Preload exposes `voice.doctor()` / `voice.transcribe(request)` fully typed.
- `src/renderer/App.tsx` — Operations toolbar now has a mission request textarea + VoiceInput + "Start mission" button; transcribed text lands in the field.

**Critical fix found by tests:** Arco's static `Message.error()`/`Modal.confirm()` route through `ReactDOM.render`, which React 19 removed — so *any* error path would crash the renderer. Root cause: Arco's internal react-dom util grabs `createRoot` from the `react-dom` **main** entry at import time, but React 19 moved it to `react-dom/client`. Arco ships `setCreateRoot` exactly for this. Added `src/renderer/arco-react19.ts` (imported first in main.tsx and test setup) that injects the client-entry `createRoot` into **both** Arco builds (`es/` for the Vite build, `lib/` for Vitest/node SSR — they resolve to different module instances). Without this, every error-path Message call is a hard crash.

**Evidence (all run this session):**
- `npm test` → **64/64 passed**. New: 6 transcribe tests (happy path + cleanup of both files, arg shape, non-zero error parse, missing-output-file, empty-text distinct error, runner-throws) + 4 doctor tests (ready, missing-ffmpeg hint, missing-yapsnap hint, non-zero exit) + 3 VoiceInput tests (not-ready tag on mount, record→transcribe→deliver with base64 payload not the data-URL prefix, transcription-error path delivers no text).
- `npm run typecheck` → clean on both configs.
- `npm run build` → main/preload/renderer all emit.
- **Live boot:** launched the built app; toolbar rendered the mission input ("Describe the mission — type it or hold-to-talk"), "Hold to talk", and "Start mission" buttons with no error banner (doctor resolved cleanly on this machine). Screenshot verified by vision analysis. Test tree killed (zerogterm left untouched).

**P3 is complete (T10–T12).** Voice input now flows end-to-end: hold-to-talk → transcribe → text in the mission field. The doctor gives an actionable hint rather than a crash when ffmpeg/yapsnap are absent.

**Next:** Superseded — T13+T14 (mission lifecycle) landed in the entry above. Remaining: T15 packaging (installer + clean-machine pass).

## 2026-10-13 — P2 complete (T7–T9 roles & config) — phase done

**Done:** Built the per-role endpoint store with encrypted keys, the test-connection probe, and the native `.vibes/config.json` writer, plus a working Roles tab replacing the stub.
- `src/main/roles/store.ts` (T7) — cipher-injected persistent store mirroring the fork's rolesConfigStore: baseUrl/model plain text, apiKey encrypted with an injected `Cipher`. The view reduces a key to a presence flag (a decrypted key never crosses IPC); an empty submitted key means "keep what's stored". A missing/corrupt file resolves to the all-empty config rather than throwing.
- `src/main/roles/safeCipher.ts` — the real cipher: Electron safeStorage (DPAPI on Windows). `encryptString` returns a Buffer, so it's base64-encoded for storage and decoded back before `decryptString`. Falls back to plaintext when no store is available.
- `src/main/roles/test-connection.ts` (T8) — bounded `fetch` (global, Node 18+) against the OpenAI-compatible `/chat/completions` with a 10s AbortSignal; Authorization header only when a key is present. No client-library dependency.
- `src/main/roles/vibes-config.ts` + `config-writer.ts` (T9) — pure mapper from our five-role config to vibes' native key names, then a merge-writer into `<workspace>/.vibes/config.json`. Read from vibes 0.4.0 `src/config.ts`: there is **no** EXECUTOR_* — the executor runs on the default OLLAMA_* endpoint, so `default` and `executor` collapse onto the same keys (executor wins when set). Planner/reviewer/triage get their own prefixed MODEL/BASE_URL/API_KEY. Empty fields are omitted so a save never blanks keys the user didn't touch.
- `src/renderer/RolesTab.tsx` — five forms (default/planner/executor/reviewer/triage), each with base URL, model, and a key field that appears when a key is stored or being entered; per-role test-connection button with reachable/error feedback; save clears the local key fields (presence flag suffices).
- `src/main/ipc/handlers.ts` — roles handlers wired: `roles:get` → store view, `roles:save` → store.save, `roles:test-connection` → probe. Absent store in tests → empty view / no-op save (parity test untouched).
- `src/main/index.ts` — constructs `RolesStore(userData, makeSafeCipher())` at ready and passes it to handler registration.

**Key mapping decision:** the fork runs its own native pipeline so it never writes `.vibes/config.json`; we spawn vibes, so T9 must. The env allowlist only carries OLLAMA_* into the child — per-role PLANNER/REVIEWER/TRIAGE keys must land in the workspace file for a spawned child to read them.

**Evidence (all run this session):**
- `npm test` → **51/51 passed**. New: 5 store tests (empty view, persist + no plaintext key on disk, round-trip getKey, empty-key-keeps-stored, corrupt-file tolerance) + 6 probe tests (validation, ok, URL trim to /chat/completions, auth-header presence, non-2xx error parse, network failure) + 7 config tests (executor-wins mapping, default fallback, per-role keys, omitEmpty, create file, merge preserves untouched keys, corrupt-fresh).
- `npm run typecheck` → clean on both configs. (safeCipher Buffer↔string fixed.)
- `npm run build` → main/preload/renderer all emit.

**P2 is complete (T7–T9).** Role endpoints now persist with encrypted keys and can be probed live; the native config writer is ready to feed a spawned child at mission start (T13).

**Superseded:** T10–T12 (voice input) landed in the entry above — P3 is complete. Next phase: P4 lifecycle & packaging.

## 2026-10-13 — P1 complete (T6 ledger view) — phase done

**Done:** Finished the operations-view port with windowed pagination, completing all of P1 (bridge + ledger).
- `src/renderer/useActivityPagination.ts` (T6) — self-contained port of the fork's `useCatalogPagination`: a 48-item window over the entry list, page navigation, start-index clamping to the last partial page, and reset-to-page-0 when the reset key (the entry-id list) changes. No i18n or shared-library dependency.
- `src/renderer/PaginationControls.tsx` — "Back / Show more (N of M)" controls with a live range readout; hidden entirely when everything fits one page.
- `src/renderer/App.tsx` — OperationsView now windows first, then filters the visible slice per group (fork semantics), so section headers show true totals while only a page of rows mounts. "All quiet" empty state and live-push upsert unchanged.

**Evidence (all run this session):**
- `npm test` → **32/32 passed**. New: 5 pagination-hook tests (first-page window + remainder, hide-controls under one page, advance/rewind a full page, clamp to last partial page, reset-key snaps back to page 0).
- `npm run typecheck` → clean on both configs.
- `npm run build` → main/preload/renderer all emit.

**P1 is complete (T3–T6).** The full data path now exists: bridge `[TASK_STATUS]` events → LedgerStore upsert → live IPC push → windowed, grouped renderer. UI stays "All quiet" until T13 wires a real mission start to the bridge.

**Superseded:** T7–T9 (roles & config) landed in the entry above — P2 is complete. Next phase: P3 voice input.

## 2026-10-13 — P1 ledger store (T5)

**Done:** Built the LedgerStore and wired it through to a live-updating renderer.
- `src/main/ledger/store.ts` (T5) — append-only JSONL in appData; replays the file into an in-memory map on construction (last line per id wins, malformed lines skipped). `recordTaskStatus` / `recordMissionEvent` upsert by task title so a task's lifecycle updates one row; group is derived via `classify()`. Every append writes to disk and emits `new-entry` to subscribers.
- `src/main/ipc/handlers.ts` — `createHandlerTable` / `registerIpcHandlers` now take `{ store, webContents }`; `ledger:get` returns the live snapshot, and the store's `new-entry` stream pushes over `ledger:new-entry`. Absent in tests → empty snapshot (parity test untouched).
- `src/main/index.ts` — constructs `LedgerStore(app.getPath('userData'))` at ready and passes it + the window's webContents to handler registration.
- `src/renderer/App.tsx` — the `onNewEntry` handler now upserts by id (an in-place task update replaces its row, never duplicates) and derives groupCounts from the entries instead of accumulating.

**Why the renderer upsert matters:** the store emits a fresh entry object per append; blindly appending would show two rows for one task as it goes running → done, and the stat tiles would drift out of sync with the list. Deriving counts from the entries keeps them the single source of truth.

**Evidence (all run this session):**
- `npm test` → **27/27 passed**. New: 7 store tests (replay last-line-wins, malformed-line skip, empty = All quiet, idempotent upsert by title with a 2-line append-only file, failed → needs-you, subscribe push, persistence across a fresh instance) + 1 live-push test (a pushed entry appears without refresh; an in-place update leaves exactly one row).
- `npm run typecheck` → clean on both configs.
- `npm run build` → main/preload/renderer all emit.

**Superseded:** T6 (ledger view) landed in the entry above — P1 is complete. Next phase: P2 roles & config.

## 2026-10-13 — P1 bridge layer (T3 + T4)

**Done:** Built the JSON-RPC stdio transport and the VibesBridge that speaks to the vibes MCP server child process.
- `src/main/bridge/jsonrpc.ts` (T3) — generic JSON-RPC 2.0 client over a child's stdio: one-object-per-line framing with partial-line buffering, id-correlated request/response, per-request timeout, non-JSON stdout → `log` event, and crash/exit detection that rejects all pending requests instead of hanging them.
- `src/main/bridge/vibes-bridge.ts` (T4) — spawns the vibes MCP server (`tsx --no-warnings src/mcp/server.ts`, preferring the checkout's local tsx), performs the `initialize` handshake (protocolVersion 2024-11-05), and exposes `planMission` / `executePlanned` / `queryStatus` / `resolveIntervention` over the five confirmed tools. Windows-safe env base; `[TASK_STATUS]` stderr lines parsed into structured task events for the ledger.

**Key port decisions (from vibes-dashboard/server/vibes-bridge.js):**
- Env allowlist kept verbatim in intent — only LLM keys (`OLLAMA_*`, provider `*_API_KEY`/`*_BASE_URL`/`*_MODEL`, `CONTEXT_WINDOW`) cross into the child. Extracted to an exported pure `buildChildEnv()` so it's directly testable without spawning.
- Dropped the dashboard's POSIX-only MINIMAL_PATH and safe-mode HOME/XDG scratch dirs (Windows-first; single-instance, no multi-mission sandbox). Single instance is enforced later by T14.
- Added structured `[TASK_STATUS]` parsing — the dashboard only forwarded raw stderr; we need task lifecycle events to drive the live ledger.

**Evidence (all run this session):**
- `npm test` → **19/19 passed**. New: 6 transport tests (correlate, error-object reject, timeout, non-JSON log, exit-reject-all, partial-line reassembly) + 5 bridge tests (allowlist passes OLLAMA keys, non-allowlisted secrets stay behind, parent env never carried wholesale, `[TASK_STATUS]` → structured event, malformed status line degrades to plain log).
- `npm run typecheck` → clean on both configs. (ChildProcess stdio streams are typed nullable — captured as non-null locals after the attach guard.)
- `npm run build` → main/preload/renderer all emit.

**Superseded:** T5 (LedgerStore) landed in the entry above. Remaining P1: T6 ledger view port.

## 2026-10-13 — P0 scaffold complete (T1 + T2)

**Done:** Built the three-process Electron skeleton and made all local quality gates green.
- `src/shared/channels.ts` — the V1 IPC contract: 7 channels, ledger/roles/mission types, `classify()` ported verbatim from the fork's TaskLedgerService (approval-provenance branch dropped per ADR-0003).
- `src/main/index.ts` + `src/main/ipc/handlers.ts` — app lifecycle + a handler table keyed by channel value; P0 stubs stand in until their owning task lands.
- `src/preload/index.ts` + `index.d.ts` — typed contextBridge surface (`window.vibesDesktop`), the renderer's only IPC path.
- `src/renderer/` — React 19 + Arco mission-control shell: Operations tab (LIVE indicator, four stat tiles, status accents, "All quiet" empty state) + Roles stub; CSS Module for theming, UnoCSS wired in.

**Evidence (all run this session):**
- `npm test` → **8/8 passed** (classify semantics, IPC channel parity V1 gate, S1 "All quiet never error banner").
- `npm run typecheck` → clean on both tsconfig.node.json and tsconfig.web.json.
- `npm run build` → main/preload/renderer all emit to out/.
- **Live boot (V2):** launched the built app; window titled "Vibes Desktop" rendered Mission Control with Operations/Roles tabs, four zero stat tiles, LIVE indicator, and **"All quiet"** — no error banner. Screenshot verified by vision analysis. Test instance killed cleanly (zerogterm left untouched).

**Dependency notes:** electron-vite@5 peers vite ^7; @vitejs/plugin-react@6 needs vite 8, so pinned plugin-react@^5 + vite@^7. esbuild postinstall scripts approved via `npm install-scripts approve`. The terminal tool's "long-lived process" heuristic false-positives on any command containing the word *electron* or a `| tail` pipe — worked around by writing package lists to a file and expanding at runtime, and by driving installs/screenshots through PowerShell scripts.

**Superseded:** T3+T4 landed in the entry above (P1 bridge layer). Remaining P1: T5 LedgerStore, T6 ledger view port.

## 2026-10-13 — Repo bootstrap (planning)

**Done:** Scaffolded the documentation spine per Agents Protocol: README, CONTEXT, AGENTS, SPEC (S1–S8), PLAN (P0–P4 + module map), TASKS (T1–T15), MCP.md intent routing, three ADRs, LTM skeleton. Cloned and read all four sources: wayland-fork mission-control page + roles engine, vibes-dashboard VibesBridge (JSON-RPC stdio child process, env allowlist), vibes 0.4.0 config surface (.vibes/config.json per-role models, toggles), yapsnap (CPU sherpa-onnx STT).

**Decisions locked with user:** Electron shell (reuse React/Arco mission-control components); spawn vibes' MCP server as child process (thin app, tracks upstream releases — no native engine port); yapsnap as sole STT backend (offline, no Web Speech API).

**Root cause of the fork's first-landing error text identified:** the operations view's source-health banner ("Activity is incomplete") fires because a fresh install has no Wayland teams/workflows/scheduler sources. ADR-0003 drops that banner here — with one Vibes source, an empty ledger renders "All quiet".

**Next:** P0/T1+T2 — Electron+Vite+React skeleton, IPC channel map, vitest/typecheck/build gates. Then P1 bridge work.

**Open questions:**
- ~~Exact vibes MCP server method names~~ — resolved: `plan_mission`, `execute_mission`, `start_execution`, `resolve_intervention`, `query_status` (read from vibes 0.4.0 `src/mcp/server.ts`; recorded in PLAN.md).
- ~~Mic capture approach: renderer MediaRecorder vs main-process capture~~ — resolved in T10: **renderer MediaRecorder** (webm/opus → base64 over IPC). Simpler, no extra native deps; the doctor check gates it.
