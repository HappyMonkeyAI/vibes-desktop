# Vibes Desktop

A focused desktop app for orchestrating [Vibes](https://github.com/HappyMonkeyAI/vibes) missions: voice input, live activity log, and a mission control UI — without the rest of Wayland.

Built from three proven parts:

- **Mission Control UI** (React + Arco) ported from the FerroxLabs wayland fork's `docs/local-first-roles-plan` work
- **VibesBridge** pattern (MCP server as JSON-RPC child process) ported from [vibes-dashboard](https://github.com/HappyMonkeyAI/vibes-dashboard)
- **Offline voice input** via [yapsnap](https://github.com/kouhxp/yapsnap) CPU transcription

## Quick Start

```bash
npm install
npm run dev        # electron + vite dev server
npm test           # vitest
npm run typecheck
npm run build      # electron-builder distributable
```

Requires Node 22+, a Vibes checkout or the `vibes-tui` npm package (the app spawns its MCP server), and for voice: ffmpeg on PATH plus `pip install yapsnap`.

## Documentation Spine

- [CONTEXT.md](CONTEXT.md) — stack, rules, what not to do
- [AGENTS.md](AGENTS.md) — agent behavior law
- [SPEC.md](SPEC.md) — acceptance criteria (S1–S8)
- [PLAN.md](PLAN.md) — architecture and phases
- [TASKS.md](TASKS.md) — task board
- [MCP.md](MCP.md) — intent → service routing
- [PROGRESS.md](PROGRESS.md) — session log
- [docs/adr/](docs/adr/) — decision records
- `.agent/memories/` — long-term memory (LTM)
