---
kind: checkpoint
created: 2026-10-27T12:55:27Z
agent: cursor
sha: 2065d41
branch: ag/t61b-fix-win-builder-config
task_id: T61b
paths: [package.json, docs/PACKAGING.md]
verification: {V0: pass, V1: skip, V2: skip, V3: pass, V4: skip}
id: 2026-10-27T1255Z-public-beta-path-first-run-t63-t64-on-main-decis
---
# Checkpoint: Public-beta path: first-run T63/T64 on main; Decision deep-probe T62b; dist fix…

## Summary

Public-beta path: first-run T63/T64 on main; Decision deep-probe T62b; dist fixed (T61b PR #13). T62 live Needs-You still blocked on sk-unsloth + LLM.

## Done

- Merged T63/T64/T62b to main
- Fixed dist schema; Setup 0.1.1.exe builds
- Documented Unsloth vs KEV tokens

## Next

- Merge T61b PR #13 if needed
- T62 with Unsloth API key + Ollama
- Sign installer when cert available
- 0.2.0 after stranger first-mission + Decision verified

## Blockers

- Need sk-unsloth key for :8888; Ollama down; no CSC cert

## Decisions

- (none)
