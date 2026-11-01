import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { RolesConfigInput } from '../src/shared/channels';
import {
  writeRoleConstitutions,
  roleConstitutionsPath,
  normalizeSystemPrompt,
} from '../src/main/roles/constitutions-writer';

let workspace: string;
beforeAll(() => {
  workspace = mkdtempSync(path.join(tmpdir(), 'vibes-constitutions-'));
});
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

const emptyRoles = (): RolesConfigInput => ({
  default: { baseUrl: '', model: '', systemPrompt: '', apiKey: '' },
  planner: { baseUrl: '', model: '', systemPrompt: 'Plan carefully.', apiKey: '' },
  executor: { baseUrl: '', model: '', systemPrompt: '  Execute with evidence.  ', apiKey: '' },
  reviewer: { baseUrl: '', model: '', apiKey: '' },
  triage: { baseUrl: '', model: '', apiKey: '' },
});

describe('writeRoleConstitutions (T79)', () => {
  it('refuses non-absolute workspace roots', () => {
    expect(writeRoleConstitutions('relative/path', emptyRoles())).toBeNull();
    expect(writeRoleConstitutions('', emptyRoles())).toBeNull();
  });

  it('writes .vibes/role-constitutions.json with trimmed role texts', () => {
    const target = writeRoleConstitutions(workspace, emptyRoles());
    expect(target).toBe(roleConstitutionsPath(workspace));
    expect(existsSync(target!)).toBe(true);
    const raw = JSON.parse(readFileSync(target!, 'utf-8')) as {
      v: number;
      roles: Record<string, string>;
    };
    expect(raw.v).toBe(1);
    expect(raw.roles.planner).toBe('Plan carefully.');
    expect(raw.roles.executor).toBe('Execute with evidence.');
    expect(raw.roles.default).toBe('');
    expect(raw.roles.reviewer).toBe('');
  });

  it('overwrites on subsequent save (Roles store is SoT)', () => {
    const next = emptyRoles();
    next.planner = { ...next.planner, systemPrompt: 'Updated planner constitution.' };
    writeRoleConstitutions(workspace, next);
    const raw = JSON.parse(readFileSync(roleConstitutionsPath(workspace), 'utf-8')) as {
      roles: Record<string, string>;
    };
    expect(raw.roles.planner).toBe('Updated planner constitution.');
  });
});

describe('normalizeSystemPrompt', () => {
  it('trims and caps length', () => {
    expect(normalizeSystemPrompt('  hi  ')).toBe('hi');
    expect(normalizeSystemPrompt('')).toBe('');
    expect(normalizeSystemPrompt(null)).toBe('');
    const long = 'x'.repeat(13_000);
    expect(normalizeSystemPrompt(long).length).toBe(12_000);
  });
});
