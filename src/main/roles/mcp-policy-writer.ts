import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  RoleKey,
  RoleMcpPolicyEntry,
  RoleMcpPolicyFile,
  RolesConfigInput,
} from '@shared/channels';
import { ROLE_KEYS } from '@shared/channels';
import {
  normalizeMcpServerAllowlist,
  normalizeMcpToolAllowlist,
  normalizeMcpToolBudget,
  resolveToolBudget,
} from '@shared/mcpPolicy';
import { normalizeContextWindow } from './store';

const VIBES_DIR = '.vibes';
const FILE_NAME = 'role-mcp-policy.json';

export function roleMcpPolicyPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, VIBES_DIR, FILE_NAME);
}

function entryFromRole(input: RolesConfigInput[RoleKey] | undefined): RoleMcpPolicyEntry {
  const contextWindow = normalizeContextWindow(input?.contextWindow);
  const manualBudget = normalizeMcpToolBudget(input?.mcpToolBudget);
  const resolved = resolveToolBudget({ contextWindow, manualBudget });
  const ctxNum = contextWindow ? Number(contextWindow) : null;
  return {
    servers: normalizeMcpServerAllowlist(input?.mcpServers),
    tools: normalizeMcpToolAllowlist(input?.mcpTools),
    toolBudget: resolved.budget,
    toolBudgetMode: resolved.mode,
    contextWindow: ctxNum && Number.isFinite(ctxNum) ? ctxNum : null,
  };
}

function rolesFromInput(input: RolesConfigInput): Record<RoleKey, RoleMcpPolicyEntry> {
  const roles = {} as Record<RoleKey, RoleMcpPolicyEntry>;
  for (const key of ROLE_KEYS) {
    roles[key] = entryFromRole(input[key]);
  }
  return roles;
}

/**
 * T84 — write per-role MCP/tool policy beside `.vibes/config.json`.
 * Does **not** rewrite `.vibes/mcp.json` (no auto-apply). T85 activates filters.
 */
export function writeRoleMcpPolicy(
  workspaceRoot: string,
  input: RolesConfigInput,
): string | null {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return null;
  const target = roleMcpPolicyPath(workspaceRoot);
  const payload: RoleMcpPolicyFile = {
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

export function hasAnyMcpPolicy(input: RolesConfigInput): boolean {
  return ROLE_KEYS.some((key) => {
    const e = entryFromRole(input[key]);
    return e.servers.length > 0 || e.tools.length > 0 || e.toolBudgetMode === 'manual';
  });
}

export function mcpPolicyFileExists(workspaceRoot: string): boolean {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return false;
  return existsSync(roleMcpPolicyPath(workspaceRoot));
}
