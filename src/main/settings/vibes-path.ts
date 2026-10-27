import { existsSync } from 'node:fs';
import path from 'node:path';

/** True when `root` looks like a Vibes checkout (has `src/mcp/server.ts`). */
export function isVibesCheckout(root: string): boolean {
  const trimmed = root.trim();
  if (!trimmed) return false;
  return existsSync(path.join(trimmed, 'src', 'mcp', 'server.ts'));
}

export type VibesPathValidation = { ok: true } | { ok: false; error: string };

/** Operator-facing check used by first-run / Settings before persisting a path. */
export function validateVibesCheckout(root: string): VibesPathValidation {
  const trimmed = root.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter the absolute path to a Vibes checkout.' };
  }
  if (!isVibesCheckout(trimmed)) {
    return {
      ok: false,
      error: `No src/mcp/server.ts under ${trimmed}. Point at a Vibes repo checkout.`,
    };
  }
  return { ok: true };
}
