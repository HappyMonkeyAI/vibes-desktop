import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeDecisionMcp } from '../src/main/decision/probe';
import { extractToolErrorDetail } from '../src/main/decision/kev-client';

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
    expect(result.detail).toMatch(/Reachable/);
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

  it('deep-probes Unsloth :8888 and surfaces sk-unsloth API key errors', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = typeof init?.body === 'string' ? init.body : '';
      if (init?.method === 'GET' || !init?.method) {
        return {
          status: 400,
          ok: false,
          headers: { get: () => null },
          text: async () => '',
        };
      }
      if (body.includes('"initialize"')) {
        return {
          status: 200,
          ok: true,
          headers: { get: (h: string) => (h.toLowerCase() === 'mcp-session-id' ? 'sess-1' : null) },
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }),
        };
      }
      if (body.includes('notifications/initialized')) {
        return { status: 202, ok: true, headers: { get: () => 'sess-1' }, text: async () => '' };
      }
      // tools/call — Unsloth rejects classic KEV tokens
      return {
        status: 200,
        ok: true,
        headers: { get: () => 'sess-1' },
        text: async () =>
          JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            result: {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    detail: 'Unsloth Studio MCP needs an Unsloth Studio API key (sk-unsloth-…).',
                  }),
                },
              ],
            },
          }),
      };
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await probeDecisionMcp({
      url: 'http://192.168.5.157:8888/mcp/',
      token: 'classic-kev-token',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/sk-unsloth/);
  });
});

describe('extractToolErrorDetail', () => {
  it('reads detail from isError content JSON', () => {
    expect(
      extractToolErrorDetail({
        result: {
          isError: true,
          content: [{ type: 'text', text: JSON.stringify({ detail: 'need sk-unsloth key' }) }],
        },
      }),
    ).toBe('need sk-unsloth key');
  });
});
