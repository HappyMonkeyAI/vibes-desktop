import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DecisionMcpConfig, RolesConfigInput } from '@shared/channels';
import { omitEmpty, toVibesConfig, type VibesConfigKey } from './vibes-config';

/**
 * T9 — write the native `.vibes/config.json` into a workspace so a spawned vibes
 * child reads the configured per-role endpoints. Merges with any existing file
 * (only non-empty fields are written) so a half-configured save never blanks keys
 * the user didn't touch. Returns the absolute path written, or null on failure.
 */

const VIBES_DIR = '.vibes';
const CONFIG_FILE = 'config.json';

export function vibesConfigPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, VIBES_DIR, CONFIG_FILE);
}

/** Merge our config into the workspace's native file. Returns the path, or null.
 *  Refuses non-absolute roots: a relative path would resolve against the app's
 *  own cwd and write .vibes/config.json into the source tree. */
export function writeVibesConfig(
  workspaceRoot: string,
  input: RolesConfigInput,
  decision?: DecisionMcpConfig | null,
): string | null {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return null;
  const target = vibesConfigPath(workspaceRoot);
  try {
    // Read any existing file so we merge rather than clobber.
    let existing: Partial<Record<VibesConfigKey, string>> = {};
    if (existsSync(target)) {
      try {
        existing = JSON.parse(readFileSync(target, 'utf-8')) as Partial<Record<VibesConfigKey, string>>;
      } catch {
        // Corrupt existing file — start fresh rather than crash.
        existing = {};
      }
    }
    const decisionFields: Partial<Record<VibesConfigKey, string>> = decision
      ? {
          KEV_MCP_URL: decision.url,
          KEV_MCP_AUTH_TOKEN: decision.token,
          ENABLE_DECISION_INTERVENE_GATE: 'true',
        }
      : {
          // Explicit off so a prior mission's token does not linger in the workspace file.
          ENABLE_DECISION_INTERVENE_GATE: 'false',
        };
    const merged: Partial<Record<VibesConfigKey, string>> = {
      ...existing,
      ...omitEmpty(toVibesConfig(input)),
      ...omitEmpty(decisionFields as Record<VibesConfigKey, string>),
    };
    // When decision is off, strip secrets from the workspace config.
    if (!decision) {
      delete merged.KEV_MCP_URL;
      delete merged.KEV_MCP_AUTH_TOKEN;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    return target;
  } catch {
    return null;
  }
}
