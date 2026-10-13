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
});
