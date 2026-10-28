import { afterEach, describe, expect, it } from 'vitest';
import { probeDecisionMcp } from '../src/main/decision/probe';
import { kevEvaluateIntervene, extractInterveneSignals } from '../src/main/decision/kev-client';
import { decideInterveneAction } from '../src/main/decision/intervene-gate';
import { startMockDecisionMcp, type MockDecisionMcp } from './helpers/mock-decision-mcp';

describe('mock Decision MCP (hermetic wiring)', () => {
  let mock: MockDecisionMcp | null = null;

  afterEach(async () => {
    await mock?.close();
    mock = null;
  });

  it('Settings probe passes against a Decision-shaped MCP', async () => {
    mock = await startMockDecisionMcp({ choice: 'continue' });
    const result = await probeDecisionMcp({ url: mock.url, token: mock.token });
    expect(result.ok).toBe(true);
    expect(result.detail).toMatch(/mock-decision|Decision tool/);
  });

  it('rejects wrong bearer', async () => {
    mock = await startMockDecisionMcp();
    const result = await probeDecisionMcp({ url: mock.url, token: 'wrong' });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Unauthorized/);
  });

  it('evaluate → gate maps escalate for Needs You path', async () => {
    mock = await startMockDecisionMcp({ choice: 'escalate' });
    const evaluated = await kevEvaluateIntervene({
      config: { url: mock.url, token: mock.token },
      state: { open_question: 'escalate?', symptom: 'blocked' },
    });
    expect(evaluated).not.toBeNull();
    const signals = extractInterveneSignals(evaluated);
    const gate = decideInterveneAction(signals);
    expect(gate.action).toBe('escalate');
  });
});
