import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { AppSettings } from '@shared/channels';

/**
 * Persistent app settings (Settings tab). Stored as JSON in userData; a missing
 * or corrupt file resolves to the defaults rather than throwing — a machine that
 * has never saved settings must still boot.
 */

const SETTINGS_FILE_NAME = 'settings.json';

export const DEFAULT_SETTINGS: AppSettings = {
  vibesPath: '',
  contextPath: '',
  memoryPath: '',
  autoSave: true,
  verboseLogging: false,
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export class SettingsStore {
  private filePath: string;

  constructor(dir: string) {
    this.filePath = path.join(dir, SETTINGS_FILE_NAME);
  }

  get(): AppSettings {
    try {
      if (!existsSync(this.filePath)) return { ...DEFAULT_SETTINGS };
      const raw = JSON.parse(readFileSync(this.filePath, 'utf-8')) as Record<string, unknown>;
      return {
        vibesPath: asString(raw.vibesPath),
        contextPath: asString(raw.contextPath),
        memoryPath: asString(raw.memoryPath),
        autoSave: typeof raw.autoSave === 'boolean' ? raw.autoSave : DEFAULT_SETTINGS.autoSave,
        verboseLogging: typeof raw.verboseLogging === 'boolean' ? raw.verboseLogging : DEFAULT_SETTINGS.verboseLogging,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  save(input: Partial<AppSettings>): boolean {
    try {
      const current = this.get();
      const next: AppSettings = {
        vibesPath: asString(input.vibesPath ?? current.vibesPath),
        contextPath: asString(input.contextPath ?? current.contextPath),
        memoryPath: asString(input.memoryPath ?? current.memoryPath),
        autoSave: typeof input.autoSave === 'boolean' ? input.autoSave : current.autoSave,
        verboseLogging: typeof input.verboseLogging === 'boolean' ? input.verboseLogging : current.verboseLogging,
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
