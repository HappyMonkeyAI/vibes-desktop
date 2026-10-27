import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SettingsStore } from '../src/main/settings/store';
import type { Cipher } from '../src/main/roles/store';

const cipher: Cipher = {
  isAvailable: () => true,
  encrypt: (plain) => Buffer.from(plain, 'utf-8').toString('base64'),
  decrypt: (encoded) => Buffer.from(encoded, 'base64').toString('utf-8'),
};

describe('SettingsStore voice fields', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-settings-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('defaults to builtin Whisper with a qwen3-asr-shaped server URL', () => {
    const store = new SettingsStore(dir, cipher);
    const s = store.get();
    expect(s.speechEngine).toBe('builtin');
    expect(s.speechModel).toContain('whisper');
    expect(s.speechServerUrl).toContain('/v1/audio/transcriptions');
    expect(s.speechServerHasKey).toBe(false);
  });

  it('encrypts the speech server key and never returns it in get()', () => {
    const store = new SettingsStore(dir, cipher);
    expect(store.save({ speechEngine: 'server', speechServerApiKey: 'secret-token' })).toBe(true);
    const view = store.get();
    expect(view.speechEngine).toBe('server');
    expect(view.speechServerHasKey).toBe(true);
    expect(JSON.stringify(view)).not.toContain('secret-token');
    expect(store.getSpeechServerApiKey()).toBe('secret-token');
  });

  it('removes the stored key on clearSpeechServerApiKey and keeps other fields', () => {
    const store = new SettingsStore(dir, cipher);
    store.save({ speechServerApiKey: 'drop-me', speechServerModel: 'qwen3-asr-0.6b-q8-0' });
    expect(store.save({ clearSpeechServerApiKey: true })).toBe(true);
    expect(store.get().speechServerHasKey).toBe(false);
    expect(store.getSpeechServerApiKey()).toBeUndefined();
    expect(store.get().speechServerModel).toBe('qwen3-asr-0.6b-q8-0');
  });

  it('keeps the stored key when save omits speechServerApiKey', () => {
    const store = new SettingsStore(dir, cipher);
    store.save({ speechServerApiKey: 'keep-me' });
    store.save({ speechServerModel: 'qwen3-asr-0.6b-q8-0' });
    expect(store.getSpeechServerApiKey()).toBe('keep-me');
    expect(store.get().speechServerModel).toBe('qwen3-asr-0.6b-q8-0');
  });
});

describe('SettingsStore decision MCP fields', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-settings-decision-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('defaults with decision model off', () => {
    const store = new SettingsStore(dir, cipher);
    const s = store.get();
    if (!process.env['KEV_MCP_URL'] && !process.env['KEV_MCP_AUTH_TOKEN']) {
      expect(s.decisionMcpUrl).toBe('');
      expect(s.decisionMcpHasToken).toBe(false);
    }
  });

  it('encrypts the decision MCP token and never returns it in get()', () => {
    const store = new SettingsStore(dir, cipher);
    expect(store.save({
      decisionMcpUrl: 'http://192.168.5.157:8765/mcp',
      decisionMcpAuthToken: 'mcp-secret',
    })).toBe(true);
    const view = store.get();
    expect(view.decisionMcpUrl).toBe('http://192.168.5.157:8765/mcp');
    expect(view.decisionMcpHasToken).toBe(true);
    expect(JSON.stringify(view)).not.toContain('mcp-secret');
    expect(store.getDecisionMcpAuthToken()).toBe('mcp-secret');
  });

  it('clears usage when URL is emptied (token may remain stored)', () => {
    const store = new SettingsStore(dir, cipher);
    store.save({
      decisionMcpUrl: 'http://192.168.5.157:8765/mcp',
      decisionMcpAuthToken: 'mcp-secret',
    });
    store.save({ decisionMcpUrl: '' });
    const view = store.get();
    expect(view.decisionMcpUrl).toBe('');
    expect(store.getDecisionMcpAuthToken()).toBe('mcp-secret');
  });
});

describe('SettingsStore Runtime knobs', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-settings-runtime-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('persists Runtime knobs with vibes-shaped defaults', () => {
    const store = new SettingsStore(dir, cipher);
    const defaults = store.get();
    expect(defaults.maxSteps).toBe(25);
    expect(defaults.maxConcurrentTasks).toBe(1);
    expect(defaults.yoloMode).toBe(true);
    expect(defaults.thinkingMode).toBe(true);
    expect(defaults.contextCompactionEnabled).toBe(true);
    expect(defaults.smallModelProfile).toBe(false);
    expect(defaults.triageEnabled).toBe(false);
    expect(defaults.triageInterval).toBe(5);
    expect(defaults.triageAutoSteer).toBe(true);
    expect(defaults.memoryEnabled).toBe(true);
    expect(defaults.localMemory).toBe(false);

    expect(store.save({
      maxSteps: 50,
      maxConcurrentTasks: 3,
      yoloMode: false,
      thinkingMode: false,
      contextCompactionEnabled: false,
      smallModelProfile: true,
      triageEnabled: true,
      triageInterval: 2,
      triageAutoSteer: false,
      memoryEnabled: false,
      localMemory: true,
    })).toBe(true);
    const view = store.get();
    expect(view.maxSteps).toBe(50);
    expect(view.maxConcurrentTasks).toBe(3);
    expect(view.yoloMode).toBe(false);
    expect(view.thinkingMode).toBe(false);
    expect(view.contextCompactionEnabled).toBe(false);
    expect(view.smallModelProfile).toBe(true);
    expect(view.triageEnabled).toBe(true);
    expect(view.triageInterval).toBe(2);
    expect(view.triageAutoSteer).toBe(false);
    expect(view.memoryEnabled).toBe(false);
    expect(view.localMemory).toBe(true);
  });
});

describe('SettingsStore key storage without an OS keyring', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-settings-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const unavailable: Cipher = {
    isAvailable: () => false,
    encrypt: () => { throw new Error('Encryption is not available.'); },
    decrypt: () => { throw new Error('Encryption is not available.'); },
  };

  it('still saves every field and falls back to a plaintext key', () => {
    const store = new SettingsStore(dir, unavailable);
    expect(store.save({
      speechEngine: 'server',
      speechServerUrl: 'http://127.0.0.1:9000/v1/audio/transcriptions',
      speechServerApiKey: 'tok',
    })).toBe(true);
    const view = store.get();
    expect(view.speechEngine).toBe('server');
    expect(view.speechServerUrl).toBe('http://127.0.0.1:9000/v1/audio/transcriptions');
    expect(view.speechServerHasKey).toBe(true);
    expect(store.getSpeechServerApiKey()).toBe('tok');
  });

  it('reads an unprefixed ciphertext key written by the previous release', () => {
    writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({
      speechServerApiKeyEnc: cipher.encrypt('legacy'),
    }));
    expect(new SettingsStore(dir, cipher).getSpeechServerApiKey()).toBe('legacy');
  });
});

describe('SettingsStore.setupComplete', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-settings-setup-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('defaults false on a fresh file, true when vibesPath already set', () => {
    const fresh = new SettingsStore(dir, cipher);
    expect(fresh.get().setupComplete).toBe(false);
    writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ vibesPath: 'C:/vibes' }));
    expect(new SettingsStore(dir, cipher).get().setupComplete).toBe(true);
  });

  it('persists an explicit setupComplete flag', () => {
    const store = new SettingsStore(dir, cipher);
    expect(store.save({ setupComplete: true })).toBe(true);
    expect(store.get().setupComplete).toBe(true);
  });
});

describe('SettingsStore.migrateSpeechEngine', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-settings-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('moves a pre-migration yapsnap file to builtin once', () => {
    writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({
      speechEngine: 'yapsnap',
      vibesPath: 'C:/vibes',
    }));
    const store = new SettingsStore(dir, cipher);
    store.migrateSpeechEngine();
    expect(store.get().speechEngine).toBe('builtin');
    expect(store.get().vibesPath).toBe('C:/vibes');
  });

  it('keeps a yapsnap choice made after the migration across launches', () => {
    writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ speechEngine: 'yapsnap' }));
    new SettingsStore(dir, cipher).migrateSpeechEngine();
    new SettingsStore(dir, cipher).save({ speechEngine: 'yapsnap' });
    const relaunched = new SettingsStore(dir, cipher);
    relaunched.migrateSpeechEngine();
    expect(relaunched.get().speechEngine).toBe('yapsnap');
  });

  it('does nothing when no settings file exists', () => {
    const store = new SettingsStore(dir, cipher);
    store.migrateSpeechEngine();
    expect(existsSync(path.join(dir, 'settings.json'))).toBe(false);
  });
});
