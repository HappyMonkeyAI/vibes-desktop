# PLAN.md — Architecture & Phases

## System overview

```
┌──────────────────────────────────────────────┐
│  Renderer (React 19 + Arco, Vite)            │
│  Mission Control: ledger view · roles tab    │
│  Voice bar: push-to-talk → transcript        │
├──────────────────────────────────────────────┤
│  Preload — contextBridge IPC surface         │
│  (ledger.*, roles.*, mission.*, voice.*)     │
├──────────────────────────────────────────────┤
│  Main process                                │
│  ┌─────────────┐  ┌──────────────────────┐   │
│  │ LedgerStore │  │ VibesBridge          │   │
│  │ (JSONL)     │◄─┤ JSON-RPC over stdio  │   │
│  └─────────────┘  └──────────┬───────────┘   │
│  ┌─────────────┐             │               │
│  │ VoiceService│             ▼               │
│  │ mic→wav     │      vibes MCP server       │
│  │ →yapsnap CLI│      (child process)        │
│  └─────────────┘                             │
│  ┌─────────────┐                             │
│  │ ConfigStore │ .vibes/config.json writer   │
│  └─────────────┘                             │
└──────────────────────────────────────────────┘
```

## Module map (≤10 children per directory)

```
src/
  main/            index.ts, app-lifecycle.ts
    bridge/        vibes-bridge.ts, jsonrpc.ts, env-allowlist.ts
    ledger/        store.ts, projector.ts, types.ts
    voice/         recorder.ts, transcriber.ts, yapsnap-doctor.ts
    config/        roles-config.ts, vibes-config-writer.ts
  preload/         index.ts (contextBridge), channels.ts
  renderer/
    pages/mission-control/   index.tsx, useMissionControl.ts, MissionControl.module.css
      roles/                 RolesTab.tsx, useRoles.ts
      voice/                 VoiceBar.tsx, useVoice.ts
```

## Key porting decisions

1. **VibesBridge** — port `vibes-dashboard/server/vibes-bridge.js` into TypeScript: spawn `npx vibes-tui mcp-server` (or a checkout path from config) with stdio pipes; JSON-RPC 2.0 request/response + notification streaming; env allowlist identical to the dashboard's (`OLLAMA_*`, model keys, CONTEXT_WINDOW). The dashboard used socket.io to fan events out to browsers; here events go straight into LedgerStore and are pushed to the renderer over IPC — no server.

   **Confirmed vibes 0.4.0 MCP tool surface** (read from `vibes/src/mcp/server.ts`): `plan_mission{description, workspace_root?}` → tasks JSON without executing; `execute_mission{description, workspace_root?}` → plan + run; `start_execution{}` → run the planned mission; `resolve_intervention{action: retry|skip|fail|reply, message?, retryFromTaskId?}`; `query_status{}`. These are MCP tools over the JSON-RPC transport — T4 calls them by name and maps their outputs onto ledger rows.
2. **Mission Control UI** — copy `src/renderer/pages/mission-control/` from wayland-fork (index.tsx, useMissionControl.ts, roles/, MissionControl.module.css) plus the ledger types from `src/common/types/missionControl.ts`. Strip: i18n multi-locale (English literals for v1), popout window, cost tab, Wayland team/workflow/scheduler sources. Keep: status accent vocabulary, grouping, pagination, RolesTab endpoint forms.
3. **Voice** — new code. `recorder.ts` uses Electron's `systemPreferences`/webContents capture or the `node-record-lpcm16`-style approach in main (simplest: renderer MediaRecorder → ArrayBuffer over IPC → wav on disk). `transcriber.ts` shells out to `yapsnap <wav> --lang auto`, parses stdout text. `yapsnap-doctor.ts` checks ffmpeg + yapsnap presence and reports install hints.
4. **Config** — roles-config in electron-store (encrypted apiKey via safeStorage); on save, also write the workspace's `.vibes/config.json` so the TUI sees identical role assignment.

## Phases

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| P0 | Repo scaffold: Electron+Vite+React skeleton, IPC bridge, CI-less local gates (test/typecheck/build) | S1 partial: blank window with nav shell |
| P1 | VibesBridge + LedgerStore + ledger view (no voice, no roles save yet) | S2, S3; live mission against a local endpoint streams into the ledger |
| P2 | Roles tab + config writer + test-connection | S4 |
| P3 | Voice bar: record → yapsnap → request field; doctor checks | S5 |
| P4 | Lifecycle controls (stop/cancel, single-mission guard) + packaging | S6, S8 |

## Risks & mitigations

- **vibes MCP server API drift** — pin the vibes version in config; bridge tolerates unknown notifications; SPEC S2 is the regression net.
- **yapsnap model download on first run** — doctor screen warns and pre-fetches models in a controlled step; never blocks app launch.
- **Windows mic permissions** — no OS prompt needed (desktop app, user-initiated capture); failure surfaces as an error toast with the OS-level hint.
