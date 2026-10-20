import { readFileSync } from 'node:fs';
import type { VoiceTranscribeResult } from '@shared/channels';

/**
 * OpenAI-compatible `/v1/audio/transcriptions` client (qwen3-asr-server, whisper.cpp
 * server, LM Studio, …). Same request shape ZeroG Terminal uses for its server engine.
 */

const REQUEST_TIMEOUT_MS = 120_000;
const ERROR_BODY_CHARS = 300;

export function isSupportedSpeechEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Pull transcript text from OpenAI-style, segment, or plain-text replies. */
export function parseTranscriptionText(payload: unknown): string | null {
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    return trimmed || null;
  }
  if (typeof payload !== 'object' || payload === null) return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.text === 'string' && record.text.trim()) return record.text.trim();
  if (Array.isArray(record.segments)) {
    const joined = record.segments
      .map((segment) => (typeof segment === 'object' && segment !== null ? (segment as Record<string, unknown>).text : null))
      .filter((text): text is string => typeof text === 'string')
      .join(' ')
      .trim();
    if (joined) return joined;
  }
  if (typeof record.error === 'string') throw new Error(record.error);
  return null;
}

export type ServerTranscribeOptions = {
  url: string;
  model: string;
  language?: string;
  apiKey?: string;
  /** Absolute path to a wav (preferred) or other audio file the server accepts. */
  filePath: string;
  fetchImpl?: typeof fetch;
};

/**
 * POST multipart form to the transcriptions endpoint. Never throws — returns
 * VoiceTranscribeResult like the yapsnap path.
 */
export async function transcribeViaServer(options: ServerTranscribeOptions): Promise<VoiceTranscribeResult> {
  const url = options.url.trim();
  if (!isSupportedSpeechEndpoint(url)) {
    return { ok: false, error: 'Speech server URL must be http:// or https:// (e.g. http://127.0.0.1:8765/v1/audio/transcriptions).' };
  }
  if (!options.model.trim()) {
    return { ok: false, error: 'Speech server model name is required.' };
  }

  let bytes: Buffer;
  try {
    bytes = readFileSync(options.filePath);
  } catch (error) {
    return { ok: false, error: `Could not read audio file (${error instanceof Error ? error.message : String(error)}).` };
  }

  const form = new FormData();
  const file = new File([new Uint8Array(bytes)], 'utterance.wav', { type: 'audio/wav' });
  form.set('file', file);
  form.set('model', options.model.trim());
  form.set('response_format', 'json');
  const lang = (options.language ?? 'auto').trim();
  if (lang && lang !== 'auto') form.set('language', lang);

  const headers: Record<string, string> = {};
  const key = options.apiKey?.trim();
  if (key) headers.Authorization = `Bearer ${key}`;

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, error: `Speech server unreachable — ${error instanceof Error ? error.message : String(error)}` };
  }

  const bodyText = await response.text();
  if (!response.ok) {
    const snippet = bodyText.trim().slice(0, ERROR_BODY_CHARS);
    return { ok: false, error: `Speech server HTTP ${response.status}${snippet ? ` — ${snippet}` : ''}` };
  }

  let payload: unknown = bodyText;
  try {
    payload = JSON.parse(bodyText) as unknown;
  } catch {
    // plain-text transcript
  }

  try {
    const text = parseTranscriptionText(payload);
    if (!text) return { ok: false, error: 'Speech server returned no transcript text.' };
    return { ok: true, text };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Lightweight reachability probe (GET the origin or POST empty is avoided — HEAD/GET health). */
export async function probeSpeechServer(
  url: string,
  apiKey?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupportedSpeechEndpoint(url)) {
    return { ok: false, error: 'URL must be http:// or https://' };
  }
  let origin: string;
  try {
    origin = new URL(url.trim()).origin;
  } catch {
    return { ok: false, error: 'Invalid URL' };
  }
  const headers: Record<string, string> = {};
  if (apiKey?.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;
  try {
    const res = await fetchImpl(`${origin}/health`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true };
    // Some stacks have no /health — a 404 still means the host answered.
    if (res.status === 404) return { ok: true, error: undefined };
    return { ok: false, error: `HTTP ${res.status} from ${origin}/health` };
  } catch (error) {
    // Fall back: OPTIONS or GET on the transcriptions URL itself.
    try {
      const res = await fetchImpl(url.trim(), {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      // Method not allowed / bad request still proves the route exists.
      if (res.status < 500) return { ok: true };
      return { ok: false, error: `HTTP ${res.status}` };
    } catch (inner) {
      return { ok: false, error: inner instanceof Error ? inner.message : String(inner) };
    }
  }
}
