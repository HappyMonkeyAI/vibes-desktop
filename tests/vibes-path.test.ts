import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isVibesCheckout, validateVibesCheckout } from '../src/main/settings/vibes-path';

describe('validateVibesCheckout', () => {
  it('rejects empty and missing trees', () => {
    expect(validateVibesCheckout('')).toEqual({
      ok: false,
      error: 'Enter the absolute path to a Vibes checkout.',
    });
    const missing = validateVibesCheckout(path.join(tmpdir(), 'no-such-vibes-checkout'));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toMatch(/src\/mcp\/server\.ts/);
  });

  it('accepts a tree that has src/mcp/server.ts', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'vibes-checkout-'));
    try {
      mkdirSync(path.join(root, 'src', 'mcp'), { recursive: true });
      writeFileSync(path.join(root, 'src', 'mcp', 'server.ts'), '// stub\n');
      expect(isVibesCheckout(root)).toBe(true);
      expect(validateVibesCheckout(root)).toEqual({ ok: true });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
