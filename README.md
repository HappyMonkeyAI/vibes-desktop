# Vibes Desktop

A focused desktop app for orchestrating [Vibes](https://github.com/HappyMonkeyAI/vibes) missions: voice input, live activity log, and a mission control UI — without the rest of Wayland.

Built from three proven parts:

- **Mission Control UI** (React + Arco) ported from the FerroxLabs wayland fork's `docs/local-first-roles-plan` work
- **VibesBridge** pattern (MCP server as JSON-RPC child process) ported from [vibes-dashboard](https://github.com/HappyMonkeyAI/vibes-dashboard)
- **Offline voice input** via [yapsnap](https://github.com/kouhxp/yapsnap) CPU transcription

## Quick Start

**Operators (installer):** install `Vibes Desktop Setup <version>.exe`, then follow [docs/BETA.md](docs/BETA.md) — you bring a [Vibes](https://github.com/HappyMonkeyAI/vibes) checkout and a local LLM (LM Studio / Ollama). Unsigned builds may need SmartScreen **More info → Run anyway** ([docs/PACKAGING.md](docs/PACKAGING.md)).

**From source:**

```bash
npm install
npm run dev        # electron + vite dev server
npm test           # vitest
npm run typecheck
npm run dist       # Windows NSIS installer → dist/
```

Requires Node 22+, a Vibes checkout containing `src/mcp/server.ts` (first-run wizard, Settings → Vibes path, or `VIBES_PATH`). Voice default is in-app Whisper (downloads on first talk); optional ASR server or legacy yapsnap + ffmpeg.

## Version

Current app version: **0.1.1** (`package.json`). User-facing release notes: [CHANGELOG.md](CHANGELOG.md). Feature map: [docs/FEATURES.md](docs/FEATURES.md). Beta setup: [docs/BETA.md](docs/BETA.md).

Bump `package.json` `version` when cutting a release; add a matching `CHANGELOG.md` section the same day; follow [docs/PACKAGING.md](docs/PACKAGING.md). Session detail stays in `PROGRESS.md` — do not duplicate full narrative into the changelog.

## Documentation Spine

- [CHANGELOG.md](CHANGELOG.md) — released versions
- [docs/FEATURES.md](docs/FEATURES.md) — operator feature map
- [CONTEXT.md](CONTEXT.md) — stack, rules, what not to do
- [AGENTS.md](AGENTS.md) — agent behavior law
- [SPEC.md](SPEC.md) — acceptance criteria (S1–S8)
- [PLAN.md](PLAN.md) — architecture and phases
- [TASKS.md](TASKS.md) — task board
- [MCP.md](MCP.md) — intent → service routing
- [PROGRESS.md](PROGRESS.md) — session log
- [docs/adr/](docs/adr/) — decision records
- `.agent/memories/` — long-term memory (LTM)

## License

[MIT](LICENSE) © Stephen Phillips
