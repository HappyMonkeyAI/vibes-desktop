---
kind: decision
title: T80 constitution ⊕ overlay ⊕ lessons compose in vibes child
tags: [t80, constitutions, overlay, lessons, harness]
paths:
  - ../vibes/src/agent/role-prompt-compose.ts
  - src/main/roles/mission-overlay-writer.ts
  - src/main/roles/lessons-writer.ts
agent: cursor
created: 2026-11-04
updated: 2026-11-04
---
# T80 constitution ⊕ overlay ⊕ lessons compose

Desktop remains SoT for constitutions (T79). Vibes child loads `.vibes/role-constitutions.json`, optional `mission-overlay.json` (add/emphasize/forbid), and optional `role-lessons.json`, and prepends labeled sections to role system prompts. Overlay cannot rewrite constitution. Needs You UI → overlay write is T80b.
