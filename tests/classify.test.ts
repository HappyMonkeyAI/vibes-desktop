import { describe, expect, it } from 'vitest';
import { classify } from '@shared/classify';
import type { LedgerEntry } from '@shared/channels';

const entry = (over: Partial<LedgerEntry>): Pick<LedgerEntry, 'status' | 'needsHuman' | 'nextRunAtMs'> => ({
  status: 'idle',
  needsHuman: false,
  nextRunAtMs: undefined,
  ...over,
});

describe('classify (ported from the fork)', () => {
  it('routes failed/blocked/zombie and needsHuman to needs-you', () => {
    expect(classify(entry({ status: 'failed' }))).toBe('needs-you');
    expect(classify(entry({ status: 'blocked' }))).toBe('needs-you');
    expect(classify(entry({ status: 'zombie' }))).toBe('needs-you');
    expect(classify(entry({ status: 'running', needsHuman: true }))).toBe('needs-you');
  });

  it('routes running/verifying to running', () => {
    expect(classify(entry({ status: 'running' }))).toBe('running');
    expect(classify(entry({ status: 'verifying' }))).toBe('running');
  });

  it('routes pending with a next run to upcoming', () => {
    expect(classify(entry({ status: 'pending', nextRunAtMs: Date.now() + 60_000 }))).toBe('upcoming');
  });

  it('routes everything else (done, idle, bare pending) to recent', () => {
    expect(classify(entry({ status: 'done' }))).toBe('recent');
    expect(classify(entry({}))).toBe('recent');
    expect(classify(entry({ status: 'pending' }))).toBe('recent');
  });
});
