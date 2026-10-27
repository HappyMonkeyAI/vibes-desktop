# Owner adversary malformed → soft-pass (2026-10-21)

## Symptom
Chat mission completed all leaf tasks (3/3 DONE); page matched request; mission FAILED with:
`Mission completion gate rejected success: Owner adversary review is malformed`

## Cause
`ENABLE_ADVERSARIAL_AUDIT` Owner-as-Adversary post-pass. Reviewer JSON failed Zod schema → gate treated parse failure as reject, overturning done work.

## Fix
In vibes (+ mirrored local-ai-planner) `evaluateMissionCompletion`:
- `unverified: true` → soft-pass (advisory)
- schema-invalid after coerce → soft-pass
- explicit `approved: false` → still fail
- coerce string `line` numbers via `normalizeOwnerReviewInput`

## Verify
`node --test tests/owner-adversary.test.mjs` in both checkouts (5/5).
Desktop Settings `vibesPath` → `development/vibes`; restart child / new Chat mission to load patch.
Planner needs `npm run build` if consuming `dist/`.
