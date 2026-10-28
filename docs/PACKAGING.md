# Packaging & release (Windows)

Installers are NSIS `Vibes Desktop Setup <version>.exe`. **Unsigned** builds are fine for closed beta and early public testers; public beta should ship a **signed** Setup once a code-signing cert is available.

## Build

```bash
npm ci
npm test
npm run typecheck
npm run dist    # → dist/Vibes Desktop Setup <version>.exe + win-unpacked/
```

Requires Node 22+, Windows x64. electron-builder reads `package.json` → `build`.

## Version cadence

1. Bump `package.json` `version` (SemVer; pre-1.0 may still break).
2. Move notes from `[Unreleased]` into `CHANGELOG.md`.
3. `npm run dist`.
4. Tag `vX.Y.Z` and attach the Setup exe to a GitHub Release (see `v0.1.1`).
5. Point testers at [BETA.md](BETA.md).

## Bring-your-own stack (what the installer does *not* include)

The Setup exe is the Electron shell only. Operators still need:

| Piece | Why |
|-------|-----|
| [Vibes](https://github.com/HappyMonkeyAI/vibes) checkout | Child MCP (`src/mcp/server.ts`) — first-run wizard / Settings |
| Local OpenAI-compatible LLM | LM Studio (`:1234`) or Ollama (`:11434`) — Roles / first-run model step |
| Optional Decision MCP | Unsloth Studio `:8888/mcp/` or classic KEV `…/mcp` — Needs You |
| Optional Speech ASR | Builtin Whisper by default; or a local `/v1/audio/transcriptions` server |

Full operator path: [BETA.md](BETA.md).

## Unsigned interim (SmartScreen)

Until `CSC_*` signing is wired, Windows may show **Windows protected your PC** / unknown publisher:

1. Click **More info**.
2. Click **Run anyway**.
3. Prefer distributing the Setup exe over a hash/channel you control (GitHub Release asset), not random mirrors.

This is expected for unsigned NSIS — not a broken build. Signing (below) removes the unknown-publisher class of warnings; reputation may still take a few signed releases.

## Code signing (public beta)

1. Obtain a Windows code-signing certificate (`.pfx` or cloud HSM).
2. Set env before `npm run dist` (do **not** commit secrets):

```bash
# PFX on disk
set CSC_LINK=C:\secure\vibes-desktop.pfx
set CSC_KEY_PASSWORD=…

# Or base64-encoded PFX
set WIN_CSC_LINK=…base64…
set CSC_KEY_PASSWORD=…
```

3. electron-builder signs the exe when `CSC_LINK` / `WIN_CSC_LINK` is present. Without it, the build still succeeds (`forceCodeSigning` is off). Do not put `signingHashAlgorithms` under `build.win` on electron-builder 26 — that field belongs to the signtool options object and fails schema validation.

`build.appId` is `com.stephenphillips.vibesdesktop`. Optional: `publisherName` under `build.win` should match the cert subject once you sign for real.

## SmartScreen after signing

After first public signed releases, Microsoft may still warn until reputation builds. Prefer an EV cert or established publisher for faster trust.

## Verify a build

- Install on a clean Windows user profile (expect SmartScreen if unsigned).
- First-run wizard → Vibes path + default model ([BETA.md](BETA.md)).
- Start a trivial mission against a local LLM.
- Optional: Decision MCP → Needs You when Unsloth/KEV is on the LAN.

## Related

- Feature map: [FEATURES.md](FEATURES.md)
- Operator setup: [BETA.md](BETA.md)
- Changelog: [../CHANGELOG.md](../CHANGELOG.md)
