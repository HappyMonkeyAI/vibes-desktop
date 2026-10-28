# Contributing

## Pull requests

- Open PRs against **`main`** (GitHub default branch). Do not use stale feature branches as the base.
- Prefer smallest complete changes; no drive-by refactors.
- Never commit `.env`, API keys, `.pfx` / signing material, or `dist/` artifacts. Use `.env.example` stubs only.

## Local checks

```bash
npm run typecheck
npm test
# optional packaging smoke
npm run dist
```

Operator setup (BYO Vibes + local LLM): [docs/BETA.md](docs/BETA.md). Packaging / SmartScreen: [docs/PACKAGING.md](docs/PACKAGING.md).

## Architecture

Electron three-process separation is law: `src/main/` (no DOM), `src/preload/` (contextBridge only), `src/renderer/` (no Node). See [CONTEXT.md](CONTEXT.md) and [AGENTS.md](AGENTS.md).
