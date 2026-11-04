/**
 * Live T85 smoke: Defiant Fable Q6_K on Unsloth + tight role-mcp-policy budget.
 * Decrypts Settings Decision bearer (not printed), then runs the live mission e2e.
 *
 *   npx electron scripts/live-t85-defiant.mjs
 */
import { app, safeStorage } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STUDIO = 'http://192.168.5.157:8888';
const MODEL =
  'Kant0game/Qwen3.5-9B-The-Defiant-Fable-Uncensored-Heretic-NEO-IMATRIX-MAX-MTP-GGUF';

app.setPath('userData', path.join(app.getPath('appData'), 'vibes-desktop'));

function loadToken() {
  if (process.env.UNSLOTH_API_KEY?.trim()) return process.env.UNSLOTH_API_KEY.trim();
  const file = path.join(app.getPath('userData'), 'settings.json');
  if (!existsSync(file)) throw new Error('No settings.json — set UNSLOTH_API_KEY or save Decision in app');
  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  const enc = typeof raw.decisionMcpAuthTokenEnc === 'string' ? raw.decisionMcpAuthTokenEnc.trim() : '';
  if (!enc) throw new Error('Settings Decision token missing');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage unavailable');
  return safeStorage.decryptString(Buffer.from(enc, 'base64')).trim();
}

app.whenReady().then(() => {
  try {
    const token = loadToken();
    console.log(`studio=${STUDIO}`);
    console.log(`model=${MODEL}`);
    console.log(`token ready (${token.length} chars, sk-unsloth=${token.startsWith('sk-unsloth')})`);

    const env = {
      ...process.env,
      VIBES_LIVE: '1',
      VIBES_LIVE_EXECUTOR_URL: STUDIO,
      VIBES_LIVE_EXECUTOR_MODEL: MODEL,
      VIBES_LIVE_REVIEWER_URL: `${STUDIO}/v1`,
      VIBES_LIVE_REVIEWER_MODEL: MODEL,
      VIBES_LIVE_API_KEY: token,
      VIBES_LIVE_TOOL_BUDGET: '6',
      VIBES_PATH: process.env.VIBES_PATH || 'C:/Users/steph/Documents/development/vibes',
    };

    const result = spawnSync(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['test', '--', 'tests/live-mission.e2e.test.ts', '-t', 'plans, executes'],
      { cwd: repoRoot, env, encoding: 'utf-8', shell: true },
    );
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    app.exit(result.status === null ? 1 : result.status);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    app.exit(1);
  }
});
