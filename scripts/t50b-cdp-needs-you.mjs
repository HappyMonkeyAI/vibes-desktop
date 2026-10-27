/**
 * T50b live UI driver via Chromium DevTools Protocol.
 * App must be running with: --remote-debugging-port=9223
 *
 *   node scripts/t50b-cdp-needs-you.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CDP = process.env.CDP_URL || 'http://127.0.0.1:9223';
const WORKSPACE = process.env.T50B_WORKSPACE || 'C:\\Users\\steph\\Documents\\development\\test';
const LEDGER = path.join(process.env.APPDATA || '', 'vibes-desktop', 'ledger.jsonl');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const requestFile = path.join(HERE, 't50b-request.txt');
const REQUEST = (
  process.env.T50B_REQUEST
  || (existsSync(requestFile) ? readFileSync(requestFile, 'utf-8') : '')
  || 'T50b Needs-You drill'
).trim();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class CdpSession {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'evaluate failed');
    }
    return result.result?.value;
  }

  close() {
    this.ws?.close();
  }
}

/** Latest row per id (JSONL is append-only upserts). */
function readLedgerLatest() {
  if (!existsSync(LEDGER)) return [];
  const byId = new Map();
  for (const line of readFileSync(LEDGER, 'utf-8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line);
      if (row?.id) byId.set(row.id, row);
    } catch {
      /* skip */
    }
  }
  return [...byId.values()];
}

function isT50bMission(e, title) {
  return e.kind === 'mission'
    && (e.title === title || (typeof e.title === 'string' && e.title.includes('T50b')));
}

function newest(matches) {
  return matches
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
}

function findNeedsYou(entries, title) {
  const exact = entries.filter((e) => e.kind === 'mission' && e.title === title && e.needsHuman);
  if (exact.length) return newest(exact);
  return newest(entries.filter((e) => isT50bMission(e, title) && e.needsHuman));
}

function findMission(entries, title) {
  const exact = entries.filter((e) => e.kind === 'mission' && e.title === title);
  if (exact.length) return newest(exact);
  return newest(entries.filter((e) => isT50bMission(e, title)));
}

async function main() {
  const pages = await (await fetch(`${CDP}/json`)).json();
  const page = pages.find((p) => p.title === 'Vibes Desktop') || pages[0];
  if (!page?.webSocketDebuggerUrl) throw new Error('No CDP page');

  const cdp = new CdpSession(page.webSocketDebuggerUrl);
  await cdp.connect();
  console.log('CDP connected');

  // Prefer Operations tab so Needs-You depth actions are visible.
  await cdp.evaluate(`(() => {
    const tabs = [...document.querySelectorAll('button, [role="tab"], .arco-tabs-header-title, .arco-tabs-tab')];
    const ops = tabs.find((el) => /operations|mission control/i.test(el.textContent || ''));
    if (ops) ops.click();
    return ops ? (ops.textContent || '').trim() : 'no-ops-tab';
  })()`);
  await sleep(400);

  // Start via the same preload bridge the UI uses (workspace Select is history-only).
  const started = await cdp.evaluate(`(async () => {
    const api = window.vibesDesktop;
    if (!api?.mission?.start) return { ok: false, error: 'vibesDesktop.mission.start missing' };
    try {
      await api.workspace.history.save(${JSON.stringify(WORKSPACE)});
    } catch (_) { /* optional */ }
    const result = await api.mission.start({
      request: ${JSON.stringify(REQUEST)},
      workspaceRoot: ${JSON.stringify(WORKSPACE)},
    });
    return { ok: Boolean(result?.started), result };
  })()`);
  console.log('start', JSON.stringify(started));
  if (!started.ok) {
    throw new Error(`mission.start failed: ${JSON.stringify(started)}`);
  }

  const activeMissionId = started.result?.missionId;
  console.log('tracking missionId', activeMissionId);
  const deadline = Date.now() + 12 * 60_000;
  let needs = null;
  while (Date.now() < deadline) {
    const entries = readLedgerLatest();
    const scoped = activeMissionId
      ? entries.filter((e) => e.missionId === activeMissionId)
      : entries;
    needs = scoped.find((e) => e.kind === 'mission' && e.needsHuman)
      || findNeedsYou(scoped, REQUEST);
    if (needs) {
      console.log('Needs You row:', {
        title: needs.title,
        status: needs.status,
        detail: needs.detail,
        missionId: needs.missionId,
      });
      break;
    }
    const mission = scoped.find((e) => e.kind === 'mission') || findMission(entries, REQUEST);
    if (
      mission
      && mission.missionId === activeMissionId
      && (mission.status === 'done' || mission.status === 'failed')
      && !mission.needsHuman
    ) {
      cdp.close();
      throw new Error(`Mission ended without Needs You: ${mission.status} ${mission.detail || ''}`);
    }
    console.log(
      'waiting…',
      mission?.status || 'no-row',
      'id=',
      (mission?.missionId || '').slice(0, 8),
      'needsHuman=',
      mission?.needsHuman,
    );
    await sleep(5000);
  }
  if (!needs) {
    cdp.close();
    throw new Error('Timed out waiting for Needs You (Decision escalate)');
  }

  // Select the mission card so the depth-panel Needs-You banner mounts.
  await cdp.evaluate(`(() => {
    const needle = ${JSON.stringify((needs.title || '').slice(0, 40))};
    const cards = [...document.querySelectorAll('[class*="card"], article, li, button, div')];
    const hit = cards.find((el) => (el.textContent || '').includes(needle) && (el.textContent || '').length < 800);
    if (hit) hit.click();
    return Boolean(hit);
  })()`);
  await sleep(800);

  // Prefer the Needs-You banner actions (not "Retry mission").
  const resolveClick = await cdp.evaluate(`(() => {
    const region = document.querySelector('[aria-label="Needs you"]');
    const scope = region || document;
    const buttons = [...scope.querySelectorAll('button')];
    const skip = buttons.find((b) => /Skip step/i.test((b.textContent || '').trim()));
    const retry = buttons.find((b) => /Retry step/i.test((b.textContent || '').trim()));
    const fail = buttons.find((b) => /Fail mission/i.test((b.textContent || '').trim()));
    const target = skip || retry || fail;
    if (!target) {
      const all = [...document.querySelectorAll('button')].map((b) => (b.textContent || '').trim()).filter(Boolean);
      return { ok: false, labels: all.slice(0, 50) };
    }
    target.click();
    return { ok: true, clicked: (target.textContent || '').trim() };
  })()`);
  console.log('resolve UI', resolveClick);

  // Also call the bridge directly so we clear intervention even if the card
  // wasn't selected (UI click is still the primary T50b evidence when ok).
  if (!resolveClick.ok) {
    const viaApi = await cdp.evaluate(`(async () => {
      const r = await window.vibesDesktop.mission.resolveIntervention({ action: 'skip' });
      return r;
    })()`);
    console.log('resolve API fallback', viaApi);
    if (!viaApi?.ok) throw new Error('No Skip step / Retry step / Fail mission control');
  }

  await sleep(2500);
  const after = readLedgerLatest();
  const row = after.find((e) => e.id === needs.id)
    || after.find((e) => e.missionId === needs.missionId && e.kind === 'mission');
  console.log('after resolve:', { status: row?.status, needsHuman: row?.needsHuman, detail: row?.detail });
  if (row?.needsHuman) {
    // One more API resolve if UI click didn't bind to the active bridge.
    const viaApi = await cdp.evaluate(`(async () => {
      return window.vibesDesktop.mission.resolveIntervention({ action: 'skip' });
    })()`);
    console.log('resolve API retry', viaApi);
    await sleep(1500);
    const again = readLedgerLatest().find((e) => e.id === needs.id);
    console.log('after API:', { status: again?.status, needsHuman: again?.needsHuman });
    if (again?.needsHuman) throw new Error('needsHuman still set after resolve');
  }

  cdp.close();
  console.log('T50b PASS');
}

main().catch((err) => {
  console.error('T50b FAIL:', err.message || err);
  process.exit(1);
});
