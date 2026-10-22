import { contextBridge, ipcRenderer } from 'electron';
import {
  channels,
  type AppSettings,
  type AppSettingsSaveInput,
  type LedgerNewEntryEvent,
  type LedgerSnapshot,
  type MissionPlanRequest,
  type MissionPlanResponse,
  type MissionStartRequest,
  type MissionStartResult,
  type MissionQueueSnapshot,
  type RolesConfigInput,
  type RolesConfigView,
  type TestConnectionRequest,
  type TestConnectionResult,
  type VoiceDoctorResult,
  type VoiceServerTestResult,
  type VoiceTranscribeRequest,
  type VoiceTranscribeResult,
  type VoiceWarmResult,
  type DecisionProbeResult,
  type HarnessLessonView,
  type MissionSteerRequest,
  type MissionSteerResult,
  type VoiceAnnounceTestResult,
  type WorkspaceHistoryEntry,
  type WorkspaceSelectResult,
} from '@shared/channels';

/**
 * The renderer's ONLY path to the main process. Typed per channel so a call
 * site that names an unknown channel fails at compile time (V1 parity).
 */
const api = {
  ledger: {
    get: (): Promise<LedgerSnapshot> => ipcRenderer.invoke(channels.ledgerGet),
    onNewEntry: (callback: (event: LedgerNewEntryEvent) => void) => {
      const listener = (_e: unknown, payload: LedgerNewEntryEvent) => callback(payload);
      ipcRenderer.on(channels.ledgerNewEntry, listener);
      return () => ipcRenderer.removeListener(channels.ledgerNewEntry, listener);
    },
    /** Archive one entry or a batch (a mission card plus its task rows). */
    archive: (entryIds: string | string[]): Promise<{ ok: boolean; count?: number; error?: string }> =>
      ipcRenderer.invoke(channels.ledgerArchive, entryIds),
  },
  roles: {
    get: (): Promise<RolesConfigView> => ipcRenderer.invoke(channels.rolesGet),
    save: (input: RolesConfigInput): Promise<{ ok: boolean }> => ipcRenderer.invoke(channels.rolesSave, input),
    testConnection: (target: TestConnectionRequest): Promise<TestConnectionResult> =>
      ipcRenderer.invoke(channels.rolesTestConnection, target),
  },
  voice: {
    doctor: (): Promise<VoiceDoctorResult> => ipcRenderer.invoke(channels.voiceDoctor),
    transcribe: (request: VoiceTranscribeRequest): Promise<VoiceTranscribeResult> =>
      ipcRenderer.invoke(channels.voiceTranscribe, request),
    warm: (): Promise<VoiceWarmResult> => ipcRenderer.invoke(channels.voiceWarm),
    testServer: (): Promise<VoiceServerTestResult> => ipcRenderer.invoke(channels.voiceTestServer),
    testAnnounce: (): Promise<VoiceAnnounceTestResult> => ipcRenderer.invoke(channels.voiceAnnounceTest),
  },
  mission: {
    start: (request: MissionStartRequest): Promise<MissionStartResult> =>
      ipcRenderer.invoke(channels.missionStart, request),
    stop: (): Promise<{ stopped: boolean }> => ipcRenderer.invoke(channels.missionStop),
    plan: (request: MissionPlanRequest): Promise<MissionPlanResponse> =>
      ipcRenderer.invoke(channels.missionPlan, request),
    /** Discard a reviewed-but-unlaunched plan (Decline / modal close). */
    cancelPlan: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(channels.missionCancelPlan),
    queue: {
      get: (): Promise<MissionQueueSnapshot> => ipcRenderer.invoke(channels.missionQueueGet),
      setPaused: (paused: boolean): Promise<MissionQueueSnapshot> =>
        ipcRenderer.invoke(channels.missionQueuePause, paused),
      clear: (): Promise<MissionQueueSnapshot> => ipcRenderer.invoke(channels.missionQueueClear),
    },
    steer: (request: MissionSteerRequest): Promise<MissionSteerResult> =>
      ipcRenderer.invoke(channels.missionSteer, request),
  },
  workspace: {
    select: (): Promise<WorkspaceSelectResult> => ipcRenderer.invoke(channels.workspaceSelect),
    history: {
      save: (path: string): Promise<{ ok: boolean }> => ipcRenderer.invoke(channels.workspaceHistorySave, path),
      get: (): Promise<WorkspaceHistoryEntry[]> => ipcRenderer.invoke(channels.workspaceHistoryGet),
      clear: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(channels.workspaceHistoryClear),
    },
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(channels.settingsGet),
    save: (input: AppSettingsSaveInput): Promise<{ ok: boolean }> => ipcRenderer.invoke(channels.settingsSave, input),
  },
  decision: {
    test: (): Promise<DecisionProbeResult> => ipcRenderer.invoke(channels.decisionTest),
  },
  harness: {
    latestLesson: (workspaceRoot: string): Promise<HarnessLessonView> =>
      ipcRenderer.invoke(channels.harnessLessonGet, workspaceRoot),
  },
};

export type VibesDesktopApi = typeof api;

contextBridge.exposeInMainWorld('vibesDesktop', api);
