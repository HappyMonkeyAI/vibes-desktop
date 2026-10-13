import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RolesStore, type Cipher } from '../src/main/roles/store';

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
      expect(view[role]).toEqual({ baseUrl: '', model: '', hasKey: false });
    }
  });

  it('persists endpoints and reports key presence without leaking the decrypted key', () => {
    const store = new RolesStore(dir, fakeCipher);
    store.save({
      default: { baseUrl: 'http://a/v1', model: 'm-a', apiKey: 'secret-a' },
      planner: { baseUrl: '', model: '', apiKey: '' },
      executor: { baseUrl: '', model: '', apiKey: '' },
      reviewer: { baseUrl: '', model: '', apiKey: '' },
      triage: { baseUrl: '', model: '', apiKey: '' },
    });
    const view = store.view();
    expect(view.default).toEqual({ baseUrl: 'http://a/v1', model: 'm-a', hasKey: true });
    // The on-disk file must NOT contain the plaintext key.
    const raw = readFileSync(path.join(dir, 'roles-config.json'), 'utf-8');
    expect(raw).not.toContain('secret-a');
    expect(raw).toContain('enc:');
  });

  it('round-trips a decrypted key via getKey', () => {
    const store = new RolesStore(dir, fakeCipher);
    expect(store.getKey('default')).toBe('secret-a');
  });

  it('an empty submitted apiKey keeps the stored one', () => {
    const store = new RolesStore(dir, fakeCipher);
    // Change only the model; leave apiKey blank → keep 'secret-a'.
    store.save({
      default: { baseUrl: 'http://a/v1', model: 'm-b', apiKey: '' },
      planner: { baseUrl: '', model: '', apiKey: '' },
      executor: { baseUrl: '', model: '', apiKey: '' },
      reviewer: { baseUrl: '', model: '', apiKey: '' },
      triage: { baseUrl: '', model: '', apiKey: '' },
    });
    expect(store.view().default).toEqual({ baseUrl: 'http://a/v1', model: 'm-b', hasKey: true });
    expect(store.getKey('default')).toBe('secret-a');
  });

  it('tolerates a corrupt file by returning the empty config', () => {
    const corruptDir = path.join(dir, 'corrupt');
    mkdirSync(corruptDir, { recursive: true });
    writeFileSync(path.join(corruptDir, 'roles-config.json'), '{ not json', 'utf-8');
    const store = new RolesStore(corruptDir, fakeCipher);
    expect(store.view().default).toEqual({ baseUrl: '', model: '', hasKey: false });
  });
});
