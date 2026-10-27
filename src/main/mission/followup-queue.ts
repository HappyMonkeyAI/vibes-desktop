import fs from 'node:fs';
import path from 'node:path';

/** OpenBot-style crash-safe FIFO of Chat/Operations follow-ups. */
export type FollowupItem = {
  id: string;
  request: string;
  workspaceRoot: string;
  createdAt: number;
};

export type FollowupQueueState = {
  paused: boolean;
  items: FollowupItem[];
};

const FILE_NAME = 'mission-followup-queue.json';

export function emptyFollowupQueue(): FollowupQueueState {
  return { paused: false, items: [] };
}

export function createFollowupQueue(userDataPath: string) {
  const filePath = path.join(userDataPath, FILE_NAME);

  const read = (): FollowupQueueState => {
    try {
      if (!fs.existsSync(filePath)) return emptyFollowupQueue();
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<FollowupQueueState>;
      const items = Array.isArray(raw.items)
        ? raw.items.filter(
            (item): item is FollowupItem =>
              !!item
              && typeof item === 'object'
              && typeof item.id === 'string'
              && typeof item.request === 'string'
              && typeof item.workspaceRoot === 'string'
              && typeof item.createdAt === 'number',
          )
        : [];
      return { paused: Boolean(raw.paused), items };
    } catch {
      return emptyFollowupQueue();
    }
  };

  const write = (state: FollowupQueueState): void => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  };

  return {
    path: filePath,
    snapshot(): FollowupQueueState {
      return read();
    },
    enqueue(request: string, workspaceRoot: string): FollowupItem {
      const state = read();
      const item: FollowupItem = {
        id: crypto.randomUUID(),
        request: request.trim(),
        workspaceRoot: workspaceRoot.trim(),
        createdAt: Date.now(),
      };
      state.items.push(item);
      write(state);
      return item;
    },
    /** Remove and return the head when not paused; otherwise null. */
    dequeueIfRunning(): FollowupItem | null {
      const state = read();
      if (state.paused || state.items.length === 0) return null;
      const [head, ...rest] = state.items;
      write({ ...state, items: rest });
      return head ?? null;
    },
    setPaused(paused: boolean): FollowupQueueState {
      const state = read();
      state.paused = paused;
      write(state);
      return state;
    },
    clear(): FollowupQueueState {
      const next = emptyFollowupQueue();
      write(next);
      return next;
    },
  };
}

export type FollowupQueue = ReturnType<typeof createFollowupQueue>;
