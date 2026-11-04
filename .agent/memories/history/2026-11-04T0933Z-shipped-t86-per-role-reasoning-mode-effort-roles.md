---
kind: checkpoint
created: 2026-11-04T09:33:19Z
agent: cursor
sha: 3911534
branch: ag/t86-role-reasoning
task_id: T86
paths: [src/shared/channels.ts, src/main/roles/store.ts, src/main/roles/reasoning-writer.ts, src/renderer/RolesTab.tsx, src/main/index.ts, src/main/ipc/handlers.ts, tests/reasoning-writer.test.ts, TASKS.md, docs/FEATURES.md, CONTEXT.md, PROGRESS.md]
verification: {V0: pass, V1: pass, V2: skip, V3: skip, V4: skip}
id: 2026-11-04T0933Z-shipped-t86-per-role-reasoning-mode-effort-roles
---
# Checkpoint: Shipped T86 per-role reasoning (mode + effort) → Roles store + role-reasoning.j…

## Summary

Shipped T86 per-role reasoning (mode + effort) → Roles store + role-reasoning.json; executor/default overrides THINKING_MODE. T87 filed.

## Done

- P13 T86/T87 tickets
- RoleEndpoint reasoningMode/effort in store + IPC view
- writeRoleReasoning + resolveThinkingModeFromRoles on save/spawn
- RolesTab Select UI for mode and effort
- V0 tests 215 pass + typecheck

## Next

- Commit/PR for ag/t86-role-reasoning
- Land T83 PR #31
- T84/T85 MCP filter
- Vibes companion for reasoning_effort kwargs
- Optional Defiant Fable Q6_K MTP live test

## Blockers

- (none)

## Decisions

- Desktop SoT first like T79; effort stored with Heretic chat markers; vibes API kwargs deferred
- THINKING_MODE collapse: executor then default then Runtime
