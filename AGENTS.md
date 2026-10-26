# AGENTS.md — Vibes Desktop Agent Law

Adapted from the [Agents Protocol](https://github.com/HappyMonkeyAI/AgentsProtocol) (AGENTS.md + BOOTSTRAP.md), scoped to this project.

## Prime Directive

Minimize friction, maximize momentum. Deliver a focused desktop app for Vibes with surgical precision. Eliminate drag: ambiguity, technical debt, poor documentation, manual verification.

## Core Orchestration & Self-Evolution

- **[Echo]** Continuously eliminate repetition; synthesize lessons into `.agent/memories/`.
- **[Ripple]** Map blast radius before non-trivial changes (which process layer? which IPC channel?).
- **[Pulse]** If a task needs >3 corrections, STOP, revert, and replan.
- **[Adaptive escalation]** Start with the least expensive adequate model; after two materially unsuccessful repair attempts, escalate one reasoning tier with the task evidence.
- **[Steer]** Acknowledge and adapt to user steering mid-turn.
- **[Thrust]** Batch safe tool calls; sequential for risky/destructive ones.
- **[Sanity]** Every session starts with grounding. Prefer Spine when available (below); otherwise read README.md, CONTEXT.md, MCP.md (and MCP.local.md if present), this file, PROGRESS.md, then TASKS.md.

## Session start and end (Spine)

If the `spine` MCP is available, call `session_brief(project="vibes-desktop")` (or the absolute path of this repo) first and use `get_section` / `recall` instead of reading PROGRESS.md or CONTEXT.md whole. Without the MCP, run `spine brief` from the repo root. If neither works, ground normally.
Before you stop, call `checkpoint` with agent `cursor`, what was done, what's next and any blockers. Save durable why/gotcha/decision facts with `record_memory`. For UI work, prefer `spine-design` (`design_brief` / `ensure_capture`) over ad-hoc screenshots when that server is mounted.

## LTM Architecture

Memory is pre-execution context enrichment, not passive logs. Store: `.agent/memories/`.

| Type | Stores | Location |
|------|--------|----------|
| Semantic | Facts, decisions, architecture | `codebase_insights/`, `architectural_decisions/` |
| Episodic | Events, plans, outcomes | `history/` |
| Procedural | Workflows, lessons, guardrails | `patterns_and_lessons.md` |

Protocol: pre-task query → inject structured summary; post-task synthesize + compress; every ~10 major tasks run a Truth Audit (memory vs current code); archive plans/walkthroughs with timestamps.

## Tool & Ground-Truth Discipline

- Prefer tool calls over hallucination; route by intent via MCP.md (ADR-0003 of the protocol).
- Vibes runtime state: read it from the child process's JSON-RPC responses and the activity ledger — never guess mission status.
- Port conflicts: check before binding any port (the app should bind none in steady state; dev servers excepted).
- yapsnap model cache lives outside the repo (`~/.cache` / `%LOCALAPPDATA%`); don't commit weights.

## Coding & Output Standards

- Lead with the answer. No filler, banned openers.
- Surgical edits only. No "vibe coding" or `// ... rest of code`.
- Three-process separation is law (see CONTEXT.md). An IPC handler that touches DOM, or a renderer import of Node APIs, is a build failure.
- Autonomous verification: fix your own errors; worker self-report is never Done proof.

## Workflow

**Quick Mode** (<15-word prompt): fast cycle. **Deep Mode**: RECON → HMW → DIVERGE → CONVERGE → LOCK.

Standard loop: grounding → spec-first report if >3 files impacted (await approval) → pre-mortem → implement in small vertical slices → Verification Ladder → update docs + memory → ratchet (commit).

### Verification Ladder

| Stage | Name | Requirement |
|-------|------|-------------|
| V0 | Deterministic | Touched-package tests, typecheck, build (`npm test`, `npm run typecheck`) |
| V1 | Contract / Ripple | IPC channel parity: every preload bridge method has a main handler and a renderer call site |
| V2 | Adversary tests | Owner (not the implementing agent) attacks SPEC acceptance criteria independently |
| V3 | Live / exploratory | Run the packaged app: launch, configure an endpoint, start a mission against a local LLM, watch the ledger, use voice input; state readback from the ledger file |
| V4 | Close the loop | Failures → fix tickets in TASKS.md → re-verify; then commit |

Skip rules: V1 when no IPC boundary touched; V2 for trivial one-liners with no behavior surface; V3 only when UI or runtime changed. V0 never skipped for code changes.

**Done means:** every named acceptance criterion in SPEC.md has independent evidence, reported as `unit | integration | e2e | live`.

## Documentation Rules

- Update CONTEXT.md + ADRs whenever architecture or workflow changes.
- PROGRESS.md gets a dated entry per session: what was done, what's next, open questions.
- TASKS.md is the only task board; no parallel TODO lists.
- Before finishing any task: verify created/changed files exist and are correct; summarize exactly what was done.

## Git

Branch `ag/<task-id>` for agent work. Conventional Commits in English (`feat`, `fix`, `chore`, ...). No AI signatures (Co-Authored-By, Generated with, etc.). Never commit secrets — the `.env.example` pattern applies to yapsnap/LLM keys.
