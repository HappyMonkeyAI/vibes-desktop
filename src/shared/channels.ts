/**
 * Shared IPC channel map + ledger types.
 *
 * This file is the V1 contract: every entry in `channels` must have a main
 * handler (src/main/ipc/handlers.ts) and be exposed by preload (src/preload/index.ts).
 * The renderer may only touch IPC through the typed surface in src/preload/index.d.ts.
 */

/** Ledger status vocabulary — same accents as the wayland-fork mission-control page. */
export const LEDGER_STATUSES = [
  'running',
  'verifying',
  'failed',
  'zombie',
  'blocked',
  'pending',
  'done',
  'idle',
] as const;
export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

/** Activity grouping, matching the fork's four-section layout. */
export const ACTIVITY_GROUPS = ['needs-you', 'running', 'upcoming', 'recent'] as const;
export type ActivityGroup = (typeof ACTIVITY_GROUPS)[number];

/** A single ledger entry — one line in the append-only JSONL activity log. */
export interface LedgerEntry {
  id: string;
  /** Grouping is derived from status/needsHuman/nextRunAtMs via classify(). */
  group: ActivityGroup;
  status: LedgerStatus;
  /** Always 'vibes-mission' in v1 (single-source ledger, ADR-0003). */
  source: 'vibes-mission';
  title: string;
  detail?: string;
  context?: string;
  needsHuman?: boolean;
  retriesUsed?: number;
  retryBudget?: number;
  nextRunAtMs?: number;
  lastHeartbeat?: number;
  updatedAt: number;
}

/** Snapshot returned by `ledger.get`. */
export interface LedgerSnapshot {
  entries: LedgerEntry[];
  groupCounts: Record<ActivityGroup, number>;
}

/** Per-role endpoint configuration (mirrors .vibes/config.json semantics). */
export type RoleKey = 'default' | 'planner' | 'executor' | 'reviewer' | 'triage';
export const ROLE_KEYS: readonly RoleKey[] = ['default', 'planner', 'executor', 'reviewer', 'triage'];

export interface RoleEndpoint {
  baseUrl: string;
  model: string;
  /** Decrypted key never crosses IPC; presence only. */
  hasKey: boolean;
}
export type RolesConfigView = Record<RoleKey, RoleEndpoint>;

/** Input for `roles.save`; empty apiKey means "keep the stored one". */
export interface RoleEndpointInput {
  baseUrl: string;
  model: string;
  apiKey?: string;
}
export type RolesConfigInput = Record<RoleKey, RoleEndpointInput>;

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
}

/** Target for `roles.test-connection`: a single endpoint to probe. */
export interface TestConnectionRequest {
  baseUrl: string;
  model: string;
  /** Optional key for the probe; omitted means "no auth" (local Ollama). */
  apiKey?: string;
}

export interface MissionStartRequest {
  request: string;
  workspaceRoot: string;
}
export interface MissionStartResult {
  started: boolean;
  alreadyRunning: boolean;
}

/** Wire shape for the `ledger:new-entry` push event (main → renderer). */
export type LedgerNewEntryEvent = { entry: LedgerEntry };

/** The full channel map — the V1 parity surface. */
export const channels = {
  ledgerGet: 'ledger:get',
  ledgerNewEntry: 'ledger:new-entry',
  rolesGet: 'roles:get',
  rolesSave: 'roles:save',
  rolesTestConnection: 'roles:test-connection',
  missionStart: 'mission:start',
  missionStop: 'mission:stop',
} as const;

export type ChannelName = (typeof channels)[keyof typeof channels];
