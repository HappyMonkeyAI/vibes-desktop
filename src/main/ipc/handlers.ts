import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { channels, type ChannelName, type LedgerSnapshot, type MissionStartRequest, type RolesConfigInput, type RolesConfigView, type TestConnectionRequest, type VoiceDoctorResult, type VoiceTranscribeRequest, type VoiceTranscribeResult } from '@shared/channels';
import type { LedgerStore } from '../ledger/store';
import type { RolesStore } from '../roles/store';
import type { MissionService } from '../mission/service';
import { testConnection } from '../roles/test-connection';
import { runVoiceDoctor } from '../voice/doctor';
import { transcribeFile, voiceTempDir } from '../voice/transcribe';

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
}

export function createHandlerTable(options: HandlerTableOptions = {}): Record<ChannelName, Handler> {
  const { store, rolesStore, missionService } = options;
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
    [channels.rolesTestConnection]: async (_e, target) => testConnection(target as TestConnectionRequest),
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
      // The renderer passes an empty workspaceRoot — the app's cwd is the mission root.
      return missionService.startMission({ request: request.request, workspaceRoot: request.workspaceRoot || process.cwd() });
    },
    [channels.missionStop]: async () => (missionService ? missionService.stopMission() : { stopped: false }),
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
