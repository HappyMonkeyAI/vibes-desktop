import type { DecisionMcpConfig } from '@shared/channels';
import { decisionToolCandidates, probeDecisionTools } from './kev-client';

export type DecisionProbeResult = { ok: boolean; error?: string; detail?: string };

/** HTTP statuses that mean "the MCP host answered" for a bare GET (no session). */
const REACHABLE_WITHOUT_SESSION = new Set([200, 204, 400, 405, 406]);

function looksLikeStudioDecision(url: string): boolean {
  const tools = decisionToolCandidates(url);
  return tools[0] === 'system_one';
}

/**
 * Reachability + auth check for a streamable-HTTP decision MCP.
 *
 * Bare GET is not a valid MCP session: servers often reply 400/406. That still
 * proves the URL + network path work. 401/403 mean the bearer is wrong.
 *
 * For Unsloth Studio (`:8888` / unsloth hosts), also runs a real `system_one`
 * tools/call so a classic KEV token does not false-pass Settings → Test.
 */
export async function probeDecisionMcp(config: DecisionMcpConfig): Promise<DecisionProbeResult> {
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

  if (looksLikeStudioDecision(config.url)) {
    return probeDecisionTools({ config });
  }

  return {
    ok: true,
    detail: 'Reachable. Decision model is on when URL + token stay set.',
  };
}
