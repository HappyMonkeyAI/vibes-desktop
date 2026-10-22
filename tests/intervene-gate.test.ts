import { describe, expect, it } from 'vitest';
import { decideInterveneAction, toAutoResolution } from '../src/main/decision/intervene-gate';

describe('decideInterveneAction (T26)', () => {
  it('escalates when choice is missing', () => {
    const r = decideInterveneAction({});
    expect(r.action).toBe('escalate');
    expect(toAutoResolution(r.action)).toBeNull();
  });

  it('continues when continue clearly wins on probabilities', () => {
    const r = decideInterveneAction({
      choice: 'continue',
      probabilities: { continue: 0.55, escalate: 0.25, skip: 0.2 },
    });
    expect(r.action).toBe('continue');
    expect(toAutoResolution(r.action)?.action).toBe('retry');
  });

  it('escalates on near-tie (T29-like margins)', () => {
    const r = decideInterveneAction({
      choice: 'escalate',
      probabilities: { escalate: 0.3875, continue: 0.3732, skip: 0.2393 },
      minMargin: 0.05,
    });
    expect(r.action).toBe('escalate');
  });

  it('prefers probability argmax over a mismatched choice string', () => {
    const r = decideInterveneAction({
      choice: 'skip',
      probabilities: { continue: 0.7, escalate: 0.2, skip: 0.1 },
    });
    expect(r.action).toBe('continue');
  });

  it('maps skip to auto-skip', () => {
    const r = decideInterveneAction({
      choice: 'skip',
      probabilities: { skip: 0.8, continue: 0.1, escalate: 0.1 },
    });
    expect(r.action).toBe('skip');
    expect(toAutoResolution(r.action)?.action).toBe('skip');
  });

  it('refuses continue without probabilities', () => {
    const r = decideInterveneAction({ choice: 'continue' });
    expect(r.action).toBe('escalate');
  });
});
