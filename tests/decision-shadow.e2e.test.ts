import { describe, expect, it } from 'vitest';
import { kevEvaluateIntervene, extractInterveneSignals } from '../src/main/decision/kev-client';
import { decideInterveneAction, toAutoResolution } from '../src/main/decision/intervene-gate';

/**
 * Live Decision shadow — calls real KEV MCP when credentials are in the env.
 *
 *   VIBES_DECISION_LIVE=1 KEV_MCP_URL=… KEV_MCP_AUTH_TOKEN=… npm test -- tests/decision-shadow.e2e.test.ts
 *
 * Skipped by default so `npm test` stays hermetic.
 */

const live = process.env.VIBES_DECISION_LIVE === '1';
const url = (process.env.KEV_MCP_URL ?? '').trim();
const token = (process.env.KEV_MCP_AUTH_TOKEN ?? '').trim();

describe.runIf(live && Boolean(url && token))('decision shadow (live KEV MCP)', () => {
  it(
    'evaluates intervene vs continue and maps through the gate',
    async () => {
      const result = await kevEvaluateIntervene({
        config: { url, token },
        state: {
          mission: 'Add a dark header to index.html',
          symptom: 'CSS task failed css_orphan on styles.css',
          open_question: 'escalate to operator or auto-retry?',
        },
      });
      expect(result, 'kev_evaluate returned null — check MCP URL/token/session').not.toBeNull();
      const signals = extractInterveneSignals(result);
      expect(signals.choice || signals.probabilities).toBeTruthy();
      const gate = decideInterveneAction(signals);
      expect(['continue', 'escalate', 'skip']).toContain(gate.action);
      // Near-tie or escalate ⇒ no auto resolution; continue/skip may auto.
      if (gate.action === 'escalate') expect(toAutoResolution(gate.action)).toBeNull();
    },
    90_000,
  );
});

describe('decision shadow (offline fixtures)', () => {
  it('maps a clear continue answer through the gate', () => {
    const gate = decideInterveneAction({
      choice: 'continue',
      probabilities: { continue: 0.6, escalate: 0.25, skip: 0.15 },
    });
    expect(gate.action).toBe('continue');
    expect(toAutoResolution(gate.action)?.action).toBe('retry');
  });
});
