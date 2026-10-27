import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFollowupQueue } from '../src/main/mission/followup-queue';

describe('followup-queue (crash-safe FIFO)', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibes-followup-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('enqueues and dequeues in FIFO order', () => {
    const q = createFollowupQueue(dir);
    const a = q.enqueue('first', 'C:/a');
    const b = q.enqueue('second', 'C:/b');
    expect(q.snapshot().items.map((i) => i.id)).toEqual([a.id, b.id]);
    expect(q.dequeueIfRunning()?.request).toBe('first');
    expect(q.dequeueIfRunning()?.request).toBe('second');
    expect(q.dequeueIfRunning()).toBeNull();
  });

  it('survives process restart via disk', () => {
    const q1 = createFollowupQueue(dir);
    q1.enqueue('persist me', 'C:/ws');
    const q2 = createFollowupQueue(dir);
    expect(q2.snapshot().items).toHaveLength(1);
    expect(q2.snapshot().items[0]?.request).toBe('persist me');
  });

  it('pause blocks dequeue without dropping items', () => {
    const q = createFollowupQueue(dir);
    q.enqueue('held', 'C:/ws');
    q.setPaused(true);
    expect(q.dequeueIfRunning()).toBeNull();
    expect(q.snapshot().items).toHaveLength(1);
    q.setPaused(false);
    expect(q.dequeueIfRunning()?.request).toBe('held');
  });

  it('skips malformed disk state', () => {
    fs.writeFileSync(path.join(dir, 'mission-followup-queue.json'), '{not json', 'utf8');
    const q = createFollowupQueue(dir);
    expect(q.snapshot()).toEqual({ paused: false, items: [] });
  });
});
