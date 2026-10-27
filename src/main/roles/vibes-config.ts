import type { RolesConfigInput, VibesRuntimeSettings } from '@shared/channels';

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
  contextWindow?: string;
}

/** The native key names vibes reads, in the order they appear in its schema. */
export type VibesConfigKey =
  | 'OLLAMA_BASE_URL'
  | 'OLLAMA_MODEL'
  | 'OLLAMA_API_KEY'
  | 'CONTEXT_WINDOW'
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
  | 'ENABLE_DECISION_INTERVENE_GATE'
  | 'MAX_STEPS'
  | 'MAX_CONCURRENT_TASKS'
  | 'YOLO_MODE'
  | 'THINKING_MODE'
  | 'CONTEXT_COMPACTION_ENABLED'
  | 'SMALL_MODEL_PROFILE'
  | 'TRIAGE_ENABLED'
  | 'TRIAGE_INTERVAL'
  | 'TRIAGE_AUTO_STEER'
  | 'MEMORY_ENABLED'
  | 'LOCAL_MEMORY';

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
  // vibes exposes a single CONTEXT_WINDOW for the runtime (not per-role). Prefer
  // executor's value, else default's — same collapse as OLLAMA_*.
  const contextWindow = pickContextWindow(input.executor, input.default);
  // The reviewer model is a separate endpoint the user must configure. Without
  // one, vibes defaults to `gemma2:27b` on the executor's server — a model that
  // usually doesn't exist there, failing every reviewed task and the final
  // adversarial audit. Unconfigured reviewer ⇒ turn both gates off explicitly.
  const reviewerConfigured = Boolean(reviewer.baseUrl || reviewer.model);

  return {
    OLLAMA_BASE_URL: normalizeOpenAiBaseUrl(ollama.baseUrl ?? ''),
    OLLAMA_MODEL: ollama.model ?? '',
    OLLAMA_API_KEY: ollama.apiKey ?? '',
    CONTEXT_WINDOW: contextWindow,
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
    // Defaults when Runtime slice is absent; Settings → Runtime overwrites on spawn.
    ENABLE_ADVERSARIAL_AUDIT: reviewerConfigured ? 'true' : 'false',
    ENABLE_DOUBLE_CHECK_COMPLETION: 'true',
    // Decision MCP is injected by writeVibesConfig when Settings has URL+token;
    // empty here so omitEmpty drops them from a roles-only save.
    KEV_MCP_URL: '',
    KEV_MCP_AUTH_TOKEN: '',
    ENABLE_DECISION_INTERVENE_GATE: '',
    // Runtime knobs come from Settings → Runtime via toVibesRuntimeConfig.
    MAX_STEPS: '',
    MAX_CONCURRENT_TASKS: '',
    YOLO_MODE: '',
    THINKING_MODE: '',
    CONTEXT_COMPACTION_ENABLED: '',
    SMALL_MODEL_PROFILE: '',
    TRIAGE_ENABLED: '',
    TRIAGE_INTERVAL: '',
    TRIAGE_AUTO_STEER: '',
    MEMORY_ENABLED: '',
    LOCAL_MEMORY: '',
  };
}

type EndpointBits = { baseUrl: string; model: string; apiKey?: string; contextWindow?: string };

function pickContextWindow(primary?: EndpointBits, fallback?: EndpointBits): string {
  const from = (e?: EndpointBits): string => {
    const raw = (e?.contextWindow ?? '').trim().replace(/[_\s,]/g, '');
    if (!/^\d+$/.test(raw)) return '';
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? String(n) : '';
  };
  return from(primary) || from(fallback) || '';
}

function pickEndpoint(primary: EndpointBits, fallback?: EndpointBits): VibesConfigField {
  const base = primary.baseUrl.trim();
  const model = primary.model.trim();
  const key = (primary.apiKey ?? '').trim();
  const ctx = pickContextWindow(primary);
  if (base || model || key || ctx) {
    return {
      baseUrl: base || undefined,
      model: model || undefined,
      apiKey: key || undefined,
      contextWindow: ctx || undefined,
    };
  }
  // Primary is empty — fall back to the shared default endpoint.
  if (!fallback) return {};
  const fbBase = fallback.baseUrl.trim();
  const fbModel = fallback.model.trim();
  const fbKey = (fallback.apiKey ?? '').trim();
  const fbCtx = pickContextWindow(fallback);
  if (!fbBase && !fbModel && !fbKey && !fbCtx) return {};
  return {
    baseUrl: fbBase || undefined,
    model: fbModel || undefined,
    apiKey: fbKey || undefined,
    contextWindow: fbCtx || undefined,
  };
}

/** Drop empty-string entries so a save never blanks keys the user left untouched. */
export function omitEmpty(config: Record<VibesConfigKey, string>): Partial<Record<VibesConfigKey, string>> {
  const out: Partial<Record<VibesConfigKey, string>> = {};
  for (const [key, value] of Object.entries(config)) {
    if (value) out[key as VibesConfigKey] = value;
  }
  return out;
}

function boolFlag(on: boolean): string {
  return on ? 'true' : 'false';
}

/**
 * Map Settings → Runtime knobs to vibes native keys. Always emits the full
 * Runtime slice so Desktop is the source of truth (including explicit `false`).
 */
export function toVibesRuntimeConfig(runtime: VibesRuntimeSettings): Partial<Record<VibesConfigKey, string>> {
  const maxSteps = Number.isFinite(runtime.maxSteps) && runtime.maxSteps > 0
    ? String(Math.floor(runtime.maxSteps))
    : '25';
  const maxConcurrent = Number.isFinite(runtime.maxConcurrentTasks) && runtime.maxConcurrentTasks > 0
    ? String(Math.floor(runtime.maxConcurrentTasks))
    : '1';
  const triageInterval = Number.isFinite(runtime.triageInterval) && runtime.triageInterval > 0
    ? String(Math.floor(runtime.triageInterval))
    : '5';
  return {
    MAX_STEPS: maxSteps,
    MAX_CONCURRENT_TASKS: maxConcurrent,
    YOLO_MODE: boolFlag(runtime.yoloMode),
    THINKING_MODE: runtime.thinkingMode ? 'enabled' : 'false',
    CONTEXT_COMPACTION_ENABLED: boolFlag(runtime.contextCompactionEnabled),
    SMALL_MODEL_PROFILE: boolFlag(runtime.smallModelProfile),
    TRIAGE_ENABLED: boolFlag(runtime.triageEnabled),
    TRIAGE_INTERVAL: triageInterval,
    TRIAGE_AUTO_STEER: boolFlag(runtime.triageAutoSteer),
    MEMORY_ENABLED: boolFlag(runtime.memoryEnabled),
    LOCAL_MEMORY: boolFlag(runtime.localMemory),
    ENABLE_DOUBLE_CHECK_COMPLETION: boolFlag(runtime.doubleCheckCompletion),
    ENABLE_ADVERSARIAL_AUDIT: boolFlag(runtime.adversarialAudit),
  };
}
