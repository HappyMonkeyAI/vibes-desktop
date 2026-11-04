import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeMissionOverlay, missionOverlayPath } from '../src/main/roles/mission-overlay-writer';
import { writeRoleLessons, roleLessonsPath } from '../src/main/roles/lessons-writer';

let workspace: string;
beforeAll(() => {
  workspace = mkdtempSync(path.join(tmpdir(), 'vibes-overlay-'));
});
afterAll(() => rmSync(workspace, { recursive: true, force: true }));

describe('writeMissionOverlay (T80)', () => {
  it('refuses non-absolute roots', () => {
    expect(writeMissionOverlay('relative', [{ op: 'add', text: 'x' }])).toBeNull();
  });

  it('writes normalized add/emphasize/forbid patches', () => {
    const target = writeMissionOverlay(workspace, [
      { op: 'forbid', text: '  No React  ' },
      { op: 'emphasize', text: 'One task' },
      { op: 'add', text: '' },
      { op: 'add', text: 'Enter VR toast' },
    ]);
    expect(target).toBe(missionOverlayPath(workspace));
    expect(existsSync(target!)).toBe(true);
    const raw = JSON.parse(readFileSync(target!, 'utf-8')) as {
      v: number;
      patches: Array<{ op: string; text: string }>;
    };
    expect(raw.v).toBe(1);
    expect(raw.patches).toEqual([
      { op: 'forbid', text: 'No React' },
      { op: 'emphasize', text: 'One task' },
      { op: 'add', text: 'Enter VR toast' },
    ]);
  });
});

describe('writeRoleLessons (T80)', () => {
  it('writes per-role lesson lists', () => {
    const target = writeRoleLessons(workspace, {
      executor: ['  Install before evidence  ', ''],
      default: ['Keep vanilla Three'],
    });
    expect(target).toBe(roleLessonsPath(workspace));
    const raw = JSON.parse(readFileSync(target!, 'utf-8')) as {
      roles: Record<string, string[]>;
    };
    expect(raw.roles.executor).toEqual(['Install before evidence']);
    expect(raw.roles.default).toEqual(['Keep vanilla Three']);
    expect(raw.roles.planner).toEqual([]);
  });
});
