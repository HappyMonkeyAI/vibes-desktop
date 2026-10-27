import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  apiKeyTransportError,
  audioExtensionForMime,
  audioMimeForPath,
  isSupportedSpeechEndpoint,
  parseTranscriptionText,
  probeSpeechServer,
  transcribeViaServer,
} from '../src/main/voice/speech-server';

describe('speech-server helpers', () => {
  it('accepts http(s) transcription URLs only', () => {
    expect(isSupportedSpeechEndpoint('http://127.0.0.1:8765/v1/audio/transcriptions')).toBe(true);
    expect(isSupportedSpeechEndpoint('https://asr.example/v1/audio/transcriptions')).toBe(true);
    expect(isSupportedSpeechEndpoint('file:///tmp/x')).toBe(false);
    expect(isSupportedSpeechEndpoint('not a url')).toBe(false);
  });

  it('parses OpenAI-style and segment transcripts', () => {
    expect(parseTranscriptionText({ text: '  hello  ' })).toBe('hello');
    expect(parseTranscriptionText({ segments: [{ text: 'hi' }, { text: 'there' }] })).toBe('hi there');
    expect(parseTranscriptionText('plain')).toBe('plain');
    expect(parseTranscriptionText({})).toBeNull();
  });

  it('maps recorder MIME types to file extensions and back', () => {
    expect(audioExtensionForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(audioExtensionForMime('audio/ogg; codecs=opus')).toBe('ogg');
    expect(audioExtensionForMime('audio/x-wav')).toBe('wav');
    expect(audioExtensionForMime('audio/mp4')).toBe('m4a');
    expect(audioExtensionForMime('')).toBe('webm');
    expect(audioExtensionForMime(undefined)).toBe('webm');
    expect(audioMimeForPath('C:/tmp/abc.webm')).toBe('audio/webm');
    expect(audioMimeForPath('/tmp/abc.wav')).toBe('audio/wav');
    expect(audioMimeForPath('/tmp/abc.unknown')).toBe('audio/webm');
  });
});

describe('transcribeViaServer', () => {
  let dir: string;
  let webmPath: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-speech-'));
    webmPath = path.join(dir, 'capture.webm');
    writeFileSync(webmPath, Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  type Captured = { url: string; init: RequestInit };
  const fakeFetch = (captured: Captured[], response: Response): typeof fetch =>
    (async (url: string | URL | Request, init?: RequestInit) => {
      captured.push({ url: String(url), init: init ?? {} });
      return response;
    }) as typeof fetch;

  it('uploads webm captures labelled as webm, with model, language and bearer key', async () => {
    const captured: Captured[] = [];
    const result = await transcribeViaServer({
      url: ' http://127.0.0.1:8765/v1/audio/transcriptions ',
      model: 'qwen3-asr-0.6b-q8-0',
      language: 'en',
      apiKey: 'tok',
      filePath: webmPath,
      fetchImpl: fakeFetch(captured, new Response(JSON.stringify({ text: ' hello ' }), { status: 200 })),
    });
    expect(result).toEqual({ ok: true, text: 'hello' });
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe('http://127.0.0.1:8765/v1/audio/transcriptions');
    expect((captured[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    const form = captured[0].init.body as FormData;
    const file = form.get('file') as File;
    expect(file.name).toBe('utterance.webm');
    expect(file.type).toBe('audio/webm');
    expect(form.get('model')).toBe('qwen3-asr-0.6b-q8-0');
    expect(form.get('language')).toBe('en');
  });

  it('omits language for auto and the auth header without a key', async () => {
    const captured: Captured[] = [];
    await transcribeViaServer({
      url: 'http://127.0.0.1:8765/v1/audio/transcriptions',
      model: 'm',
      language: 'auto',
      filePath: webmPath,
      fetchImpl: fakeFetch(captured, new Response('plain text', { status: 200 })),
    });
    const form = captured[0].init.body as FormData;
    expect(form.has('language')).toBe(false);
    expect((captured[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('reports HTTP errors with a trimmed body snippet', async () => {
    const result = await transcribeViaServer({
      url: 'http://127.0.0.1:8765/v1/audio/transcriptions',
      model: 'm',
      filePath: webmPath,
      fetchImpl: fakeFetch([], new Response('x'.repeat(1000), { status: 415 })),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/^Speech server HTTP 415 — x+$/);
    expect(result.error!.length).toBeLessThan(400);
  });

  it('reports an unreachable server without throwing', async () => {
    const result = await transcribeViaServer({
      url: 'http://127.0.0.1:8765/v1/audio/transcriptions',
      model: 'm',
      filePath: webmPath,
      fetchImpl: (async () => { throw new Error('ECONNREFUSED'); }) as typeof fetch,
    });
    expect(result).toEqual({ ok: false, error: 'Speech server unreachable — ECONNREFUSED' });
  });
});

describe('API key transport (T31)', () => {
  it('allows keys over https and to loopback http, refuses remote http', () => {
    expect(apiKeyTransportError('https://asr.example/v1/audio/transcriptions', 'k')).toBeNull();
    expect(apiKeyTransportError('http://127.0.0.1:8765/v1/audio/transcriptions', 'k')).toBeNull();
    expect(apiKeyTransportError('http://localhost:8765/x', 'k')).toBeNull();
    expect(apiKeyTransportError('http://[::1]:8765/x', 'k')).toBeNull();
    expect(apiKeyTransportError('http://192.168.1.20:8765/x', 'k')).toContain('Refusing to send the API key');
    expect(apiKeyTransportError('http://127.evil.example/x', 'k')).toContain('Refusing');
    expect(apiKeyTransportError('http://192.168.1.20:8765/x', undefined)).toBeNull();
    expect(apiKeyTransportError('http://192.168.1.20:8765/x', '  ')).toBeNull();
  });

  it('transcribeViaServer never contacts a remote http server with a key', async () => {
    let called = false;
    const result = await transcribeViaServer({
      url: 'http://192.168.1.20:8765/v1/audio/transcriptions',
      model: 'm',
      apiKey: 'secret',
      filePath: '/does/not/matter.webm',
      fetchImpl: (async () => { called = true; return new Response('{}'); }) as typeof fetch,
    });
    expect(called).toBe(false);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Refusing');
  });
});

describe('probeSpeechServer (T31)', () => {
  const url = 'http://127.0.0.1:8765/v1/audio/transcriptions';
  /** Route table: `${METHOD} ${url}` → status, or 'down' to throw. */
  const routes = (table: Record<string, number | 'down'>): typeof fetch =>
    (async (input: string | URL | Request, init?: RequestInit) => {
      const key = `${init?.method ?? 'GET'} ${String(input)}`;
      const status = table[key] ?? 'down';
      if (status === 'down') throw new Error(`connect ECONNREFUSED (${key})`);
      return new Response(null, { status });
    }) as typeof fetch;

  it('is reachable when /health answers 2xx', async () => {
    expect(await probeSpeechServer(url, undefined, routes({ 'GET http://127.0.0.1:8765/health': 200 }))).toEqual({ ok: true });
  });

  it('is reachable when the endpoint rejects an empty upload (route exists)', async () => {
    const fetchImpl = routes({ 'GET http://127.0.0.1:8765/health': 404, [`POST ${url}`]: 422 });
    expect(await probeSpeechServer(url, undefined, fetchImpl)).toEqual({ ok: true });
  });

  it('is not reachable when every route 404s (some other web server)', async () => {
    const fetchImpl = routes({ 'GET http://127.0.0.1:8765/health': 404, [`POST ${url}`]: 404 });
    const result = await probeSpeechServer(url, undefined, fetchImpl);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no transcriptions endpoint');
  });

  it('reports a rejected key', async () => {
    const fetchImpl = routes({ 'GET http://127.0.0.1:8765/health': 401, [`POST ${url}`]: 401 });
    const result = await probeSpeechServer(url, 'bad', fetchImpl);
    expect(result).toEqual({ ok: false, error: 'HTTP 401 — the server rejected the API key.' });
  });

  it('reports a down host', async () => {
    const result = await probeSpeechServer(url, undefined, routes({}));
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('refuses to probe remote http with a key', async () => {
    const result = await probeSpeechServer('http://10.0.0.5:8765/v1/audio/transcriptions', 'k', routes({}));
    expect(result.error).toContain('Refusing');
  });
});
