# ADR-0003 — Ledger source health: no error banner for a single-source app

Status: accepted (2026-10-13)

## Context

The wayland-fork mission-control operations view aggregates activity from multiple sources (desktop teams, desktop workflows, scheduler, approvals) and renders an "Activity is incomplete" warning when any source is unhealthy. On a fresh install — the exact state we hit while testing the fork's Mission Control landing — none of those sources exist yet, so the page opens showing error text before the user has done anything.

## Decision

Vibes Desktop's ledger has exactly one activity source: the Vibes bridge (missions). An empty or unreachable ledger renders the "All quiet" empty state with a hint, never an error banner. If the vibes child process is dead, the roles/mission surface shows its own targeted status (failed row with stderr tail) — that is specific enough to act on, unlike a generic completeness warning.

## Consequences

- First launch is clean: "All quiet" instead of alarming error text.
- The `sourceHealth` array and `completeness` field from the fork's ledger types are dropped from the port (they exist to reconcile multi-source disagreement, which cannot happen with one source).
- If a second activity source is ever added (e.g. scheduled missions), this ADR must be revisited before re-introducing health aggregation.
