import path from 'node:path';
import { existsSync } from 'node:fs';
import type { LedgerStore } from '../ledger/store';
import { VibesBridge, type TaskStatusEvent } from '../bridge/vibes-bridge';
import type { MissionStartResult, MissionPlanResponse } from '@shared/channels';

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
  planMission(request: { request: string; workspaceRoot?: string }): Promise<MissionPlanResponse>;
  stopMission(): Promise<{ stopped: boolean }>;
}

/** The default checkout location used when VIBES_PATH is unset (dev machine). */
const DEFAULT_VIBES_PATH = 'C:/Users/steph/AppData/Local/Temp/vibes';

/** Parse tasks from the plan_mission tool response. The vibes MCP server returns
 *  a JSON array like `[{id:1,name:"...",status:"pending"},...]`; older or degraded
 *  responses may be a numbered/bulleted list, so fall back to line matching. */
export function parseTasksFromPlan(planResponse: string): string[] {
  const text = planResponse.trim();
  if (!text) return [];

  // Primary shape: the JSON array emitted by vibes' plan_mission tool.
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) {
        const names = parsed
          .map((item) => (typeof item === 'string' ? item : (item as Record<string, unknown>)?.name))
          .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
          .map((n) => n.trim());
        if (names.length > 0) return names;
      }
    } catch {
      // not valid JSON after all — fall through to line matching
    }
  }

  // Fallback shape: numbered or bulleted lines.
  const tasks: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const match =
      line.match(/^\d+[\.\)]\s+(.+)$/) ??
      line.match(/^[-*]\s+(.+)$/);
    if (match) tasks.push(match[1].trim());
  }
  return tasks;
}

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

  /** Spawn + initialize a fresh bridge for one mission, wiring ledger streaming.
   *  When `adopt` is false (a planning-only call) the bridge stays local to the
   *  caller and never touches the shared single-mission slot. */
  const spawnBridge = async (workspaceRoot: string, adopt = true): Promise<MissionBridge> => {
    const make = createBridge ?? (() => new VibesBridge({ vibesPath: resolveVibesPath(), workspaceRoot }));
    const next = make(workspaceRoot);
    // Live task lifecycle events flow straight into the ledger as they stream,
    // tagged with this mission's workspace root so cards can group their tasks.
    next.on('task-status', (event) => {
      void store.recordTaskStatus(event, workspaceRoot).catch(() => undefined);
    });
    await next.start();
    if (adopt) bridge = next;
    return next;
  };

  return {
    state: () => state,

    async startMission({ request, workspaceRoot }): Promise<MissionStartResult> {
      // T14 guard: only one mission runs at a time. The check is synchronous and
      // happens before any await, so two rapid starts cannot both pass it.
      if (state === 'running') return { started: false, alreadyRunning: true };
      state = 'running';

      // Never fall back to the app's own directory — a mission must run in an
      // explicit workspace, or it would rewrite this app's source tree.
      const root = workspaceRoot?.trim();
      if (!root) {
        state = 'idle';
        return { started: false, alreadyRunning: false, error: 'Choose a working directory before starting a mission.' };
      }
      try {
        const mission = await spawnBridge(root);
        await store.recordMissionEvent(`Planning: ${request}`, 'running', root);
        await mission.planMission(request);
        await store.recordMissionEvent('Executing mission', 'running', root);
        // Execution streams task-status events into the ledger while it runs; this
        // resolves when the child reports completion or failure.
        await mission.executePlanned();
        await store.recordMissionEvent('Mission complete', 'done', root);
        return { started: true, alreadyRunning: false };
      } catch (error) {
        // Covers a crashed child, a planning error, and an execution failure alike.
        const message = (error as Error).message;
        await store.recordMissionEvent('Mission failed', 'failed', root).catch(() => undefined);
        return { started: false, alreadyRunning: false, error: message };
      } finally {
        // One child per mission — always terminate it cleanly on exit.
        await endBridge();
        state = 'idle';
      }
    },

    async planMission({ request, workspaceRoot }): Promise<MissionPlanResponse> {
      // Plan-only: a throwaway bridge that never adopts the single-mission slot,
      // so a mission already running is left untouched.
      const root = workspaceRoot || process.cwd();
      let mission: MissionBridge | null = null;
      try {
        mission = await spawnBridge(root, false);
        const planResponse = await mission.planMission(request);
        return { tasks: parseTasksFromPlan(planResponse) };
      } catch (error) {
        // Surface the failure so the UI can tell the user planning failed,
        // instead of silently showing an empty task list.
        return { tasks: [], error: (error as Error).message };
      } finally {
        if (mission) await mission.stop().catch(() => undefined);
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
