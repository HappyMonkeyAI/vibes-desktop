import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/** Workspace history entry. */
export interface WorkspaceHistoryEntry {
  path: string;
  lastUsed: number;
}

const FILE_NAME = 'workspace-history.json';
const MAX_HISTORY_ENTRIES = 10;

/**
 * Workspace history store.
 * Manages a list of recently used working directories.
 */
export class WorkspaceHistoryStore {
  private entries: WorkspaceHistoryEntry[] = [];
  private filePath: string;
  private ready: Promise<void>;

  constructor(dir: string) {
    this.filePath = path.join(dir, FILE_NAME);
    this.ready = this.load();
  }

  /** Replay the JSON file into memory. */
  private async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const data = JSON.parse(raw) as WorkspaceHistoryEntry[];
      if (Array.isArray(data)) {
        // Filter out invalid entries and sort by lastUsed descending
        const valid = data.filter(
          (e): e is WorkspaceHistoryEntry =>
            typeof e?.path === 'string' && typeof e?.lastUsed === 'number'
        );
        this.entries = valid.sort((a, b) => b.lastUsed - a.lastUsed).slice(0, MAX_HISTORY_ENTRIES);
      }
    } catch {
      // no file yet or invalid JSON — empty history is valid
      this.entries = [];
    }
  }

  /** Save the current history to disk. */
  private async save(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.entries, null, 2), 'utf8');
  }

  /** Add a workspace to history, or update its lastUsed time if it exists. */
  async addWorkspace(path: string): Promise<void> {
    await this.ready;
    
    // Remove if already exists
    this.entries = this.entries.filter((e) => e.path !== path);
    
    // Add to the front
    this.entries.unshift({ path, lastUsed: Date.now() });
    
    // Trim to max size
    this.entries = this.entries.slice(0, MAX_HISTORY_ENTRIES);
    
    await this.save();
  }

  /** Get all history entries, sorted by lastUsed descending. */
  async getHistory(): Promise<WorkspaceHistoryEntry[]> {
    await this.ready;
    return [...this.entries];
  }

  /** Clear all history. */
  async clear(): Promise<void> {
    await this.ready;
    this.entries = [];
    await this.save();
  }
}
