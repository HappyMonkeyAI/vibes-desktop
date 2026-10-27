import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeDecisionMcp } from '../src/main/decision/probe';

describe('probeDecisionMcp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats streamable-HTTP bare-GET 400 as reachable (Gutsy/KEV)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 400, ok: false }));
    const result = await probeDecisionMcp({
      url: 'http://192.168.5.157:8766/mcp',
      token: 'test-token',
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/400/);
  });

  it('treats 406 as reachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 406, ok: false }));
    const result = await probeDecisionMcp({
      url: 'http://192.168.5.157:8765/mcp',
      token: 'test-token',
    });
    expect(result.ok).toBe(true);
  });

  it('fails on 401 with a token hint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false }));
    const result = await probeDecisionMcp({
      url: 'http://192.168.5.157:8766/mcp',
      token: 'bad',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unauthorized/);
  });
});
