/**
 * One-shot: write Decision MCP URL + bearer into userData settings.json
 * using Electron safeStorage (same cipher as Settings tab).
 *
 *   node_modules/.bin/electron scripts/set-decision-settings.mjs
 *
 * Env:
 *   KEV_MCP_URL (required)
 *   KEV_MCP_AUTH_TOKEN (required)
 */
import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const url = (process.env.KEV_MCP_URL ?? '').trim();
const token = (process.env.KEV_MCP_AUTH_TOKEN ?? '').trim();
if (!url || !token) {
  console.error('Set KEV_MCP_URL and KEV_MCP_AUTH_TOKEN');
  app.exit(1);
}

// Match packaged/dev app folder (bare `electron` defaults to Roaming/Electron).
app.setPath('userData', path.join(app.getPath('appData'), 'vibes-desktop'));

app.whenReady().then(() => {
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('safeStorage encryption unavailable');
    app.exit(1);
    return;
  }
  const dir = app.getPath('userData');
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'settings.json');
  let raw = {};
  if (existsSync(file)) {
    try {
      raw = JSON.parse(readFileSync(file, 'utf-8'));
    } catch {
      raw = {};
    }
  }
  raw.decisionMcpUrl = url;
  raw.decisionMcpAuthTokenEnc = safeStorage.encryptString(token).toString('base64');
  writeFileSync(file, JSON.stringify(raw, null, 2) + '\n', 'utf-8');
  console.log(`Wrote Decision MCP settings → ${file}`);
  console.log(`URL: ${url}`);
  console.log('Token: stored (encrypted)');
  app.exit(0);
});
