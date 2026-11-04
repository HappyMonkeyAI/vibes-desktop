/**
 * T83 — lightweight HTTP MCP probe (initialize only).
 * Stdio servers are validated in the UI (command required); spawning them here
 * would hang Settings. Reuses the same Accept / JSON-RPC shape as Decision probe.
 */

export type McpProbeResult = { ok: boolean; error?: string; detail?: string };

type FetchLike = typeof fetch;

export async function probeHttpMcp(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<McpProbeResult> {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: 'URL is empty.' };
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
  } catch {
    return { ok: false, error: 'URL is not valid.' };
  }

  try {
    const res = await fetchImpl(trimmed, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'vibes-desktop-mcp-probe', version: '0.2.0' },
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error: `HTTP ${res.status} — auth required (this probe sends no bearer).`,
        detail: await res.text().catch(() => undefined),
      };
    }
    if (res.status >= 400) {
      return {
        ok: false,
        error: `HTTP ${res.status}`,
        detail: (await res.text().catch(() => '')).slice(0, 400) || undefined,
      };
    }
    const text = await res.text();
    // SSE or JSON both count as "answered" for registry health.
    if (text.includes('jsonrpc') || text.includes('data:') || res.ok) {
      return { ok: true, detail: `HTTP ${res.status}` };
    }
    return { ok: true, detail: `HTTP ${res.status} (empty body)` };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
