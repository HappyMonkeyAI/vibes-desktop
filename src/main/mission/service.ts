import path from 'node:path';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import type { LedgerStore } from '../ledger/store';
import { VibesBridge, type TaskStatusEvent } from '../bridge/vibes-bridge';
import type { MissionStartResult, MissionPlanResponse } from '@shared/channels';

/**
 * T13 + T14 — the mission lifecycle service. Owns a single VibesBridge and the
 * one-mission-at-a-time guard: `startMission` plans then dispatches execution over
 * the MCP child process, streaming `[TASK_STATUS]` events into the ledger as they
 * arrive; `stopMission` ends the child cleanly and marks in-flight tasks blocked.
 *
 * The plan-review flow keeps the planning bridge alive (`pendingPlan`) so
 * "Accept & Launch" executes exactly the plan the user reviewed — the vibes MCP
 * child holds its last plan in-process, so re-planning on a fresh child would
 * execute a different plan than the one approved.
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
  startMission(request: { request: string; workspaceRoot?: string; acceptPlan?: boolean }): Promise<MissionStartResult>;
  planMission(request: { request: string; workspaceRoot?: string }): Promise<MissionPlanResponse>;
  cancelPlan(): Promise<void>;
  stopMission(): Promise<{ stopped: boolean }>;
}

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

/**
 * Decide the mission's terminal ledger status from the child's start_execution
 * text. The scheduler reports `Mission <status>. Completed <done>/<total> tasks.`
 * — a resolved call alone is NOT success (planning can fail inside the tool and
 * still resolve, and `start_execution` answers "No mission has been planned."
 * as plain text). Only an explicit completed mission with real done work counts;
 * anything else is a failure carrying the child's own text as detail.
 */
export function missionOutcomeFrom(result: string): { status: 'done' | 'failed'; detail: string } {
  const text = (result ?? '').trim();
  const match = /^Mission (\w+)\.\s+Completed (\d+)\/(\d+) tasks\./.exec(text);
  if (match) {
    const [, status, done, total] = match;
    const ok = status === 'completed' && Number(done) > 0 && Number(done) === Number(total);
    return { status: ok ? 'done' : 'failed', detail: text };
  }
  // Unrecognized shape ("No mission has been planned.", empty, garbled) — fail
  // closed with the raw text so the ledger explains why.
  return { status: 'failed', detail: text || 'The mission child returned no result.' };
}

export function createMissionService(options: MissionServiceOptions): MissionService {
  const { store, createBridge } = options;
  let state: MissionState = 'idle';
  let bridge: MissionBridge | null = null;
  /** A planned-but-not-yet-launched mission: its child holds the reviewed plan. */
  let pendingPlan: { bridge: MissionBridge; request: string; workspaceRoot: string; tasks: string[] } | null = null;
  /** The running mission's id — scopes ledger writes and stop-blocking to it. */
  let currentMissionId: string | undefined;
  /** Set by stopMission so the background execution chain doesn't record a
   *  spurious "failed" for a mission the user deliberately terminated. */
  let stopRequested = false;
  /** Bumped on every start/stop so a stale background chain can never tear down
   *  a newer mission's bridge or clobber its state. */
  let generation = 0;

  const resolveVibesPath = (): string => {
    const fromEnv = options.vibesPath?.();
    if (fromEnv && existsSync(path.join(fromEnv, 'src', 'mcp', 'server.ts'))) return fromEnv;
    throw new Error(
      'No vibes checkout found. Set vibesPath in Settings (or VIBES_PATH env) to a repo containing src/mcp/server.ts.',
    );
  };

  /** Tear down the live child and clear it. Safe to call when there is none. */
  const endBridge = async (): Promise<void> => {
    const active = bridge;
    bridge = null;
    currentMissionId = undefined;
    if (active) await active.stop().catch(() => undefined);
  };

  /** Stop and forget any pending (reviewed-but-unlaunched) plan. */
  const cancelPendingPlan = async (): Promise<void> => {
    const pending = pendingPlan;
    pendingPlan = null;
    if (pending) await pending.bridge.stop().catch(() => undefined);
  };

  /** Spawn + initialize a fresh, unadopted bridge for one workspace. */
  const spawnBridge = async (workspaceRoot: string): Promise<MissionBridge> => {
    const make = createBridge ?? (() => new VibesBridge({ vibesPath: resolveVibesPath(), workspaceRoot }));
    const next = make(workspaceRoot);
    await next.start();
    return next;
  };

  /** Wire a bridge's live task lifecycle events into the ledger, scoped to one mission. */
  const wireLedger = (mission: MissionBridge, workspaceRoot: string, missionId: string): void => {
    mission.on('task-status', (event) => {
      void store
        .recordTaskStatus(
          { name: event.name, status: event.status, detail: event.detail },
          workspaceRoot,
          missionId,
        )
        .catch(() => undefined);
    });
  };

  /** Dispatch execution in the background. Resolves the start call immediately
   *  after planning; the ledger streams live updates until the mission ends. */
  const dispatchExecution = (mission: MissionBridge, request: string, root: string, missionId: string, gen: number): void => {
    bridge = mission;
    currentMissionId = missionId;
    void mission
      .executePlanned()
      .then(
        async (result) => {
          if (!stopRequested && gen === generation) {
            // A resolved tool call is not success — the child reports outcomes
            // in text ("Mission completed/failed. Completed X/Y tasks."), and a
            // planning failure inside start_execution still resolves. Only an
            // explicit completed mission is recorded done.
            const outcome = missionOutcomeFrom(result);
            if (outcome.status === 'failed') {
              await store.markOpenTasksFailed(missionId).catch(() => undefined);
            } else if (outcome.status === 'done') {
              await store.markUnreportedTasksIdle(missionId).catch(() => undefined);
            }
            return store.recordMissionEvent(request, outcome.status, root, missionId, outcome.detail).catch(() => undefined);
          }
          return undefined;
        },
        async (error: unknown) => {
          // A rejection after stopRequested is the child dying from our own
          // stop — already reflected as blocked rows, not a new failure.
          if (!stopRequested && gen === generation) {
            const detail = error instanceof Error ? error.message : String(error);
            await store.markOpenTasksFailed(missionId).catch(() => undefined);
            return store.recordMissionEvent(request, 'failed', root, missionId, detail).catch(() => undefined);
          }
          return undefined;
        },
      )
      .finally(() => {
        // Only the current generation may tear down — a stale chain from a
        // stopped mission must never kill its successor's child.
        if (gen !== generation) return;
        void endBridge().finally(() => {
          if (gen === generation) state = 'idle';
        });
      });
  };

  return {
    state: () => state,

    async startMission({ request, workspaceRoot, acceptPlan }): Promise<MissionStartResult> {
      // T14 guard: only one mission runs at a time. The check is synchronous and
      // happens before any await, so two rapid starts cannot both pass it.
      if (state === 'running') return { started: false, alreadyRunning: true };

      // Never fall back to the app's own directory — a mission must run in an
      // explicit workspace, or it would rewrite this app's source tree.
      const root = workspaceRoot?.trim();
      if (!root) {
        return { started: false, alreadyRunning: false, error: 'Choose a working directory before starting a mission.' };
      }

      state = 'running';
      stopRequested = false;
      const gen = ++generation;
      const missionId = crypto.randomUUID();

      // A reviewed plan for this exact workspace is adopted as-is; anything else
      // pending is discarded so its child never outlives the flow that created it.
      const adopt = acceptPlan && pendingPlan && pendingPlan.workspaceRoot === root ? pendingPlan : null;
      pendingPlan = null;

      let mission: MissionBridge | undefined;
      let plannedTasks: string[] = [];
      try {
        if (adopt) {
          mission = adopt.bridge;
          plannedTasks = adopt.tasks;
        } else {
          await cancelPendingPlan();
          mission = await spawnBridge(root);
          await store.recordMissionEvent(request, 'running', root, missionId);
          const planResponse = await mission.planMission(request);
          // plan_mission reports failures as TEXT ("Mission planning failed: …")
          // and can return an empty task list — both must fail the start here,
          // or dispatching execution would "succeed" with nothing to run.
          plannedTasks = parseTasksFromPlan(planResponse);
          if (plannedTasks.length === 0) {
            const trimmed = planResponse.trim();
            throw new Error(trimmed || 'Mission planning produced no tasks.');
          }
        }
        wireLedger(mission, root, missionId);
        await store.recordMissionEvent(request, 'running', root, missionId);
        // Seed the full reviewed plan so the card shows 0/N immediately, not
        // only the tasks that have already emitted [TASK_STATUS] events.
        if (plannedTasks.length > 0) {
          await store.seedPlannedTasks(plannedTasks, root, missionId).catch(() => undefined);
        }
        // Execution streams task-status events into the ledger while it runs; the
        // returned promise resolves as soon as the mission is dispatched.
        dispatchExecution(mission, request, root, missionId, gen);
        return { started: true, alreadyRunning: false };
      } catch (error) {
        // Covers a crashed child and a planning error — both are start failures.
        const message = error instanceof Error ? error.message : String(error);
        await store.recordMissionEvent(request, 'failed', root, missionId, message).catch(() => undefined);
        try { if (mission) await mission.stop().catch(() => undefined); } catch {}
        await endBridge();
        state = 'idle';
        return { started: false, alreadyRunning: false, error: message };
      }
    },

    async planMission({ request, workspaceRoot }): Promise<MissionPlanResponse> {
      // One MCP child at a time — planning while a mission runs would double-spawn.
      if (state === 'running') {
        return { tasks: [], error: 'A mission is already running — wait for it to finish or stop it first.' };
      }
      // Plan in an explicit workspace only: the bridge factory writes
      // .vibes/config.json there, and a cwd fallback would write into the app repo.
      const root = workspaceRoot?.trim();
      if (!root) {
        return { tasks: [], error: 'Choose a working directory before planning a mission.' };
      }
      // A new plan supersedes any reviewed-but-unlaunched one.
      await cancelPendingPlan();
      let mission: MissionBridge | null = null;
      try {
        mission = await spawnBridge(root);
        const planResponse = await mission.planMission(request);
        const tasks = parseTasksFromPlan(planResponse);
        if (tasks.length === 0) {
          // Don't hold a child open for an empty plan — but distinguish a real
          // empty plan from a swallowed planning failure ("Mission planning
          // failed: …") so the UI shows why instead of a bare empty list.
          await mission.stop().catch(() => undefined);
          const trimmed = planResponse.trim();
          if (trimmed.toLowerCase().startsWith('mission planning failed')) {
            return { tasks: [], error: trimmed };
          }
          return { tasks: [] };
        }
        // Keep the child alive: it holds the reviewed plan in-process, and
        // Accept & Launch will execute it via the same bridge.
        pendingPlan = { bridge: mission, request, workspaceRoot: root, tasks };
        return { tasks };
      } catch (error) {
        // Surface the failure so the UI can tell the user planning failed,
        // instead of silently showing an empty task list.
        if (mission) await mission.stop().catch(() => undefined);
        return { tasks: [], error: (error as Error).message };
      }
    },

    async cancelPlan(): Promise<void> {
      await cancelPendingPlan();
    },

    async stopMission(): Promise<{ stopped: boolean }> {
      const hadChild = !!bridge || !!pendingPlan;
      stopRequested = true;
      generation++; // invalidate any in-flight background chain
      const missionId = currentMissionId;
      await endBridge();
      await cancelPendingPlan();
      // T13: in-flight tasks of THIS mission become blocked, not silently dropped.
      await store.markInFlightBlocked(missionId).catch(() => undefined);
      state = 'idle';
      return { stopped: hadChild };
    },
  };
}
