---
kind: decision
title: T86 per-role reasoning desktop SoT
tags: [roles, reasoning, t86]
paths: [src/main/roles/reasoning-writer.ts, src/shared/channels.ts, src/renderer/RolesTab.tsx]
sha: 3911534
agent: cursor
created: 2026-11-04
updated: 2026-11-04
---
# T86 per-role reasoning desktop SoT

Roles store reasoningMode (inherit|on|off) + reasoningEffort (inherit|low|medium|xhigh|einstein|spoon). On spawn/save write `.vibes/role-reasoning.json` with chatMarker `{REASON:effort}` for Heretic/Qwen hosts. Vibes still has one THINKING_MODE — resolveThinkingModeFromRoles prefers executor then default then Settings Runtime. Effort API kwargs (enable_thinking / reasoning_effort) need a vibes companion; T87 is operator-visible auto-suggest later, not silent.
