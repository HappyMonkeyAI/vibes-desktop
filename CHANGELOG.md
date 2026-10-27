# Changelog

All notable changes to Vibes Desktop are recorded here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/) — `MAJOR.MINOR.PATCH` while pre-1.0 (`0.y.z` may still break APIs).

## [Unreleased]

### Added

- First-run setup wizard (Vibes path → default model → Operations tip); `setupComplete` in settings (T60).
- [docs/PACKAGING.md](docs/PACKAGING.md): dist cadence, SmartScreen, `CSC_*` / `WIN_CSC_LINK` signing for public beta (T61).

### Changed

- Installer metadata: author, homepage, repository, copyright; NSIS artifact `Vibes Desktop Setup <version>.exe`; `forceCodeSigning: false` until a cert is configured.

## [0.1.1] — 2026-10-27

Closed-beta cut: Roles/Runtime parity with high-value TUI knobs, Decision/Needs You reliability, Windows installer. **Requires** a Vibes checkout + local OpenAI-compatible LLM — see [docs/BETA.md](docs/BETA.md).

### Added

- Roles cards: per-role **context window** (tokens); executor/default → vibes `CONTEXT_WINDOW` (T55).
- Settings → **Runtime**: `MAX_STEPS`, `MAX_CONCURRENT_TASKS`, `YOLO_MODE`, `THINKING_MODE`, `CONTEXT_COMPACTION_ENABLED`, `SMALL_MODEL_PROFILE` (T56).
- Runtime II: triage observer (`TRIAGE_*`) + `MEMORY_ENABLED` / `LOCAL_MEMORY` (T57).
- Closed beta setup guide: [docs/BETA.md](docs/BETA.md).

### Fixed

- Vibes intervene gate calls Unsloth `system_one` (was `kev_evaluate`-only), so Decision escalate can open Needs You against Studio `:8888`.
- Completion-gate rejects (Owner / incomplete) open Needs You via Decision + `intervention_required`.
- Resolving intervention clears `needsHuman` on task rows as well as the mission card.
- Scheduler soft-requeue race that left missions stuck `in_progress` / `Completed 0/1` (T52, vibes).

### Changed

- Decision intervene gate escalates auto continue/skip when System One reports `confidence` below 0.35 (T54).

## [0.1.0] — 2026-10-22

First feature cut after the Electron scaffold (`0.0.1`). Mission Control, Chat, Decision intervene, and voice announce are usable end-to-end against a local Vibes checkout + LAN LLM / Unsloth Decision.

### Added

- **Mission Control (Hybrid C):** dispatch bar, metric strip (Needs You / Running / Upcoming / Recent), card grid, depth panel with checklist + live logs, Retry / Terminate / Archive.
- **Chat tab:** plan → auto-launch → ledger summary; mid-run steer; follow-up queue with Pause / Resume / Clear.
- **Needs You:** Decision escalate / triage / task-fail → ledger `needsHuman`; Retry step / Skip / Fail → `resolve_intervention`.
- **Decision (KEV / Unsloth):** Settings MCP URL + bearer; child env + `.vibes` config; tools `system_one` (Unsloth Studio) and `kev_evaluate` (classic KEV).
- **Harness lessons:** post-failure `.vibes/harness-lesson.json` (v2 helped/failed/harnessClass) seeded into Retry.
- **Mission MCP registry:** Settings → HTML Design Advisor → workspace `.vibes/mcp.json` on spawn.
- **Completion gates (vibes + desktop):** soft-pass malformed Owner FAIL; optional double-check completion.
- **Agent Voice announce:** soft TTS on mission done/failed via daemon URL.
- **Voice settings:** builtin Whisper / server ASR / yapsnap; doctor + warm.
- **Roles + encrypted keys;** test-connection probe; `.vibes/config.json` writer.
- **Windows NSIS installer** via electron-builder.

### Changed

- Default Mission Control theme is dark (Stitch sky accent); light toggle retained.
- Decision client prefers `system_one` for Unsloth (`:8888` / unsloth hostnames), else `kev_evaluate`.

### Docs

- Operator feature map: [docs/FEATURES.md](docs/FEATURES.md).
- Session log remains [PROGRESS.md](PROGRESS.md); task board [TASKS.md](TASKS.md).

## [0.0.1] — 2026-10-13

### Added

- Electron three-process skeleton (main / preload / renderer), JSON-RPC VibesBridge, ledger store, Roles, voice mic → yapsnap, stop/cancel + single-mission guard, first Windows installer.

[Unreleased]: https://github.com/SPhillips1337/vibes-desktop/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/SPhillips1337/vibes-desktop/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/SPhillips1337/vibes-desktop/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/SPhillips1337/vibes-desktop/releases/tag/v0.0.1
