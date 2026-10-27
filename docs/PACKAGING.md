# Packaging & release (Windows)

Closed-beta installers are **unsigned** NSIS builds. Public beta should ship a signed `Vibes Desktop Setup <version>.exe`.

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

## Code signing (public beta)

Unsigned installers trigger SmartScreen / “unknown publisher”. To sign:

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

3. electron-builder signs the exe when `CSC_LINK` / `WIN_CSC_LINK` is present. Without it, the build still succeeds (`forceCodeSigning` is off) for closed beta. Do not put `signingHashAlgorithms` under `build.win` on electron-builder 26 — that field belongs to the signtool options object and fails schema validation.

Optional: `publisherName` in `package.json` → `build.win` should match the cert subject once you sign for real.

## SmartScreen

After first public signed releases, Microsoft may still warn until reputation builds. Prefer an EV cert or established publisher for faster trust.

## Verify a build

- Install on a clean Windows user profile.
- First-run wizard → Vibes path + default model ([BETA.md](BETA.md)).
- Start a trivial mission against a local LLM.
- Optional: Decision MCP → Needs You when Unsloth/KEV is on the LAN.

## Related

- Feature map: [FEATURES.md](FEATURES.md)
- Operator setup: [BETA.md](BETA.md)
- Changelog: [../CHANGELOG.md](../CHANGELOG.md)
