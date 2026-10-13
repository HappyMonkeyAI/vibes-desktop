import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeVibesConfig, vibesConfigPath } from '../src/main/roles/config-writer';
import type { RolesConfigInput } from '@shared/channels';

let workspace: string;
beforeAll(() => {
  workspace = mkdtempSync(path.join(tmpdir(), 'vibes-ws-'));
});
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

const input: RolesConfigInput = {
  default: { baseUrl: '', model: '', apiKey: '' },
  planner: { baseUrl: 'http://planner/v1', model: 'p-model', apiKey: 'pk' },
  executor: { baseUrl: 'http://exec/v1', model: 'e-model', apiKey: 'ek' },
  reviewer: { baseUrl: '', model: '', apiKey: '' },
  triage: { baseUrl: '', model: '', apiKey: '' },
};

describe('writeVibesConfig (T9)', () => {
  it('creates .vibes/config.json with the native key names', () => {
    const target = writeVibesConfig(workspace, input);
    expect(target).toBe(vibesConfigPath(workspace));
    const written = JSON.parse(readFileSync(target!, 'utf-8')) as Record<string, string>;
    // Executor drives the shared OLLAMA endpoint.
    expect(written.OLLAMA_BASE_URL).toBe('http://exec/v1');
    expect(written.OLLAMA_MODEL).toBe('e-model');
    expect(written.PLANNER_MODEL).toBe('p-model');
    // Empty roles are omitted, not written as blanks.
    expect(written.REVIEWER_MODEL).toBeUndefined();
    expect(written.TRIAGE_BASE_URL).toBeUndefined();
  });

  it('merges with an existing file without blanking untouched keys', () => {
    // Pre-seed a reviewer key the user set earlier.
    const target = vibesConfigPath(workspace);
    writeFileSync(target, JSON.stringify({ REVIEWER_MODEL: 'r-model', OLLAMA_MODEL: 'old' }), 'utf-8');

    writeVibesConfig(workspace, input);
    const merged = JSON.parse(readFileSync(target, 'utf-8')) as Record<string, string>;
    expect(merged.REVIEWER_MODEL).toBe('r-model'); // preserved
    expect(merged.OLLAMA_MODEL).toBe('e-model'); // overwritten by this save
  });

  it('starts fresh when the existing file is corrupt', () => {
    const ws2 = path.join(workspace, 'corrupt-ws');
    mkdirSync(path.join(ws2, '.vibes'), { recursive: true });
    writeFileSync(path.join(ws2, '.vibes', 'config.json'), '{ bad json', 'utf-8');
    const target = writeVibesConfig(ws2, input);
    expect(target).toBeTruthy();
    const written = JSON.parse(readFileSync(target!, 'utf-8')) as Record<string, string>;
    expect(written.OLLAMA_MODEL).toBe('e-model');
  });
});
