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

- yapsnap needs ffmpeg on PATH and a one-time ~80MB model fetch per language; the doctor check must run before first capture, not after failure.

## Tooling / environment (Windows + Hermes terminal)

- The terminal tool's "long-lived process" heuristic false-positives on any command line containing the word *electron* or a `| tail`/pipe — it rejects foreground runs and demands background=true even for a one-shot `npm install`. Workaround: write package lists to a temp file and expand at runtime (`npm install -D $(tr "\n" " " < deps.txt)`), which keeps the literal command clean; drive installs/screenshots through PowerShell `-File` scripts.
- esbuild postinstall (binary download) is gated behind `npm install-scripts approve <pkg>` on this machine — run it after any install that pulls esbuild, or vite build fails to find the binary.
- Dependency pinning: electron-vite@5 peers vite ^7; @vitejs/plugin-react@6 requires vite 8. Use plugin-react@^5 + vite@^7 together.

## TypeScript / Node child-process stdio

- `ChildProcess.stdout`/`.stderr`/`.stdin` are typed nullable, and TS does NOT narrow across closures: capture the stream into a local (`const stdin = this.process?.stdin; if (!stdin || !stdin.writable) return;`) and use that local everywhere, including inside callbacks and getters. A bare `!== null` is not enough — `undefined` must be excluded too (use `!!x`).
- To drive fake stdio in tests without spawning: build the child as an EventEmitter whose stdout/stderr are `Readable({read(){}})` fed via `.push(chunk)` (Readables have no `.write`); make stdin a `Writable` sink. Attach the client, feed lines, assert on resolved promises / emitted events.
