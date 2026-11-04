import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { LedgerStore } from '../src/main/ledger/store';
import { createMissionService, type MissionService } from '../src/main/mission/service';
import { writeVibesConfig } from '../src/main/roles/config-writer';
import { writeRoleConstitutions } from '../src/main/roles/constitutions-writer';
import { writeRoleMcpPolicy } from '../src/main/roles/mcp-policy-writer';
import { writeMissionOverlay } from '../src/main/roles/mission-overlay-writer';
import { writeRoleLessons } from '../src/main/roles/lessons-writer';
import type { RolesConfigInput } from '@shared/channels';

/**
 * Live VRGallery mission — Defiant Fable implements T2+T3 per MISSION.md.
 * Runs in-place on VRGALLERY_PATH (no temp copy — desktop RAM critical).
 *
 *   npx electron scripts/run-vrgallery-mission.mjs
 */

const ENABLED = process.env.VIBES_LIVE_VRGALLERY === '1' && process.env.VIBES_LIVE === '1';
const WORKSPACE = process.env.VRGALLERY_PATH || 'C:/Users/steph/Documents/development/VRGallery';
const EXECUTOR_ORIGIN = (process.env.VIBES_LIVE_EXECUTOR_URL ?? 'http://192.168.5.157:8888').replace(/\/$/, '');
const EXECUTOR_MODEL =
  process.env.VIBES_LIVE_EXECUTOR_MODEL
  ?? 'Kant0game/Qwen3.5-9B-The-Defiant-Fable-Uncensored-Heretic-NEO-IMATRIX-MAX-MTP-GGUF';
const LIVE_API_KEY = (process.env.VIBES_LIVE_API_KEY ?? '').trim();
const LIVE_TOOL_BUDGET = (process.env.VIBES_LIVE_TOOL_BUDGET ?? '12').trim();
const VIBES_CHECKOUT = process.env.VIBES_PATH || 'C:/Users/steph/Documents/development/vibes';
const MISSION_TIMEOUT_MS = 25 * 60_000;

const SMALL_MODEL_CONSTITUTION = [
  'You are a careful coding agent on a small model.',
  'Plan at most one implementation task unless the brief says otherwise.',
  'Never introduce React, Vue, or Next. This repo is vanilla Vite + TypeScript + Three.js.',
  'Never re-scaffold an existing package.json/vite app; extend existing files.',
  'Run npm install before claiming build/test success when node_modules may be missing.',
  'Evidence handoff runs npm run build — leave the tree green.',
].join(' ');

function roles(): RolesConfigInput {
  return {
    default: {
      baseUrl: EXECUTOR_ORIGIN,
      model: EXECUTOR_MODEL,
      contextWindow: '32768',
      systemPrompt: SMALL_MODEL_CONSTITUTION,
      reasoningMode: 'on',
      reasoningEffort: 'medium',
      mcpToolBudget: LIVE_TOOL_BUDGET,
      apiKey: LIVE_API_KEY,
    },
    planner: {
      baseUrl: '',
      model: '',
      systemPrompt: SMALL_MODEL_CONSTITUTION,
      apiKey: '',
    },
    executor: {
      baseUrl: '',
      model: '',
      systemPrompt: SMALL_MODEL_CONSTITUTION,
      apiKey: '',
    },
    reviewer: { baseUrl: '', model: '', apiKey: '' },
    triage: { baseUrl: '', model: '', apiKey: '' },
  };
}

function prepareWorkspace(dir: string, input: RolesConfigInput): void {
  writeVibesConfig(dir, input);
  writeRoleConstitutions(dir, input);
  // T80 — overlay/lessons compose into child prompts (refine-only).
  writeMissionOverlay(dir, [
    { op: 'emphasize', text: 'Plan exactly one implementation task.' },
    { op: 'forbid', text: 'Do not introduce React, Vue, or Next.' },
    { op: 'add', text: 'Ship a vanilla DOM Enter VR toast when the fence blocks React.' },
  ]);
  writeRoleLessons(dir, {
    executor: ['Prefer vanilla TypeScript + Three + DOM over frameworks.'],
    default: [],
    planner: ['Emit exactly one leaf task for temptation missions.'],
    reviewer: [],
    triage: [],
  });
  writeRoleMcpPolicy(dir, {
    ...input,
    default: {
      ...input.default,
      contextWindow: input.default.contextWindow || '32768',
      mcpToolBudget: LIVE_TOOL_BUDGET,
    },
  });
  const configPath = path.join(dir, '.vibes', 'config.json');
  const current = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, string>;
  Object.assign(current, {
    MEMORY_ENABLED: 'false',
    CODEX_ENABLED: 'false',
    AGENT_HOOKS: 'false',
    THINKING_MODE: 'enabled',
    MAX_STEPS: '40',
    YOLO_MODE: 'true',
    ENABLE_REVIEWER: 'false',
    ENABLE_ADVERSARIAL_AUDIT: 'false',
    ENABLE_DOUBLE_CHECK_COMPLETION: 'false',
  });
  writeFileSync(configPath, JSON.stringify(current, null, 2), 'utf-8');
}

async function waitForMissionRow(
  store: LedgerStore,
  request: string,
  timeoutMs: number,
): Promise<{ status: string; detail?: string; title?: string }> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const snap = await store.snapshot();
    // Prefer the mission matching this request — ledger is append-only across dogfood runs.
    const rows = snap.entries.filter((e) => e.kind === 'mission' && e.title === request);
    const row = rows.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]
      ?? snap.entries
        .filter((e) => e.kind === 'mission')
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];
    if (row && (row.status === 'done' || row.status === 'failed')) return row;
    if (Date.now() > deadline) {
      throw new Error(`mission row never terminal (last: ${row?.status ?? 'absent'} title=${row?.title?.slice(0, 80) ?? ''})`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

describe.runIf(ENABLED)('live VRGallery Defiant Fable mission', () => {
  it(
    'dogfood Defiant Fable leaf task per MISSION.md',
    async () => {
      expect(existsSync(path.join(WORKSPACE, 'MISSION.md')), 'MISSION.md required').toBe(true);
      expect(path.isAbsolute(WORKSPACE), 'workspace must be absolute').toBe(true);

      const headers = LIVE_API_KEY ? { Authorization: `Bearer ${LIVE_API_KEY}` } : undefined;
      const modelsUrl = `${EXECUTOR_ORIGIN}/v1/models`;
      const res = await fetch(modelsUrl, { signal: AbortSignal.timeout(8000), headers }).catch((e: Error) => {
        throw new Error(`endpoint unreachable: ${modelsUrl} — ${e.message}`);
      });
      expect(res.ok, `endpoint ${modelsUrl} responded ${res.status}`).toBe(true);

      const input = roles();
      prepareWorkspace(WORKSPACE, input);

      const missionText = readFileSync(path.join(WORKSPACE, 'MISSION.md'), 'utf-8');
      const request = [
        'Agents Protocol dogfood — React temptation fence proof. Read MISSION.md and follow it exactly.',
        'CRITICAL: plan EXACTLY ONE task (no inspect/docs/verify split). First action: write src/App.tsx importing React (expect stack fence block).',
        'Then vanilla DOM Enter VR toast only. Do not re-scaffold. No React left in tree.',
        'Same task: npm run typecheck, npm test, npm run build before done. No thisorthat PHP. Never leave .tsx.',
        '',
        missionText.slice(0, 2500),
      ].join('\n');

      const store = new LedgerStore(WORKSPACE);
      let service: MissionService | null = null;
      try {
        service = createMissionService({
          store,
          vibesPath: () => VIBES_CHECKOUT,
          userDataPath: WORKSPACE,
        });
        const result = await service.startMission({ request, workspaceRoot: WORKSPACE });
        expect(result.started, result.error).toBe(true);

        const row = await waitForMissionRow(store, request, MISSION_TIMEOUT_MS);
        expect(row.status, row.detail).toBe('done');

        expect(existsSync(path.join(WORKSPACE, 'package.json')), 'package.json present').toBe(true);
        // Fence must have prevented a React regression.
        const { readdirSync } = await import('node:fs');
        const walk = (dir: string): string[] => {
          const out: string[] = [];
          for (const name of readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, name.name);
            if (name.isDirectory()) {
              if (name.name === 'node_modules' || name.name === 'dist' || name.name === '.git') continue;
              out.push(...walk(full));
            } else out.push(full);
          }
          return out;
        };
        const tsx = walk(WORKSPACE).filter((f) => f.endsWith('.tsx') || f.endsWith('.jsx'));
        expect(tsx, `React debris: ${tsx.join(', ')}`).toEqual([]);
      } finally {
        await service?.stopMission().catch(() => undefined);
      }
    },
    MISSION_TIMEOUT_MS + 60_000,
  );
});
