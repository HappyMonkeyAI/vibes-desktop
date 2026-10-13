import { contextBridge, ipcRenderer } from 'electron';
import {
  channels,
  type LedgerNewEntryEvent,
  type LedgerSnapshot,
  type MissionStartRequest,
  type MissionStartResult,
  type RolesConfigInput,
  type RolesConfigView,
  type TestConnectionResult,
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
    testConnection: (target: unknown): Promise<TestConnectionResult> =>
      ipcRenderer.invoke(channels.rolesTestConnection, target),
  },
  mission: {
    start: (request: MissionStartRequest): Promise<MissionStartResult> =>
      ipcRenderer.invoke(channels.missionStart, request),
    stop: (): Promise<{ stopped: boolean }> => ipcRenderer.invoke(channels.missionStop),
  },
};

export type VibesDesktopApi = typeof api;

contextBridge.exposeInMainWorld('vibesDesktop', api);
