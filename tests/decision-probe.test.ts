import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeDecisionMcp, speechUrlMistakenForDecision } from '../src/main/decision/probe';
import { extractToolErrorDetail } from '../src/main/decision/kev-client';

function mcpHandshakeFetch(options: {
  getStatus?: number;
  toolResult: unknown;
}): ReturnType<typeof vi.fn> {
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? init.body : '';
    if (init?.method === 'GET' || !init?.method) {
      return {
        status: options.getStatus ?? 400,
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
    return {
      status: 200,
      ok: true,
      headers: { get: () => 'sess-1' },
      text: async () => JSON.stringify(options.toolResult),
    };
  });
}

describe('speechUrlMistakenForDecision', () => {
  it('rejects Speech ASR transcription URLs and /health', () => {
    expect(
      speechUrlMistakenForDecision('http://127.0.0.1:8765/v1/audio/transcriptions'),
    ).toMatch(/Speech ASR/);
    expect(speechUrlMistakenForDecision('http://127.0.0.1:8765/health')).toMatch(/\/health/);
    expect(speechUrlMistakenForDecision('http://192.168.5.157:8765/mcp')).toBeNull();
    expect(speechUrlMistakenForDecision('http://host:8888/mcp/')).toBeNull();
  });
});

describe('probeDecisionMcp', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects Speech ASR URLs before fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await probeDecisionMcp({
      url: 'http://127.0.0.1:8765/v1/audio/transcriptions',
      token: 'x',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Speech ASR/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails classic KEV when tools/call never answers (bare GET is not enough)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 400, ok: false, headers: { get: () => null }, text: async () => '' }));
    const result = await probeDecisionMcp({
      url: 'http://192.168.5.157:8766/mcp',
      token: 'test-token',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/tools\/call failed|Decision MCP/);
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
    vi.stubGlobal(
      'fetch',
      mcpHandshakeFetch({
        toolResult: {
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
        },
      }),
    );

    const result = await probeDecisionMcp({
      url: 'http://192.168.5.157:8888/mcp/',
      token: 'classic-kev-token',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/sk-unsloth/);
  });

  it('passes classic KEV when kev_evaluate answers', async () => {
    vi.stubGlobal(
      'fetch',
      mcpHandshakeFetch({
        getStatus: 406,
        toolResult: {
          jsonrpc: '2.0',
          id: 2,
          result: {
            structuredContent: {
              model: 'kev-test',
              answers: {
                action: { choice: 'continue', probabilities: { continue: 0.9, escalate: 0.1 } },
              },
            },
          },
        },
      }),
    );

    const result = await probeDecisionMcp({
      url: 'http://192.168.5.157:8765/mcp',
      token: 'kev-token',
    });
    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/kev-test|Decision tool/);
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
