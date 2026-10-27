# Cline / OpenBot cherry-picks (2026-10-22)

## Adopted
1. **Double-check completion** (Cline) → vibes `ENABLE_DOUBLE_CHECK_COMPLETION` + `doubleCheckMissionEvidence`. Also fixed Owner prompt `join('\\n')` → real newlines (likely contributor to malformed adversary JSON).
2. **Crash-safe FIFO queue** (OpenBot) → desktop `mission-followup-queue.json`; Chat `enqueueIfBusy`; drain on natural completion only.
3. **Focus chain lite** → Chat RHS plan sticky until next send (DESIGN).

## Rejected
Multi-engine ACP shell, YOLO, Computer Use, agent social channels. OpenBot PolyForm → patterns only.
