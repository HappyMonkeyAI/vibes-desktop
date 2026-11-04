import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  RoleKey,
  RoleReasoningEffort,
  RoleReasoningEntry,
  RoleReasoningFile,
  RoleReasoningMode,
  RolesConfigInput,
} from '@shared/channels';
import { ROLE_KEYS } from '@shared/channels';
import { normalizeReasoningEffort, normalizeReasoningMode } from './store';

const VIBES_DIR = '.vibes';
const FILE_NAME = 'role-reasoning.json';

export function roleReasoningPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, VIBES_DIR, FILE_NAME);
}

/** Heretic / Qwen chat-level switch when effort is concrete. */
export function chatMarkerForEffort(effort: RoleReasoningEffort): string {
  if (effort === 'inherit') return '';
  return `{REASON:${effort}}`;
}

function entryFromRole(input: RolesConfigInput[RoleKey] | undefined): RoleReasoningEntry {
  const mode = normalizeReasoningMode(input?.reasoningMode);
  const effort = normalizeReasoningEffort(input?.reasoningEffort);
  return {
    mode,
    effort,
    chatMarker: chatMarkerForEffort(effort),
  };
}

function rolesFromInput(input: RolesConfigInput): Record<RoleKey, RoleReasoningEntry> {
  const roles = {} as Record<RoleKey, RoleReasoningEntry>;
  for (const key of ROLE_KEYS) {
    roles[key] = entryFromRole(input[key]);
  }
  return roles;
}

/**
 * T86 — write per-role reasoning policy beside `.vibes/config.json`.
 * Refuses non-absolute roots. Overwrites the whole file (SoT is Roles store).
 * Vibes child API kwargs (`reasoning_effort` / `enable_thinking`) are a companion;
 * desktop resolves THINKING_MODE from executor/default on spawn.
 */
export function writeRoleReasoning(
  workspaceRoot: string,
  input: RolesConfigInput,
): string | null {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return null;
  const target = roleReasoningPath(workspaceRoot);
  const payload: RoleReasoningFile = {
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

/**
 * Vibes has one THINKING_MODE. Prefer executor override, then default; else Runtime.
 */
export function resolveThinkingModeFromRoles(
  input: RolesConfigInput,
  runtimeThinking: boolean,
): boolean {
  const pick = (mode: RoleReasoningMode | undefined): boolean | null => {
    if (mode === 'on') return true;
    if (mode === 'off') return false;
    return null;
  };
  return (
    pick(normalizeReasoningMode(input.executor?.reasoningMode))
    ?? pick(normalizeReasoningMode(input.default?.reasoningMode))
    ?? runtimeThinking
  );
}

export function hasAnyReasoningOverride(input: RolesConfigInput): boolean {
  return ROLE_KEYS.some((key) => {
    const mode = normalizeReasoningMode(input[key]?.reasoningMode);
    const effort = normalizeReasoningEffort(input[key]?.reasoningEffort);
    return mode !== 'inherit' || effort !== 'inherit';
  });
}

export function reasoningFileExists(workspaceRoot: string): boolean {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return false;
  return existsSync(roleReasoningPath(workspaceRoot));
}
