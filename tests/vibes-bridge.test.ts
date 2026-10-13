import { describe, expect, it } from 'vitest';
import { buildChildEnv, VibesBridge, type TaskStatusEvent } from '../src/main/bridge/vibes-bridge';

describe('VibesBridge env allowlist (T4)', () => {
  it('passes only allowlisted LLM keys into the child env', () => {
    const env = buildChildEnv({
      OLLAMA_BASE_URL: 'http://127.0.0.1:11434/v1',
      OLLAMA_MODEL: 'qwen3.6-27b',
      OLLAMA_API_KEY: 'secret-key',
      CONTEXT_WINDOW: '8192',
      // These must NOT leak into the child:
      GITHUB_TOKEN: 'ghp_should-not-cross',
      DATABASE_URL: 'postgres://should-not-cross',
      HERMES_VAULT_PASSWORD: 'nope',
    });
    expect(env.OLLAMA_BASE_URL).toBe('http://127.0.0.1:11434/v1');
    expect(env.OLLAMA_MODEL).toBe('qwen3.6-27b');
    expect(env.OLLAMA_API_KEY).toBe('secret-key');
    expect(env.CONTEXT_WINDOW).toBe('8192');
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.HERMES_VAULT_PASSWORD).toBeUndefined();
  });

  it('never carries the parent process env wholesale', () => {
    // Whatever is in the real environment, a key that is neither platform-base
    // nor allowlisted must not appear.
    const env = buildChildEnv({ SOME_RANDOM_APP_SECRET: 'x' } as Record<string, string>);
    expect(env.SOME_RANDOM_APP_SECRET).toBeUndefined();
  });
});

describe('VibesBridge task-status events (T4)', () => {
  function bridgeWithTaskEvents() {
    const bridge = new VibesBridge({
      vibesPath: '/nonexistent',
      workspaceRoot: '/tmp',
    });
    const events: TaskStatusEvent[] = [];
    const logs: string[] = [];
    bridge.on('task-status', (e: TaskStatusEvent) => events.push(e));
    bridge.on('log', (line: string) => logs.push(line));
    return { bridge, events, logs };
  }

  it('parses [TASK_STATUS] lines into structured events', () => {
    const { bridge, events } = bridgeWithTaskEvents();
    // The bridge forwards the client's 'log' event; drive it directly (no child process).
    bridge.client.emit('log', '[TASK_STATUS] {"name": "Set up project", "status": "in-progress"}');
    bridge.client.emit('log', '[TASK_STATUS] {"name": "Write tests", "status": "complete"}');

    expect(events).toEqual([
      { name: 'Set up project', status: 'in-progress' },
      { name: 'Write tests', status: 'complete' },
    ]);
  });

  it('forwards plain stderr lines as log, not task events', () => {
    const { bridge, events, logs } = bridgeWithTaskEvents();
    bridge.client.emit('log', '[INFO] starting mission');
    bridge.client.emit('log', 'random warning line');

    expect(events).toEqual([]);
    expect(logs).toEqual(['[INFO] starting mission', 'random warning line']);
  });

  it('treats a malformed [TASK_STATUS] payload as a plain log', () => {
    const { bridge, events, logs } = bridgeWithTaskEvents();
    bridge.client.emit('log', '[TASK_STATUS] {not valid json');
    expect(events).toEqual([]);
    expect(logs).toContain('[TASK_STATUS] {not valid json');
  });
});
