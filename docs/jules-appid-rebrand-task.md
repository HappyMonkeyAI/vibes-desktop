# Jules task: Retarget Electron `appId` off FerroxLabs leftover

> **Done locally (T72, 2026-10-28)** — Jules source for this private repo was not connected yet; Cursor landed `com.stephenphillips.vibesdesktop` on `main`. Keep this brief as a template for future handoffs.

## Context
Vibes Desktop is MIT © Stephen Phillips and heading toward public beta. `package.json` → `build.appId` was still `com.ferrox.vibesdesktop` from the early FerroxLabs/wayland fork packaging. That id is wrong for a stranger-facing installer and for any future signing/`publisherName` alignment. Historical README mention of FerroxLabs as UI provenance can stay.

## Exact files
- `package.json` — `build.appId` only (and `build.publisherName` **only if** it already exists and still says Ferrox; do not invent unrelated metadata)
- Optionally one-line note in `docs/PACKAGING.md` if it hard-codes the old appId (skip if absent)
- Do **not** rewrite `PROGRESS.md` history lines that quote the old id

## Required behavior
1. Change `build.appId` from `com.ferrox.vibesdesktop` to `com.stephenphillips.vibesdesktop`.
2. Leave `productName` as `Vibes Desktop`, `copyright` / `author` / `license` unchanged.
3. Do not change NSIS targets, icons, or `forceCodeSigning`.
4. If any **non-history** doc currently instructs operators to use `com.ferrox.vibesdesktop`, update that one line to the new id.

## Hard constraints
- Smallest complete change — no drive-by refactors, dependency bumps, or UI work.
- Do not change `appId` format to a reverse-DNS you invent beyond `com.stephenphillips.vibesdesktop`.
- Do not commit `.env`, keys, `.pfx`, or dist artifacts.
- Do not merge the PR; open it against **`main`**.
- Three-process Electron separation is out of scope for this task (do not touch `src/`).

## Acceptance criteria
- [ ] `package.json` `build.appId` is `com.stephenphillips.vibesdesktop`.
- [ ] `productName` remains `Vibes Desktop`.
- [ ] No unrelated files churned.
- [ ] Deliverable is a **GitHub pull request with the code change**, targeting `main`, with files changed + how to verify (`npm run typecheck` is enough; full `npm run dist` optional) in the PR body — **not a plan-only session**.
