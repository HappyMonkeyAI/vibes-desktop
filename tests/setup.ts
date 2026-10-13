import { vi } from 'vitest';

// Renderer-side fake of the preload bridge (typed surface in src/preload/index.d.ts).
// Tests that need specific snapshots override per-test.
const emptySnapshot = {
  entries: [],
  groupCounts: { 'needs-you': 0, running: 0, upcoming: 0, recent: 0 },
};

window.vibesDesktop = {
  ledger: {
    get: vi.fn().mockResolvedValue(emptySnapshot),
    onNewEntry: vi.fn(() => () => undefined),
  },
  roles: {
    get: vi.fn().mockResolvedValue({}),
    save: vi.fn().mockResolvedValue({ ok: true }),
    testConnection: vi.fn().mockResolvedValue({ ok: false, error: 'stub' }),
  },
  mission: {
    start: vi.fn().mockResolvedValue({ started: false, alreadyRunning: false }),
    stop: vi.fn().mockResolvedValue({ stopped: false }),
  },
};
