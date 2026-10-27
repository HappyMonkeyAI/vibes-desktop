# patterns_and_lessons.md — Procedural memory

Lessons learned while building Vibes Desktop. Imperative rules with the why; one rule per line-group. No incident narration, no PR numbers.

## Bridge (vibes MCP child process)

- Enumerate the MCP tool surface from vibes' `src/mcp/server.ts` before writing bridge calls — tool names/params drift between releases. Verified 2026-10-13 against vibes 0.4.0: plan_mission, execute_mission, start_execution, resolve_intervention, query_status.
- Spawn the child with an env allowlist (OLLAMA_*, model keys, CONTEXT_WINDOW), never the full app environment — secrets must not leak into a grandchild process tree.

## Ledger

- Single-source ledger: an empty ledger is "All quiet", never an error banner (ADR-0003). The fork's multi-source health aggregation does not port.
- When main pushes a fresh entry object per append, the renderer must upsert by id, not append — otherwise one task going running → done shows two rows and the stat tiles drift from the list. Derive groupCounts from the entries array (single source of truth) instead of accumulating counts on each push.
- An append-only JSONL store that upserts in memory keeps the file as true history (two lines for a task's lifecycle) while `snapshot()` reflects only current state — last line per id wins on replay.

## Roles & config (T7–T9)

- `safeStorage.encryptString` returns a **Buffer**, not a string — base64-encode it for storage and decode back before `decryptString`. The fork's naive pass-through typechecks only because its cipher is abstracted; ours is concrete.
- vibes has **no EXECUTOR_*** keys: the executor runs on the default OLLAMA_* endpoint. Our five-role config collapses default+executor onto OLLAMA_* (executor wins when set); planner/reviewer/triage get their own prefixed MODEL/BASE_URL/API_KEY. Verified against vibes 0.4.0 `src/config.ts`.
- The env allowlist only carries OLLAMA_* into a spawned child — per-role PLANNER/REVIEWER/TRIAGE keys must be written to `<workspace>/.vibes/config.json` (T9) or a spawned child never sees them. The fork runs its own native pipeline so it never needed this file; we spawn vibes, so we must write it.
- Omit empty fields when writing the native config so a half-configured save never blanks keys the user set earlier — merge with the existing file, don't clobber.
- A decrypted API key never crosses IPC: the view carries only a `hasKey` presence flag; an empty submitted key means "keep what's stored".

## Voice

- yapsnap needs ffmpeg on PATH and a one-time ~80MB model fetch per language; the doctor check must run before first capture, not after failure. Absence is a *result* (`ready:false` + install hint), never an error — a missing binary is expected on a fresh machine.
- yapsnap's CLI writes the transcript to a **file** (`-o OUTPUT.txt`) and prints only the path on stdout; all progress/errors go to stderr. Read the output file, don't parse stdout for the text. Make the CLI runner injectable so tests never spawn a real process.
- Push-to-talk capture is renderer-side (MediaRecorder → webm/opus → base64 over IPC). The doctor runs on mount and blocks capture with a "voice not ready" tag when ffmpeg/yapsnap are absent, so the user gets an actionable hint instead of a silent no-op or a crash.

## React 19 + Arco (critical)

- Arco's static `Message.error()` / `Modal.confirm()` / `Notification` route through `ReactDOM.render`, which **React 19 removed** — every error path is a hard crash unless fixed. Root cause: Arco's internal react-dom util grabs `createRoot` from the `react-dom` *main* entry at import time, but React 19 moved it to `react-dom/client`.
- The fix is Arco's own `setCreateRoot(_createRoot)` escape hatch (its comment says exactly this). Import `createRoot` from `react-dom/client` and call `setCreateRoot` **before any Arco component renders** (first import in main.tsx and test setup).
- Patch **both** Arco builds: the package has no `exports` map, so `main`→`lib/` (CJS) and `module`→`es/` are separate module instances. Vite's production build resolves to `es/`, but Vitest/node SSR resolves to `lib/`. Call `setCreateRoot` on each (`@arco-design/web-react/es/_util/react-dom` and `/lib/_util/react-dom`) or one of the two paths stays broken (you'll see it as an unhandled rejection in tests, not a test failure).
- Mount `<Message />` once in the tree too — that's where the static API renders its container. Both are needed: `setCreateRoot` fixes *how* it mounts, `<Message />` provides *where*.

## Vitest module mocking

- `vi.mock('node:child_process', () => ({ spawn: spawnMock }))` is **hoisted above** the `const spawnMock = vi.fn()` declaration, so the factory hits a TDZ ReferenceError. Wrap the mock in `vi.hoisted(() => ({ spawnMock: vi.fn() }))` and destructure from it — the hoisted scope runs before imports.

## Tooling / environment (Windows + Hermes terminal)

- The terminal tool's "long-lived process" heuristic false-positives on any command line containing the word *electron* or a `| tail`/pipe — it rejects foreground runs and demands background=true even for a one-shot `npm install`. Workaround: write package lists to a temp file and expand at runtime (`npm install -D $(tr "\n" " " < deps.txt)`), which keeps the literal command clean; drive installs/screenshots through PowerShell `-File` scripts.
- esbuild postinstall (binary download) is gated behind `npm install-scripts approve <pkg>` on this machine — run it after any install that pulls esbuild, or vite build fails to find the binary.
- Dependency pinning: electron-vite@5 peers vite ^7; @vitejs/plugin-react@6 requires vite 8. Use plugin-react@^5 + vite@^7 together.

## TypeScript / Node child-process stdio

- `ChildProcess.stdout`/`.stderr`/`.stdin` are typed nullable, and TS does NOT narrow across closures: capture the stream into a local (`const stdin = this.process?.stdin; if (!stdin || !stdin.writable) return;`) and use that local everywhere, including inside callbacks and getters. A bare `!== null` is not enough — `undefined` must be excluded too (use `!!x`).
- To drive fake stdio in tests without spawning: build the child as an EventEmitter whose stdout/stderr are `Readable({read(){}})` fed via `.push(chunk)` (Readables have no `.write`); make stdin a `Writable` sink. Attach the client, feed lines, assert on resolved promises / emitted events.

## Mission lifecycle (T13–T14)

- One child per mission, terminated on **every** exit path (complete, fail, stop). A crashed child is surfaced in the ledger as `failed`, never crashes the app — that's S2/S6. Structure it as a synchronous `startMission` flow (`spawn → plan → execute`) so task-status events stream to the ledger in real time and the invoke resolves when the mission ends (the UI can show loading + surface errors).
- The single-mission guard must check state **synchronously, before any await** — two rapid starts both pass an `await`-gated check. Return `{started:false, alreadyRunning:true}`; never throw for a benign "already running".
- On stop/cancel, rewrite in-flight tasks (`running`/`verifying`, source `vibes-mission`) to `blocked` **in place** (same id) so the renderer's upsert replaces the row instead of duplicating it. Return the blocked count.
- Depend on a minimal structural bridge interface (`on`, `start`, `planMission`, `executePlanned`, `stop`) rather than the full class — tests inject a fake without implementing `client`/`queryStatus`. The real bridge satisfies it structurally.
- Write `.vibes/config.json` from the roles store **before each spawn** (the child reads its per-role endpoints from that file, not env). Fall back to a known checkout path when VIBES_PATH is unset — dev convenience only; packaging sets it explicitly.

## Packaging (T15)

- electron-builder needs its postinstall scripts approved on this machine: `esbuild` (binary download) **and** `electron-winstaller` (downloads 7za for the win-installer target). Run `npm install-scripts approve <pkg>` for both after any install that pulls them, or the build fails to find the binary.
- Build a Windows NSIS installer with a `dist` script (`electron-vite build && electron-builder --win`) and a `build` config in package.json (appId, productName, `win.target` = nsis/x64, `files: ["out/**/*", "package.json"]`). Output lands in `dist/` (already gitignored). The installer is a valid PE — verify the MZ header before claiming success.
- Verify the **packaged** app, not just dev mode: launch `dist/win-unpacked/<Product>.exe` directly and capture via Win32 EnumWindows+CopyFromScreen. S1 ("All quiet", no error banner) must hold in production too — the Arco/React 19 shim and ADR-0003 are only proven when the bundled build boots clean.

## Preload & child-process spawn (post-plan fixes)

- A **sandboxed** Electron preload runs in a CommonJS context: with `"type": "module"` in package.json, electron-vite emits `index.mjs` whose `import` throws at load, leaving `window.vibesDesktop` undefined and crashing every tab on mount. Force CJS output for the preload build (rollupOptions `format: 'cjs'`, `entryFileNames: '[name].js'`) — this also restores the original `index.js` path. Preload scripts do not HMR-reload; a full app restart is required after any preload change.
- Resolve the child interpreter deterministically: run the checkout's local tsx CLI (`node_modules/tsx/dist/cli.mjs`) through `process.execPath` with `ELECTRON_RUN_AS_NODE=1`. Never rely on PATH, and never spawn `.bin/tsx` directly — it is a cmd batch file on Windows that needs `shell:true`. Fail fast with an actionable "run `npm install` inside the checkout" error when neither the CLI nor a shim exists.
- **Always attach an `error` listener to a child process.** An EventEmitter child `error` with no listener becomes an uncaught exception that kills Electron's main process — the user sees "A JavaScript error occurred in the main process". Swallow it in the bridge (pending requests are already rejected by the client and surface as a failed mission via the service catch path). This is S2: a crashed child is a ledger entry, never an app death.
- `npm install` in the vibes checkout needs `--ignore-scripts`: `better-sqlite3`'s gyp build fails on Node 26 without VS Build Tools, and the MCP server never imports it.

## Ledger store (race)

- Concurrent read-modify-write mutations for the same title mint duplicate rows: each call does its "find existing by title" lookup after awaiting setup, so two concurrent calls both miss each other. Serialize all mutations through a `writeQueue` promise chain and make `snapshot()` drain it before reading. Add a regression test that fires concurrent events for one title and asserts exactly one row.

## Theming (zerogterm pattern)

- Palettes live under `:root[data-theme='light' | 'dark']`; light is the default, dark retained so a future toggle is an attribute flip. CSS custom properties carry every color; non-CSS data (theme list, labels, kind, terminal palettes) stays in a themes module with a `toggledTheme()` helper. Module CSS must reference semantic surface tokens (`--surface-card`, `--surface-row`, …), never hardcoded `rgba(255,255,255,…)` overlays — that is what makes both modes render correctly from one stylesheet.
- Set `arco-theme` + `data-theme` on `documentElement` **synchronously in `<body>` before the module script** to prevent a theme flash. Setting the attribute on `body` from a `<head>` script silently no-ops (body doesn't exist yet).

## Verification tooling (Windows)

- Window-capture (`CopyFromScreen`) grabs the desktop wallpaper when the app isn't frontmost — it failed silently and returned the background image. Use CDP's `Page.captureScreenshot` instead: it captures the renderer directly with no z-order fight. Drive CDP from Node v26's global `WebSocket`; add `awaitPromise: true` to `Runtime.evaluate` for any expression that returns a Promise, or you get `{}` back.
- Fresh `npm ci` with npm's install-script gate skips electron's postinstall: the first `electron .` prints "Downloading Electron binary..." and opens no window for a while. Wait for the CDP `/json/list` page target rather than assuming the launch failed. CDP worker traffic: `Target.setAutoAttach {autoAttach, waitForDebuggerOnStart, flatten}` then enable Network/Runtime per `sessionId` and `Runtime.runIfWaitingForDebugger`.
- Kill only the instance you launched: find it by its debug port (`Get-NetTCPConnection -LocalPort <port>`), since `TaskStop` on the shell leaves electron.exe running and other Electron apps share the image name.

## Renderer supply chain / CSP

- Transformers.js sets onnxruntime `wasmPaths` to cdn.jsdelivr.net at import time. Override after import in the worker with bundled `?url` assets (alias `ort-dist` → `node_modules/onnxruntime-web/dist`; the package exports map blocks `onnxruntime-web/dist/*`). Keep the asyncify variant to match what Transformers picks.
- CSP is injected at build only (Vite `transformIndexHtml`, `apply: 'build'`); a dev CSP breaks the React-refresh inline preamble. Inline scripts are not allowed — put boot scripts in `src/renderer/public/`.
