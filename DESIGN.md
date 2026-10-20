# DESIGN.md — Vibes Desktop Mission Control (Hybrid C)

Last locked: 2026-10-20. Visual target: dark Mission Control (stitch HTML #2) + existing card workflow. TUI informs *what* to surface; desktop does not embed the TUI.

## Direction

**Hybrid C:** card grid for overview + Mission Control awareness when a mission is selected or running.

| Layer | Role |
|-------|------|
| Card grid | At-a-glance missions: Launch tile + status cards (COMPLETE / EXECUTING / FAILED) with progress |
| Mission depth | Side panel or expanded strip: task checklist, `LedgerEntry.detail`, live logs |
| Dispatch | Always-visible composer (workspace + prompt + voice + Start/Stop) — keep Review Plan as optional gate |
| Chrome | Status metrics (Needs You / Running / Upcoming / Recent), footer telemetry |

## Information architecture

```
┌─ Header: Mission Control · LIVE · Voice · Theme · Settings ─┐
├─ Dispatch bar (workspace · mission · Hold-to-talk · Start/Stop) ─┤
├─ Metric strip: Needs You | Running | Upcoming | Recent ─────────┤
├─ Cards (overview)          │  Depth panel (selected / active)  ─┤
│  [+] Launch New Agent      │  Title · status · dir · detail    │
│  [card] EXECUTING …        │  Task checklist (live)            │
│  [card] COMPLETE …         │  LIVE LOGS (scroll)               │
│                            │  Retry / Terminate / Archive      │
├─ Footer: Engine · model/context if known · shortcuts ───────────┤
└─────────────────────────────────────────────────────────────────┘
```

Empty state stays ADR-0003: **"All quiet"**, never an incomplete-source error.

## Visual contract

- **Theme default:** dark canvas (`#090D16` / surface `#0F172A` family) aligned with stitch dark Mission Control; light theme tokens remain via existing `theme.css`.
- **Accent:** sky/cyan for primary actions and active borders; rose for failed/needs-you; amber for blocked; emerald for done/live.
- **Type:** UI sans from current stack; mono (JetBrains Mono or system mono) for paths, IDs, logs, diagnostics.
- **Cards:** interaction containers only (mission tiles + Launch). No decorative card chrome in the header/hero.
- **Density:** TUI-inspired *information*, not TUI chrome (no Alt+ shortcut maze in v1 of this pass).

## Interaction rules

1. **Launch:** `[+] Launch New Agent` or dispatch Start → optional Review Plan modal → Accept & Launch (existing bridge `acceptPlan` flow).
2. **Direct Start:** dispatch Start without Review when user chooses “Start mission” (plan+execute); Review remains available via Generate Tasks / Launch modal.
3. **Select card:** opens depth panel (prefer sticky split over full-screen modal when width allows; modal fallback on narrow).
4. **Active mission:** depth panel auto-focuses the running card; checklist + logs update from ledger subscription (no fake streams).
5. **Failure:** show `detail` / diagnostic text in the depth panel terminal block; Retry / Archive actions stay in the panel footer.
6. **Viewport:** tab pane scrolls the Operations page; card grid must not sit in a flex-shrunk strip. Depth actions (Retry / Archive / Terminate) sit under the panel header; panel body scrolls under a viewport `max-height`.

## Must surface (parity with TUI intent)

| Signal | Source today | UI target |
|--------|--------------|-----------|
| Mission + task status | Ledger rows | Cards + checklist |
| Failure reason | `LedgerEntry.detail` | Depth diagnostics (was missing) |
| Live task events | Bridge `task-status` → ledger | Checklist + log lines |
| Workspace | Mission / history | Dispatch bar + card meta |
| Roles / models | Roles tab + `.vibes/config.json` | Keep Roles; footer may show active model when known |
| Engine health | Child spawn / stop | Footer LIVE / offline |

Out of scope for this pass: full TUI Settings parity (YOLO, swarm, triage interval), chat transcript pane, system htop pane, keyboard Alt+ view switching.

## Voice (locked 2026-10-20; revised same day)

- **Default STT:** in-app Whisper ONNX (`@huggingface/transformers`) — downloads on first hold-to-talk and caches (ZeroG Terminal behaviour). No pip/yapsnap required.
- **Optional STT:** OpenAI-compatible server (qwen3-asr) or legacy yapsnap CLI.
- **TTS (later):** Agent Voice daemon HTTP announce; not embedded MCP.

## Success criteria

- User can answer “what is it doing / why did it fail / what finished?” without opening DevTools.
- Card overview remains scannable for multi-mission history.
- Depth panel never invents logs; empty log = honest empty state.
- V0: tests + typecheck; V1 if new IPC; V3: run a live mission and watch checklist + logs update.

## Reference sources (local)

| Source | Path | Use for Hybrid C |
|--------|------|------------------|
| Wayland Mission Control | `C:\Users\steph\Documents\development\wayland\src\renderer\pages\mission-control\` | Grouping, status accents, empty-state copy, pagination patterns already partially ported |
| Wayland roles plan docs | `wayland\docs\` (local-first-roles / mission-control where present) | Provenance only — do not pull Core/socket.io |
| Vibes TUI | HappyMonkeyAI/vibes | Which signals matter (tasks, detail, telemetry) |
| Stitch + this mock | `.planning/hybrid-c/mockups/hybrid-c/` | Layout target |

Port patterns and CSS tokens selectively; keep ADR-0001 thin control plane (Vibes MCP child, not Wayland engine).

## Rejected alternatives

- **A — Full Mission Control list-only:** drops the stitch card workflow users already learned.
- **B — Cards-only polish:** keeps the awareness gap vs TUI.
- **Embed TUI in Electron:** violates ADR-0001 thin control plane.
