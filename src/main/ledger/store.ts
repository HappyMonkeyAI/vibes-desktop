import { EventEmitter } from 'node:events';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { classify } from '@shared/classify';
import type { ActivityGroup, LedgerEntry, LedgerSnapshot } from '@shared/channels';

/**
 * T5 — LedgerStore. The single source of activity truth (ADR-0003).
 * Append-only JSONL on disk in appData; an in-memory map is rebuilt by replaying
 * the file at startup (last line per id wins). Every mutation is appended to the
 * file and pushed to subscribers so the renderer's ledger updates live.
 *
 * Testable without Electron: takes an explicit directory, no app import.
 */

export interface TaskStatusInput {
  name: string;
  status: 'in-progress' | 'complete' | 'failed';
}

const STATUS_MAP = {
  'in-progress': 'running',
  complete: 'done',
  failed: 'failed',
} as const;

const FILE_NAME = 'ledger.jsonl';

export class LedgerStore extends EventEmitter {
  private entries = new Map<string, LedgerEntry>();
  private filePath: string;
  private ready: Promise<void>;
  /** Serializes all read-modify-write mutations so concurrent recordTaskStatus calls for the same title upsert in place instead of minting duplicate rows. */
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    super();
    this.filePath = path.join(dir, FILE_NAME);
    this.ready = this.load();
  }

  /** Run a mutation after all previously-enqueued ones have settled. Keeps the chain alive across errors. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.writeQueue.then(fn, fn);
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  /** Replay the JSONL file into memory. Malformed lines are skipped, not fatal. */
  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        let entry: LedgerEntry;
        try {
          entry = JSON.parse(line) as LedgerEntry;
        } catch {
          continue; // corrupt line — skip, keep the rest
        }
        if (typeof entry?.id === 'string' && typeof entry?.status === 'string') {
          this.entries.set(entry.id, entry);
        }
      }
    } catch {
      // no file yet — empty ledger is valid
    }
  }

  /** Current snapshot: all entries plus per-group counts. Waits for any in-flight mutation to settle so an upsert is never observed half-applied. */
  async snapshot(): Promise<LedgerSnapshot> {
    await this.ready;
    await this.writeQueue;
    const counts: Record<ActivityGroup, number> = { 'needs-you': 0, running: 0, upcoming: 0, recent: 0 };
    for (const entry of this.entries.values()) counts[entry.group] += 1;
    return { entries: [...this.entries.values()], groupCounts: counts };
  }

  /** Subscribe to live updates. Returns an unsubscribe function. */
  subscribe(onNew: (entry: LedgerEntry) => void): () => void {
    this.on('new-entry', onNew);
    return () => this.off('new-entry', onNew);
  }

  /** Record a vibes task lifecycle event as a ledger entry (idempotent upsert). Serialized so two events for the same title cannot both miss each other and mint duplicate rows. */
  async recordTaskStatus(input: TaskStatusInput): Promise<LedgerEntry> {
    const status = STATUS_MAP[input.status];
    return this.enqueue(async () => {
      await this.ready;
      const existing = [...this.entries.values()].find((e) => e.source === 'vibes-mission' && e.title === input.name);
      const entry: LedgerEntry = {
        id: existing?.id ?? crypto.randomUUID(),
        group: classify({ status, needsHuman: false }),
        status,
        source: 'vibes-mission',
        title: input.name,
        updatedAt: Date.now(),
      };
      return this.append(entry);
    });
  }

  /** Record a mission-level event (start / finish) as a ledger entry. */
  async recordMissionEvent(title: string, status: LedgerEntry['status']): Promise<LedgerEntry> {
    return this.enqueue(async () => {
      await this.ready;
      const existing = [...this.entries.values()].find((e) => e.source === 'vibes-mission' && e.title === title);
      const entry: LedgerEntry = {
        id: existing?.id ?? crypto.randomUUID(),
        group: classify({ status, needsHuman: false }),
        status,
        source: 'vibes-mission',
        title,
        updatedAt: Date.now(),
      };
      return this.append(entry);
    });
  }

  /** Append an entry to disk and push it to subscribers. Internal — callers go through the write queue. */
  private async append(entry: LedgerEntry): Promise<LedgerEntry> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify(entry)}\n`, 'utf8');
    this.entries.set(entry.id, entry);
    this.emit('new-entry', entry);
    return entry;
  }

  /**
   * T13 — when a mission is stopped/cancelled, every in-flight task (running or
   * verifying) becomes blocked. Rewrites each such entry in place (same id, new
   * status) so the renderer's upsert replaces its row rather than duplicating it.
   * Returns how many tasks were blocked.
   */
  async markInFlightBlocked(): Promise<number> {
    return this.enqueue(async () => {
      await this.ready;
      let count = 0;
      for (const entry of [...this.entries.values()]) {
        if (entry.source !== 'vibes-mission') continue;
        if (entry.status !== 'running' && entry.status !== 'verifying') continue;
        const blocked: LedgerEntry = {
          ...entry,
          status: 'blocked',
          group: classify({ status: 'blocked', needsHuman: false }),
          updatedAt: Date.now(),
        };
        await this.append(blocked);
        count += 1;
      }
      return count;
    });
  }
}
