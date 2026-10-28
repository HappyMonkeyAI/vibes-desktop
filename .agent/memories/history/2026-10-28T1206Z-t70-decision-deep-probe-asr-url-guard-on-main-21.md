---
kind: checkpoint
created: 2026-10-28T12:06:39Z
agent: cursor
sha: 3dcd575
branch: main
task_id: T70
paths: [src/main/decision/probe.ts, tests/decision-probe.test.ts, tests/live-mission.e2e.test.ts]
verification: {V0: pass, V1: skip, V2: skip, V3: pass, V4: skip}
id: 2026-10-28T1206Z-t70-decision-deep-probe-asr-url-guard-on-main-21
---
# Checkpoint: T70 Decision deep-probe + ASR URL guard on main (#21). Live first-mission e2e r…

## Summary

T70 Decision deep-probe + ASR URL guard on main (#21). Live first-mission e2e re-passed on LM Studio :1234. Decision hosts still down for T62.

## Done

- T70 merged (PR #21)
- Live mission smoke plans/executes passed (~60s) on :1234

## Next

- T62 when Unsloth/KEV MCP + sk-unsloth available
- CSC signing
- Cut 0.2.0
- Public visibility when ready

## Blockers

- Decision MCP unreachable
- No CSC cert

## Decisions

- (none)
