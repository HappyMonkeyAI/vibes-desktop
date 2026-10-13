import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { RoleEndpointInput, RolesConfigInput, RolesConfigView } from '@shared/channels';

/**
 * T7 — persistent per-role endpoint store. Mirrors the fork's rolesConfigStore:
 * baseUrl/model are plain text (not secrets); each role's apiKey is encrypted with
 * an injected cipher so no key sits on disk readable. A missing/corrupt file
 * resolves to the all-empty config rather than throwing — a machine that has never
 * configured roles must still boot.
 *
 * Testable without Electron: takes an explicit directory and a Cipher. The real
 * safeStorage-backed cipher is injected at wiring time (see safeCipher).
 */

export interface Cipher {
  isAvailable(): boolean;
  encrypt(plain: string): string;
  decrypt(encoded: string): string;
}

/** Prefix marking a stored value as our ciphertext; lets us tolerate legacy plaintext. */
const ENC_PREFIX = 'enc:';

const CONFIG_FILE_NAME = 'roles-config.json';

type StoredEndpoint = { baseUrl: string; model: string; apiKey: string };
type StoredConfig = Record<keyof RolesConfigView, StoredEndpoint>;

export const EMPTY_ROLES_CONFIG: StoredConfig = {
  default: { baseUrl: '', model: '', apiKey: '' },
  planner: { baseUrl: '', model: '', apiKey: '' },
  executor: { baseUrl: '', model: '', apiKey: '' },
  reviewer: { baseUrl: '', model: '', apiKey: '' },
  triage: { baseUrl: '', model: '', apiKey: '' },
};

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Decrypt a stored key, tolerating plaintext (pre-encryption) values. */
function decryptKey(cipher: Cipher, encoded: string): string {
  if (!encoded) return '';
  if (!encoded.startsWith(ENC_PREFIX)) return encoded; // legacy plaintext
  try {
    return cipher.decrypt(encoded.slice(ENC_PREFIX.length));
  } catch {
    return '';
  }
}

/** Encrypt a key for storage, falling back to plaintext when no store is up. */
function encryptKey(cipher: Cipher, key: string): string {
  if (!key) return '';
  if (!cipher.isAvailable()) return key;
  try {
    return ENC_PREFIX + cipher.encrypt(key);
  } catch {
    return key;
  }
}

export class RolesStore {
  private dir: string;
  private cipher: Cipher;

  constructor(dir: string, cipher: Cipher) {
    this.dir = dir;
    this.cipher = cipher;
  }

  private configPath(): string {
    return path.join(this.dir, CONFIG_FILE_NAME);
  }

  /** Read + decrypt the persisted config. Never throws. */
  load(): StoredConfig {
    const file = this.configPath();
    if (!existsSync(file)) return structuredClone(EMPTY_ROLES_CONFIG);
    try {
      const raw = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>;
      const pick = (role: keyof RolesConfigView): StoredEndpoint => {
        const entry = (raw[role] ?? {}) as Record<string, unknown>;
        return {
          baseUrl: asString(entry.baseUrl),
          model: asString(entry.model),
          apiKey: decryptKey(this.cipher, asString(entry.apiKey)),
        };
      };
      return {
        default: pick('default'),
        planner: pick('planner'),
        executor: pick('executor'),
        reviewer: pick('reviewer'),
        triage: pick('triage'),
      };
    } catch {
      return structuredClone(EMPTY_ROLES_CONFIG);
    }
  }

  /** The view shape: key reduced to a presence flag — a decrypted key never leaves main. */
  view(): RolesConfigView {
    const config = this.load();
    const toView = (e: StoredEndpoint): { baseUrl: string; model: string; hasKey: boolean } => ({
      baseUrl: e.baseUrl,
      model: e.model,
      hasKey: e.apiKey.length > 0,
    });
    return {
      default: toView(config.default),
      planner: toView(config.planner),
      executor: toView(config.executor),
      reviewer: toView(config.reviewer),
      triage: toView(config.triage),
    };
  }

  /** Merge an edited role into the existing config. Empty apiKey keeps the stored one. */
  save(input: RolesConfigInput): boolean {
    const cipher = this.cipher;
    const dir = this.dir;
    const encryptStored = (e: StoredEndpoint): StoredEndpoint => ({
      baseUrl: e.baseUrl,
      model: e.model,
      apiKey: encryptKey(cipher, e.apiKey),
    });
    const existing = this.load();
    const mergeRole = (existingRole: StoredEndpoint, inputRole: RoleEndpointInput): StoredEndpoint => ({
      baseUrl: (inputRole.baseUrl ?? '').trim(),
      model: (inputRole.model ?? '').trim(),
      // An empty submitted key means "don't touch what's already encrypted".
      apiKey: inputRole.apiKey && inputRole.apiKey.length > 0 ? inputRole.apiKey : existingRole.apiKey,
    });
    const next: StoredConfig = {
      default: mergeRole(existing.default, input.default ?? EMPTY_ROLES_CONFIG.default),
      planner: mergeRole(existing.planner, input.planner ?? EMPTY_ROLES_CONFIG.planner),
      executor: mergeRole(existing.executor, input.executor ?? EMPTY_ROLES_CONFIG.executor),
      reviewer: mergeRole(existing.reviewer, input.reviewer ?? EMPTY_ROLES_CONFIG.reviewer),
      triage: mergeRole(existing.triage, input.triage ?? EMPTY_ROLES_CONFIG.triage),
    };
    try {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const toPersist = {
        default: encryptStored(next.default),
        planner: encryptStored(next.planner),
        executor: encryptStored(next.executor),
        reviewer: encryptStored(next.reviewer),
        triage: encryptStored(next.triage),
      };
      writeFileSync(this.configPath(), JSON.stringify(toPersist, null, 2), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /** The decrypted key for one role (used to feed the child env / config writer). */
  getKey(role: keyof RolesConfigView): string {
    return this.load()[role].apiKey;
  }

  /** Full decrypted config as the input shape — feeds the native config writer (T13). */
  input(): RolesConfigInput {
    const config = this.load();
    const toInput = (e: StoredEndpoint): RoleEndpointInput => ({ baseUrl: e.baseUrl, model: e.model, apiKey: e.apiKey });
    return {
      default: toInput(config.default),
      planner: toInput(config.planner),
      executor: toInput(config.executor),
      reviewer: toInput(config.reviewer),
      triage: toInput(config.triage),
    };
  }
}
