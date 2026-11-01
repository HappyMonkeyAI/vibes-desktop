---
kind: checkpoint
created: 2026-11-01T12:26:53Z
agent: cursor
sha: b38bc3c
branch: ag/t79-role-constitutions
task_id: T79
paths: [src/shared/channels.ts, src/main/roles/store.ts, src/main/roles/constitutions-writer.ts, src/main/index.ts, src/main/ipc/handlers.ts, src/renderer/RolesTab.tsx, tests/constitutions-writer.test.ts, tests/roles-store.test.ts, TASKS.md, CONTEXT.md, docs/FEATURES.md, PROGRESS.md, LINKS.md, .agent/memories/codebase_insights/2026-11-01-bookmarks-neo-delta.md, .agent/memories/codebase_insights/2026-11-01-elephant-goldfish-single-agent-loop.md]
verification: {V0: pass, V1: skip, V2: skip, V3: skip, V4: skip}
id: 2026-11-01T1226Z-shipped-p11-bookmark-plan-t79-role-constitutions
---
# Checkpoint: Shipped P11 bookmark plan: T79 role constitutions desktop slice; T81/T82 resear…

## Summary

Shipped P11 bookmark plan: T79 role constitutions desktop slice; T81/T82 research; T51 watchlist; T80 left open. Beta blockers T62/CSC unchanged.

## Done

- TASKS P11: T79–T82 + T80 stub; T51 watchlist extended
- T79 systemPrompt in Roles store/UI + .vibes/role-constitutions.json on spawn/save
- T81 elephant-goldfish / single-agent-loop note
- T82 CONTEXT model+harness + no auto-evolve
- FEATURES Roles constitution blurb; PROGRESS entry

## Next

- T80 overlay + vibes compose when checkout available
- T62 Decision live when Unsloth up
- CSC / public visibility when ready

## Blockers

- T62 needs Unsloth :8888 + key
- No CSC cert
- T80 needs vibes child work

## Decisions

- Constitutions are sibling JSON not OLLAMA_* env keys
- Overlays/compose deferred to T80
