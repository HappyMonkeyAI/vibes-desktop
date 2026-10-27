import { describe, expect, it } from 'vitest';
import { toVibesConfig, toVibesRuntimeConfig, omitEmpty, normalizeOpenAiBaseUrl } from '../src/main/roles/vibes-config';
import type { RolesConfigInput, VibesRuntimeSettings } from '@shared/channels';

const full: RolesConfigInput = {
  default: { baseUrl: 'http://default:11434/v1', model: 'd-model', contextWindow: '8192', apiKey: 'dk' },
  planner: { baseUrl: 'http://planner:8080/v1', model: 'p-model', contextWindow: '4096', apiKey: 'pk' },
  executor: { baseUrl: 'http://exec:9000/v1', model: 'e-model', contextWindow: '16384', apiKey: 'ek' },
  reviewer: { baseUrl: 'http://reviewer:7000/v1', model: 'r-model', contextWindow: '8192', apiKey: 'rk' },
  triage: { baseUrl: 'http://triage:6000/v1', model: 't-model', contextWindow: '4096', apiKey: 'tk' },
};

describe('toVibesConfig (T9 mapping)', () => {
  it('maps default+executor onto OLLAMA_* with executor winning', () => {
    const cfg = toVibesConfig(full);
    // Executor is set, so it drives the shared OLLAMA endpoint.
    expect(cfg.OLLAMA_BASE_URL).toBe('http://exec:9000/v1');
    expect(cfg.OLLAMA_MODEL).toBe('e-model');
    expect(cfg.OLLAMA_API_KEY).toBe('ek');
  });

  it('falls back to default when executor is empty', () => {
    const cfg = toVibesConfig({ ...full, executor: { baseUrl: '', model: '', apiKey: '' } });
    expect(cfg.OLLAMA_BASE_URL).toBe('http://default:11434/v1');
    expect(cfg.OLLAMA_MODEL).toBe('d-model');
    expect(cfg.OLLAMA_API_KEY).toBe('dk');
    expect(cfg.CONTEXT_WINDOW).toBe('8192');
  });

  it('writes CONTEXT_WINDOW from executor, falling back to default', () => {
    expect(toVibesConfig(full).CONTEXT_WINDOW).toBe('16384');
    const fromDefault = toVibesConfig({
      ...full,
      executor: { baseUrl: 'http://exec:9000/v1', model: 'e-model', contextWindow: '', apiKey: 'ek' },
    });
    expect(fromDefault.CONTEXT_WINDOW).toBe('8192');
    const unset = toVibesConfig({
      ...full,
      default: { ...full.default, contextWindow: '' },
      executor: { ...full.executor, contextWindow: '' },
    });
    expect(unset.CONTEXT_WINDOW).toBe('');
  });

  it('gives planner/reviewer/triage their own prefixed keys', () => {
    const cfg = toVibesConfig(full);
    expect(cfg.PLANNER_BASE_URL).toBe('http://planner:8080/v1');
    expect(cfg.PLANNER_MODEL).toBe('p-model');
    expect(cfg.PLANNER_API_KEY).toBe('pk');
    expect(cfg.REVIEWER_MODEL).toBe('r-model');
    expect(cfg.TRIAGE_BASE_URL).toBe('http://triage:6000/v1');
  });

  it('leaves empty fields as empty strings (caller omits before merge)', () => {
    const cfg = toVibesConfig({
      ...full,
      triage: { baseUrl: '', model: '', apiKey: '' },
    });
    expect(cfg.TRIAGE_BASE_URL).toBe('');
    expect(cfg.TRIAGE_MODEL).toBe('');
  });

  it('normalizes a bare origin to its /v1 root (the false-done 404 fix)', () => {
    // The user typed http://host:11434 (no /v1) — the child SDK would post to
    // /chat/completions and 404. Config must carry the normalized URL.
    const cfg = toVibesConfig({
      ...full,
      executor: { baseUrl: 'http://192.168.5.232:11434', model: 'm', apiKey: '' },
    });
    expect(cfg.OLLAMA_BASE_URL).toBe('http://192.168.5.232:11434/v1');
  });

  it('enables the reviewer gates only when a reviewer is configured', () => {
    const configured = toVibesConfig(full);
    expect(configured.ENABLE_REVIEWER).toBe('true');
    expect(configured.ENABLE_ADVERSARIAL_AUDIT).toBe('true');
    expect(configured.ENABLE_DOUBLE_CHECK_COMPLETION).toBe('true');

    // Unconfigured reviewer → vibes would default to gemma2:27b on the
    // executor's server (a model that usually doesn't exist there) and fail
    // every reviewed task — so the desktop turns both gates off explicitly.
    const unconfigured = toVibesConfig({ ...full, reviewer: { baseUrl: '', model: '', apiKey: '' } });
    expect(unconfigured.ENABLE_REVIEWER).toBe('false');
    expect(unconfigured.ENABLE_ADVERSARIAL_AUDIT).toBe('false');
    // Double-check is deterministic evidence — stays on without a reviewer.
    expect(unconfigured.ENABLE_DOUBLE_CHECK_COMPLETION).toBe('true');
  });
});

describe('normalizeOpenAiBaseUrl', () => {
  it('appends /v1 to a bare origin', () => {
    expect(normalizeOpenAiBaseUrl('http://192.168.5.232:11434')).toBe('http://192.168.5.232:11434/v1');
    expect(normalizeOpenAiBaseUrl('http://192.168.5.232:11434/')).toBe('http://192.168.5.232:11434/v1');
  });

  it('leaves URLs that already carry a path untouched', () => {
    expect(normalizeOpenAiBaseUrl('http://localhost:11434/v1')).toBe('http://localhost:11434/v1');
    expect(normalizeOpenAiBaseUrl('http://localhost:11434/v1/')).toBe('http://localhost:11434/v1');
    expect(normalizeOpenAiBaseUrl('https://openrouter.ai/api/v1')).toBe('https://openrouter.ai/api/v1');
    expect(normalizeOpenAiBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
  });

  it('returns empty for empty/whitespace input', () => {
    expect(normalizeOpenAiBaseUrl('')).toBe('');
    expect(normalizeOpenAiBaseUrl('   ')).toBe('');
  });

  it('passes non-URL text through unchanged (probe surfaces the error)', () => {
    expect(normalizeOpenAiBaseUrl('not a url')).toBe('not a url');
  });
});

describe('omitEmpty (T9)', () => {
  it('drops empty-string entries so a save never blanks untouched keys', () => {
    const out = omitEmpty({ OLLAMA_MODEL: 'm', PLANNER_MODEL: '', REVIEWER_BASE_URL: '' } as never);
    expect(out).toEqual({ OLLAMA_MODEL: 'm' });
  });

  it('keeps explicit "false" flags (they are real values, not blanks)', () => {
    const out = omitEmpty({ ENABLE_REVIEWER: 'false', OLLAMA_MODEL: 'm' } as never);
    expect(out).toEqual({ ENABLE_REVIEWER: 'false', OLLAMA_MODEL: 'm' });
  });
});

describe('toVibesRuntimeConfig (T56/T57)', () => {
  const runtime: VibesRuntimeSettings = {
    maxSteps: 40,
    maxConcurrentTasks: 2,
    yoloMode: false,
    thinkingMode: true,
    contextCompactionEnabled: false,
    smallModelProfile: true,
    triageEnabled: true,
    triageInterval: 3,
    triageAutoSteer: false,
    memoryEnabled: true,
    localMemory: true,
    doubleCheckCompletion: true,
    adversarialAudit: false,
  };

  it('maps Settings Runtime knobs to vibes native keys', () => {
    expect(toVibesRuntimeConfig(runtime)).toEqual({
      MAX_STEPS: '40',
      MAX_CONCURRENT_TASKS: '2',
      YOLO_MODE: 'false',
      THINKING_MODE: 'enabled',
      CONTEXT_COMPACTION_ENABLED: 'false',
      SMALL_MODEL_PROFILE: 'true',
      TRIAGE_ENABLED: 'true',
      TRIAGE_INTERVAL: '3',
      TRIAGE_AUTO_STEER: 'false',
      MEMORY_ENABLED: 'true',
      LOCAL_MEMORY: 'true',
      ENABLE_DOUBLE_CHECK_COMPLETION: 'true',
      ENABLE_ADVERSARIAL_AUDIT: 'false',
    });
  });

  it('emits THINKING_MODE false when reasoning is off', () => {
    expect(toVibesRuntimeConfig({ ...runtime, thinkingMode: false }).THINKING_MODE).toBe('false');
  });
});
