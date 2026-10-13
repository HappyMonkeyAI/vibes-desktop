import { contextBridge, ipcRenderer } from 'electron';
import {
  channels,
  type LedgerNewEntryEvent,
  type LedgerSnapshot,
  type MissionStartRequest,
  type MissionStartResult,
  type RolesConfigInput,
  type RolesConfigView,
  type TestConnectionRequest,
  type TestConnectionResult,
  type VoiceDoctorResult,
  type VoiceTranscribeRequest,
  type VoiceTranscribeResult,
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
  },
  mission: {
    start: (request: MissionStartRequest): Promise<MissionStartResult> =>
      ipcRenderer.invoke(channels.missionStart, request),
    stop: (): Promise<{ stopped: boolean }> => ipcRenderer.invoke(channels.missionStop),
  },
  workspace: {
    select: (): Promise<WorkspaceSelectResult> => ipcRenderer.invoke(channels.workspaceSelect),
  },
};

export type VibesDesktopApi = typeof api;

contextBridge.exposeInMainWorld('vibesDesktop', api);
