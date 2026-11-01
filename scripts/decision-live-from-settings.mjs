/**
 * T62 helper: run decision-shadow e2e using Settings Decision URL + decrypted bearer.
 * Does not print the token. Usage:
 *   npx electron scripts/decision-live-from-settings.mjs
 */
import { app, safeStorage } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

app.setPath('userData', path.join(app.getPath('appData'), 'vibes-desktop'));

app.whenReady().then(async () => {
  const file = path.join(app.getPath('userData'), 'settings.json');
  if (!existsSync(file)) {
    console.error('No settings.json — configure Decision in the app first.');
    app.exit(1);
    return;
  }
  let raw = {};
  try {
    raw = JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    console.error('Corrupt settings.json');
    app.exit(1);
    return;
  }
  const url = typeof raw.decisionMcpUrl === 'string' ? raw.decisionMcpUrl.trim() : '';
  const enc = typeof raw.decisionMcpAuthTokenEnc === 'string' ? raw.decisionMcpAuthTokenEnc.trim() : '';
  if (!url || !enc) {
    console.error('Settings Decision URL or token missing.');
    app.exit(1);
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    console.error('safeStorage unavailable');
    app.exit(1);
    return;
  }
  let token = '';
  try {
    token = safeStorage.decryptString(Buffer.from(enc, 'base64')).trim();
  } catch (error) {
    console.error('Could not decrypt Decision token:', error instanceof Error ? error.message : error);
    app.exit(1);
    return;
  }
  if (!token) {
    console.error('Decrypted Decision token empty.');
    app.exit(1);
    return;
  }

  console.log(`Decision URL: ${url}`);
  console.log(`Token: ready (${token.length} chars, not printed)`);
  console.log(`Token looks like sk-unsloth: ${token.startsWith('sk-unsloth')}`);

  async function mcp(body, sid) {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    };
    if (sid) headers['mcp-session-id'] = sid;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await res.text();
    const next = res.headers.get('mcp-session-id') || sid;
    let payload = null;
    if (text.includes('data:')) {
      const last = [...text.split(/\r?\n/).filter((l) => l.startsWith('data:'))].at(-1)?.slice(5).trim();
      if (last && last !== '[DONE]') {
        try {
          payload = JSON.parse(last);
        } catch {
          /* ignore */
        }
      }
    } else {
      try {
        payload = JSON.parse(text);
      } catch {
        /* ignore */
      }
    }
    return { status: res.status, sid: next, payload, text: text.slice(0, 600) };
  }

  try {
    const init = await mcp({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'decision-live-from-settings', version: '0.1.0' },
      },
    });
    console.log(`initialize status=${init.status} session=${Boolean(init.sid)}`);
    if (init.status === 401 || init.status === 403) {
      console.error('Auth rejected — update Settings Decision with a Studio sk-unsloth… key.');
      app.exit(1);
      return;
    }
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        ...(init.sid ? { 'mcp-session-id': init.sid } : {}),
      },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }),
    }).catch(() => undefined);

    const call = await mcp(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'system_one',
          arguments: {
            state: { symptom: 'css_orphan', open_question: 'escalate or continue?' },
            questions: {
              action: {
                type: 'choice',
                instructions: 'Mission triage: intervene vs continue',
                criteria: {
                  continue: 'Keep executing; no operator needed yet',
                  escalate: 'Ask the operator / open intervention',
                  skip: 'Skip the blocked work and move on',
                },
              },
            },
          },
        },
      },
      init.sid,
    );
    const err =
      call.payload?.error?.message ||
      call.payload?.result?.structuredContent?.detail ||
      (call.payload?.result?.isError ? call.text : null);
    console.log(`system_one status=${call.status} err=${err || 'none'}`);
    if (err) {
      console.error('system_one failed — fix Settings Decision token, then re-run.');
      app.exit(1);
      return;
    }
  } catch (error) {
    console.error('Probe failed:', error instanceof Error ? error.message : error);
    app.exit(1);
    return;
  }

  const env = {
    ...process.env,
    KEV_MCP_URL: url,
    KEV_MCP_AUTH_TOKEN: token,
    UNSLOTH_API_KEY: token,
    VIBES_DECISION_LIVE: '1',
  };
  delete env.ELECTRON_RUN_AS_NODE;

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npmCmd, ['run', 'test:decision-live'], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell: true,
  });
  app.exit(result.status ?? 1);
});
