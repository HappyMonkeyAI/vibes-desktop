import type { DecisionMcpConfig } from '@shared/channels';
import { probeDecisionTools } from './kev-client';

export type DecisionProbeResult = { ok: boolean; error?: string; detail?: string };

/** HTTP statuses that mean "the MCP host answered" for a bare GET (no session). */
const REACHABLE_WITHOUT_SESSION = new Set([200, 204, 400, 405, 406]);

/**
 * Local Speech defaults often use :8765 for OpenAI-compatible ASR.
 * Decision MCP is a different service (usually …/mcp) — reject speech URLs early.
 */
export function speechUrlMistakenForDecision(url: string): string | null {
  const u = url.trim().toLowerCase();
  if (!u) return null;
  if (u.includes('/v1/audio') || u.includes('/audio/transcriptions')) {
    return 'That looks like the Speech ASR URL. Decision needs an MCP endpoint (…/mcp), usually Unsloth :8888/mcp/ or a classic KEV MCP host — not the qwen3-asr /transcriptions path.';
  }
  try {
    const path = new URL(url.trim()).pathname.replace(/\/+$/, '') || '/';
    if (path === '/health') {
      return 'Decision MCP URL should end in /mcp (or /mcp/), not /health. Local :8765/health is often Speech ASR, not KEV.';
    }
  } catch {
    /* invalid URL — let fetch report it */
  }
  return null;
}

/**
 * Reachability + auth check for a streamable-HTTP decision MCP.
 *
 * Bare GET is not a valid MCP session: servers often reply 400/406. That still
 * proves the URL + network path work. 401/403 mean the bearer is wrong.
 *
 * Always follows with a real tools/call (`system_one` / `kev_evaluate`) so a
 * wrong host (e.g. Speech ASR on :8765) or wrong token cannot false-pass.
 */
export async function probeDecisionMcp(config: DecisionMcpConfig): Promise<DecisionProbeResult> {
  const mistaken = speechUrlMistakenForDecision(config.url);
  if (mistaken) return { ok: false, error: mistaken };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(config.url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/json, text/event-stream',
      },
      signal: controller.signal,
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: `Unauthorized (HTTP ${res.status}) — check the MCP bearer token.` };
    }
    if (!REACHABLE_WITHOUT_SESSION.has(res.status)) {
      return { ok: false, error: `Unexpected HTTP ${res.status}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('abort') || message.includes('AbortError')) {
      return { ok: false, error: 'Timed out reaching the decision MCP.' };
    }
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }

  return probeDecisionTools({ config });
}
