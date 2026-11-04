import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RolesStore, normalizeContextWindow, type Cipher } from '../src/main/roles/store';

/** A reversible fake cipher so tests exercise the encrypt/decrypt round-trip without Electron. */
const fakeCipher: Cipher = {
  isAvailable: () => true,
  encrypt: (plain) => Buffer.from(plain).toString('base64'),
  decrypt: (encoded) => Buffer.from(encoded, 'base64').toString('utf-8'),
};

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'vibes-roles-'));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('RolesStore (T7)', () => {
  it('returns the empty view when no file exists', () => {
    const store = new RolesStore(path.join(dir, 'fresh'), fakeCipher);
    const view = store.view();
    for (const role of ['default', 'planner', 'executor', 'reviewer', 'triage'] as const) {
      expect(view[role]).toEqual({
        baseUrl: '',
        model: '',
        contextWindow: '',
        systemPrompt: '',
        reasoningMode: 'inherit',
        reasoningEffort: 'inherit',
        mcpServers: [],
        mcpTools: [],
        mcpToolBudget: '',
        hasKey: false,
      });
    }
  });

  it('persists endpoints and reports key presence without leaking the decrypted key', () => {
    const store = new RolesStore(dir, fakeCipher);
    store.save({
      default: {
        baseUrl: 'http://a/v1',
        model: 'm-a',
        contextWindow: '8192',
        systemPrompt: 'You are default.',
        apiKey: 'secret-a',
      },
      planner: { baseUrl: '', model: '', apiKey: '' },
      executor: { baseUrl: '', model: '', apiKey: '' },
      reviewer: { baseUrl: '', model: '', apiKey: '' },
      triage: { baseUrl: '', model: '', apiKey: '' },
    });
    const view = store.view();
    expect(view.default).toEqual({
      baseUrl: 'http://a/v1',
      model: 'm-a',
      contextWindow: '8192',
      systemPrompt: 'You are default.',
      reasoningMode: 'inherit',
      reasoningEffort: 'inherit',
      mcpServers: [],
      mcpTools: [],
      mcpToolBudget: '',
      hasKey: true,
    });
    // The on-disk file must NOT contain the plaintext key.
    const raw = readFileSync(path.join(dir, 'roles-config.json'), 'utf-8');
    expect(raw).not.toContain('secret-a');
    expect(raw).toContain('enc:');
    expect(raw).toContain('"contextWindow": "8192"');
    expect(raw).toContain('You are default.');
  });

  it('round-trips a decrypted key via getKey', () => {
    const store = new RolesStore(dir, fakeCipher);
    expect(store.getKey('default')).toBe('secret-a');
  });

  it('an empty submitted apiKey keeps the stored one', () => {
    const store = new RolesStore(dir, fakeCipher);
    // Change only the model; leave apiKey blank → keep 'secret-a'.
    store.save({
      default: { baseUrl: 'http://a/v1', model: 'm-b', contextWindow: '16384', apiKey: '' },
      planner: { baseUrl: '', model: '', apiKey: '' },
      executor: { baseUrl: '', model: '', apiKey: '' },
      reviewer: { baseUrl: '', model: '', apiKey: '' },
      triage: { baseUrl: '', model: '', apiKey: '' },
    });
    expect(store.view().default).toEqual({
      baseUrl: 'http://a/v1',
      model: 'm-b',
      contextWindow: '16384',
      systemPrompt: 'You are default.',
      reasoningMode: 'inherit',
      reasoningEffort: 'inherit',
      mcpServers: [],
      mcpTools: [],
      mcpToolBudget: '',
      hasKey: true,
    });
    expect(store.getKey('default')).toBe('secret-a');
  });

  it('tolerates a corrupt file by returning the empty config', () => {
    const corruptDir = path.join(dir, 'corrupt');
    mkdirSync(corruptDir, { recursive: true });
    writeFileSync(path.join(corruptDir, 'roles-config.json'), '{ not json', 'utf-8');
    const store = new RolesStore(corruptDir, fakeCipher);
    expect(store.view().default).toEqual({
      baseUrl: '',
      model: '',
      contextWindow: '',
      systemPrompt: '',
      reasoningMode: 'inherit',
      reasoningEffort: 'inherit',
      mcpServers: [],
      mcpTools: [],
      mcpToolBudget: '',
      hasKey: false,
    });
  });

  it('round-trips MCP policy fields', () => {
    const store = new RolesStore(path.join(dir, 'mcp-policy'), fakeCipher);
    store.save({
      default: {
        baseUrl: '',
        model: '',
        mcpServers: ['html-design-advisor'],
        mcpTools: ['read_file'],
        mcpToolBudget: '10',
        apiKey: '',
      },
      planner: { baseUrl: '', model: '', apiKey: '' },
      executor: { baseUrl: '', model: '', apiKey: '' },
      reviewer: { baseUrl: '', model: '', apiKey: '' },
      triage: { baseUrl: '', model: '', apiKey: '' },
    });
    expect(store.view().default.mcpServers).toEqual(['html-design-advisor']);
    expect(store.view().default.mcpTools).toEqual(['read_file']);
    expect(store.view().default.mcpToolBudget).toBe('10');
  });

  it('round-trips reasoning mode and effort', () => {
    const store = new RolesStore(path.join(dir, 'reasoning'), fakeCipher);
    store.save({
      default: {
        baseUrl: '',
        model: '',
        reasoningMode: 'on',
        reasoningEffort: 'xhigh',
        apiKey: '',
      },
      planner: {
        baseUrl: '',
        model: '',
        reasoningMode: 'off',
        reasoningEffort: 'spoon',
        apiKey: '',
      },
      executor: { baseUrl: '', model: '', apiKey: '' },
      reviewer: { baseUrl: '', model: '', apiKey: '' },
      triage: { baseUrl: '', model: '', apiKey: '' },
    });
    expect(store.view().default.reasoningMode).toBe('on');
    expect(store.view().default.reasoningEffort).toBe('xhigh');
    expect(store.view().planner.reasoningMode).toBe('off');
    expect(store.view().planner.reasoningEffort).toBe('spoon');
    expect(store.view().executor.reasoningMode).toBe('inherit');
  });

  it('round-trips systemPrompt and clears when empty string submitted', () => {
    const store = new RolesStore(path.join(dir, 'prompt'), fakeCipher);
    store.save({
      default: { baseUrl: '', model: '', systemPrompt: 'Stay on rails.', apiKey: '' },
      planner: { baseUrl: '', model: '', systemPrompt: 'Plan tightly.', apiKey: '' },
      executor: { baseUrl: '', model: '', apiKey: '' },
      reviewer: { baseUrl: '', model: '', apiKey: '' },
      triage: { baseUrl: '', model: '', apiKey: '' },
    });
    expect(store.view().default.systemPrompt).toBe('Stay on rails.');
    expect(store.input().planner.systemPrompt).toBe('Plan tightly.');
    store.save({
      default: { baseUrl: '', model: '', systemPrompt: '', apiKey: '' },
      planner: { baseUrl: '', model: '', systemPrompt: 'Plan tightly.', apiKey: '' },
      executor: { baseUrl: '', model: '', apiKey: '' },
      reviewer: { baseUrl: '', model: '', apiKey: '' },
      triage: { baseUrl: '', model: '', apiKey: '' },
    });
    expect(store.view().default.systemPrompt).toBe('');
    expect(store.view().planner.systemPrompt).toBe('Plan tightly.');
  });

  it('normalizes contextWindow on save and ignores junk', () => {
    const store = new RolesStore(path.join(dir, 'ctx'), fakeCipher);
    store.save({
      default: { baseUrl: 'http://a/v1', model: 'm', contextWindow: '32_768', apiKey: '' },
      planner: { baseUrl: '', model: '', contextWindow: 'nope', apiKey: '' },
      executor: { baseUrl: '', model: '', apiKey: '' },
      reviewer: { baseUrl: '', model: '', apiKey: '' },
      triage: { baseUrl: '', model: '', apiKey: '' },
    });
    expect(store.view().default.contextWindow).toBe('32768');
    expect(store.view().planner.contextWindow).toBe('');
  });
});

describe('normalizeContextWindow', () => {
  it('accepts positive integers and light separators', () => {
    expect(normalizeContextWindow('8192')).toBe('8192');
    expect(normalizeContextWindow('32_768')).toBe('32768');
    expect(normalizeContextWindow('128,000')).toBe('128000');
    expect(normalizeContextWindow(4096)).toBe('4096');
  });

  it('rejects zero, negative, and non-numeric', () => {
    expect(normalizeContextWindow('0')).toBe('');
    expect(normalizeContextWindow('-1')).toBe('');
    expect(normalizeContextWindow('abc')).toBe('');
    expect(normalizeContextWindow('')).toBe('');
  });
});
