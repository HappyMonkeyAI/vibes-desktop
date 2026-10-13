# patterns_and_lessons.md — Procedural memory

Lessons learned while building Vibes Desktop. Imperative rules with the why; one rule per line-group. No incident narration, no PR numbers.

## Bridge (vibes MCP child process)

- Enumerate the MCP tool surface from vibes' `src/mcp/server.ts` before writing bridge calls — tool names/params drift between releases. Verified 2026-10-13 against vibes 0.4.0: plan_mission, execute_mission, start_execution, resolve_intervention, query_status.
- Spawn the child with an env allowlist (OLLAMA_*, model keys, CONTEXT_WINDOW), never the full app environment — secrets must not leak into a grandchild process tree.

## Ledger

- Single-source ledger: an empty ledger is "All quiet", never an error banner (ADR-0003). The fork's multi-source health aggregation does not port.

## Voice

- yapsnap needs ffmpeg on PATH and a one-time ~80MB model fetch per language; the doctor check must run before first capture, not after failure.
