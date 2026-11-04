import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RoleKey, RoleLessonsFile } from '@shared/channels';
import { ROLE_KEYS } from '@shared/channels';

const VIBES_DIR = '.vibes';
const FILE_NAME = 'role-lessons.json';
const MAX_LESSON_CHARS = 2_000;
const MAX_LESSONS_PER_ROLE = 24;

export function roleLessonsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, VIBES_DIR, FILE_NAME);
}

function normalizeLessons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    out.push(trimmed.length > MAX_LESSON_CHARS ? trimmed.slice(0, MAX_LESSON_CHARS) : trimmed);
    if (out.length >= MAX_LESSONS_PER_ROLE) break;
  }
  return out;
}

/**
 * T80 — write per-role lessons for vibes child compose (operator-visible; no silent rewrite).
 */
export function writeRoleLessons(
  workspaceRoot: string,
  roles: Partial<Record<RoleKey, string[]>>,
): string | null {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return null;
  const payloadRoles = {} as Record<RoleKey, string[]>;
  for (const key of ROLE_KEYS) {
    payloadRoles[key] = normalizeLessons(roles[key]);
  }
  const payload: RoleLessonsFile = {
    v: 1,
    at: Date.now(),
    roles: payloadRoles,
  };
  try {
    const target = roleLessonsPath(workspaceRoot);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    return target;
  } catch {
    return null;
  }
}
