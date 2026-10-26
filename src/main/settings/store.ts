import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AppSettings, AppSettingsSaveInput, SpeechEngine } from '@shared/channels';
import type { Cipher } from '../roles/store';

/**
 * Persistent app settings (Settings tab). Stored as JSON in userData; a missing
 * or corrupt file resolves to the defaults rather than throwing — a machine that
 * has never saved settings must still boot.
 *
 * Speech-server and decision-MCP secrets are encrypted via the injected Cipher
 * (same OS safeStorage path as Roles) and never returned decrypted over IPC.
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
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asEngine(value: unknown): SpeechEngine {
  if (value === 'server' || value === 'yapsnap' || value === 'builtin') return value;
  return 'builtin';
}

export class SettingsStore {
  private filePath: string;
  private cipher: Cipher | null;

  constructor(dir: string, cipher: Cipher | null = null) {
    this.filePath = path.join(dir, SETTINGS_FILE_NAME);
    this.cipher = cipher;
  }

  /** Decrypted speech-server key for main-process use only — never over IPC. */
  getSpeechServerApiKey(): string | undefined {
    try {
      if (!existsSync(this.filePath)) return undefined;
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Persisted;
      const enc = asString(raw.speechServerApiKeyEnc);
      if (!enc || !this.cipher) return undefined;
      return this.cipher.decrypt(enc) || undefined;
    } catch {
      return undefined;
    }
  }

  /** Decrypted decision MCP bearer for main-process use only — never over IPC. */
  getDecisionMcpAuthToken(): string | undefined {
    try {
      if (!existsSync(this.filePath)) {
        const fromEnv = (process.env['KEV_MCP_AUTH_TOKEN'] ?? '').trim();
        return fromEnv || undefined;
      }
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Persisted;
      const enc = asString(raw.decisionMcpAuthTokenEnc);
      if (enc && this.cipher) {
        const plain = this.cipher.decrypt(enc);
        if (plain) return plain;
      }
      const fromEnv = (process.env['KEV_MCP_AUTH_TOKEN'] ?? '').trim();
      return fromEnv || undefined;
    } catch {
      const fromEnv = (process.env['KEV_MCP_AUTH_TOKEN'] ?? '').trim();
      return fromEnv || undefined;
    }
  }

  /** Decrypted Agent Voice daemon token — never over IPC. */
  getTtsDaemonToken(): string | undefined {
    try {
      if (!existsSync(this.filePath)) {
        const fromEnv = (process.env['AVT_TOKEN'] ?? '').trim();
        return fromEnv || undefined;
      }
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Persisted;
      const enc = asString(raw.ttsDaemonTokenEnc);
      if (enc && this.cipher) {
        const plain = this.cipher.decrypt(enc);
        if (plain) return plain;
      }
      const fromEnv = (process.env['AVT_TOKEN'] ?? '').trim();
      return fromEnv || undefined;
    } catch {
      const fromEnv = (process.env['AVT_TOKEN'] ?? '').trim();
      return fromEnv || undefined;
    }
  }

  get(): AppSettings {
    try {
      if (!existsSync(this.filePath)) {
        return {
          ...DEFAULT_SETTINGS,
          decisionMcpUrl: (process.env['KEV_MCP_URL'] ?? '').trim(),
          decisionMcpHasToken: Boolean((process.env['KEV_MCP_AUTH_TOKEN'] ?? '').trim()),
        };
      }
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Persisted & Record<string, unknown>;
      const hasSpeechKey = Boolean(asString(raw.speechServerApiKeyEnc));
      const hasDecisionToken = Boolean(asString(raw.decisionMcpAuthTokenEnc))
        || Boolean((process.env['KEV_MCP_AUTH_TOKEN'] ?? '').trim());
      const decisionUrl = asString(raw.decisionMcpUrl) || (process.env['KEV_MCP_URL'] ?? '').trim();
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
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  save(input: AppSettingsSaveInput): boolean {
    try {
      const currentView = this.get();
      let existingSpeechEnc = '';
      let existingDecisionEnc = '';
      let existingTtsEnc = '';
      try {
        if (existsSync(this.filePath)) {
          const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Persisted;
          existingSpeechEnc = asString(raw.speechServerApiKeyEnc);
          existingDecisionEnc = asString(raw.decisionMcpAuthTokenEnc);
          existingTtsEnc = asString(raw.ttsDaemonTokenEnc);
        }
      } catch {
        existingSpeechEnc = '';
        existingDecisionEnc = '';
        existingTtsEnc = '';
      }

      let nextSpeechEnc = existingSpeechEnc;
      if (typeof input.speechServerApiKey === 'string' && input.speechServerApiKey.length > 0 && this.cipher) {
        nextSpeechEnc = this.cipher.encrypt(input.speechServerApiKey);
      }

      let nextDecisionEnc = existingDecisionEnc;
      if (typeof input.decisionMcpAuthToken === 'string' && input.decisionMcpAuthToken.length > 0 && this.cipher) {
        nextDecisionEnc = this.cipher.encrypt(input.decisionMcpAuthToken);
      }

      let nextTtsEnc = existingTtsEnc;
      if (typeof input.ttsDaemonToken === 'string' && input.ttsDaemonToken.length > 0 && this.cipher) {
        nextTtsEnc = this.cipher.encrypt(input.ttsDaemonToken);
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
