import { afterEach, describe, expect, it } from 'vitest';
import { resolveDecisionMcpConfig } from '../src/main/decision/config';

function fakeStore(opts: { url?: string; token?: string | null }) {
  return {
    get: () => ({
      decisionMcpUrl: opts.url ?? '',
      decisionMcpHasToken: Boolean(opts.token),
    }),
    getDecisionMcpAuthToken: () => opts.token ?? null,
  } as never;
}

describe('resolveDecisionMcpConfig', () => {
  const prev = {
    kevUrl: process.env.KEV_MCP_URL,
    kevTok: process.env.KEV_MCP_AUTH_TOKEN,
    unsloth: process.env.UNSLOTH_API_KEY,
    unslothStudio: process.env.UNSLOTH_STUDIO_API_KEY,
  };

  afterEach(() => {
    for (const [k, v] of Object.entries({
      KEV_MCP_URL: prev.kevUrl,
      KEV_MCP_AUTH_TOKEN: prev.kevTok,
      UNSLOTH_API_KEY: prev.unsloth,
      UNSLOTH_STUDIO_API_KEY: prev.unslothStudio,
    })) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('returns null when URL and token are missing', () => {
    delete process.env.KEV_MCP_URL;
    delete process.env.KEV_MCP_AUTH_TOKEN;
    delete process.env.UNSLOTH_API_KEY;
    expect(resolveDecisionMcpConfig(fakeStore({}))).toBeNull();
  });

  it('uses UNSLOTH_API_KEY for Studio :8888 when Settings token is empty', () => {
    delete process.env.KEV_MCP_AUTH_TOKEN;
    process.env.UNSLOTH_API_KEY = 'sk-unsloth-test';
    const cfg = resolveDecisionMcpConfig(
      fakeStore({ url: 'http://192.168.5.157:8888/mcp/', token: null }),
    );
    expect(cfg).toEqual({
      url: 'http://192.168.5.157:8888/mcp/',
      token: 'sk-unsloth-test',
    });
  });

  it('does not use UNSLOTH_API_KEY for classic KEV :8765', () => {
    delete process.env.KEV_MCP_AUTH_TOKEN;
    process.env.UNSLOTH_API_KEY = 'sk-unsloth-test';
    expect(
      resolveDecisionMcpConfig(fakeStore({ url: 'http://192.168.5.157:8765/mcp', token: null })),
    ).toBeNull();
  });
});
