import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LedgerStore } from '../src/main/ledger/store';
import { createMissionService, type MissionService } from '../src/main/mission/service';
import { writeVibesConfig } from '../src/main/roles/config-writer';
import type { RolesConfigInput } from '@shared/channels';

/**
 * V3 live smoke — spawns the REAL vibes MCP child against a REAL local LLM.
 * Gated behind VIBES_LIVE=1 so the default `npm test` stays hermetic:
 *
 *   VIBES_LIVE=1 npm test -- tests/live-mission.e2e.test.ts
 *
 * Proves the false-done fix end-to-end: a bare-origin endpoint (no /v1) must
 * normalize, plan, execute, and produce an honest 'done' with a real file on
 * disk — and a dead model must produce 'failed', never 'done'.
 */

// Defaults target a local OpenAI-compatible host (LM Studio / Ollama). Override via env for LAN boxes.
const EXECUTOR_ORIGIN = (process.env.VIBES_LIVE_EXECUTOR_URL ?? 'http://127.0.0.1:1234').replace(/\/$/, ''); // WITHOUT /v1 — writer appends it
const EXECUTOR_MODEL = process.env.VIBES_LIVE_EXECUTOR_MODEL ?? 'google/gemma-4-e2b';
const REVIEWER_BASE = (process.env.VIBES_LIVE_REVIEWER_URL ?? 'http://127.0.0.1:1234/v1').replace(/\/$/, '');
const REVIEWER_MODEL = process.env.VIBES_LIVE_REVIEWER_MODEL ?? 'google/gemma-4-e2b';
const VIBES_CHECKOUT = process.env.VIBES_PATH || 'C:/Users/steph/Documents/development/vibes';

const MISSION_TIMEOUT_MS = 8 * 60_000;

function createLiveService(store: LedgerStore, userDataPath: string): MissionService {
  return createMissionService({
    store,
    vibesPath: () => VIBES_CHECKOUT,
    userDataPath,
  });
}

function makeWorkspace(input: RolesConfigInput, extras: Record<string, string> = {}): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'vibes-live-'));
  writeVibesConfig(dir, input);
  // Minimize child side-features (memory/codex/hooks) that aren't under test.
  const configPath = path.join(dir, '.vibes', 'config.json');
  const current = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, string>;
  Object.assign(current, { MEMORY_ENABLED: 'false', CODEX_ENABLED: 'false', AGENT_HOOKS: 'false' }, extras);
  writeFileSync(configPath, JSON.stringify(current, null, 2), 'utf-8');
  return dir;
}

function executorOnly(): RolesConfigInput {
  // Bare origin on purpose: writeVibesConfig must append /v1 (the URL bug
  // that made every mission 404-and-"done" in milliseconds).
  return {
    default: { baseUrl: EXECUTOR_ORIGIN, model: EXECUTOR_MODEL, apiKey: '' },
    planner: { baseUrl: '', model: '', apiKey: '' },
    executor: { baseUrl: '', model: '', apiKey: '' },
    reviewer: { baseUrl: '', model: '', apiKey: '' },
    triage: { baseUrl: '', model: '', apiKey: '' },
  };
}

async function waitForMissionRow(store: LedgerStore, request: string, timeoutMs: number): Promise<{ status: string; detail?: string }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const snap = await store.snapshot();
    const row = snap.entries.find((e) => e.title === request && e.kind === 'mission');
    if (row && (row.status === 'done' || row.status === 'failed')) return row;
    if (Date.now() > deadline) throw new Error(`mission row never reached a terminal status (last: ${row?.status ?? 'absent'})`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

describe.runIf(process.env.VIBES_LIVE === '1')('live mission smoke (real child + real LLM)', () => {
  beforeAll(async () => {
    // Preflight: fail fast with a clear message instead of a 10-minute timeout.
    for (const url of [`${EXECUTOR_ORIGIN}/v1/models`, `${REVIEWER_BASE}/models`]) {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) }).catch((e) => {
        throw new Error(`endpoint unreachable: ${url} — ${e.message}`);
      });
      expect(res.ok, `endpoint ${url} responded ${res.status}`).toBe(true);
    }
  }, 20_000);

  it(
    'plans, executes, and honestly records done for a real file change (bare origin, no /v1)',
    async () => {
      const workspace = makeWorkspace(executorOnly());
      const store = new LedgerStore(workspace);
      let service: MissionService | null = null;
      try {
        service = createLiveService(store, workspace);
        const request = 'Create a file named hello.txt that contains exactly the word bonjour';
        const result = await service.startMission({ request, workspaceRoot: workspace });
        expect(result.error).toBeUndefined();
        expect(result.started).toBe(true);

        const row = await waitForMissionRow(store, request, MISSION_TIMEOUT_MS);
        expect(row.detail, `mission failed: ${row.detail}`).toContain('Mission completed');
        expect(row.status).toBe('done');

        const file = path.join(workspace, 'hello.txt');
        expect(existsSync(file), 'hello.txt must exist on disk — done means work happened').toBe(true);
        expect(readFileSync(file, 'utf-8')).toContain('bonjour');
      } finally {
        await service?.stopMission().catch(() => undefined);
        try { rmSync(workspace, { recursive: true, force: true }); } catch { /* Windows may hold handles briefly */ }
      }
    },
    MISSION_TIMEOUT_MS + 60_000,
  );

  it(
    'records FAILED (not done) when the model does not exist',
    async () => {
      const workspace = makeWorkspace(
        { ...executorOnly(), default: { baseUrl: EXECUTOR_ORIGIN, model: 'definitely-not-a-real-model-xyz', apiKey: '' } },
      );
      const store = new LedgerStore(workspace);
      let service: MissionService | null = null;
      try {
        service = createLiveService(store, workspace);
        const request = 'Create a file named nope.txt with the word test';
        const result = await service.startMission({ request, workspaceRoot: workspace });
        // Ollama often fails at start; LM Studio may accept the id then fail mid-run.
        // Either way: never a silent done, and the file must not appear.
        if (!result.started) {
          expect(result.error).toBeTruthy();
          const snap = await store.snapshot();
          const row = snap.entries.find((e) => e.title === request && e.kind === 'mission');
          expect(row?.status).toBe('failed');
          expect(row?.detail).toBeTruthy();
        } else {
          const row = await waitForMissionRow(store, request, MISSION_TIMEOUT_MS);
          expect(row.status).toBe('failed');
          expect(row.detail).toBeTruthy();
        }
        expect(existsSync(path.join(workspace, 'nope.txt'))).toBe(false);
      } finally {
        await service?.stopMission().catch(() => undefined);
        try { rmSync(workspace, { recursive: true, force: true }); } catch { /* Windows may hold handles briefly */ }
      }
    },
    MISSION_TIMEOUT_MS + 60_000,
  );

  it(
    'completes with a configured reviewer on a second endpoint (ENABLE_REVIEWER=true path)',
    async () => {
      const workspace = makeWorkspace(
        {
          ...executorOnly(),
          reviewer: { baseUrl: REVIEWER_BASE, model: REVIEWER_MODEL, apiKey: '' },
        },
        // Isolate the reviewer-task path from the final adversarial audit.
        { ENABLE_ADVERSARIAL_AUDIT: 'false' },
      );
      const store = new LedgerStore(workspace);
      let service: MissionService | null = null;
      try {
        service = createLiveService(store, workspace);
        const request = 'Create a file named note.txt that contains exactly the word aloha';
        const result = await service.startMission({ request, workspaceRoot: workspace });
        expect(result.error).toBeUndefined();
        expect(result.started).toBe(true);

        const row = await waitForMissionRow(store, request, MISSION_TIMEOUT_MS);
        expect(row.detail, `mission failed: ${row.detail}`).toContain('Mission completed');
        expect(row.status).toBe('done');

        const file = path.join(workspace, 'note.txt');
        expect(existsSync(file), 'note.txt must exist on disk').toBe(true);
        expect(readFileSync(file, 'utf-8')).toContain('aloha');
      } finally {
        await service?.stopMission().catch(() => undefined);
        try { rmSync(workspace, { recursive: true, force: true }); } catch { /* Windows may hold handles briefly */ }
      }
    },
    MISSION_TIMEOUT_MS + 60_000,
  );
});
