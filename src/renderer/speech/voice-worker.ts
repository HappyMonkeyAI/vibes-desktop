/// <reference lib="webworker" />
/**
 * Whisper transcription worker — model downloads from Hugging Face on first use
 * and is cached afterwards (same approach as ZeroG Terminal).
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import ortWasmUrl from 'ort-dist/ort-wasm-simd-threaded.asyncify.wasm?url';
import ortFactoryUrl from 'ort-dist/ort-wasm-simd-threaded.asyncify.mjs?url';

env.allowLocalModels = false;
// Transformers.js defaults the onnxruntime WASM runtime to cdn.jsdelivr.net,
// i.e. executable code fetched from a third party at runtime. Point it at the
// copies bundled with the app (same build transformers picks by default).
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = {
    wasm: new URL(ortWasmUrl, self.location.href).href,
    mjs: new URL(ortFactoryUrl, self.location.href).href,
  };
}

export type WorkerConfig = {
  model: string;
  precision: string;
  device: 'wasm' | 'webgpu';
  language: string;
  task: 'transcribe' | 'translate';
  multilingual: boolean;
};

type WorkerRequest = { type: 'transcribe'; id: number; audio: Float32Array; config: WorkerConfig };
type WorkerResponse =
  | { type: 'loading'; id: number; progress: number | null }
  | { type: 'notice'; id: number; message: string }
  | { type: 'result'; id: number; text: string; elapsedMs: number }
  | { type: 'error'; id: number; message: string };

const scope = self as unknown as DedicatedWorkerGlobalScope;

type LoadedPipeline = {
  key: string;
  pipeline: AutomaticSpeechRecognitionPipeline;
};

let loaded: LoadedPipeline | null = null;
let loading: Promise<LoadedPipeline> | null = null;
/** Bumped when a new load starts so a stale in-flight build cannot overwrite `loaded`. */
let loadGeneration = 0;

function configKey(config: WorkerConfig): string {
  return `${config.model}|${config.precision}|${config.device}`;
}

async function build(config: WorkerConfig, device: WorkerConfig['device'], id: number): Promise<LoadedPipeline> {
  const created = await pipeline('automatic-speech-recognition', config.model, {
    device,
    dtype: config.precision as 'q8',
    session_options: { graphOptimizationLevel: 'basic' },
    progress_callback: (info: { status: string; progress?: number }) => {
      if (info.status === 'progress') {
        scope.postMessage({ type: 'loading', id, progress: info.progress ?? null } satisfies WorkerResponse);
      }
    },
  });
  return { key: configKey(config), pipeline: created };
}

async function loadPipeline(config: WorkerConfig, id: number): Promise<LoadedPipeline> {
  const key = configKey(config);
  if (loaded && loaded.key === key) return loaded;
  if (loading) {
    try {
      const pending = await loading;
      if (pending.key === key) return pending;
    } catch {
      // That load failed. It was for this config (retry below) or another one
      // (irrelevant) — either way its error belongs to its own request, not this one.
    }
  }
  if (loaded) {
    try {
      await loaded.pipeline.dispose();
    } catch {
      // ignore
    }
    loaded = null;
  }

  const generation = ++loadGeneration;
  loading = build(config, config.device, id)
    .catch(async (error) => {
      if (config.device !== 'webgpu') throw error;
      scope.postMessage({
        type: 'notice',
        id,
        message: `WebGPU unavailable (${error instanceof Error ? error.message : String(error)}); using WASM`,
      } satisfies WorkerResponse);
      return build(config, 'wasm', id);
    })
    .then((result) => {
      if (generation === loadGeneration) {
        loaded = result;
        loading = null;
      } else {
        // Superseded — dispose the orphaned pipeline we just built.
        void result.pipeline.dispose().catch(() => undefined);
      }
      return result;
    })
    .catch((error) => {
      if (generation === loadGeneration) loading = null;
      throw error;
    });

  return loading;
}

async function handleTranscribe(data: WorkerRequest): Promise<void> {
  const started = Date.now();
  try {
    const active = await loadPipeline(data.config, data.id);
    const options = data.config.multilingual
      ? {
          task: data.config.task,
          ...(data.config.language && data.config.language !== 'auto' ? { language: data.config.language } : {}),
        }
      : {};
    const output = await active.pipeline(data.audio, options);
    const text = typeof output === 'object' && output && 'text' in output ? String((output as { text: string }).text).trim() : '';
    scope.postMessage({ type: 'result', id: data.id, text, elapsedMs: Date.now() - started } satisfies WorkerResponse);
  } catch (error) {
    scope.postMessage({
      type: 'error',
      id: data.id,
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  }
}

scope.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const data = event.data;
  if (!data || data.type !== 'transcribe' || !(data.audio instanceof Float32Array)) return;
  void handleTranscribe(data);
};
