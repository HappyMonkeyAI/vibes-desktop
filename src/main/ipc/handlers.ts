import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { channels, type AppSettings, type AppSettingsSaveInput, type ChannelName, type LedgerSnapshot, type MissionPlanRequest, type MissionResolveInterventionRequest, type MissionStartRequest, type RolesConfigInput, type RolesConfigView, type TestConnectionRequest, type VoiceDoctorResult, type VoiceTranscribeRequest, type VoiceTranscribeResult, type WorkspaceSelectResult } from '@shared/channels';
import type { LedgerStore } from '../ledger/store';
import type { RolesStore } from '../roles/store';
import type { MissionService } from '../mission/service';
import { testConnection } from '../roles/test-connection';
import { runVoiceDoctor } from '../voice/doctor';
import { spawnYapsnap, transcribeFile, voiceTempDir } from '../voice/transcribe';
import { transcribeViaServer, probeSpeechServer } from '../voice/speech-server';
import { warmYapsnapModels } from '../voice/warm';
import type { WorkspaceHistoryStore } from '../workspace/history';
import { DEFAULT_SETTINGS, type SettingsStore } from '../settings/store';
import { resolveDecisionMcpConfig } from '../decision/config';
import { probeDecisionMcp } from '../decision/probe';
import { readHarnessLesson } from '../harness/lesson-store';
import { announceToDaemon } from '../voice/announce';

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
    default: { baseUrl: '', model: '', contextWindow: '', hasKey: false },
    planner: { baseUrl: '', model: '', contextWindow: '', hasKey: false },
    executor: { baseUrl: '', model: '', contextWindow: '', hasKey: false },
    reviewer: { baseUrl: '', model: '', contextWindow: '', hasKey: false },
    triage: { baseUrl: '', model: '', contextWindow: '', hasKey: false },
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
    // Pre-fetch local yapsnap models (ADR-0002 doctor screen).
    [channels.voiceWarm]: async () => {
      const settings = settingsStore?.get() ?? DEFAULT_SETTINGS;
      return warmYapsnapModels(settings.speechLang || 'auto');
    },
    // Probe the configured OpenAI-compatible speech server (e.g. qwen3-asr).
    [channels.voiceTestServer]: async () => {
      const settings = settingsStore?.get() ?? DEFAULT_SETTINGS;
      const apiKey = settingsStore?.getSpeechServerApiKey();
      return probeSpeechServer(settings.speechServerUrl, apiKey);
    },
    // T10/T11 — write the captured buffer to a temp file and transcribe it
    // via yapsnap (local) or the configured speech server.
    [channels.voiceTranscribe]: async (_e, req): Promise<VoiceTranscribeResult> => {
      const request = req as VoiceTranscribeRequest;
      if (!request?.audioBase64) return { ok: false, error: 'No audio received.' };
      try {
        const settings = settingsStore?.get() ?? DEFAULT_SETTINGS;
        const dir = voiceTempDir();
        mkdirSync(dir, { recursive: true });
        const id = randomBytes(8).toString('hex');
        const inputPath = path.join(dir, `${id}.webm`);
        const outPath = path.join(dir, `${id}.txt`);
        writeFileSync(inputPath, Buffer.from(request.audioBase64, 'base64'));
        if (settings.speechEngine === 'server') {
          const result = await transcribeViaServer({
            url: settings.speechServerUrl,
            model: settings.speechServerModel,
            language: settings.speechLang,
            apiKey: settingsStore?.getSpeechServerApiKey(),
            filePath: inputPath,
          });
          try {
            rmSync(inputPath, { force: true });
          } catch {
            // best-effort cleanup
          }
          return result;
        }
        return await transcribeFile(inputPath, outPath, spawnYapsnap, settings.speechLang || 'auto');
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    // T13/T14 — real mission lifecycle; inert stubs only when no service is wired (tests).
    [channels.missionStart]: async (_e, req) => {
      if (!missionService) return { started: false, alreadyRunning: false };
      const request = req as MissionStartRequest;
      // No cwd fallback — an empty workspaceRoot is rejected by the service.
      return missionService.startMission({
        request: request.request,
        workspaceRoot: request.workspaceRoot,
        acceptPlan: request.acceptPlan,
        enqueueIfBusy: request.enqueueIfBusy,
      });
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
    [channels.missionQueueGet]: async () =>
      missionService ? missionService.getFollowupQueue() : { paused: false, items: [] },
    [channels.missionQueuePause]: async (_e, paused) =>
      missionService
        ? missionService.setFollowupQueuePaused(Boolean(paused))
        : { paused: Boolean(paused), items: [] },
    [channels.missionQueueClear]: async () =>
      missionService ? missionService.clearFollowupQueue() : { paused: false, items: [] },
    // Native folder picker for the mission working directory; cancel → null path.
    [channels.workspaceSelect]: async (): Promise<WorkspaceSelectResult> =>
      selectWorkspace ? selectWorkspace() : { path: null },
    // Workspace history management.
    [channels.workspaceHistorySave]: async (_e, pathArg: unknown) => {
      if (!workspaceHistoryStore) return { ok: true };
      if (typeof pathArg !== 'string' || !pathArg.trim()) {
        return { ok: false, error: 'Invalid workspace path.' };
      }
      await workspaceHistoryStore.addWorkspace(pathArg);
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
      settingsStore ? settingsStore.get() : { ...DEFAULT_SETTINGS },
    [channels.settingsSave]: async (_e, input) => {
      if (!settingsStore) return { ok: true }; // parity stub — nothing to persist in tests
      const ok = settingsStore.save(input as AppSettingsSaveInput);
      return { ok };
    },
    // Optional KEV/GUTSY decision MCP — only probes when URL + token are configured.
    [channels.decisionTest]: async () => {
      const config = resolveDecisionMcpConfig(settingsStore);
      if (!config) {
        return {
          ok: false,
          error: 'Decision model is off — set MCP URL and bearer token in Settings, then Save.',
        };
      }
      return probeDecisionMcp(config);
    },
    // T35 — latest harness lesson for Retry seed (null when absent / bad path).
    [channels.harnessLessonGet]: async (_e, workspaceRootArg) => {
      const root = typeof workspaceRootArg === 'string' ? workspaceRootArg.trim() : '';
      if (!root) return null;
      const record = readHarnessLesson(root);
      if (!record) return null;
      return {
        lesson: record.lesson,
        missionTitle: record.missionTitle,
        at: record.at,
        helped: record.helped,
        failed: record.failed,
        harnessClass: record.harnessClass,
      };
    },
    // T24 — test announcement to Agent Voice daemon.
    [channels.voiceAnnounceTest]: async () => {
      if (!settingsStore) return { ok: false, error: 'Settings unavailable' };
      const settings = settingsStore.get();
      const token = settingsStore.getTtsDaemonToken()?.trim();
      if (!token) {
        return { ok: false, error: 'Set an Agent Voice daemon token in Settings → Voice, then Save.' };
      }
      return announceToDaemon(
        { baseUrl: settings.ttsDaemonUrl, token },
        { text: 'Vibes Desktop test announcement.', priority: 3, sourceName: 'vibes-desktop' },
      );
    },
    // Chat phase 2 — mid-run steering.
    [channels.missionSteer]: async (_e, req) => {
      if (!missionService) return { ok: false, error: 'Mission service not available' };
      const message = typeof (req as { message?: unknown })?.message === 'string'
        ? (req as { message: string }).message
        : '';
      return missionService.steerMission(message);
    },
    // Needs-You — resolve pending vibes intervention.
    [channels.missionResolveIntervention]: async (_e, req) => {
      if (!missionService) return { ok: false, error: 'Mission service not available' };
      const body = req as MissionResolveInterventionRequest;
      return missionService.resolveIntervention({
        action: body?.action,
        message: typeof body?.message === 'string' ? body.message : undefined,
      });
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
