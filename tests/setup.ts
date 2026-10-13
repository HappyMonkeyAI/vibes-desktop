import { vi } from 'vitest';
// React 19 + Arco shim — must load before any test imports an Arco component, so
// static Message/Modal APIs use createRoot instead of the removed ReactDOM.render.
import '../src/renderer/arco-react19';

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
  voice: {
    doctor: vi.fn().mockResolvedValue({ ffmpegAvailable: false, yapsnapAvailable: false, ready: false, ffmpegHint: 'install ffmpeg', yapsnapHint: 'install yapsnap' }),
    transcribe: vi.fn().mockResolvedValue({ ok: true, text: 'stub transcription' }),
  },
  mission: {
    start: vi.fn().mockResolvedValue({ started: false, alreadyRunning: false }),
    stop: vi.fn().mockResolvedValue({ stopped: false }),
  },
};
