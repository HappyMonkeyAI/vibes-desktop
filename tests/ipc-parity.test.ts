import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: {
    invoke: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

import { channels } from '@shared/channels';
import { createHandlerTable } from '../src/main/ipc/handlers';
import { contextBridge, ipcRenderer } from 'electron';

const allChannelValues = new Set<string>(Object.values(channels));

describe('IPC channel parity (V1 gate)', () => {
  it('handler table covers every declared channel exactly', () => {
    const table = createHandlerTable();
    // The table is keyed by channel VALUES (e.g. 'ledger:get'), so parity means
    // the key set equals the declared value set, and every entry is a handler.
    expect(new Set(Object.keys(table))).toEqual(allChannelValues);
    for (const handler of Object.values(table)) {
      expect(typeof handler).toBe('function');
    }
  });

  it('preload exposes every declared channel through invoke/on', async () => {
    const mod = await import('../src/preload/index');
    void mod; // module side effect: exposeInMainWorld
    const api = (contextBridge.exposeInMainWorld as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as any;

    const seen = new Set<string>();
    
    // Recursively collect all functions from the API object
    const collectFunctions = (obj: any) => {
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (typeof value === 'function') {
          try {
            const ret = value({});
            if (ret && typeof (ret as Promise<unknown>).then === 'function') {
              // For invoke calls, they'll be recorded in the mock.calls
            }
          } catch {
            // functions without args still record their channel via invoke/on
          }
        } else if (value && typeof value === 'object') {
          collectFunctions(value);
        }
      }
    };
    
    collectFunctions(api);

    for (const call of (ipcRenderer.invoke as unknown as ReturnType<typeof vi.fn>).mock.calls) {
      seen.add(call[0] as string);
    }
    for (const call of (ipcRenderer.on as unknown as ReturnType<typeof vi.fn>).mock.calls) {
      seen.add(call[0] as string);
    }

    expect(seen).toEqual(allChannelValues);
  });
});
