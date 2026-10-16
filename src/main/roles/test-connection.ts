import type { TestConnectionRequest, TestConnectionResult } from '@shared/channels';

/**
 * T8 — probe a single endpoint with a 1-token chat completion. Uses the global
 * fetch (Node 18+) so no client library is needed; a 10s AbortSignal keeps a dead
 * box from hanging the settings pane. A fresh request each time reflects exactly
 * what the user just typed, not a stale cached endpoint.
 */

const TIMEOUT_MS = 30_000;

export async function testConnection(req: TestConnectionRequest): Promise<TestConnectionResult> {
  const baseUrl = (req.baseUrl ?? '').trim().replace(/\/+$/, '');
  const model = (req.model ?? '').trim();
  if (!baseUrl || !model) return { ok: false, error: 'Both a base URL and a model are required.' };

  // The base URL is the OpenAI-compatible root as configured per role — e.g.
  // `http://localhost:11434/v1` for Ollama or `https://api.openai.com/v1`.
  // We append only `/chat/completions`; a second `/v1` would 404 on every such host.
  const url = `${baseUrl}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(req.apiKey ? { Authorization: `Bearer ${req.apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      signal: controller.signal,
    });
    if (res.ok) return { ok: true };
    const detail = await safeErrorDetail(res);
    return { ok: false, error: `Endpoint responded ${res.status}${detail ? ` — ${detail}` : ''}.` };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, error: 'Connection timed out after 30s.' };
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function safeErrorDetail(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } | string };
      if (typeof parsed.error === 'string') return parsed.error;
      return parsed.error?.message ?? '';
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return '';
  }
}
