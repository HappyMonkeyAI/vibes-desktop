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

  it('keeps the stored key when save omits speechServerApiKey', () => {
    const store = new SettingsStore(dir, cipher);
    store.save({ speechServerApiKey: 'keep-me' });
    store.save({ speechServerModel: 'qwen3-asr-0.6b-q8-0' });
    expect(store.getSpeechServerApiKey()).toBe('keep-me');
    expect(store.get().speechServerModel).toBe('qwen3-asr-0.6b-q8-0');
  });
});

describe('SettingsStore key storage without an OS keyring', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-settings-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  // Mirrors safeStorage when no keyring is up: encrypt/decrypt throw.
  const unavailable: Cipher = {
    isAvailable: () => false,
    encrypt: () => { throw new Error('Encryption is not available.'); },
    decrypt: () => { throw new Error('Encryption is not available.'); },
  };

  it('still saves every field and falls back to a plaintext key', () => {
    const store = new SettingsStore(dir, unavailable);
    expect(store.save({ speechEngine: 'server', speechServerUrl: 'http://127.0.0.1:9000/v1/audio/transcriptions', speechServerApiKey: 'tok' })).toBe(true);
    const view = store.get();
    expect(view.speechEngine).toBe('server');
    expect(view.speechServerUrl).toBe('http://127.0.0.1:9000/v1/audio/transcriptions');
    expect(view.speechServerHasKey).toBe(true);
    expect(store.getSpeechServerApiKey()).toBe('tok');
  });

  it('reads an unprefixed ciphertext key written by the previous release', () => {
    writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ speechServerApiKeyEnc: cipher.encrypt('legacy') }));
    expect(new SettingsStore(dir, cipher).getSpeechServerApiKey()).toBe('legacy');
  });
});

describe('SettingsStore.migrateSpeechEngine', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-settings-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('moves a pre-migration yapsnap file to builtin once', () => {
    writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ speechEngine: 'yapsnap', vibesPath: 'C:/vibes' }));
    const store = new SettingsStore(dir, cipher);
    store.migrateSpeechEngine();
    expect(store.get().speechEngine).toBe('builtin');
    expect(store.get().vibesPath).toBe('C:/vibes');
  });

  it('keeps a yapsnap choice made after the migration across launches', () => {
    writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ speechEngine: 'yapsnap' }));
    new SettingsStore(dir, cipher).migrateSpeechEngine();
    new SettingsStore(dir, cipher).save({ speechEngine: 'yapsnap' });
    // Next launch.
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
