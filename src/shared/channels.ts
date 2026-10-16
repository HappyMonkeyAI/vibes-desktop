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
  'archived',
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
  /** The workspace root this mission was executed in. */
  workspaceRoot?: string;
  /** 'mission' marks a mission-level event row (Planning/Executing/complete); absent on task rows. */
  kind?: 'mission';
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

/** T12 — yapsnap-doctor result: what's present, and how to install what isn't. */
export interface VoiceDoctorResult {
  ffmpegAvailable: boolean;
  yapsnapAvailable: boolean;
  /** True when both are present and transcription can proceed offline. */
  ready: boolean;
  /** Actionable hint for each missing piece (null when present). */
  ffmpegHint: string | null;
  yapsnapHint: string | null;
}

/** T10/T11 — a captured mic buffer, base64-encoded webm/opus from the renderer. */
export interface VoiceTranscribeRequest {
  /** Base64 of the recorded webm (MediaRecorder's native format). */
  audioBase64: string;
  mime: string;
}

/** T11 — transcription result: text on success, an actionable error otherwise. */
export interface VoiceTranscribeResult {
  ok: boolean;
  text?: string;
  error?: string;
}

export interface MissionStartRequest {
  request: string;
  /** Optional explicit mission root; falls back to the app's cwd when empty. */
  workspaceRoot?: string;
}
export interface MissionStartResult {
  started: boolean;
  alreadyRunning: boolean;
  /** Present when the start was rejected or failed for a reason the user can act on. */
  error?: string;
}

/** Mission plan response from the planner API. */
export interface MissionPlanResponse {
  tasks: string[];
  /** Present when planning failed (no reachable LLM, no workspace, child crash). */
  error?: string;
}

export interface MissionPlanRequest {
  request: string;
  /** Optional explicit mission root; falls back to the app's cwd when empty. */
  workspaceRoot?: string;
}

/** Result of the native folder picker used to choose a mission's working directory. */
export interface WorkspaceSelectResult {
  /** The chosen absolute path, or null when the dialog was cancelled. */
  path: string | null;
}

/** Workspace history entry. */
export interface WorkspaceHistoryEntry {
  path: string;
  lastUsed: number;
}

/** Ledger search filter. */
export interface LedgerSearchFilter {
  query?: string;
  status?: LedgerStatus;
  group?: ActivityGroup;
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
  voiceDoctor: 'voice:doctor',
  voiceTranscribe: 'voice:transcribe',
  missionStart: 'mission:start',
  missionStop: 'mission:stop',
  missionPlan: 'mission:plan',
  workspaceSelect: 'workspace:select',
  workspaceHistorySave: 'workspace:history:save',
  workspaceHistoryGet: 'workspace:history:get',
  workspaceHistoryClear: 'workspace:history:clear',
  ledgerSearch: 'ledger:search',
  ledgerArchive: 'ledger:archive',
} as const;

export type ChannelName = (typeof channels)[keyof typeof channels];
