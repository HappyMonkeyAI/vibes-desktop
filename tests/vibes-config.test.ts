import { describe, expect, it } from 'vitest';
import { toVibesConfig, omitEmpty, normalizeOpenAiBaseUrl } from '../src/main/roles/vibes-config';
import type { RolesConfigInput } from '@shared/channels';

const full: RolesConfigInput = {
  default: { baseUrl: 'http://default:11434/v1', model: 'd-model', apiKey: 'dk' },
  planner: { baseUrl: 'http://planner:8080/v1', model: 'p-model', apiKey: 'pk' },
  executor: { baseUrl: 'http://exec:9000/v1', model: 'e-model', apiKey: 'ek' },
  reviewer: { baseUrl: 'http://reviewer:7000/v1', model: 'r-model', apiKey: 'rk' },
  triage: { baseUrl: 'http://triage:6000/v1', model: 't-model', apiKey: 'tk' },
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

    // Unconfigured reviewer → vibes would default to gemma2:27b on the
    // executor's server (a model that usually doesn't exist there) and fail
    // every reviewed task — so the desktop turns both gates off explicitly.
    const unconfigured = toVibesConfig({ ...full, reviewer: { baseUrl: '', model: '', apiKey: '' } });
    expect(unconfigured.ENABLE_REVIEWER).toBe('false');
    expect(unconfigured.ENABLE_ADVERSARIAL_AUDIT).toBe('false');
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
