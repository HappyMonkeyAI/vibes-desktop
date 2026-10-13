import path from 'node:path';
import { existsSync } from 'node:fs';
import type { LedgerStore } from '../ledger/store';
import { VibesBridge, type TaskStatusEvent } from '../bridge/vibes-bridge';
import type { MissionStartResult } from '@shared/channels';

/**
 * T13 + T14 — the mission lifecycle service. Owns a single VibesBridge and the
 * one-mission-at-a-time guard: `startMission` plans then executes over the MCP
 * child process, streaming `[TASK_STATUS]` events into the ledger as they arrive;
 * `stopMission` ends the child cleanly and marks in-flight tasks blocked.
 *
 * Testable without Electron: the bridge is injected via a factory (tests pass a
 * fake), and the ledger store takes an explicit directory.
 */

/** The minimal bridge surface the service drives — the real VibesBridge satisfies it. */
export interface MissionBridge {
  on(event: 'task-status', callback: (event: TaskStatusEvent) => void): unknown;
  start(): Promise<void>;
  planMission(description: string): Promise<string>;
  executePlanned(): Promise<string>;
  stop(): Promise<void>;
}

export type MissionState = 'idle' | 'running';

export interface MissionServiceOptions {
  store: LedgerStore;
  /** Resolve the vibes checkout to spawn, e.g. VIBES_PATH or a dev default. */
  vibesPath?: () => string | undefined;
  /** Bridge factory — injectable so tests never spawn a real child process. */
  createBridge?: (workspaceRoot: string) => MissionBridge;
}

export interface MissionService {
  state(): MissionState;
  startMission(request: { request: string; workspaceRoot?: string }): Promise<MissionStartResult>;
  stopMission(): Promise<{ stopped: boolean }>;
}

/** The default checkout location used when VIBES_PATH is unset (dev machine). */
const DEFAULT_VIBES_PATH = 'C:/Users/steph/AppData/Local/Temp/vibes';

export function createMissionService(options: MissionServiceOptions): MissionService {
  const { store, createBridge } = options;
  let state: MissionState = 'idle';
  let bridge: MissionBridge | null = null;

  const resolveVibesPath = (): string => {
    const fromEnv = options.vibesPath?.();
    if (fromEnv && existsSync(path.join(fromEnv, 'src', 'mcp', 'server.ts'))) return fromEnv;
    if (existsSync(path.join(DEFAULT_VIBES_PATH, 'src', 'mcp', 'server.ts'))) return DEFAULT_VIBES_PATH;
    throw new Error(
      'No vibes checkout found. Set VIBES_PATH in the app environment to a vibes repo (containing src/mcp/server.ts).',
    );
  };

  /** Tear down the child and clear it. Safe to call when there is none. */
  const endBridge = async (): Promise<void> => {
    const active = bridge;
    bridge = null;
    if (active) await active.stop().catch(() => undefined);
  };

  /** Spawn + initialize a fresh bridge for one mission, wiring ledger streaming. */
  const spawnBridge = async (workspaceRoot: string): Promise<MissionBridge> => {
    const make = createBridge ?? (() => new VibesBridge({ vibesPath: resolveVibesPath(), workspaceRoot }));
    const next = make(workspaceRoot);
    // Live task lifecycle events flow straight into the ledger as they stream.
    next.on('task-status', (event) => {
      void store.recordTaskStatus(event).catch(() => undefined);
    });
    await next.start();
    bridge = next;
    return next;
  };

  return {
    state: () => state,

    async startMission({ request, workspaceRoot }): Promise<MissionStartResult> {
      // T14 guard: only one mission runs at a time. The check is synchronous and
      // happens before any await, so two rapid starts cannot both pass it.
      if (state === 'running') return { started: false, alreadyRunning: true };
      state = 'running';

      const root = workspaceRoot || process.cwd();
      try {
        const mission = await spawnBridge(root);
        await store.recordMissionEvent(`Planning: ${request}`, 'running');
        await mission.planMission(request);
        await store.recordMissionEvent('Executing mission', 'running');
        // Execution streams task-status events into the ledger while it runs; this
        // resolves when the child reports completion or failure.
        await mission.executePlanned();
        await store.recordMissionEvent('Mission complete', 'done');
        return { started: true, alreadyRunning: false };
      } catch (error) {
        // Covers a crashed child, a planning error, and an execution failure alike.
        const message = (error as Error).message;
        await store.recordMissionEvent('Mission failed', 'failed').catch(() => undefined);
        return { started: false, alreadyRunning: false, error: message };
      } finally {
        // One child per mission — always terminate it cleanly on exit.
        await endBridge();
        state = 'idle';
      }
    },

    async stopMission(): Promise<{ stopped: boolean }> {
      const hadChild = !!bridge;
      await endBridge();
      // T13: in-flight tasks become blocked, not silently dropped.
      await store.markInFlightBlocked().catch(() => undefined);
      state = 'idle';
      return { stopped: hadChild };
    },
  };
}
