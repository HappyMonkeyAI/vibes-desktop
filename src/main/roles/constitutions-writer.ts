import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RoleConstitutionsFile, RoleKey, RolesConfigInput } from '@shared/channels';
import { ROLE_KEYS } from '@shared/channels';

const VIBES_DIR = '.vibes';
const FILE_NAME = 'role-constitutions.json';
/** Soft cap so a pasted novel does not blow the workspace file. */
const MAX_PROMPT_CHARS = 12_000;

export function roleConstitutionsPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, VIBES_DIR, FILE_NAME);
}

export function normalizeSystemPrompt(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.length > MAX_PROMPT_CHARS ? trimmed.slice(0, MAX_PROMPT_CHARS) : trimmed;
}

function rolesFromInput(input: RolesConfigInput): Record<RoleKey, string> {
  const roles = {} as Record<RoleKey, string>;
  for (const key of ROLE_KEYS) {
    roles[key] = normalizeSystemPrompt(input[key]?.systemPrompt);
  }
  return roles;
}

/**
 * T79 — write operator constitutions beside `.vibes/config.json`.
 * Refuses non-absolute roots. Overwrites the whole file (SoT is Roles store).
 */
export function writeRoleConstitutions(
  workspaceRoot: string,
  input: RolesConfigInput,
): string | null {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return null;
  const target = roleConstitutionsPath(workspaceRoot);
  const payload: RoleConstitutionsFile = {
    v: 1,
    at: Date.now(),
    roles: rolesFromInput(input),
  };
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    return target;
  } catch {
    return null;
  }
}

/** True when at least one role has a non-empty constitution (for tests / callers). */
export function hasAnyConstitution(input: RolesConfigInput): boolean {
  return ROLE_KEYS.some((key) => normalizeSystemPrompt(input[key]?.systemPrompt).length > 0);
}

export function constitutionsFileExists(workspaceRoot: string): boolean {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return false;
  return existsSync(roleConstitutionsPath(workspaceRoot));
}
