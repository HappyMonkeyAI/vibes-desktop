import type { DecisionMcpConfig } from '@shared/channels';

/**
 * Minimal streamable-HTTP MCP client for decision tools (T26).
 * Session: initialize → notifications/initialized → tools/call.
 * Failures return null so the intervene gate can escalate safely.
 *
 * Tool names: HappyMonkey **kev-decision-mcp** exposes `kev_evaluate`;
 * Unsloth Studio Decision API MCP exposes `system_one` (same question shape).
 */

export interface KevEvaluateAnswer {
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
}

export interface KevEvaluateResult {
  answers?: Record<string, KevEvaluateAnswer>;
  latency_ms?: number;
  model?: string;
  raw?: unknown;
}

export type FetchLike = typeof fetch;

function parseSseOrJson(body: string): unknown {
  const trimmed = body.trim();
  if (!trimmed) return null;
  // SSE: take the last data: JSON line
  if (trimmed.includes('data:')) {
    const lines = trimmed.split(/\r?\n/).filter((l) => l.startsWith('data:'));
    const last = lines.at(-1)?.slice(5).trim();
    if (last && last !== '[DONE]') {
      try {
        return JSON.parse(last);
      } catch {
        /* fall through */
      }
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

type HeaderMap = Record<string, string>;

function sessionHeaders(base: HeaderMap, sessionId: string | null): HeaderMap {
  const h = { ...base };
  if (sessionId) h['mcp-session-id'] = sessionId;
  return h;
}

async function mcpPost(
  url: string,
  headers: HeaderMap,
  body: unknown,
  fetchImpl: FetchLike,
  sessionId: string | null,
): Promise<{ status: number; sessionId: string | null; payload: unknown }> {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: sessionHeaders(headers, sessionId),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const nextSession = res.headers.get('mcp-session-id') || sessionId;
  const text = await res.text();
  const parsed = parseSseOrJson(text);
  return { status: res.status, sessionId: nextSession, payload: parsed };
}

const INTERVENE_ARGS = {
  questions: {
    action: {
      type: 'choice',
      instructions: 'Mission triage: intervene vs continue',
      criteria: {
        continue: 'Keep executing; no operator needed yet',
        escalate: 'Ask the operator / open intervention',
        skip: 'Skip the blocked work and move on',
      },
    },
  },
} as const;

/** Prefer Unsloth `system_one` when the URL looks like Studio; else KEV first. */
export function decisionToolCandidates(url: string): string[] {
  const u = url.toLowerCase();
  if (u.includes('unsloth') || u.includes(':8888')) {
    return ['system_one', 'kev_evaluate'];
  }
  return ['kev_evaluate', 'system_one'];
}

function parseToolResult(rpc: { result?: unknown; error?: unknown } | null): KevEvaluateResult | null {
  if (!rpc || rpc.error) return null;
  const result = rpc.result as {
    structuredContent?: KevEvaluateResult;
    content?: Array<{ type?: string; text?: string }>;
    isError?: boolean;
  } | null;
  if (!result || result.isError) return null;
  if (result.structuredContent && typeof result.structuredContent === 'object') {
    return { ...result.structuredContent, raw: result.structuredContent };
  }
  const text = result.content?.find((c) => c.type === 'text')?.text;
  if (text) {
    try {
      const parsed = JSON.parse(text) as KevEvaluateResult;
      return { ...parsed, raw: parsed };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Call a System One–compatible MCP tool for triage intervene vs continue.
 * Returns null on transport / auth / shape failure (caller escalates).
 */
export async function kevEvaluateIntervene(options: {
  config: DecisionMcpConfig;
  state: Record<string, unknown>;
  fetchImpl?: FetchLike;
  /** Override tool probe order (tests). */
  toolNames?: string[];
}): Promise<KevEvaluateResult | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: HeaderMap = {
    Authorization: `Bearer ${options.config.token}`,
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };

  try {
    const init = await mcpPost(
      options.config.url,
      headers,
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'vibes-desktop', version: '0.0.1' },
        },
      },
      fetchImpl,
      null,
    );
    if (init.status === 401 || init.status === 403) return null;
    const sessionId = init.sessionId;
    if (!sessionId && init.status >= 400) return null;

    // initialized notification (no response expected)
    await fetchImpl(options.config.url, {
      method: 'POST',
      headers: sessionHeaders(headers, sessionId),
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => undefined);

    const tools = options.toolNames ?? decisionToolCandidates(options.config.url);
    for (const name of tools) {
      const call = await mcpPost(
        options.config.url,
        headers,
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name,
            arguments: {
              state: options.state,
              ...INTERVENE_ARGS,
            },
          },
        },
        fetchImpl,
        sessionId,
      );
      if (call.status >= 400) continue;
      const parsed = parseToolResult(call.payload as { result?: unknown; error?: unknown } | null);
      if (parsed) return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Pull choice + probabilities from a kev_evaluate payload. */
export function extractInterveneSignals(result: KevEvaluateResult | null): {
  choice?: string;
  probabilities?: Record<string, number>;
} {
  if (!result?.answers || typeof result.answers !== 'object') return {};
  const action = result.answers.action ?? Object.values(result.answers)[0];
  if (!action || typeof action !== 'object') return {};
  return {
    choice: typeof action.choice === 'string' ? action.choice : undefined,
    probabilities:
      action.probabilities && typeof action.probabilities === 'object'
        ? action.probabilities
        : undefined,
  };
}
