/** Curated Whisper ONNX models for the builtin engine (ported from ZeroG Terminal). */

export type SpeechPrecision = 'q4' | 'q8' | 'fp16' | 'fp32';

export type SpeechModel = {
  id: string;
  label: string;
  family: 'tiny' | 'base' | 'small';
  multilingual: boolean;
  downloadMb: Record<SpeechPrecision, number>;
};

const TINY_SIZES: Record<SpeechPrecision, number> = { q4: 96, q8: 41, fp16: 76, fp32: 152 };
const BASE_SIZES: Record<SpeechPrecision, number> = { q4: 142, q8: 77, fp16: 146, fp32: 291 };
const SMALL_SIZES: Record<SpeechPrecision, number> = { q4: 299, q8: 249, fp16: 485, fp32: 968 };

export const SPEECH_MODELS: SpeechModel[] = [
  { id: 'onnx-community/whisper-tiny.en', label: 'Whisper tiny · English', family: 'tiny', multilingual: false, downloadMb: TINY_SIZES },
  { id: 'onnx-community/whisper-base.en', label: 'Whisper base · English', family: 'base', multilingual: false, downloadMb: BASE_SIZES },
  { id: 'onnx-community/whisper-small.en', label: 'Whisper small · English', family: 'small', multilingual: false, downloadMb: SMALL_SIZES },
  { id: 'onnx-community/whisper-tiny', label: 'Whisper tiny · multilingual', family: 'tiny', multilingual: true, downloadMb: TINY_SIZES },
  { id: 'onnx-community/whisper-base', label: 'Whisper base · multilingual', family: 'base', multilingual: true, downloadMb: BASE_SIZES },
  { id: 'onnx-community/whisper-small', label: 'Whisper small · multilingual', family: 'small', multilingual: true, downloadMb: SMALL_SIZES },
];

export const DEFAULT_SPEECH_MODEL = 'onnx-community/whisper-tiny.en';
export const DEFAULT_SPEECH_PRECISION: SpeechPrecision = 'q8';

export function findSpeechModel(id: string): SpeechModel | undefined {
  return SPEECH_MODELS.find((model) => model.id === id);
}

export function supportsLanguageSelection(id: string): boolean {
  return findSpeechModel(id)?.multilingual ?? false;
}

export function describeDownload(id: string, precision: SpeechPrecision): string {
  const size = findSpeechModel(id)?.downloadMb[precision];
  return size == null ? 'Download size unknown' : `≈${size} MB download, cached after first use`;
}
