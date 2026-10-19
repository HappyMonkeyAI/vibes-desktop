import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { channels, type AppSettings, type ChannelName, type LedgerSnapshot, type MissionPlanRequest, type MissionStartRequest, type RolesConfigInput, type RolesConfigView, type TestConnectionRequest, type VoiceDoctorResult, type VoiceTranscribeRequest, type VoiceTranscribeResult, type WorkspaceSelectResult } from '@shared/channels';
import type { LedgerStore } from '../ledger/store';
import type { RolesStore } from '../roles/store';
import type { MissionService } from '../mission/service';
import { testConnection } from '../roles/test-connection';
import { runVoiceDoctor } from '../voice/doctor';
import { transcribeFile, voiceTempDir } from '../voice/transcribe';
import type { WorkspaceHistoryStore } from '../workspace/history';
import type { SettingsStore } from '../settings/store';

/**
 * Handler table: one entry per channel in the shared map. T5 wires the ledger
 * store in; T7/T8 wire the roles store and probe; mission (T13) stubs stand in
 * until that task lands. The parity test asserts this table covers every channel — V1 gate.
 */

export type Handler = (...args: unknown[]) => Promise<unknown>;

/** Zeroed group counts for an empty ledger. */
export function emptySnapshot(): LedgerSnapshot {
  return {
    entries: [],
    groupCounts: { 'needs-you': 0, running: 0, upcoming: 0, recent: 0 },
  };
}

/** Five unconfigured role endpoints (P0 default; T7 makes this persistent). */
export function emptyRolesView(): RolesConfigView {
  return {
    default: { baseUrl: '', model: '', hasKey: false },
    planner: { baseUrl: '', model: '', hasKey: false },
    executor: { baseUrl: '', model: '', hasKey: false },
    reviewer: { baseUrl: '', model: '', hasKey: false },
    triage: { baseUrl: '', model: '', hasKey: false },
  };
}

export interface HandlerTableOptions {
  /** The live ledger store (T5). Absent in tests → empty snapshot. */
  store?: LedgerStore;
  /** Where `ledger:new-entry` pushes go (the renderer's WebContents). */
  webContents?: WebContents;
  /** The per-role endpoint store (T7). Absent in tests → empty view / no-op save. */
  rolesStore?: RolesStore;
  /** The mission lifecycle service (T13/T14). Absent in tests → inert stubs. */
  missionService?: MissionService;
  /** Native folder picker for the mission working directory. Absent in tests → cancel. */
  selectWorkspace?: () => Promise<WorkspaceSelectResult>;
  /** Workspace history store. Absent in tests → empty history. */
  workspaceHistoryStore?: WorkspaceHistoryStore;
  /** App settings store. Absent in tests → defaults / no-op save. */
  settingsStore?: SettingsStore;
}

export function createHandlerTable(options: HandlerTableOptions = {}): Record<ChannelName, Handler> {
  const { store, rolesStore, missionService, selectWorkspace, workspaceHistoryStore, settingsStore } = options;
  return {
    [channels.ledgerGet]: async () => (store ? store.snapshot() : emptySnapshot()),
    // Push channel (main → renderer); bound as a no-op handler for parity.
    [channels.ledgerNewEntry]: async () => undefined,
    [channels.rolesGet]: async () => (rolesStore ? rolesStore.view() : emptyRolesView()),
    [channels.rolesSave]: async (_e, input) => {
      if (!rolesStore) return { ok: true }; // parity stub — nothing to persist in tests
      const ok = rolesStore.save(input as RolesConfigInput);
      return { ok };
    },
    // Probe with the typed key, or — when the field is empty and the role is
    // named — with the key already stored for that role (never sent over IPC).
    [channels.rolesTestConnection]: async (_e, targetArg) => {
      const target = targetArg as TestConnectionRequest;
      let apiKey = target.apiKey;
      if (!apiKey && target.role && rolesStore) {
        apiKey = rolesStore.getKey(target.role) || undefined;
      }
      return testConnection({ baseUrl: target.baseUrl, model: target.model, apiKey });
    },
    // T12 — presence check before any capture attempt.
    [channels.voiceDoctor]: async (): Promise<VoiceDoctorResult> => runVoiceDoctor(),
    // T10/T11 — write the captured buffer to a temp file and transcribe it.
    [channels.voiceTranscribe]: async (_e, req): Promise<VoiceTranscribeResult> => {
      const request = req as VoiceTranscribeRequest;
      if (!request?.audioBase64) return { ok: false, error: 'No audio received.' };
      try {
        const dir = voiceTempDir();
        mkdirSync(dir, { recursive: true });
        const id = randomBytes(8).toString('hex');
        const inputPath = path.join(dir, `${id}.webm`);
        const outPath = path.join(dir, `${id}.txt`);
        writeFileSync(inputPath, Buffer.from(request.audioBase64, 'base64'));
        return await transcribeFile(inputPath, outPath);
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    // T13/T14 — real mission lifecycle; inert stubs only when no service is wired (tests).
    [channels.missionStart]: async (_e, req) => {
      if (!missionService) return { started: false, alreadyRunning: false };
      const request = req as MissionStartRequest;
      // No cwd fallback — an empty workspaceRoot is rejected by the service.
      return missionService.startMission({ request: request.request, workspaceRoot: request.workspaceRoot, acceptPlan: request.acceptPlan });
    },
    [channels.missionStop]: async () => (missionService ? missionService.stopMission() : { stopped: false }),
    // Mission plan via VibesBridge: call planMission and return extracted tasks.
    // The service already resolves failures into { tasks: [], error }, so no catch here.
    [channels.missionPlan]: async (_e, req) => {
      if (!missionService) return { tasks: [] as string[], error: 'Mission service not available' };
      const request = req as MissionPlanRequest;
      return missionService.planMission({ request: request.request, workspaceRoot: request.workspaceRoot });
    },
    // Discard a reviewed-but-unlaunched plan (Decline / modal close).
    [channels.missionCancelPlan]: async () => {
      if (missionService) await missionService.cancelPlan();
      return { ok: true };
    },
    // Native folder picker for the mission working directory; cancel → null path.
    [channels.workspaceSelect]: async (): Promise<WorkspaceSelectResult> =>
      selectWorkspace ? selectWorkspace() : { path: null },
    // Workspace history management.
    [channels.workspaceHistorySave]: async (_e, pathArg: unknown) => {
      if (!workspaceHistoryStore) return { ok: true };
      const path = pathArg as string;
      await workspaceHistoryStore.addWorkspace(path);
      return { ok: true };
    },
    [channels.workspaceHistoryGet]: async () => {
      if (!workspaceHistoryStore) return [];
      return await workspaceHistoryStore.getHistory();
    },
    [channels.workspaceHistoryClear]: async () => {
      if (!workspaceHistoryStore) return { ok: true };
      await workspaceHistoryStore.clear();
      return { ok: true };
    },
    // Ledger archive — one id or a batch (a mission card plus its task rows).
    [channels.ledgerArchive]: async (_e, idsArg: unknown) => {
      if (!store) return { ok: false, error: 'Ledger store not available' };
      const ids = Array.isArray(idsArg) ? idsArg : [idsArg];
      try {
        const archived = await store.archiveEntries(ids as string[]);
        if (archived.length === 0) return { ok: false, error: 'Entry not found' };
        return { ok: true, count: archived.length };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    // App settings persistence (Settings tab).
    [channels.settingsGet]: async (): Promise<AppSettings> =>
      settingsStore ? settingsStore.get() : { vibesPath: '', contextPath: '', memoryPath: '', autoSave: true, verboseLogging: false },
    [channels.settingsSave]: async (_e, input) => {
      if (!settingsStore) return { ok: true }; // parity stub — nothing to persist in tests
      const ok = settingsStore.save(input as Partial<AppSettings>);
      return { ok };
    },
  };
}

/** Binds every handler in the table to ipcMain. Called once at app ready. */
export function registerIpcHandlers(ipc: typeof ipcMain, options: HandlerTableOptions = {}): void {
  const table = createHandlerTable(options);
  for (const [channel, handler] of Object.entries(table)) {
    ipc.handle(channel, (...args) => handler(...args));
  }

  // Live ledger push: new entries flow straight to the renderer.
  const { store, webContents } = options;
  if (store && webContents) {
    store.subscribe((entry) => {
      if (!webContents.isDestroyed()) {
        webContents.send(channels.ledgerNewEntry, { entry });
      }
    });
  }
}
