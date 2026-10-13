import { describe, expect, it } from 'vitest';
import { toVibesConfig, omitEmpty } from '../src/main/roles/vibes-config';
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
});

describe('omitEmpty (T9)', () => {
  it('drops empty-string entries so a save never blanks untouched keys', () => {
    const out = omitEmpty({ OLLAMA_MODEL: 'm', PLANNER_MODEL: '', REVIEWER_BASE_URL: '' } as never);
    expect(out).toEqual({ OLLAMA_MODEL: 'm' });
  });
});
