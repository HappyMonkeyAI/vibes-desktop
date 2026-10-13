import { ipcMain } from 'electron';
import { channels, type ChannelName, type LedgerSnapshot, type RolesConfigView } from '@shared/channels';

/**
 * Handler table: one entry per channel in the shared map. P0 stubs stand in
 * until their owning task lands (T5 ledger store, T7/T8 roles, T13 mission).
 * The parity test asserts this table covers every channel — V1 gate.
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

export function createHandlerTable(): Record<ChannelName, Handler> {
  return {
    [channels.ledgerGet]: async () => emptySnapshot(),
    // Push channel (main → renderer); bound as a no-op handler for parity.
    [channels.ledgerNewEntry]: async () => undefined,
    [channels.rolesGet]: async () => emptyRolesView(),
    [channels.rolesSave]: async () => ({ ok: true }),
    [channels.rolesTestConnection]: async () => ({ ok: false, error: 'not implemented (T8)' }),
    [channels.missionStart]: async () => ({ started: false, alreadyRunning: false }),
    [channels.missionStop]: async () => ({ stopped: false }),
  };
}

/** Binds every handler in the table to ipcMain. Called once at app ready. */
export function registerIpcHandlers(ipc: typeof ipcMain): void {
  const table = createHandlerTable();
  for (const [channel, handler] of Object.entries(table)) {
    ipc.handle(channel, (...args) => handler(...args));
  }
}
