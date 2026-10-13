import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RolesConfigInput } from '@shared/channels';
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

/** Merge our config into the workspace's native file. Returns the path, or null. */
export function writeVibesConfig(workspaceRoot: string, input: RolesConfigInput): string | null {
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
    const merged: Partial<Record<VibesConfigKey, string>> = { ...existing, ...omitEmpty(toVibesConfig(input)) };
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
    return target;
  } catch {
    return null;
  }
}
