# 2026-10-20 — Ghost-done deadlock ported to development/vibes

Mission `3ee5aaaf-6cbb-437d-b838-589142ce6288` (Unsplash info boxes) failed 1/3 with false circular-deps deadlock. App Settings `vibesPath` = `C:\Users\steph\Documents\development\vibes`; fix had only landed in `local-ai-planner`.

Ported into that checkout: `requeueOrFailGate`, ghost-aware `describeDependencyDeadlock`, `tests/scheduler-evidence-requeue.test.mjs`. Verified: `node --test tests/scheduler-evidence-requeue.test.mjs` pass.

Next live check: Retry Unsplash mission — expect requeue or honest ghost message, not circular essay.
