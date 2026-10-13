# ADR-0001 — Electron thin control plane (MCP child process)

Status: accepted (2026-10-13)

## Context

Three ways to drive Vibes from a desktop app were on the table: (a) port the four-role engine natively into the app (the wayland-fork path), (b) spawn vibes' MCP server as a child process and speak JSON-RPC (the vibes-dashboard path), (c) embed the real Vibes TUI in an xterm.js pane.

## Decision

Electron shell; the app is a thin control plane that spawns `vibes-tui`'s MCP server (`src/mcp/server.ts`) as a child process and communicates over stdio JSON-RPC 2.0, exactly like `vibes-dashboard/server/vibes-bridge.js`. Events flow child → main (LedgerStore) → renderer (IPC push). No HTTP server, no socket.io — one local user.

## Consequences

- Always tracks the latest vibes release; no re-porting of planner/executor/reviewer/triage logic on upstream changes.
- The app must tolerate MCP API drift: pin a tested vibes version in config, accept unknown notifications, and keep SPEC S2 as the regression net.
- Child crashes surface as ledger `failed` rows with stderr tail; the app itself never dies from agent failure.
- Rejected (a): native port duplicates engine logic and diverges from upstream — that duplication is exactly what made the fork's mission-control UI feel redundant.
- Rejected (c): a terminal pane can't give us structured ledger data, voice-driven mission entry, or the roles configuration surface.
