import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { MissionOverlayFile, MissionOverlayPatch } from '@shared/channels';

const VIBES_DIR = '.vibes';
const FILE_NAME = 'mission-overlay.json';
const MAX_PATCH_CHARS = 4_000;
const MAX_PATCHES = 32;

export function missionOverlayPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, VIBES_DIR, FILE_NAME);
}

function normalizePatch(raw: MissionOverlayPatch): MissionOverlayPatch | null {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.op !== 'add' && raw.op !== 'emphasize' && raw.op !== 'forbid') return null;
  if (typeof raw.text !== 'string') return null;
  const text = raw.text.trim();
  if (!text) return null;
  return {
    op: raw.op,
    text: text.length > MAX_PATCH_CHARS ? text.slice(0, MAX_PATCH_CHARS) : text,
  };
}

/**
 * T80 — write mission overlay patches for vibes child compose.
 * Overlay refines; it cannot rewrite role constitutions (SoT stays T79 file).
 */
export function writeMissionOverlay(
  workspaceRoot: string,
  patches: MissionOverlayPatch[],
): string | null {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return null;
  const normalized = patches
    .map(normalizePatch)
    .filter((p): p is MissionOverlayPatch => p !== null)
    .slice(0, MAX_PATCHES);
  const payload: MissionOverlayFile = {
    v: 1,
    at: Date.now(),
    patches: normalized,
  };
  try {
    const target = missionOverlayPath(workspaceRoot);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    return target;
  } catch {
    return null;
  }
}
