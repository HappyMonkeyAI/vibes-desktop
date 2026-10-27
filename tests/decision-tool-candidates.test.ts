import { describe, expect, it } from 'vitest';
import { decisionToolCandidates } from '../src/main/decision/kev-client';

describe('decisionToolCandidates', () => {
  it('prefers system_one for Unsloth Studio MCP', () => {
    expect(decisionToolCandidates('http://192.168.5.157:8888/mcp/')).toEqual([
      'system_one',
      'kev_evaluate',
    ]);
  });

  it('prefers kev_evaluate for HappyMonkey KEV MCP', () => {
    expect(decisionToolCandidates('http://192.168.5.157:8765/mcp')).toEqual([
      'kev_evaluate',
      'system_one',
    ]);
  });
});
