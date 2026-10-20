# ADR note — Hybrid C Operations UI (2026-10-20)

**Decision:** Desktop Mission Control uses Hybrid C: card grid for overview + Mission Control depth (checklist, detail, live logs) when a mission is selected or running. Visual target = dark stitch Mission Control; interaction target = existing Launch/Review cards + TUI-level awareness signals.

**Why:** Pure list Mission Control (A) drops the learned card flow; cards-only polish (B) leaves the awareness gap vs TUI; embedding the TUI violates ADR-0001.

**Rejected:** Full TUI chrome (Alt+ views, YOLO banner, htop), chat-left/workers-right layout as primary shell.

**Contract:** `DESIGN.md`. Tasks: T16–T21 in `TASKS.md`.
