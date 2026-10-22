import type { RolesConfigInput } from '@shared/channels';

/**
 * T9 — map our five-role endpoint config to vibes' native `.vibes/config.json`
 * key names. Read from vibes 0.4.0 `src/config.ts` ConfigSchema: there is no
 * dedicated EXECUTOR_* — the executor runs on the default OLLAMA_* endpoint, so
 * `default` and `executor` collapse onto the same keys (the more specific one
 * wins). Planner/reviewer/triage each get their own prefixed MODEL/BASE_URL/
 * API_KEY. Empty values are omitted so a half-configured role doesn't clobber
 * a working persisted config with blanks.
 */

export interface VibesConfigField {
  model?: string;
  baseUrl?: string;
  apiKey?: string;
}

/** The native key names vibes reads, in the order they appear in its schema. */
export type VibesConfigKey =
  | 'OLLAMA_BASE_URL'
  | 'OLLAMA_MODEL'
  | 'OLLAMA_API_KEY'
  | 'PLANNER_MODEL'
  | 'PLANNER_BASE_URL'
  | 'PLANNER_API_KEY'
  | 'REVIEWER_MODEL'
  | 'REVIEWER_BASE_URL'
  | 'REVIEWER_API_KEY'
  | 'TRIAGE_MODEL'
  | 'TRIAGE_BASE_URL'
  | 'TRIAGE_API_KEY'
  | 'ENABLE_REVIEWER'
  | 'ENABLE_ADVERSARIAL_AUDIT'
  | 'ENABLE_DOUBLE_CHECK_COMPLETION'
  | 'KEV_MCP_URL'
  | 'KEV_MCP_AUTH_TOKEN'
  | 'ENABLE_DECISION_INTERVENE_GATE';

/**
 * OpenAI-compatible providers serve under a version prefix (Ollama, LM Studio,
 * OpenAI: `/v1`; OpenRouter: `/api/v1`). Users often paste the bare origin
 * (`http://host:11434`), which makes every SDK call land on `/chat/completions`
 * and 404. Append `/v1` only when the URL has no path so full URLs pass through.
 */
export function normalizeOpenAiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    if (!url.pathname || url.pathname === '/') {
      url.pathname = '/v1';
      return url.toString().replace(/\/+$/, '');
    }
    return trimmed;
  } catch {
    return trimmed; // not a URL — leave untouched; the probe surfaces the error
  }
}

/**
 * Build the native config object for a workspace. Only non-empty fields are
 * emitted, so merging with an existing file (the way vibes' updateConfig does)
 * never blanks out keys the user didn't touch this save.
 */
export function toVibesConfig(input: RolesConfigInput): Record<VibesConfigKey, string> {
  // default and executor both drive the OLLAMA_* endpoint; executor wins when set.
  const ollama = pickEndpoint(input.executor, input.default);
  const planner = pickEndpoint(input.planner);
  const reviewer = pickEndpoint(input.reviewer);
  const triage = pickEndpoint(input.triage);
  // The reviewer model is a separate endpoint the user must configure. Without
  // one, vibes defaults to `gemma2:27b` on the executor's server — a model that
  // usually doesn't exist there, failing every reviewed task and the final
  // adversarial audit. Unconfigured reviewer ⇒ turn both gates off explicitly.
  const reviewerConfigured = Boolean(reviewer.baseUrl || reviewer.model);

  return {
    OLLAMA_BASE_URL: normalizeOpenAiBaseUrl(ollama.baseUrl ?? ''),
    OLLAMA_MODEL: ollama.model ?? '',
    OLLAMA_API_KEY: ollama.apiKey ?? '',
    PLANNER_MODEL: planner.model ?? '',
    PLANNER_BASE_URL: normalizeOpenAiBaseUrl(planner.baseUrl ?? ''),
    PLANNER_API_KEY: planner.apiKey ?? '',
    REVIEWER_MODEL: reviewer.model ?? '',
    REVIEWER_BASE_URL: normalizeOpenAiBaseUrl(reviewer.baseUrl ?? ''),
    REVIEWER_API_KEY: reviewer.apiKey ?? '',
    TRIAGE_MODEL: triage.model ?? '',
    TRIAGE_BASE_URL: normalizeOpenAiBaseUrl(triage.baseUrl ?? ''),
    TRIAGE_API_KEY: triage.apiKey ?? '',
    ENABLE_REVIEWER: reviewerConfigured ? 'true' : 'false',
    ENABLE_ADVERSARIAL_AUDIT: reviewerConfigured ? 'true' : 'false',
    // Always on: deterministic evidence re-check before mission success (Cline-style).
    ENABLE_DOUBLE_CHECK_COMPLETION: 'true',
  };
}

function pickEndpoint(primary: { baseUrl: string; model: string; apiKey?: string }, fallback?: { baseUrl: string; model: string; apiKey?: string }): VibesConfigField {
  const base = primary.baseUrl.trim();
  const model = primary.model.trim();
  const key = (primary.apiKey ?? '').trim();
  if (base || model || key) return { baseUrl: base || undefined, model: model || undefined, apiKey: key || undefined };
  // Primary is empty — fall back to the shared default endpoint.
  if (!fallback) return {};
  const fbBase = fallback.baseUrl.trim();
  const fbModel = fallback.model.trim();
  const fbKey = (fallback.apiKey ?? '').trim();
  if (!fbBase && !fbModel && !fbKey) return {};
  return { baseUrl: fbBase || undefined, model: fbModel || undefined, apiKey: fbKey || undefined };
}

/** Drop empty-string entries so a save never blanks keys the user left untouched. */
export function omitEmpty(config: Record<VibesConfigKey, string>): Partial<Record<VibesConfigKey, string>> {
  const out: Partial<Record<VibesConfigKey, string>> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value) out[key as VibesConfigKey] = value;
  }
  return out;
}
