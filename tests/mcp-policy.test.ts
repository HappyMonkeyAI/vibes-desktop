import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { RolesConfigInput } from '../src/shared/channels';
import {
  normalizeMcpServerAllowlist,
  normalizeMcpToolAllowlist,
  normalizeMcpToolBudget,
  resolveToolBudget,
  suggestToolBudget,
} from '../src/shared/mcpPolicy';
import { writeRoleMcpPolicy } from '../src/main/roles/mcp-policy-writer';

const blank = (): RolesConfigInput[keyof RolesConfigInput] => ({
  baseUrl: '',
  model: '',
  apiKey: '',
});

function roles(partial: Partial<RolesConfigInput> = {}): RolesConfigInput {
  return {
    default: blank(),
    planner: blank(),
    executor: blank(),
    reviewer: blank(),
    triage: blank(),
    ...partial,
  };
}

describe('suggestToolBudget', () => {
  it('clamps from context window', () => {
    expect(suggestToolBudget(0)).toBe(16);
    expect(suggestToolBudget(8192)).toBe(4);
    expect(suggestToolBudget(32768)).toBe(16);
    expect(suggestToolBudget(200_000)).toBe(48);
  });
});

describe('normalize allowlists', () => {
  it('sanitizes server keys', () => {
    expect(normalizeMcpServerAllowlist('HTML Design, foo!!bar\nbaz')).toEqual([
      'html-design',
      'foo-bar',
      'baz',
    ]);
  });

  it('keeps tool name case', () => {
    expect(normalizeMcpToolAllowlist('read_file\nWrite_File, read_file')).toEqual([
      'read_file',
      'Write_File',
    ]);
  });

  it('normalizes budget', () => {
    expect(normalizeMcpToolBudget('12')).toBe('12');
    expect(normalizeMcpToolBudget('')).toBe('');
    expect(normalizeMcpToolBudget('nope')).toBe('');
  });
});

describe('resolveToolBudget', () => {
  it('prefers manual over auto', () => {
    expect(resolveToolBudget({ contextWindow: '32768', manualBudget: '8' })).toEqual({
      budget: 8,
      mode: 'manual',
    });
    expect(resolveToolBudget({ contextWindow: '32768', manualBudget: '' }).mode).toBe('auto');
  });
});

describe('writeRoleMcpPolicy (T84)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-mcp-policy-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('writes resolved budget and allowlists without touching mcp.json', () => {
    const target = writeRoleMcpPolicy(
      dir,
      roles({
        executor: {
          ...blank(),
          contextWindow: '32768',
          mcpServers: ['html-design-advisor'],
          mcpTools: ['read_file'],
          mcpToolBudget: '',
        },
        planner: {
          ...blank(),
          contextWindow: '8192',
          mcpToolBudget: '6',
        },
      }),
    );
    expect(target).toBe(path.join(dir, '.vibes', 'role-mcp-policy.json'));
    const raw = JSON.parse(readFileSync(target!, 'utf-8')) as {
      v: number;
      roles: Record<string, {
        servers: string[];
        tools: string[];
        toolBudget: number;
        toolBudgetMode: string;
        contextWindow: number | null;
      }>;
    };
    expect(raw.v).toBe(1);
    expect(raw.roles.executor).toMatchObject({
      servers: ['html-design-advisor'],
      tools: ['read_file'],
      toolBudget: 16,
      toolBudgetMode: 'auto',
      contextWindow: 32768,
    });
    expect(raw.roles.planner).toMatchObject({
      toolBudget: 6,
      toolBudgetMode: 'manual',
      contextWindow: 8192,
    });
    expect(() => readFileSync(path.join(dir, '.vibes', 'mcp.json'))).toThrow();
  });

  it('refuses relative roots', () => {
    expect(writeRoleMcpPolicy('relative', roles())).toBeNull();
  });
});
