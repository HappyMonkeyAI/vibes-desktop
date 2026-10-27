import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LedgerStore } from '../src/main/ledger/store';
import { createMissionService, missionOutcomeFrom } from '../src/main/mission/service';

function tempDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'vibes-mission-'));
}

/** Mirror the child's real plan_mission output: a JSON task array. */
const PLAN_OK = JSON.stringify([{ id: 1, name: 'Write code', status: 'pending' }]);
/** Mirror the child's real start_execution success text. */
const EXEC_OK = 'Mission completed. Completed 1/1 tasks.';

/** A fake bridge that streams task-status events and resolves execution on demand. */
function makeFakeBridge(opts: {
  planError?: Error;
  execError?: Error;
  planResponse?: string;
  execResponse?: string;
  stream?: Array<{ name: string; status: 'in-progress' | 'complete' | 'failed' | 'intervention'; detail?: string }>;
} = {}) {
  const ee = new EventEmitter();
  let started = false;
  let stopped = false;
  const interventions: Array<{ action: string; message?: string }> = [];
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
      return opts.planResponse ?? PLAN_OK;
    },
    executePlanned: async () => {
      // Stream any configured task events before resolving.
      for (const ev of opts.stream ?? []) ee.emit('task-status', ev);
      await Promise.resolve();
      if (opts.execError) throw opts.execError;
      return opts.execResponse ?? EXEC_OK;
    },
    resolveIntervention: async (action: string, message?: string) => {
      interventions.push({ action, message });
      return `resolved:${action}`;
    },
    stop: async () => {
      stopped = true;
    },
    _state: () => ({ started, stopped, interventions }),
    _emit: (event: string, payload: unknown) => ee.emit(event, payload),
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
    // With the MVP UX, the mission's card title is the original request and we
    // upsert its mission row in place (scoped by missionId). The child is
    // terminated cleanly after execution completes.
    await new Promise((r) => setTimeout(r, 30)); // allow background execution to finish
    expect(bridge._state().stopped).toBe(true);

    const snap = await store.snapshot();
    const titles = snap.entries.map((e) => e.title);
    expect(titles).toContain('Write code');
    expect(titles).toContain('Build a thing'); // mission row title = original request
    const task = snap.entries.find((e) => e.title === 'Write code')!;
    expect(task.status).toBe('done'); // upserted in place to done
    const missionRow = snap.entries.find((e) => e.title === 'Build a thing')!;
    expect(missionRow.status).toBe('done'); // child reported Mission completed. Completed 1/1
    expect(missionRow.detail).toContain('Mission completed');
    rmSync(dir, { recursive: true, force: true });
  });

  it('closes a seeded plan step the completed mission never reported as idle, not pending', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const service = createMissionService({
      store,
      createBridge: () =>
        makeFakeBridge({
          planResponse: JSON.stringify([
            { id: 1, name: 'Write code', status: 'pending' },
            { id: 2, name: 'Write docs', status: 'pending' },
          ]),
          stream: [{ name: 'Write code', status: 'complete' }],
        }),
    });

    await service.startMission({ request: 'Build a thing', workspaceRoot: dir });
    await new Promise((r) => setTimeout(r, 30)); // allow background execution to finish

    const snap = await store.snapshot();
    expect(snap.entries.find((e) => e.title === 'Write code')!.status).toBe('done');
    expect(snap.entries.find((e) => e.title === 'Write docs')!.status).toBe('idle');
    expect(snap.entries.find((e) => e.title === 'Build a thing')!.status).toBe('done');
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

    resolveExec(EXEC_OK);
    await first;
    await new Promise((r) => setTimeout(r, 30)); // allow background chain to finish
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
    expect(snap.entries.some((e) => e.title === 'Will fail' && e.status === 'failed')).toBe(true);
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
    const first = service.startMission({ request: 'Hang', workspaceRoot: dir });
    await new Promise((r) => setTimeout(r, 30));
    const withChild = await service.stopMission();
    expect(withChild.stopped).toBe(true);
    await new Promise((r) => setTimeout(r, 30)); // allow background chain to settle
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
    // Start resolves at dispatch; the child crash surfaces via the ledger, not
    // the start promise (P2-2: toast/spinner at start, not end).
    expect(result.started).toBe(true);
    expect(result.error).toBeUndefined();
    await new Promise((r) => setTimeout(r, 30)); // allow background chain to settle
    expect(bridge._state().stopped).toBe(true);

    const snap = await store.snapshot();
    expect(snap.entries.some((e) => e.title === 'Crash' && e.status === 'failed')).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('fails the start when planning returns failure TEXT (resolved, not thrown)', async () => {
    // The old child caught errors and returned them as normal strings — a
    // resolved planMission carried "Mission planning failed: …". That must not
    // reach dispatch, or start_execution would "succeed" with nothing to run.
    const dir = tempDir();
    const store = new LedgerStore(dir);
    let bridge;
    const service = createMissionService({
      store,
      createBridge: () => {
        bridge = makeFakeBridge({ planResponse: 'Mission planning failed: 404 Not Found' });
        return bridge;
      },
    });

    const result = await service.startMission({ request: 'Bad endpoint', workspaceRoot: dir });
    expect(result.started).toBe(false);
    expect(result.error).toContain('Mission planning failed');
    expect(bridge._state().stopped).toBe(true);

    const snap = await store.snapshot();
    const failed = snap.entries.find((e) => e.title === 'Bad endpoint' && e.status === 'failed')!;
    expect(failed).toBeTruthy();
    expect(failed.detail).toContain('Mission planning failed');
    rmSync(dir, { recursive: true, force: true });
  });

  it('fails the start when planning returns an empty task list', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const service = createMissionService({
      store,
      createBridge: () => makeFakeBridge({ planResponse: '[]' }),
    });

    const result = await service.startMission({ request: 'Empty plan', workspaceRoot: dir });
    expect(result.started).toBe(false);
    expect(result.error).toBeTruthy();
    const snap = await store.snapshot();
    expect(snap.entries.some((e) => e.title === 'Empty plan' && e.status === 'failed')).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('records FAILED (not done) when execution resolves with a failed mission text', async () => {
    // Regression: the false-done bug. A resolved executePlanned carrying
    // "Mission failed. Completed 0/2 tasks." must never be recorded as done.
    const dir = tempDir();
    const store = new LedgerStore(dir);
    let bridge;
    const service = createMissionService({
      store,
      createBridge: () => {
        bridge = makeFakeBridge({ execResponse: 'Mission failed. Completed 0/2 tasks.' });
        return bridge;
      },
    });

    const result = await service.startMission({ request: 'Will fail', workspaceRoot: dir });
    expect(result.started).toBe(true); // start resolves at dispatch by design
    await new Promise((r) => setTimeout(r, 30));
    expect(bridge._state().stopped).toBe(true);

    const snap = await store.snapshot();
    const row = snap.entries.find((e) => e.title === 'Will fail')!;
    expect(row.status).toBe('failed');
    expect(row.detail).toContain('Mission failed. Completed 0/2');
    rmSync(dir, { recursive: true, force: true });
  });

  it('seeds the full planned task list so progress is 0/N before any task-status events', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const plan = JSON.stringify([
      { id: 1, name: 'Analyze structure', status: 'pending' },
      { id: 2, name: 'Apply design advice', status: 'pending' },
      { id: 3, name: 'Verify layout', status: 'pending' },
    ]);
    let resolveExec: (v: string) => void = () => undefined;
    const execGate = new Promise<string>((r) => (resolveExec = r));
    const service = createMissionService({
      store,
      createBridge: () => {
        const bridge = makeFakeBridge({ planResponse: plan });
        bridge.executePlanned = () => execGate;
        return bridge;
      },
    });

    const result = await service.startMission({ request: 'Improve design', workspaceRoot: dir });
    expect(result.started).toBe(true);

    const snap = await store.snapshot();
    const tasks = snap.entries.filter((e) => e.kind !== 'mission' && e.missionId);
    expect(tasks.map((t) => t.title).sort()).toEqual([
      'Analyze structure',
      'Apply design advice',
      'Verify layout',
    ]);
    expect(tasks.every((t) => t.status === 'pending')).toBe(true);

    resolveExec('Mission failed. Completed 1/3 tasks.');
    await new Promise((r) => setTimeout(r, 40));
    rmSync(dir, { recursive: true, force: true });
  });

  it('acceptPlan seeds the reviewed tasks from pendingPlan', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const plan = JSON.stringify([
      { id: 1, name: 'Step one', status: 'pending' },
      { id: 2, name: 'Step two', status: 'pending' },
    ]);
    let resolveExec: (v: string) => void = () => undefined;
    const execGate = new Promise<string>((r) => (resolveExec = r));
    let sharedBridge: ReturnType<typeof makeFakeBridge> | undefined;
    const service = createMissionService({
      store,
      createBridge: () => {
        sharedBridge = makeFakeBridge({ planResponse: plan });
        sharedBridge.executePlanned = () => execGate;
        return sharedBridge;
      },
    });

    const planned = await service.planMission({ request: 'Reviewed mission', workspaceRoot: dir });
    expect(planned.tasks).toEqual(['Step one', 'Step two']);

    const started = await service.startMission({
      request: 'Reviewed mission',
      workspaceRoot: dir,
      acceptPlan: true,
    });
    expect(started.started).toBe(true);

    const snap = await store.snapshot();
    const tasks = snap.entries.filter((e) => e.kind !== 'mission' && e.title.startsWith('Step'));
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.status === 'pending')).toBe(true);

    resolveExec(EXEC_OK);
    await new Promise((r) => setTimeout(r, 40));
    rmSync(dir, { recursive: true, force: true });
  });

  it("records FAILED when execution resolves with 'No mission has been planned.'", async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const service = createMissionService({
      store,
      createBridge: () => makeFakeBridge({ execResponse: 'No mission has been planned.' }),
    });

    await service.startMission({ request: 'Lost plan', workspaceRoot: dir });
    await new Promise((r) => setTimeout(r, 30));

    const snap = await store.snapshot();
    const row = snap.entries.find((e) => e.title === 'Lost plan')!;
    expect(row.status).toBe('failed');
    expect(row.detail).toContain('No mission has been planned');
    rmSync(dir, { recursive: true, force: true });
  });

  it('T50 — intervention TASK_STATUS → Needs You; resolveIntervention clears needsHuman', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    let resolveExec: (v: string) => void = () => undefined;
    const execGate = new Promise<string>((r) => (resolveExec = r));
    let bridge: ReturnType<typeof makeFakeBridge>;
    const service = createMissionService({
      store,
      createBridge: () => {
        bridge = makeFakeBridge();
        bridge.executePlanned = () => execGate;
        return bridge;
      },
    });

    const started = await service.startMission({ request: 'Needs You fixture', workspaceRoot: dir });
    expect(started.started).toBe(true);
    await new Promise((r) => setTimeout(r, 30));

    bridge!._emit('task-status', {
      name: 'Fix CSS orphan',
      status: 'intervention',
      detail: 'Escalate: css_orphan — retry or skip?',
    });
    await new Promise((r) => setTimeout(r, 40));

    let snap = await store.snapshot();
    const mission = snap.entries.find((e) => e.title === 'Needs You fixture')!;
    expect(mission.status).toBe('blocked');
    expect(mission.needsHuman).toBe(true);
    expect(mission.detail).toContain('css_orphan');
    const task = snap.entries.find((e) => e.title === 'Fix CSS orphan')!;
    expect(task.needsHuman).toBe(true);

    const resolved = await service.resolveIntervention({ action: 'skip' });
    expect(resolved.ok).toBe(true);
    expect(bridge!._state().interventions).toEqual([{ action: 'skip', message: undefined }]);

    snap = await store.snapshot();
    const after = snap.entries.find((e) => e.title === 'Needs You fixture')!;
    expect(after.needsHuman).toBeFalsy();
    expect(after.status).toBe('running');
    expect(after.detail).toContain('Intervention: skip');
    const taskAfter = snap.entries.find((e) => e.title === 'Fix CSS orphan')!;
    expect(taskAfter.needsHuman).toBeFalsy();

    resolveExec(EXEC_OK);
    await new Promise((r) => setTimeout(r, 40));
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('missionOutcomeFrom (honesty gate)', () => {
  it('marks done only for an explicit completed mission with all work done', () => {
    expect(missionOutcomeFrom('Mission completed. Completed 3/3 tasks.')).toEqual({
      status: 'done',
      detail: 'Mission completed. Completed 3/3 tasks.',
    });
  });

  it('fails a completed mission with zero tasks (nothing executed)', () => {
    expect(missionOutcomeFrom('Mission completed. Completed 0/0 tasks.').status).toBe('failed');
  });

  it('fails a partially completed mission', () => {
    expect(missionOutcomeFrom('Mission failed. Completed 1/3 tasks.').status).toBe('failed');
  });

  it('fails unrecognized shapes rather than trusting the resolve', () => {
    expect(missionOutcomeFrom('No mission has been planned.').status).toBe('failed');
    expect(missionOutcomeFrom('').status).toBe('failed');
    expect(missionOutcomeFrom('').detail).toBe('The mission child returned no result.');
    expect(missionOutcomeFrom('Mission planning failed: 404').status).toBe('failed');
    expect(missionOutcomeFrom(undefined as unknown as string).status).toBe('failed');
  });
});
