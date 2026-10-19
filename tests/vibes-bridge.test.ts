import { describe, expect, it } from 'vitest';
import { buildChildEnv, unwrapToolResult, VibesBridge, type TaskStatusEvent } from '../src/main/bridge/vibes-bridge';

describe('unwrapToolResult (false-done fix: MCP results are objects, not strings)', () => {
  it('passes through a bare string (older/other servers)', () => {
    expect(unwrapToolResult('plain text', 'plan_mission')).toBe('plain text');
  });

  it('unwraps the FastMCP { content: [{ type: "text", text }] } shape', () => {
    const result = { content: [{ type: 'text', text: 'Mission completed. Completed 1/1 tasks.' }], isError: false };
    expect(unwrapToolResult(result, 'start_execution')).toBe('Mission completed. Completed 1/1 tasks.');
  });

  it('joins multiple text parts with newlines', () => {
    const result = { content: [{ type: 'text', text: 'line one' }, { type: 'text', text: 'line two' }] };
    expect(unwrapToolResult(result, 'query_status')).toBe('line one\nline two');
  });

  it('throws the tool text when isError is true (a failed call is a rejection)', () => {
    const result = {
      content: [{ type: 'text', text: 'Tool \'plan_mission\' execution failed: 404 Not Found' }],
      isError: true,
    };
    expect(() => unwrapToolResult(result, 'plan_mission')).toThrow(/execution failed: 404/);
  });

  it('throws on an unexpected shape instead of silently succeeding', () => {
    expect(() => unwrapToolResult({ weird: true }, 'plan_mission')).toThrow(/unexpected result shape/i);
    expect(() => unwrapToolResult(undefined, 'plan_mission')).toThrow(/unexpected result shape/i);
  });
});

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

// Shared helper — module-scoped so the spawn-failure block can reuse it too.
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

describe('VibesBridge task-status events (T4)', () => {
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

describe('VibesBridge spawn failure (S2 — never crash the app)', () => {
  it('swallows a child spawn error so no uncaught exception reaches the process', async () => {
    const { bridge } = bridgeWithTaskEvents();
    // A nonexistent binary makes spawn emit 'error' (ENOENT) on every platform.
    const proc = (await import('node:child_process')).spawn('definitely-not-a-real-binary-xyz', []);
    const uncaught: unknown[] = [];
    const onUncaught = (err: unknown) => uncaught.push(err);
    process.on('uncaughtException', onUncaught);
    // Register the error wait BEFORE attach so we never miss an early fire.
    const sawError = new Promise<void>((resolve) => {
      proc.once('error', () => resolve());
      setTimeout(resolve, 1500); // safety net
    });
    try {
      bridge.client.attach(proc as import('node:child_process').ChildProcess);
      await sawError;
      await new Promise((r) => setTimeout(r, 50)); // let any uncaughtException surface
    } finally {
      process.off('uncaughtException', onUncaught);
      try { proc.kill(); } catch { /* already dead */ }
    }
    expect(uncaught).toEqual([]);
  });

  it('rejects an in-flight request when the child dies mid-call', async () => {
    const { bridge } = bridgeWithTaskEvents();
    const proc = (await import('node:child_process')).spawn('definitely-not-a-real-binary-xyz', []);
    bridge.client.attach(proc as import('node:child_process').ChildProcess);
    // Race the request against the spawn error; whichever settles first, it must
    // REJECT (never hang, never throw uncaught).
    const pending = bridge.client.sendRequest('initialize', {}, 2000);
    await expect(pending).rejects.toThrow(/not running|spawn error|not found/i);
    try { proc.kill(); } catch { /* already dead */ }
  });

  it('fails fast with an actionable message when no tsx is resolvable', async () => {
    const os = await import('node:os');
    const fs = await import('node:fs');
    const pathMod = await import('node:path');
    const dir = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'vibes-no-tsx-'));
    // server.ts present (so the checkout check passes) but no node_modules at all.
    fs.mkdirSync(pathMod.join(dir, 'src', 'mcp'), { recursive: true });
    fs.writeFileSync(pathMod.join(dir, 'src', 'mcp', 'server.ts'), 'export {};\n');
    const bridge = new VibesBridge({ vibesPath: dir, workspaceRoot: dir });
    await expect(bridge.start()).rejects.toThrow(/tsx not found/i);
  });
});
