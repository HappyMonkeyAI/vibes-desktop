/**
 * T84 — per-role MCP/tool policy helpers (desktop SoT).
 * Activation / catalogue filtering is T85 — this module only shapes policy data.
 */

const MAX_LIST_ITEMS = 64;
const MAX_NAME_LEN = 96;

/** Suggest how many tools a small model can see for a given context window. */
export function suggestToolBudget(contextWindow: number): number {
  if (!Number.isFinite(contextWindow) || contextWindow <= 0) return 16;
  // ~2k tokens of schema/docs per tool; clamp for tiny / huge windows.
  const raw = Math.floor(contextWindow / 2048);
  return Math.max(4, Math.min(48, raw));
}

/** Sanitize one MCP server key (matches mcp-writer rules loosely). */
export function normalizeMcpServerName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function splitList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string');
  }
  if (typeof raw !== 'string') return [];
  return raw.split(/[\n,]+/);
}

/** Unique sanitized server keys; empty input → []. */
export function normalizeMcpServerAllowlist(raw: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of splitList(raw)) {
    const name = normalizeMcpServerName(part);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= MAX_LIST_ITEMS) break;
  }
  return out;
}

/** Unique tool name tokens (preserve case; trim). Empty → []. */
export function normalizeMcpToolAllowlist(raw: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of splitList(raw)) {
    const name = part.trim().slice(0, MAX_NAME_LEN);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= MAX_LIST_ITEMS) break;
  }
  return out;
}

/** Digits → positive int string; empty/junk → '' (auto budget). */
export function normalizeMcpToolBudget(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return String(Math.min(128, Math.floor(raw)));
  }
  if (typeof raw !== 'string') return '';
  const digits = raw.trim().replace(/[_\s,]/g, '');
  if (!/^\d+$/.test(digits)) return '';
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(Math.min(128, n));
}

export function resolveToolBudget(opts: {
  contextWindow: string;
  manualBudget: string;
}): { budget: number; mode: 'auto' | 'manual' } {
  const manual = normalizeMcpToolBudget(opts.manualBudget);
  if (manual) return { budget: Number(manual), mode: 'manual' };
  const ctx = Number(opts.contextWindow.replace(/[_\s,]/g, '') || '0');
  return { budget: suggestToolBudget(ctx), mode: 'auto' };
}

export function formatAllowlistForInput(list: string[]): string {
  return list.join(', ');
}

export function formatToolAllowlistForInput(list: string[]): string {
  return list.join('\n');
}
