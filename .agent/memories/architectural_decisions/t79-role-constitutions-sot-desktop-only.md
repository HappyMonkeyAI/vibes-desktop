---
kind: decision
title: T79 role constitutions SoT desktop-only
tags: [t79, constitutions, harness, roles]
paths: [src/main/roles/constitutions-writer.ts, src/main/roles/store.ts, src/renderer/RolesTab.tsx]
sha: b38bc3c
agent: cursor
created: 2026-11-01
updated: 2026-11-01
---
# T79 role constitutions SoT desktop-only

Per-role systemPrompt (constitution) lives in RolesStore/roles-config.json and writes .vibes/role-constitutions.json on mission spawn and on roles save (latest workspace history). Not injected into toVibesConfig/OLLAMA_* keys. Composition constitution⊕overlay⊕lessons is T80 in vibes child. Operator-owned SoT; no model.rewrite(constitution).
