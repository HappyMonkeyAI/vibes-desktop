import { ipcMain } from 'electron';
import type { WebContents } from 'electron';
import { channels, type ChannelName, type LedgerSnapshot, type RolesConfigInput, type RolesConfigView, type TestConnectionRequest } from '@shared/channels';
import type { LedgerStore } from '../ledger/store';
import type { RolesStore } from '../roles/store';
import { testConnection } from '../roles/test-connection';

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
}

export function createHandlerTable(options: HandlerTableOptions = {}): Record<ChannelName, Handler> {
  const { store, rolesStore } = options;
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
    [channels.missionStart]: async () => ({ started: false, alreadyRunning: false }),
    [channels.missionStop]: async () => ({ stopped: false }),
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
