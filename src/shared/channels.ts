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
  /** 'mission' marks a mission-level event row; absent on task rows. */
  kind?: 'mission';
  /** Scopes a row to one mission: task and mission rows upsert by (missionId, title)
   *  so two missions never collide on identical titles. Minted per startMission. */
  missionId?: string;
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
  /** When present and apiKey is omitted, the main process probes with the stored key for this role. */
  role?: RoleKey;
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
  /** Required working directory for the mission (no cwd fallback). */
  workspaceRoot?: string;
  /** When true, execute the plan already reviewed by the user (kept alive by mission:plan)
   *  instead of planning again. Falls back to a fresh plan when no pending plan matches. */
  acceptPlan?: boolean;
  /** When a mission is already running, enqueue this request (crash-safe FIFO) instead of rejecting. */
  enqueueIfBusy?: boolean;
}
export interface MissionStartResult {
  started: boolean;
  alreadyRunning: boolean;
  /** Present when the start was rejected or failed for a reason the user can act on. */
  error?: string;
  /** Minted when start succeeds — Chat / depth panels bind ledger rows to this id. */
  missionId?: string;
  /** True when enqueueIfBusy parked the request behind the active mission. */
  queued?: boolean;
  queueId?: string;
  queueDepth?: number;
}

export interface MissionQueueSnapshot {
  paused: boolean;
  items: Array<{ id: string; request: string; workspaceRoot: string; createdAt: number }>;
}

/** Mission plan response from the planner API. */
export interface MissionPlanResponse {
  tasks: string[];
  /** Present when planning failed (no reachable LLM, no workspace, child crash). */
  error?: string;
}

export interface MissionPlanRequest {
  request: string;
  /** Required working directory for planning (no cwd fallback). */
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

/**
 * Speech-to-text engine:
 * - builtin — Whisper ONNX in-app (Transformers.js), downloads model on first talk (ZeroG-style)
 * - server — OpenAI-compatible /v1/audio/transcriptions (e.g. qwen3-asr)
 * - yapsnap — legacy local CLI (optional; requires pip install)
 */
export type SpeechEngine = 'builtin' | 'server' | 'yapsnap';

/** App settings persisted in userData (Settings tab). */
export interface AppSettings {
  /** Absolute path to a vibes checkout (contains src/mcp/server.ts). */
  vibesPath: string;
  contextPath: string;
  memoryPath: string;
  autoSave: boolean;
  verboseLogging: boolean;
  /** STT backend. */
  speechEngine: SpeechEngine;
  /** Hugging Face Whisper id for builtin engine. */
  speechModel: string;
  /** Transformers.js dtype for builtin: q8 | q4 | fp16 | fp32. */
  speechPrecision: string;
  /** Language code for STT, or `auto`. */
  speechLang: string;
  /** Full transcriptions URL, e.g. http://127.0.0.1:8765/v1/audio/transcriptions */
  speechServerUrl: string;
  /** Model name the server expects (e.g. qwen3-asr-0.6b-q8-0). */
  speechServerModel: string;
  /** True when an API key is stored for the speech server (never returned decrypted). */
  speechServerHasKey: boolean;
  /**
   * Streamable-HTTP MCP URL for a KEV-compatible decision server
   * (e.g. http://192.168.5.157:8765/mcp). Empty = decision model off.
   */
  decisionMcpUrl: string;
  /** True when a bearer token is stored for the decision MCP (never returned decrypted). */
  decisionMcpHasToken: boolean;
  /** T24 — announce mission done/failed via Agent Voice daemon. */
  ttsAnnounceEnabled: boolean;
  /** Daemon base URL (no path), e.g. http://127.0.0.1:4100 */
  ttsDaemonUrl: string;
  /** True when an AVT_TOKEN is stored (never returned decrypted). */
  ttsDaemonHasToken: boolean;
  /**
   * When true, mission spawn merges `html-design-advisor` into workspace
   * `.vibes/mcp.json` (stdio: python -m html_design_advisor).
   */
  htmlDesignAdvisorEnabled: boolean;
  /** Python executable for the advisor (default `python`). */
  htmlDesignAdvisorPython: string;
  /** Optional HTML_DESIGN_ADVISOR_WORKSPACE (ui-design catalog root). */
  htmlDesignAdvisorWorkspace: string;
}

/** Partial save payload — empty *ApiKey / *AuthToken fields mean keep the stored secret. */
export type AppSettingsSaveInput = Partial<Omit<AppSettings, 'speechServerHasKey' | 'decisionMcpHasToken' | 'ttsDaemonHasToken'>> & {
  speechServerApiKey?: string;
  /** Bearer for decision MCP; empty string omitted = keep stored. */
  decisionMcpAuthToken?: string;
  /** Bearer for Agent Voice daemon; empty = keep stored. */
  ttsDaemonToken?: string;
};

/** Main-process view of an optional decision MCP endpoint. */
export type DecisionMcpConfig = {
  url: string;
  token: string;
};

/** True when Settings (or env fallback) has both a URL and a token. */
export function isDecisionModelConfigured(settings: Pick<AppSettings, 'decisionMcpUrl' | 'decisionMcpHasToken'>): boolean {
  return Boolean(settings.decisionMcpUrl.trim() && settings.decisionMcpHasToken);
}

/** Result of warming / pre-fetching the local yapsnap model cache. */
export interface VoiceWarmResult {
  ok: boolean;
  error?: string;
  detail?: string;
}

/** Probe result for the configured speech server. */
export interface VoiceServerTestResult {
  ok: boolean;
  error?: string;
}

/** Probe result for the optional decision MCP (KEV / GUTSY). */
export interface DecisionProbeResult {
  ok: boolean;
  error?: string;
  detail?: string;
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
  voiceWarm: 'voice:warm',
  voiceTestServer: 'voice:test-server',
  missionStart: 'mission:start',
  missionStop: 'mission:stop',
  missionPlan: 'mission:plan',
  missionCancelPlan: 'mission:cancel-plan',
  missionQueueGet: 'mission:queue-get',
  missionQueuePause: 'mission:queue-pause',
  missionQueueClear: 'mission:queue-clear',
  workspaceSelect: 'workspace:select',
  workspaceHistorySave: 'workspace:history:save',
  workspaceHistoryGet: 'workspace:history:get',
  workspaceHistoryClear: 'workspace:history:clear',
  ledgerArchive: 'ledger:archive',
  settingsGet: 'settings:get',
  settingsSave: 'settings:save',
  decisionTest: 'decision:test',
  /** T35 — latest Harness²-lite lesson for a workspace (`.vibes/harness-lesson.json`). */
  harnessLessonGet: 'harness:lesson-get',
  /** T24 — probe/post a test announcement to the Agent Voice daemon. */
  voiceAnnounceTest: 'voice:announce-test',
  /** Chat phase 2 — inject mid-run steering into the active mission. */
  missionSteer: 'mission:steer',
} as const;

export type VoiceAnnounceTestResult = { ok: boolean; error?: string; id?: string };
export type MissionSteerRequest = { message: string };
export type MissionSteerResult = { ok: boolean; error?: string };

export type HarnessLessonView = {
  lesson: string;
  missionTitle: string;
  at: number;
} | null;

export type ChannelName = (typeof channels)[keyof typeof channels];
