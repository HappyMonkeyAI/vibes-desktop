import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AppSettings, AppSettingsSaveInput, SpeechEngine } from '@shared/channels';
import { ENC_PREFIX, decryptKey, encryptKey, type Cipher } from '../roles/store';

/**
 * Persistent app settings (Settings tab). Stored as JSON in userData; a missing
 * or corrupt file resolves to the defaults rather than throwing — a machine that
 * has never saved settings must still boot.
 *
 * The speech-server API key is encrypted via the injected Cipher (same OS
 * safeStorage path and plaintext fallback as Roles) and never returned
 * decrypted over IPC.
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
};

type Persisted = Omit<AppSettings, 'speechServerHasKey'> & {
  speechServerApiKeyEnc?: string;
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
    const stored = asString(this.readRaw()?.speechServerApiKeyEnc);
    if (!stored) return undefined;
    if (stored.startsWith(ENC_PREFIX)) return this.cipher ? decryptKey(this.cipher, stored) || undefined : undefined;
    if (!this.cipher) return stored;
    // Unprefixed: ciphertext written before the enc: prefix was adopted, or a
    // plaintext fallback. Ciphertext decrypts; plaintext fails and is used as-is.
    try {
      return this.cipher.decrypt(stored) || undefined;
    } catch {
      return stored;
    }
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
    if (!raw) return { ...DEFAULT_SETTINGS };
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
      speechServerHasKey: Boolean(asString(raw.speechServerApiKeyEnc)),
    };
  }

  save(input: AppSettingsSaveInput): boolean {
    try {
      const currentView = this.get();
      let nextEnc = input.clearSpeechServerApiKey === true ? '' : asString(this.readRaw()?.speechServerApiKeyEnc);
      if (typeof input.speechServerApiKey === 'string' && input.speechServerApiKey.length > 0) {
        // encryptKey falls back to plaintext when the OS store is unavailable,
        // so a missing keyring never fails the whole settings save.
        nextEnc = this.cipher ? encryptKey(this.cipher, input.speechServerApiKey) : input.speechServerApiKey;
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
        speechServerApiKeyEnc: nextEnc || undefined,
        // Any file written by this version already has the current defaults.
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
