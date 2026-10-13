import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LedgerStore } from '../src/main/ledger/store';
import { createMissionService } from '../src/main/mission/service';

function tempDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'vibes-mission-'));
}

/** A fake bridge that streams task-status events and resolves execution on demand. */
function makeFakeBridge(opts: { planError?: Error; execError?: Error; stream?: Array<{ name: string; status: 'in-progress' | 'complete' | 'failed' }> } = {}) {
  const ee = new EventEmitter();
  let started = false;
  let stopped = false;
  return {
    on: (event: string, cb: (event?: unknown) => void) => {
      ee.on(event, cb);
      return ee;
    },
    start: async () => {
      started = true;
    },
    planMission: async (_desc: string) => {
      if (opts.planError) throw opts.planError;
      return 'plan ok';
    },
    executePlanned: async () => {
      // Stream any configured task events before resolving.
      for (const ev of opts.stream ?? []) ee.emit('task-status', ev);
      await Promise.resolve();
      if (opts.execError) throw opts.execError;
      return 'exec ok';
    },
    stop: async () => {
      stopped = true;
    },
    _state: () => ({ started, stopped }),
  };
}

describe('MissionService (T13/T14)', () => {
  it('streams task-status events into the ledger and records a completed mission', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    let bridge;
    const service = createMissionService({
      store,
      createBridge: (root) => {
        bridge = makeFakeBridge({ stream: [{ name: 'Write code', status: 'in-progress' }, { name: 'Write code', status: 'complete' }] });
        return bridge;
      },
    });

    const result = await service.startMission({ request: 'Build a thing', workspaceRoot: dir });
    expect(result.started).toBe(true);
    expect(result.alreadyRunning).toBe(false);
    // The child was terminated cleanly after the mission.
    expect(bridge._state().stopped).toBe(true);

    const snap = await store.snapshot();
    // Planning + executing + complete event, plus the upserted task row (in-progress then complete → one row).
    const titles = snap.entries.map((e) => e.title);
    expect(titles).toContain('Write code');
    expect(titles).toContain('Mission complete');
    const task = snap.entries.find((e) => e.title === 'Write code')!;
    expect(task.status).toBe('done'); // upserted in place to done
    rmSync(dir, { recursive: true, force: true });
  });

  it('T14 — a second start while one is running returns alreadyRunning without spawning', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    let resolveExec: (v: string) => void = () => undefined;
    const execGate = new Promise<string>((r) => (resolveExec = r));
    let bridge;
    const service = createMissionService({
      store,
      createBridge: () => {
        bridge = makeFakeBridge();
        // Override executePlanned to hang until we release it.
        bridge.executePlanned = () => execGate;
        return bridge;
      },
    });

    const first = service.startMission({ request: 'First', workspaceRoot: dir });
    // Let the guard flip to running before the second start.
    await new Promise((r) => setTimeout(r, 20));
    const second = await service.startMission({ request: 'Second', workspaceRoot: dir });
    expect(second.started).toBe(false);
    expect(second.alreadyRunning).toBe(true);

    resolveExec('done');
    await first;
    expect(bridge._state().stopped).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('records a failed mission when planning throws, and clears the child', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    let bridge;
    const service = createMissionService({
      store,
      createBridge: () => {
        bridge = makeFakeBridge({ planError: new Error('planner down') });
        return bridge;
      },
    });

    const result = await service.startMission({ request: 'Will fail', workspaceRoot: dir });
    expect(result.started).toBe(false);
    expect(result.error).toBe('planner down');
    expect(bridge._state().stopped).toBe(true); // child torn down on failure

    const snap = await store.snapshot();
    expect(snap.entries.some((e) => e.title === 'Mission failed' && e.status === 'failed')).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('stopMission marks in-flight tasks blocked and reports whether a child was running', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    await store.recordTaskStatus({ name: 'In flight', status: 'in-progress' }); // running row

    // Build the bridge up front (the service only spawns one on start) so we can
    // assert against it in both the no-child and with-child phases.
    const bridge = makeFakeBridge();
    const service = createMissionService({ store, createBridge: () => bridge });

    // No child yet — stop reports stopped:false but still blocks in-flight rows.
    const noChild = await service.stopMission();
    expect(noChild.stopped).toBe(false);
    let snap = await store.snapshot();
    expect(snap.entries.find((e) => e.title === 'In flight')!.status).toBe('blocked');

    // Now with a live child — start hangs in executePlanned, then stop ends it and reports stopped:true.
    const execGate = new Promise<string>(() => undefined); // never resolves
    bridge.executePlanned = () => execGate;
    void service.startMission({ request: 'Hang', workspaceRoot: dir });
    await new Promise((r) => setTimeout(r, 20));
    const withChild = await service.stopMission();
    expect(withChild.stopped).toBe(true);
    expect(bridge._state().stopped).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('records a failed mission when execution throws (child crash path)', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    let bridge;
    const service = createMissionService({
      store,
      createBridge: () => {
        bridge = makeFakeBridge({ execError: new Error('child exited 1') });
        return bridge;
      },
    });

    const result = await service.startMission({ request: 'Crash', workspaceRoot: dir });
    expect(result.started).toBe(false);
    expect(result.error).toBe('child exited 1');
    expect(bridge._state().stopped).toBe(true);

    const snap = await store.snapshot();
    expect(snap.entries.some((e) => e.title === 'Mission failed' && e.status === 'failed')).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
