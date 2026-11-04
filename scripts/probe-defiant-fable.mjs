/**
 * Live probe: Defiant Fable Q6_K on Unsloth Studio :8888.
 * Decrypts Settings Decision bearer (not printed). Usage:
 *   npx electron scripts/probe-defiant-fable.mjs
 */
import { app, safeStorage } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.UNSLOTH_BASE_URL?.trim() || 'http://192.168.5.157:8888/v1';
const MODEL =
  process.env.UNSLOTH_MODEL?.trim()
  || 'Kant0game/Qwen3.5-9B-The-Defiant-Fable-Uncensored-Heretic-NEO-IMATRIX-MAX-MTP-GGUF';

app.setPath('userData', path.join(app.getPath('appData'), 'vibes-desktop'));

function loadToken() {
  if (process.env.UNSLOTH_API_KEY?.trim()) return process.env.UNSLOTH_API_KEY.trim();
  if (process.env.KEV_MCP_AUTH_TOKEN?.trim()) return process.env.KEV_MCP_AUTH_TOKEN.trim();
  const file = path.join(app.getPath('userData'), 'settings.json');
  if (!existsSync(file)) throw new Error('No settings.json and no UNSLOTH_API_KEY');
  const raw = JSON.parse(readFileSync(file, 'utf-8'));
  const enc = typeof raw.decisionMcpAuthTokenEnc === 'string' ? raw.decisionMcpAuthTokenEnc.trim() : '';
  if (!enc) throw new Error('Settings Decision token missing — set UNSLOTH_API_KEY or save Decision in app');
  if (!safeStorage.isEncryptionAvailable()) throw new Error('safeStorage unavailable');
  return safeStorage.decryptString(Buffer.from(enc, 'base64')).trim();
}

async function chat(token, body, label, timeoutMs) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  const ms = Date.now() - t0;
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* keep text */
  }
  const msg = json?.choices?.[0]?.message ?? {};
  const content = typeof msg.content === 'string' ? msg.content : '';
  const reasoning =
    (typeof msg.reasoning_content === 'string' && msg.reasoning_content)
    || (typeof msg.reasoning === 'string' && msg.reasoning)
    || '';
  console.log(`\n=== ${label} ===`);
  console.log(`status=${res.status} elapsed_ms=${ms}`);
  if (!res.ok) {
    console.log(`error: ${text.slice(0, 400)}`);
    return { ok: false, ms };
  }
  console.log(`content_chars=${content.length} reasoning_chars=${reasoning.length}`);
  console.log(`content_preview: ${content.replace(/\s+/g, ' ').slice(0, 180)}`);
  if (reasoning) {
    console.log(`reasoning_preview: ${reasoning.replace(/\s+/g, ' ').slice(0, 180)}`);
  }
  return { ok: true, ms, contentLen: content.length, reasoningLen: reasoning.length };
}

app.whenReady().then(async () => {
  try {
    const token = loadToken();
    console.log(`base=${BASE}`);
    console.log(`model=${MODEL}`);
    console.log(`token ready (${token.length} chars, sk-unsloth=${token.startsWith('sk-unsloth')})`);

    // 1) tiny ping — may cold-load Q6_K
    await chat(
      token,
      {
        model: MODEL,
        messages: [{ role: 'user', content: 'Reply with exactly: pong' }],
        max_tokens: 16,
        temperature: 0.2,
      },
      'ping (cold load ok)',
      180_000,
    );

    // 2) thinking on + medium effort (API kwargs — host may ignore)
    await chat(
      token,
      {
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: '{REASON:medium} In one sentence, what is 17*19? Show only the answer sentence.',
          },
        ],
        max_tokens: 128,
        temperature: 0.3,
        enable_thinking: true,
        reasoning_effort: 'medium',
      },
      'REASON:medium + enable_thinking',
      180_000,
    );

    // 3) Studio-validated effort enum (no Heretic i* / spoon in kwargs)
    await chat(
      token,
      {
        model: MODEL,
        messages: [{ role: 'user', content: 'Name one primary color. One word only.' }],
        max_tokens: 32,
        temperature: 0.2,
        enable_thinking: false,
        reasoning_effort: 'none',
      },
      'API effort=none thinking off',
      120_000,
    );

    // 4) Heretic spoon via chat marker only (kwargs stay Studio-safe)
    await chat(
      token,
      {
        model: MODEL,
        messages: [
          {
            role: 'user',
            content: '{REASON:spoon} In one short sentence: capital of France?',
          },
        ],
        max_tokens: 96,
        temperature: 0.3,
        enable_thinking: true,
        reasoning_effort: 'xhigh',
      },
      'REASON:spoon + API xhigh',
      180_000,
    );

    console.log('\nDone.');
    app.exit(0);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    app.exit(1);
  }
});
