# T30 — Hy Memory vs vibes MEMORY/CODEX + Adapter

Date: 2026-10-20. Docs spike only (Part A). Decision: **ignore as a product dependency for now; keep watchlist.**

## What each layer is

| Layer | What it stores | Where it lives | Latency / deps |
|-------|----------------|----------------|----------------|
| **Mission ledger** (desktop) | Per-mission status, task checklist, failure detail, live log lines | Electron appData JSONL | Local, append-only |
| **vibes MEMORY** (`MEMORY_ENABLED`) | Preferences + mission summaries for planner/executor context | Remote **mem0** (needs API key) **or** `LOCAL_MEMORY=true` JSONL | Remote = cloud; local = disk |
| **vibes CODEX** (`CODEX_ENABLED`) | Pattern / knowledge-base retrieval during execute/review | External Codex script paths | Optional local scripts |
| **Adapter** (Cursor / HappyMonkey) | Cross-session decisions, facts, task outcomes | Adapter workspace MCP | Separate product; not in mission child env |
| **Hy Memory 2.0** (bookmark) | Chat/work/code “memory steward”; MemHub sync across tools | Tencent open stack (claims #1 on MemoryArena) | New dependency; unverified here |

## Overlap with Hy Memory claims

Hy Memory markets a unified chat/work/code memory layer + cross-tool sync. Vibes already has:

- **Working memory for operators** → ledger + mission ID + depth panel (shipped).
- **Agent episodic crumbs** → MEMORY mission summaries / preferences (local or mem0).
- **Procedural patterns** → CODEX + `.agent/memories` in this repo.
- **Human/agent LTM across products** → Adapter (when authenticated).

Hy Memory would only pay off if we needed **semantic retrieval across many missions and tools** better than LOCAL_MEMORY + Adapter, without pulling mem0 cloud.

## Decision

**Ignore / defer** integrating Hy Memory (or TencentDB Agent Memory) into Vibes Desktop.

Reasons:

1. ADR-0001 — desktop is a thin control plane; memory backends belong in vibes or Adapter, not a third Electron store.
2. LOCAL_MEMORY already gives offline JSONL without a new vendor stack.
3. Bookmark claims are unverified (no bench run in this spike).
4. T26 (external MCP) + T29 (KEV) are higher leverage for mission quality than another memory product.

**Watchlist:** if LOCAL_MEMORY proves too weak for multi-week projects, re-evaluate Hy Memory *as a vibes-side optional backend* behind the same MEMORY facade — not a desktop feature.

## Operator defaults (recommended)

- Desktop: keep ledger as source of truth for UI.
- vibes: `LOCAL_MEMORY=true` for private machines; leave mem0 off unless explicitly wanted.
- Adapter: remember decisions/outcomes at session end; do not duplicate ledger rows.
- Do not add Hy Memory URL/settings to Roles/Settings until a vibes-side spike proves lift.
