import { describe, expect, it, vi, afterEach } from 'vitest';
import { testConnection } from '../src/main/roles/test-connection';

afterEach(() => vi.unstubAllGlobals());

describe('testConnection (T8)', () => {
  it('requires both a base URL and a model', async () => {
    expect(await testConnection({ baseUrl: '', model: '' })).toEqual({ ok: false, error: 'Both a base URL and a model are required.' });
    expect((await testConnection({ baseUrl: 'http://x/v1', model: '' })).ok).toBe(false);
  });

  it('reports ok on a 2xx completion', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })));
    expect(await testConnection({ baseUrl: 'http://x/v1/', model: 'm' })).toEqual({ ok: true });
  });

  it('strips trailing slashes and posts to /chat/completions', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await testConnection({ baseUrl: 'http://x/v1///', model: 'm' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://x/v1/chat/completions');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe('m');
  });

  it('normalizes a bare origin to /v1 before probing (matches what the child will call)', async () => {
    // The false-done bug started here: the probe hit /chat/completions (404)
    // while the SDK needed /v1/chat/completions — probe and child must agree.
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await testConnection({ baseUrl: 'http://192.168.5.232:11434', model: 'm' });
    expect(fetchMock.mock.calls[0][0]).toBe('http://192.168.5.232:11434/v1/chat/completions');
  });

  it('sends an Authorization header only when a key is present', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await testConnection({ baseUrl: 'http://x/v1', model: 'm', apiKey: 'k' });
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer k' });

    fetchMock.mockClear();
    await testConnection({ baseUrl: 'http://x/v1', model: 'm' });
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('surfaces a non-2xx status with the parsed error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'model not found' } }), { status: 404 })));
    const res = await testConnection({ baseUrl: 'http://x/v1', model: 'nope' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('404');
    expect(res.error).toContain('model not found');
  });

  it('reports a network failure as an error, not a throw', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const res = await testConnection({ baseUrl: 'http://x/v1', model: 'm' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('ECONNREFUSED');
  });
});
