import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
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

describe('SettingsStore decision MCP fields', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'vibes-settings-decision-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('defaults with decision model off', () => {
    const store = new SettingsStore(dir, cipher);
    const s = store.get();
    // Env may populate on this machine — treat empty-file store without env as off when unset.
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
    // Token may still be on disk; resolveDecisionMcpConfig requires both.
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

    expect(store.save({
      maxSteps: 50,
      maxConcurrentTasks: 3,
      yoloMode: false,
      thinkingMode: false,
      contextCompactionEnabled: false,
      smallModelProfile: true,
    })).toBe(true);
    const view = store.get();
    expect(view.maxSteps).toBe(50);
    expect(view.maxConcurrentTasks).toBe(3);
    expect(view.yoloMode).toBe(false);
    expect(view.thinkingMode).toBe(false);
    expect(view.contextCompactionEnabled).toBe(false);
    expect(view.smallModelProfile).toBe(true);
  });
});
