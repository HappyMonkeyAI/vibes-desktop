import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type {
  RoleEndpoint,
  RoleEndpointInput,
  RoleReasoningEffort,
  RoleReasoningMode,
  RolesConfigInput,
  RolesConfigView,
} from '@shared/channels';
import { ROLE_REASONING_EFFORTS, ROLE_REASONING_MODES } from '@shared/channels';
import {
  normalizeMcpServerAllowlist,
  normalizeMcpToolAllowlist,
  normalizeMcpToolBudget,
} from '@shared/mcpPolicy';

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
export const ENC_PREFIX = 'enc:';

const CONFIG_FILE_NAME = 'roles-config.json';

type StoredEndpoint = {
  baseUrl: string;
  model: string;
  contextWindow: string;
  systemPrompt: string;
  reasoningMode: RoleReasoningMode;
  reasoningEffort: RoleReasoningEffort;
  mcpServers: string[];
  mcpTools: string[];
  mcpToolBudget: string;
  apiKey: string;
};
type StoredConfig = Record<keyof RolesConfigView, StoredEndpoint>;

const EMPTY_ENDPOINT: StoredEndpoint = {
  baseUrl: '',
  model: '',
  contextWindow: '',
  systemPrompt: '',
  reasoningMode: 'inherit',
  reasoningEffort: 'inherit',
  mcpServers: [],
  mcpTools: [],
  mcpToolBudget: '',
  apiKey: '',
};

export const EMPTY_ROLES_CONFIG: StoredConfig = {
  default: { ...EMPTY_ENDPOINT },
  planner: { ...EMPTY_ENDPOINT },
  executor: { ...EMPTY_ENDPOINT },
  reviewer: { ...EMPTY_ENDPOINT },
  triage: { ...EMPTY_ENDPOINT },
};

/** Soft cap for constitution text persisted in roles-config.json. */
const MAX_SYSTEM_PROMPT_CHARS = 12_000;

export function normalizeSystemPrompt(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.length > MAX_SYSTEM_PROMPT_CHARS
    ? trimmed.slice(0, MAX_SYSTEM_PROMPT_CHARS)
    : trimmed;
}

/** Digits-only positive int as string; anything else becomes empty (unset). */
export function normalizeContextWindow(raw: unknown): string {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return String(Math.floor(raw));
  }
  if (typeof raw !== 'string') return '';
  const digits = raw.trim().replace(/[_\s,]/g, '');
  if (!/^\d+$/.test(digits)) return '';
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return '';
  return String(n);
}

export function normalizeReasoningMode(raw: unknown): RoleReasoningMode {
  if (typeof raw === 'string' && (ROLE_REASONING_MODES as readonly string[]).includes(raw)) {
    return raw as RoleReasoningMode;
  }
  return 'inherit';
}

export function normalizeReasoningEffort(raw: unknown): RoleReasoningEffort {
  if (typeof raw === 'string' && (ROLE_REASONING_EFFORTS as readonly string[]).includes(raw)) {
    return raw as RoleReasoningEffort;
  }
  return 'inherit';
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** Decrypt a stored key, tolerating plaintext (pre-encryption) values. */
export function decryptKey(cipher: Cipher, encoded: string): string {
  if (!encoded) return '';
  if (!encoded.startsWith(ENC_PREFIX)) return encoded; // legacy plaintext
  try {
    return cipher.decrypt(encoded.slice(ENC_PREFIX.length));
  } catch {
    return '';
  }
}

/** Encrypt a key for storage, falling back to plaintext when no store is up. */
export function encryptKey(cipher: Cipher, key: string): string {
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
          contextWindow: normalizeContextWindow(entry.contextWindow),
          systemPrompt: normalizeSystemPrompt(entry.systemPrompt),
          reasoningMode: normalizeReasoningMode(entry.reasoningMode),
          reasoningEffort: normalizeReasoningEffort(entry.reasoningEffort),
          mcpServers: normalizeMcpServerAllowlist(entry.mcpServers),
          mcpTools: normalizeMcpToolAllowlist(entry.mcpTools),
          mcpToolBudget: normalizeMcpToolBudget(entry.mcpToolBudget),
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
    const toView = (e: StoredEndpoint): RoleEndpoint => ({
      baseUrl: e.baseUrl,
      model: e.model,
      contextWindow: e.contextWindow,
      systemPrompt: e.systemPrompt,
      reasoningMode: e.reasoningMode,
      reasoningEffort: e.reasoningEffort,
      mcpServers: [...e.mcpServers],
      mcpTools: [...e.mcpTools],
      mcpToolBudget: e.mcpToolBudget,
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
      contextWindow: e.contextWindow,
      systemPrompt: e.systemPrompt,
      reasoningMode: e.reasoningMode,
      reasoningEffort: e.reasoningEffort,
      mcpServers: e.mcpServers,
      mcpTools: e.mcpTools,
      mcpToolBudget: e.mcpToolBudget,
      apiKey: encryptKey(cipher, e.apiKey),
    });
    const existing = this.load();
    const mergeRole = (existingRole: StoredEndpoint, inputRole: RoleEndpointInput): StoredEndpoint => ({
      baseUrl: (inputRole.baseUrl ?? '').trim(),
      model: (inputRole.model ?? '').trim(),
      contextWindow: normalizeContextWindow(inputRole.contextWindow),
      // Explicit field (including empty) replaces; omit keeps stored constitution.
      systemPrompt:
        inputRole.systemPrompt !== undefined
          ? normalizeSystemPrompt(inputRole.systemPrompt)
          : existingRole.systemPrompt,
      reasoningMode:
        inputRole.reasoningMode !== undefined
          ? normalizeReasoningMode(inputRole.reasoningMode)
          : existingRole.reasoningMode,
      reasoningEffort:
        inputRole.reasoningEffort !== undefined
          ? normalizeReasoningEffort(inputRole.reasoningEffort)
          : existingRole.reasoningEffort,
      mcpServers:
        inputRole.mcpServers !== undefined
          ? normalizeMcpServerAllowlist(inputRole.mcpServers)
          : existingRole.mcpServers,
      mcpTools:
        inputRole.mcpTools !== undefined
          ? normalizeMcpToolAllowlist(inputRole.mcpTools)
          : existingRole.mcpTools,
      mcpToolBudget:
        inputRole.mcpToolBudget !== undefined
          ? normalizeMcpToolBudget(inputRole.mcpToolBudget)
          : existingRole.mcpToolBudget,
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
    const toInput = (e: StoredEndpoint): RoleEndpointInput => ({
      baseUrl: e.baseUrl,
      model: e.model,
      contextWindow: e.contextWindow,
      systemPrompt: e.systemPrompt,
      reasoningMode: e.reasoningMode,
      reasoningEffort: e.reasoningEffort,
      mcpServers: [...e.mcpServers],
      mcpTools: [...e.mcpTools],
      mcpToolBudget: e.mcpToolBudget,
      apiKey: e.apiKey,
    });
    return {
      default: toInput(config.default),
      planner: toInput(config.planner),
      executor: toInput(config.executor),
      reviewer: toInput(config.reviewer),
      triage: toInput(config.triage),
    };
  }
}
