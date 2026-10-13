import { safeStorage } from 'electron';
import type { Cipher } from './store';

/**
 * The real cipher for production: Electron's safeStorage, which uses the OS
 * credential store (DPAPI on Windows, Keychain on macOS, libsecret on Linux).
 * A key never sits on disk readable. Falls back to plaintext when no store is
 * available (e.g. a headless CI run) — the same graceful degradation as the fork.
 */
export function makeSafeCipher(): Cipher {
  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (plain) => safeStorage.encryptString(plain).toString('base64'),
    decrypt: (encoded) => safeStorage.decryptString(Buffer.from(encoded, 'base64')),
  };
}
