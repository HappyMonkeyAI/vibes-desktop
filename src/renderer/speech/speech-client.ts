import { supportsLanguageSelection } from './speech-models';

export type SpeechProgress =
  | { kind: 'loading'; progress: number | null }
  | { kind: 'notice'; message: string };

export type BuiltinSpeechSettings = {
  model: string;
  precision: string;
  language: string;
  device?: 'wasm' | 'webgpu';
};

type WorkerResult = { text: string; elapsedMs: number };

type Pending = {
  resolve(result: WorkerResult): void;
  reject(error: Error): void;
  onProgress?: (progress: SpeechProgress) => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Renderer-side client for the Whisper worker. Lazy-loads Transformers.js only
 * when the builtin engine is used.
 */
export class SpeechClient {
  private worker: Worker | null = null;
  private pending = new Map<number, Pending>();
  private nextId = 1;

  async transcribe(
    audio: Float32Array,
    settings: BuiltinSpeechSettings,
    onProgress?: (progress: SpeechProgress) => void,
  ): Promise<WorkerResult> {
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise<WorkerResult>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      worker.postMessage(
        {
          type: 'transcribe',
          id,
          audio,
          config: {
            model: settings.model,
            precision: settings.precision,
            device: settings.device ?? 'wasm',
            language: settings.language,
            task: 'transcribe' as const,
            multilingual: supportsLanguageSelection(settings.model),
          },
        },
        [audio.buffer],
      );
    });
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./voice-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<unknown>) => this.handleMessage(event.data);
    worker.onerror = (event) => {
      this.failAll(new Error(event.message || 'Speech worker failed'));
      this.worker = null;
    };
    this.worker = worker;
    return worker;
  }

  private handleMessage(data: unknown): void {
    if (!isRecord(data) || typeof data.id !== 'number') return;
    const pending = this.pending.get(data.id);
    if (!pending) return;

    if (data.type === 'loading') {
      pending.onProgress?.({ kind: 'loading', progress: typeof data.progress === 'number' ? data.progress : null });
      return;
    }
    if (data.type === 'notice') {
      pending.onProgress?.({ kind: 'notice', message: String(data.message) });
      return;
    }
    if (data.type === 'result') {
      this.pending.delete(data.id);
      pending.resolve({
        text: typeof data.text === 'string' ? data.text : '',
        elapsedMs: typeof data.elapsedMs === 'number' ? data.elapsedMs : 0,
      });
      return;
    }
    if (data.type === 'error') {
      this.pending.delete(data.id);
      pending.reject(new Error(typeof data.message === 'string' ? data.message : 'Transcription failed'));
    }
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  dispose(): void {
    this.failAll(new Error('Speech client disposed'));
    this.worker?.terminate();
    this.worker = null;
  }
}

let sharedClient: SpeechClient | null = null;

export function getSpeechClient(): SpeechClient {
  if (!sharedClient) sharedClient = new SpeechClient();
  return sharedClient;
}
