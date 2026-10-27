import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LedgerStore } from '../src/main/ledger/store';

function tempDir() {
  return mkdtempSync(path.join(os.tmpdir(), 'vibes-ledger-'));
}

describe('LedgerStore (T5)', () => {
  it('replays an existing JSONL file, last line per id wins', async () => {
    const dir = tempDir();
    // Pre-seed a ledger with a task that was updated in place (two lines, same id).
    const id = 'task-1';
    writeFileSync(
      path.join(dir, 'ledger.jsonl'),
      [
        JSON.stringify({ id, group: 'running', status: 'running', source: 'vibes-mission', title: 'Build thing', updatedAt: 1 }),
        JSON.stringify({ id, group: 'recent', status: 'done', source: 'vibes-mission', title: 'Build thing', updatedAt: 2 }),
      ].join('\n') + '\n',
    );
    const store = new LedgerStore(dir);
    const snap = await store.snapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0].status).toBe('done');
    expect(snap.groupCounts.recent).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('skips malformed lines instead of crashing', async () => {
    const dir = tempDir();
    writeFileSync(path.join(dir, 'ledger.jsonl'), 'not json\n' + JSON.stringify({ id: 'x', group: 'recent', status: 'done', source: 'vibes-mission', title: 'ok', updatedAt: 1 }) + '\n');
    const store = new LedgerStore(dir);
    const snap = await store.snapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0].id).toBe('x');
    rmSync(dir, { recursive: true, force: true });
  });

  it('is empty (All quiet) when there is no file', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const snap = await store.snapshot();
    expect(snap.entries).toEqual([]);
    expect(snap.groupCounts).toEqual({ 'needs-you': 0, running: 0, upcoming: 0, recent: 0 });
    rmSync(dir, { recursive: true, force: true });
  });

  it('upserts a task by title — in-progress then complete updates the same entry', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    await store.recordTaskStatus({ name: 'Write tests', status: 'in-progress' });
    await store.recordTaskStatus({ name: 'Write tests', status: 'complete' });
    const snap = await store.snapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0].status).toBe('done');
    // The file holds exactly two lines (append-only history), not a rewritten file.
    const lines = readFileSync(path.join(dir, 'ledger.jsonl'), 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    rmSync(dir, { recursive: true, force: true });
  });

  it('routes failed tasks into the needs-you group', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    await store.recordTaskStatus({ name: 'Deploy', status: 'failed' });
    const snap = await store.snapshot();
    expect(snap.entries[0].group).toBe('needs-you');
    expect(snap.groupCounts['needs-you']).toBe(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('pushes a new-entry event to subscribers on each append', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const seen: string[] = [];
    const unsub = store.subscribe((entry) => seen.push(entry.title));
    await store.recordTaskStatus({ name: 'Plan', status: 'in-progress' });
    await store.recordMissionEvent('Mission started', 'running');
    unsub();
    expect(seen).toEqual(['Plan', 'Mission started']);
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists across a fresh store instance (survives restart)', async () => {
    const dir = tempDir();
    const first = new LedgerStore(dir);
    await first.recordTaskStatus({ name: 'Persist me', status: 'complete' });
    const second = new LedgerStore(dir); // simulates app restart, same file
    const snap = await second.snapshot();
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0].title).toBe('Persist me');
    rmSync(dir, { recursive: true, force: true });
  });

  it('T13 — markInFlightBlocked blocks running/verifying mission tasks, leaves done and non-mission rows', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    await store.recordTaskStatus({ name: 'Still going', status: 'in-progress' }); // running
    await store.recordTaskStatus({ name: 'Already done', status: 'complete' }); // done
    // A verifying task (upserted from in-progress, then re-recorded as a new row via mission event)
    await store.recordMissionEvent('Verifying build', 'verifying');

    const count = await store.markInFlightBlocked();
    expect(count).toBe(2); // "Still going" + "Verifying build"; "Already done" untouched

    const snap = await store.snapshot();
    const byTitle = Object.fromEntries(snap.entries.map((e) => [e.title, e]));
    expect(byTitle['Still going'].status).toBe('blocked');
    expect(byTitle['Still going'].group).toBe('needs-you');
    expect(byTitle['Verifying build'].status).toBe('blocked');
    expect(byTitle['Already done'].status).toBe('done'); // untouched
    rmSync(dir, { recursive: true, force: true });
  });

  it('T13 — markInFlightBlocked is a no-op when nothing is in flight', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    await store.recordTaskStatus({ name: 'Done task', status: 'complete' });
    const count = await store.markInFlightBlocked();
    expect(count).toBe(0);
    const snap = await store.snapshot();
    expect(snap.entries[0].status).toBe('done');
    rmSync(dir, { recursive: true, force: true });
  });

  it('seedPlannedTasks writes pending rows; later in-progress upserts in place', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const missionId = 'm-seed';
    await store.seedPlannedTasks(['Alpha', 'Beta'], dir, missionId);
    await store.recordTaskStatus({ name: 'Alpha', status: 'in-progress' }, dir, missionId);

    const snap = await store.snapshot();
    const alpha = snap.entries.find((e) => e.title === 'Alpha')!;
    const beta = snap.entries.find((e) => e.title === 'Beta')!;
    expect(alpha.status).toBe('running');
    expect(beta.status).toBe('pending');
    expect(snap.entries.filter((e) => e.title === 'Alpha')).toHaveLength(1);
    rmSync(dir, { recursive: true, force: true });
  });

  it('markOpenTasksFailed flips pending/running task rows but not mission rows', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const missionId = 'm-fail';
    await store.recordMissionEvent('Do the thing', 'running', dir, missionId);
    await store.seedPlannedTasks(['A', 'B'], dir, missionId);
    await store.recordTaskStatus({ name: 'A', status: 'in-progress' }, dir, missionId);
    await store.recordTaskStatus(
      { name: 'Mission Scheduler', status: 'failed', detail: 'Scheduler deadlock: circular depends_on' },
      dir,
      missionId,
    );

    const count = await store.markOpenTasksFailed(missionId);
    expect(count).toBe(2);

    const snap = await store.snapshot();
    expect(snap.entries.find((e) => e.title === 'A')!.status).toBe('failed');
    expect(snap.entries.find((e) => e.title === 'A')!.detail).toBe('Left incomplete when the mission ended.');
    expect(snap.entries.find((e) => e.title === 'B')!.detail).toContain('Left pending');
    // Must not overwrite the scheduler's real error with the mission summary.
    expect(snap.entries.find((e) => e.title === 'Mission Scheduler')!.detail).toContain('Scheduler deadlock');
    expect(snap.entries.find((e) => e.kind === 'mission')!.status).toBe('running'); // caller updates mission separately
    rmSync(dir, { recursive: true, force: true });
  });

  it('markUnreportedTasksIdle closes rows a completed mission never reported, without failing them', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const missionId = 'm-done';
    await store.recordMissionEvent('Do the thing', 'running', dir, missionId);
    await store.seedPlannedTasks(['A', 'B', 'C'], dir, missionId);
    await store.recordTaskStatus({ name: 'A', status: 'complete' }, dir, missionId);
    await store.recordTaskStatus({ name: 'B', status: 'in-progress' }, dir, missionId);

    const count = await store.markUnreportedTasksIdle(missionId);
    expect(count).toBe(2);

    const snap = await store.snapshot();
    expect(snap.entries.find((e) => e.title === 'A')!.status).toBe('done');
    for (const title of ['B', 'C']) {
      const row = snap.entries.find((e) => e.title === title)!;
      expect(row.status).toBe('idle');
      expect(row.group).toBe('recent'); // not needs-you
      expect(row.detail).toContain('Not reported by the mission');
    }
    expect(snap.entries.find((e) => e.kind === 'mission')!.status).toBe('running');
    rmSync(dir, { recursive: true, force: true });
  });

  it('concurrent task-status events for the same title upsert in place — one row, final status', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    // Fire both without awaiting — exactly what MissionService does with its
    // fire-and-forget recordTaskStatus when a child streams rapid events.
    const p1 = store.recordTaskStatus({ name: 'Write code', status: 'in-progress' });
    const p2 = store.recordTaskStatus({ name: 'Write code', status: 'complete' });
    await Promise.all([p1, p2]);

    const snap = await store.snapshot();
    const rows = snap.entries.filter((e) => e.title === 'Write code');
    expect(rows).toHaveLength(1); // no duplicate row minted by the race
    expect(rows[0].status).toBe('done'); // final status wins
    rmSync(dir, { recursive: true, force: true });
  });

  it('clearNeedsHuman drops flags on mission and task rows', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const missionId = 'm-clear';
    await store.recordMissionEvent('Mission', 'blocked', dir, missionId, 'wait', { needsHuman: true });
    await store.recordTaskStatus(
      { name: 'Gate', status: 'intervention', detail: 'Escalate?' },
      dir,
      missionId,
    );
    await store.clearNeedsHuman(missionId, 'Intervention: skip');
    const snap = await store.snapshot();
    expect(snap.entries.every((e) => !e.needsHuman)).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it('intervention status lands in Needs You with needsHuman + question detail', async () => {
    const dir = tempDir();
    const store = new LedgerStore(dir);
    const missionId = 'm-intervene';
    await store.recordMissionEvent('Ship it', 'running', dir, missionId);
    const row = await store.recordTaskStatus(
      {
        name: 'Patch CSS',
        status: 'intervention',
        detail: 'Retry this step, skip it, or fail the mission?',
      },
      dir,
      missionId,
    );
    expect(row.status).toBe('blocked');
    expect(row.needsHuman).toBe(true);
    expect(row.group).toBe('needs-you');
    expect(row.detail).toMatch(/Retry this step/);
    await store.recordMissionEvent(
      'Ship it',
      'blocked',
      dir,
      missionId,
      row.detail,
      { needsHuman: true },
    );
    const snap = await store.snapshot();
    expect(snap.groupCounts['needs-you']).toBeGreaterThanOrEqual(1);
    expect(snap.entries.find((e) => e.kind === 'mission')!.needsHuman).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
