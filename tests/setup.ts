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
    search: vi.fn().mockResolvedValue(emptySnapshot),
    archive: vi.fn().mockResolvedValue({ ok: true, count: 0 }),
  },
  roles: {
    get: vi.fn().mockResolvedValue({}),
    save: vi.fn().mockResolvedValue({ ok: true }),
    testConnection: vi.fn().mockResolvedValue({ ok: false, error: 'stub' }),
  },
  voice: {
    doctor: vi.fn().mockResolvedValue({ ffmpegAvailable: false, yapsnapAvailable: false, ready: false, ffmpegHint: 'install ffmpeg', yapsnapHint: 'install yapsnap' }),
    transcribe: vi.fn().mockResolvedValue({ ok: true, text: 'stub transcription' }),
    warm: vi.fn().mockResolvedValue({ ok: true, detail: 'stub warm' }),
    testServer: vi.fn().mockResolvedValue({ ok: true }),
  },
  mission: {
    start: vi.fn().mockResolvedValue({ started: false, alreadyRunning: false }),
    stop: vi.fn().mockResolvedValue({ stopped: false }),
    plan: vi.fn().mockResolvedValue({ tasks: [] as string[] }),
    cancelPlan: vi.fn().mockResolvedValue({ ok: true }),
  },
  workspace: {
    select: vi.fn().mockResolvedValue({ path: null }),
    history: {
      save: vi.fn().mockResolvedValue({ ok: true }),
      get: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue({ ok: true }),
    },
  },
  settings: {
    get: vi.fn().mockResolvedValue({
      vibesPath: '',
      contextPath: '',
      memoryPath: '',
      autoSave: true,
      verboseLogging: false,
      speechEngine: 'builtin',
      speechModel: 'onnx-community/whisper-tiny.en',
      speechPrecision: 'q8',
      speechLang: 'auto',
      speechServerUrl: 'http://127.0.0.1:8765/v1/audio/transcriptions',
      speechServerModel: 'qwen3-asr-0.6b-q8-0',
      speechServerHasKey: false,
    }),
    save: vi.fn().mockResolvedValue({ ok: true }),
  },
};
