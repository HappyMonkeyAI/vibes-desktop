import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { RolesConfigInput } from '../src/shared/channels';
import {
  chatMarkerForEffort,
  resolveThinkingModeFromRoles,
  writeRoleReasoning,
} from '../src/main/roles/reasoning-writer';

const blank = (): RolesConfigInput[keyof RolesConfigInput] => ({
  baseUrl: '',
  model: '',
  apiKey: '',
  reasoningMode: 'inherit',
  reasoningEffort: 'inherit',
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

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'vibes-reasoning-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('writeRoleReasoning (T86)', () => {
  it('writes mode, effort, and chat markers', () => {
    const target = writeRoleReasoning(
      dir,
      roles({
        planner: {
          ...blank(),
          reasoningMode: 'on',
          reasoningEffort: 'xhigh',
        },
        executor: {
          ...blank(),
          reasoningMode: 'off',
          reasoningEffort: 'einstein',
        },
      }),
    );
    expect(target).toBe(path.join(dir, '.vibes', 'role-reasoning.json'));
    const raw = JSON.parse(readFileSync(target!, 'utf-8')) as {
      v: number;
      roles: Record<string, { mode: string; effort: string; chatMarker: string }>;
    };
    expect(raw.v).toBe(1);
    expect(raw.roles.planner).toEqual({
      mode: 'on',
      effort: 'xhigh',
      chatMarker: '{REASON:xhigh}',
    });
    expect(raw.roles.executor).toEqual({
      mode: 'off',
      effort: 'einstein',
      chatMarker: '{REASON:einstein}',
    });
    expect(raw.roles.default.chatMarker).toBe('');
  });

  it('refuses relative workspace roots', () => {
    expect(writeRoleReasoning('relative/path', roles())).toBeNull();
  });
});

describe('resolveThinkingModeFromRoles', () => {
  it('inherits Runtime when roles are inherit', () => {
    expect(resolveThinkingModeFromRoles(roles(), true)).toBe(true);
    expect(resolveThinkingModeFromRoles(roles(), false)).toBe(false);
  });

  it('executor wins over default and Runtime', () => {
    expect(
      resolveThinkingModeFromRoles(
        roles({
          default: { ...blank(), reasoningMode: 'on' },
          executor: { ...blank(), reasoningMode: 'off' },
        }),
        true,
      ),
    ).toBe(false);
  });

  it('default overrides Runtime when executor inherits', () => {
    expect(
      resolveThinkingModeFromRoles(
        roles({
          default: { ...blank(), reasoningMode: 'off' },
        }),
        true,
      ),
    ).toBe(false);
  });
});

describe('chatMarkerForEffort', () => {
  it('emits Heretic markers for concrete efforts only', () => {
    expect(chatMarkerForEffort('inherit')).toBe('');
    expect(chatMarkerForEffort('spoon')).toBe('{REASON:spoon}');
  });
});
