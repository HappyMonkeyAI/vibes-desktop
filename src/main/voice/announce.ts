/**
 * T24 — Agent Voice TTS announce via local daemon `POST /v1/announce`
 * (agent-voice-tts schema v1). Failures are soft — never fail a mission over TTS.
 */

export type AnnounceInput = {
  text: string;
  /** 0–9; mission terminal defaults to mid priority. */
  priority?: number;
  sourceName?: string;
};

export type AnnounceResult = {
  ok: boolean;
  status?: number;
  error?: string;
  id?: string;
};

export type AnnounceConfig = {
  baseUrl: string;
  token: string;
};

export type FetchLike = typeof fetch;

function truncate(text: string, max = 2000): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Build a schema-v1 announcement body (no I/O). */
export function buildAnnounceEvent(input: AnnounceInput): {
  version: '1';
  id: string;
  priority: number;
  text: string;
  source: { name: string; host?: string };
  createdAt: string;
} {
  const priority = Math.max(0, Math.min(9, Math.trunc(input.priority ?? 5)));
  return {
    version: '1',
    id: `vibes-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    priority,
    text: truncate(input.text),
    source: { name: (input.sourceName ?? 'vibes-desktop').slice(0, 64) },
    createdAt: new Date().toISOString(),
  };
}

export async function announceToDaemon(
  config: AnnounceConfig,
  input: AnnounceInput,
  fetchImpl: FetchLike = fetch,
): Promise<AnnounceResult> {
  const base = config.baseUrl.trim().replace(/\/+$/, '');
  const token = config.token.trim();
  if (!base || !token) {
    return { ok: false, error: 'TTS announce is off — set daemon URL and token in Settings → Voice.' };
  }
  const text = truncate(input.text);
  if (!text) return { ok: false, error: 'Nothing to announce.' };

  const url = `${base}/v1/announce`;
  const body = buildAnnounceEvent({ ...input, text });
  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, error: `Unauthorized (HTTP ${res.status})` };
    }
    if (res.status === 202 || res.status === 200) {
      const json = (await res.json().catch(() => ({}))) as { id?: string };
      return { ok: true, status: res.status, id: json.id ?? body.id };
    }
    const errText = await res.text().catch(() => '');
    return {
      ok: false,
      status: res.status,
      error: errText.slice(0, 200) || `HTTP ${res.status}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/abort/i.test(message)) return { ok: false, error: 'TTS daemon timed out.' };
    return { ok: false, error: message };
  }
}

export function missionAnnounceText(status: 'done' | 'failed', title: string, detail?: string): string {
  const shortTitle = title.replace(/\s+/g, ' ').trim().slice(0, 120) || 'mission';
  if (status === 'done') return `Mission complete: ${shortTitle}`;
  const why = detail?.replace(/\s+/g, ' ').trim().slice(0, 160);
  return why ? `Mission failed: ${shortTitle}. ${why}` : `Mission failed: ${shortTitle}`;
}
