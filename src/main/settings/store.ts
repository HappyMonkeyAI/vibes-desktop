import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AppSettings, AppSettingsSaveInput, SpeechEngine } from '@shared/channels';
import { ENC_PREFIX, decryptKey, encryptKey, type Cipher } from '../roles/store';

/**
 * Persistent app settings (Settings tab). Stored as JSON in userData; a missing
 * or corrupt file resolves to the defaults rather than throwing — a machine that
 * has never saved settings must still boot.
 *
 * Speech-server, decision-MCP, and TTS secrets are encrypted via the injected
 * Cipher (same OS safeStorage path and plaintext fallback as Roles) and never
 * returned decrypted over IPC.
 */

const SETTINGS_FILE_NAME = 'settings.json';

export const DEFAULT_SETTINGS: AppSettings = {
  vibesPath: '',
  contextPath: '',
  memoryPath: '',
  autoSave: true,
  verboseLogging: false,
  speechEngine: 'builtin',
  speechModel: 'onnx-community/whisper-tiny.en',
  speechPrecision: 'q8',
  speechLang: 'auto',
  speechServerUrl: 'http://127.0.0.1:8765/v1/audio/transcriptions',
  speechServerModel: 'qwen3-asr-0.6b-q8-0',
  speechServerHasKey: false,
  decisionMcpUrl: '',
  decisionMcpHasToken: false,
  ttsAnnounceEnabled: false,
  ttsDaemonUrl: 'http://127.0.0.1:4100',
  ttsDaemonHasToken: false,
  htmlDesignAdvisorEnabled: false,
  htmlDesignAdvisorPython: 'python',
  htmlDesignAdvisorWorkspace: '',
  // Vibes ConfigSchema defaults — written to workspace .vibes/config.json on spawn.
  maxSteps: 25,
  maxConcurrentTasks: 1,
  yoloMode: true,
  thinkingMode: true,
  contextCompactionEnabled: true,
  smallModelProfile: false,
  triageEnabled: false,
  triageInterval: 5,
  triageAutoSteer: true,
  memoryEnabled: true,
  localMemory: false,
  doubleCheckCompletion: true,
  adversarialAudit: true,
  setupComplete: false,
};

function asPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

type Persisted = Omit<AppSettings, 'speechServerHasKey' | 'decisionMcpHasToken' | 'ttsDaemonHasToken'> & {
  speechServerApiKeyEnc?: string;
  decisionMcpAuthTokenEnc?: string;
  ttsDaemonTokenEnc?: string;
  /** Set once the yapsnap → builtin default migration has run for this file. */
  speechEngineMigrated?: boolean;
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asEngine(value: unknown): SpeechEngine {
  if (value === 'server' || value === 'yapsnap' || value === 'builtin') return value;
  return 'builtin';
}

/** Decrypt a stored secret; tolerate enc: prefix, legacy ciphertext, or plaintext. */
function decryptStored(cipher: Cipher | null, stored: string): string | undefined {
  if (!stored) return undefined;
  if (stored.startsWith(ENC_PREFIX)) {
    return cipher ? decryptKey(cipher, stored) || undefined : undefined;
  }
  if (!cipher) return stored;
  try {
    return cipher.decrypt(stored) || undefined;
  } catch {
    return stored;
  }
}

export class SettingsStore {
  private filePath: string;
  private cipher: Cipher | null;

  constructor(dir: string, cipher: Cipher | null = null) {
    this.filePath = path.join(dir, SETTINGS_FILE_NAME);
    this.cipher = cipher;
  }

  /** The raw persisted JSON, or null when missing/corrupt. */
  private readRaw(): (Partial<Persisted> & Record<string, unknown>) | null {
    try {
      if (!existsSync(this.filePath)) return null;
      return JSON.parse(readFileSync(this.filePath, 'utf-8')) as Partial<Persisted> & Record<string, unknown>;
    } catch {
      return null;
    }
  }

  /** Decrypted speech-server key for main-process use only — never over IPC. */
  getSpeechServerApiKey(): string | undefined {
    return decryptStored(this.cipher, asString(this.readRaw()?.speechServerApiKeyEnc));
  }

  /** Decrypted decision MCP bearer for main-process use only — never over IPC. */
  getDecisionMcpAuthToken(): string | undefined {
    const fromFile = decryptStored(this.cipher, asString(this.readRaw()?.decisionMcpAuthTokenEnc));
    if (fromFile) return fromFile;
    const fromKev = (process.env['KEV_MCP_AUTH_TOKEN'] ?? '').trim();
    if (fromKev) return fromKev;
    // Unsloth Studio Decision MCP accepts the Studio API key; allow the same env names Studio uses.
    const url = asString(this.readRaw()?.decisionMcpUrl) || (process.env['KEV_MCP_URL'] ?? '').trim();
    const studio = url.toLowerCase().includes('unsloth') || url.toLowerCase().includes(':8888');
    if (studio) {
      return (
        (process.env['UNSLOTH_API_KEY'] ?? '').trim()
        || (process.env['UNSLOTH_STUDIO_API_KEY'] ?? '').trim()
        || undefined
      );
    }
    return undefined;
  }

  /** Decrypted Agent Voice daemon token — never over IPC. */
  getTtsDaemonToken(): string | undefined {
    const fromFile = decryptStored(this.cipher, asString(this.readRaw()?.ttsDaemonTokenEnc));
    if (fromFile) return fromFile;
    const fromEnv = (process.env['AVT_TOKEN'] ?? '').trim();
    return fromEnv || undefined;
  }

  /**
   * One-time move off the old yapsnap default to builtin Whisper. Runs only for
   * a settings file that predates the migration marker, so a user who
   * re-selects yapsnap afterwards keeps it across launches.
   */
  migrateSpeechEngine(): void {
    const raw = this.readRaw();
    if (!raw || raw.speechEngineMigrated === true) return;
    this.save(raw.speechEngine === 'yapsnap' ? { speechEngine: 'builtin' } : {});
  }

  get(): AppSettings {
    const raw = this.readRaw();
    if (!raw) {
      const decisionMcpUrl = (process.env['KEV_MCP_URL'] ?? '').trim();
      const studio = decisionMcpUrl.toLowerCase().includes('unsloth')
        || decisionMcpUrl.toLowerCase().includes(':8888');
      return {
        ...DEFAULT_SETTINGS,
        decisionMcpUrl,
        decisionMcpHasToken: Boolean(
          (process.env['KEV_MCP_AUTH_TOKEN'] ?? '').trim()
          || (studio && ((process.env['UNSLOTH_API_KEY'] ?? '').trim()
            || (process.env['UNSLOTH_STUDIO_API_KEY'] ?? '').trim())),
        ),
      };
    }
    const hasSpeechKey = Boolean(asString(raw.speechServerApiKeyEnc));
    // Empty string is intentional clear — only fall back to env when the key was never stored.
    const decisionUrl = Object.prototype.hasOwnProperty.call(raw, 'decisionMcpUrl')
      ? asString(raw.decisionMcpUrl)
      : (process.env['KEV_MCP_URL'] ?? '').trim();
    const studioUrl = decisionUrl.toLowerCase().includes('unsloth')
      || decisionUrl.toLowerCase().includes(':8888');
    const hasDecisionToken = Boolean(asString(raw.decisionMcpAuthTokenEnc))
      || Boolean((process.env['KEV_MCP_AUTH_TOKEN'] ?? '').trim())
      || Boolean(
        studioUrl && ((process.env['UNSLOTH_API_KEY'] ?? '').trim()
          || (process.env['UNSLOTH_STUDIO_API_KEY'] ?? '').trim()),
      );
    const hasTtsToken = Boolean(asString(raw.ttsDaemonTokenEnc))
      || Boolean((process.env['AVT_TOKEN'] ?? '').trim());
    return {
      vibesPath: asString(raw.vibesPath),
      contextPath: asString(raw.contextPath),
      memoryPath: asString(raw.memoryPath),
      autoSave: typeof raw.autoSave === 'boolean' ? raw.autoSave : DEFAULT_SETTINGS.autoSave,
      verboseLogging: typeof raw.verboseLogging === 'boolean' ? raw.verboseLogging : DEFAULT_SETTINGS.verboseLogging,
      speechEngine: asEngine(raw.speechEngine),
      speechModel: asString(raw.speechModel) || DEFAULT_SETTINGS.speechModel,
      speechPrecision: asString(raw.speechPrecision) || DEFAULT_SETTINGS.speechPrecision,
      speechLang: asString(raw.speechLang) || DEFAULT_SETTINGS.speechLang,
      speechServerUrl: asString(raw.speechServerUrl) || DEFAULT_SETTINGS.speechServerUrl,
      speechServerModel: asString(raw.speechServerModel) || DEFAULT_SETTINGS.speechServerModel,
      speechServerHasKey: hasSpeechKey,
      decisionMcpUrl: decisionUrl,
      decisionMcpHasToken: hasDecisionToken,
      ttsAnnounceEnabled: typeof raw.ttsAnnounceEnabled === 'boolean'
        ? raw.ttsAnnounceEnabled
        : DEFAULT_SETTINGS.ttsAnnounceEnabled,
      ttsDaemonUrl: asString(raw.ttsDaemonUrl) || DEFAULT_SETTINGS.ttsDaemonUrl,
      ttsDaemonHasToken: hasTtsToken,
      htmlDesignAdvisorEnabled: typeof raw.htmlDesignAdvisorEnabled === 'boolean'
        ? raw.htmlDesignAdvisorEnabled
        : DEFAULT_SETTINGS.htmlDesignAdvisorEnabled,
      htmlDesignAdvisorPython: asString(raw.htmlDesignAdvisorPython)
        || DEFAULT_SETTINGS.htmlDesignAdvisorPython,
      htmlDesignAdvisorWorkspace: asString(raw.htmlDesignAdvisorWorkspace),
      maxSteps: asPositiveInt(raw.maxSteps, DEFAULT_SETTINGS.maxSteps),
      maxConcurrentTasks: asPositiveInt(raw.maxConcurrentTasks, DEFAULT_SETTINGS.maxConcurrentTasks),
      yoloMode: asBool(raw.yoloMode, DEFAULT_SETTINGS.yoloMode),
      thinkingMode: asBool(raw.thinkingMode, DEFAULT_SETTINGS.thinkingMode),
      contextCompactionEnabled: asBool(raw.contextCompactionEnabled, DEFAULT_SETTINGS.contextCompactionEnabled),
      smallModelProfile: asBool(raw.smallModelProfile, DEFAULT_SETTINGS.smallModelProfile),
      triageEnabled: asBool(raw.triageEnabled, DEFAULT_SETTINGS.triageEnabled),
      triageInterval: asPositiveInt(raw.triageInterval, DEFAULT_SETTINGS.triageInterval),
      triageAutoSteer: asBool(raw.triageAutoSteer, DEFAULT_SETTINGS.triageAutoSteer),
      memoryEnabled: asBool(raw.memoryEnabled, DEFAULT_SETTINGS.memoryEnabled),
      localMemory: asBool(raw.localMemory, DEFAULT_SETTINGS.localMemory),
      doubleCheckCompletion: asBool(raw.doubleCheckCompletion, DEFAULT_SETTINGS.doubleCheckCompletion),
      adversarialAudit: asBool(raw.adversarialAudit, DEFAULT_SETTINGS.adversarialAudit),
      // Existing installs with a vibes path are treated as already set up.
      setupComplete: asBool(
        raw.setupComplete,
        Boolean(asString(raw.vibesPath).trim()),
      ),
    };
  }

  save(input: AppSettingsSaveInput): boolean {
    try {
      const currentView = this.get();
      const existing = this.readRaw();

      let nextSpeechEnc = input.clearSpeechServerApiKey === true
        ? ''
        : asString(existing?.speechServerApiKeyEnc);
      if (typeof input.speechServerApiKey === 'string' && input.speechServerApiKey.length > 0) {
        nextSpeechEnc = this.cipher
          ? encryptKey(this.cipher, input.speechServerApiKey)
          : input.speechServerApiKey;
      }

      let nextDecisionEnc = asString(existing?.decisionMcpAuthTokenEnc);
      if (typeof input.decisionMcpAuthToken === 'string' && input.decisionMcpAuthToken.length > 0) {
        nextDecisionEnc = this.cipher
          ? encryptKey(this.cipher, input.decisionMcpAuthToken)
          : input.decisionMcpAuthToken;
      }

      let nextTtsEnc = asString(existing?.ttsDaemonTokenEnc);
      if (typeof input.ttsDaemonToken === 'string' && input.ttsDaemonToken.length > 0) {
        nextTtsEnc = this.cipher
          ? encryptKey(this.cipher, input.ttsDaemonToken)
          : input.ttsDaemonToken;
      }

      const nextEngine = input.speechEngine === 'server' || input.speechEngine === 'yapsnap' || input.speechEngine === 'builtin'
        ? input.speechEngine
        : currentView.speechEngine;

      const next: Persisted = {
        vibesPath: asString(input.vibesPath ?? currentView.vibesPath),
        contextPath: asString(input.contextPath ?? currentView.contextPath),
        memoryPath: asString(input.memoryPath ?? currentView.memoryPath),
        autoSave: typeof input.autoSave === 'boolean' ? input.autoSave : currentView.autoSave,
        verboseLogging: typeof input.verboseLogging === 'boolean' ? input.verboseLogging : currentView.verboseLogging,
        speechEngine: nextEngine,
        speechModel: asString(input.speechModel ?? currentView.speechModel) || DEFAULT_SETTINGS.speechModel,
        speechPrecision: asString(input.speechPrecision ?? currentView.speechPrecision) || DEFAULT_SETTINGS.speechPrecision,
        speechLang: asString(input.speechLang ?? currentView.speechLang) || DEFAULT_SETTINGS.speechLang,
        speechServerUrl: asString(input.speechServerUrl ?? currentView.speechServerUrl),
        speechServerModel: asString(input.speechServerModel ?? currentView.speechServerModel),
        speechServerApiKeyEnc: nextSpeechEnc || undefined,
        decisionMcpUrl: asString(input.decisionMcpUrl ?? currentView.decisionMcpUrl),
        decisionMcpAuthTokenEnc: nextDecisionEnc || undefined,
        ttsAnnounceEnabled: typeof input.ttsAnnounceEnabled === 'boolean'
          ? input.ttsAnnounceEnabled
          : currentView.ttsAnnounceEnabled,
        ttsDaemonUrl: asString(input.ttsDaemonUrl ?? currentView.ttsDaemonUrl) || DEFAULT_SETTINGS.ttsDaemonUrl,
        ttsDaemonTokenEnc: nextTtsEnc || undefined,
        htmlDesignAdvisorEnabled: typeof input.htmlDesignAdvisorEnabled === 'boolean'
          ? input.htmlDesignAdvisorEnabled
          : currentView.htmlDesignAdvisorEnabled,
        htmlDesignAdvisorPython: asString(input.htmlDesignAdvisorPython ?? currentView.htmlDesignAdvisorPython)
          || DEFAULT_SETTINGS.htmlDesignAdvisorPython,
        htmlDesignAdvisorWorkspace: asString(
          input.htmlDesignAdvisorWorkspace ?? currentView.htmlDesignAdvisorWorkspace,
        ),
        maxSteps: asPositiveInt(input.maxSteps ?? currentView.maxSteps, DEFAULT_SETTINGS.maxSteps),
        maxConcurrentTasks: asPositiveInt(
          input.maxConcurrentTasks ?? currentView.maxConcurrentTasks,
          DEFAULT_SETTINGS.maxConcurrentTasks,
        ),
        yoloMode: asBool(input.yoloMode ?? currentView.yoloMode, DEFAULT_SETTINGS.yoloMode),
        thinkingMode: asBool(input.thinkingMode ?? currentView.thinkingMode, DEFAULT_SETTINGS.thinkingMode),
        contextCompactionEnabled: asBool(
          input.contextCompactionEnabled ?? currentView.contextCompactionEnabled,
          DEFAULT_SETTINGS.contextCompactionEnabled,
        ),
        smallModelProfile: asBool(
          input.smallModelProfile ?? currentView.smallModelProfile,
          DEFAULT_SETTINGS.smallModelProfile,
        ),
        triageEnabled: asBool(input.triageEnabled ?? currentView.triageEnabled, DEFAULT_SETTINGS.triageEnabled),
        triageInterval: asPositiveInt(
          input.triageInterval ?? currentView.triageInterval,
          DEFAULT_SETTINGS.triageInterval,
        ),
        triageAutoSteer: asBool(
          input.triageAutoSteer ?? currentView.triageAutoSteer,
          DEFAULT_SETTINGS.triageAutoSteer,
        ),
        memoryEnabled: asBool(input.memoryEnabled ?? currentView.memoryEnabled, DEFAULT_SETTINGS.memoryEnabled),
        localMemory: asBool(input.localMemory ?? currentView.localMemory, DEFAULT_SETTINGS.localMemory),
        doubleCheckCompletion: asBool(
          input.doubleCheckCompletion ?? currentView.doubleCheckCompletion,
          DEFAULT_SETTINGS.doubleCheckCompletion,
        ),
        adversarialAudit: asBool(
          input.adversarialAudit ?? currentView.adversarialAudit,
          DEFAULT_SETTINGS.adversarialAudit,
        ),
        setupComplete: asBool(input.setupComplete ?? currentView.setupComplete, DEFAULT_SETTINGS.setupComplete),
        speechEngineMigrated: true,
      };
      const dir = path.dirname(this.filePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(next, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
}
