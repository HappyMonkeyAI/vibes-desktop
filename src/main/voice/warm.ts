import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { VoiceWarmResult } from '@shared/channels';
import { transcribeFile, type CliRunner, spawnYapsnap } from './transcribe';

/**
 * Pre-fetch / warm the local yapsnap model cache by transcribing a tiny silent
 * WAV. First run may download ~80MB; later runs should be fast.
 */

/** Minimal 16-bit mono 16 kHz WAV (~0.1 s of silence). */
function writeSilentWav(filePath: string): void {
  const sampleRate = 16_000;
  const samples = Math.floor(sampleRate * 0.1);
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  writeFileSync(filePath, buffer);
}

export async function warmYapsnapModels(
  lang = 'auto',
  runner: CliRunner = spawnYapsnap,
): Promise<VoiceWarmResult> {
  const dir = mkdtempSync(path.join(tmpdir(), 'vibes-voice-warm-'));
  const wav = path.join(dir, 'silence.wav');
  const out = path.join(dir, 'out.txt');
  try {
    writeSilentWav(wav);
    const result = await transcribeFile(wav, out, runner, lang);
    // Empty transcript on silence is still a successful warm (models loaded).
    if (result.ok || /no text|silent/i.test(result.error ?? '')) {
      return { ok: true, detail: 'Local yapsnap model cache is ready (or was already present).' };
    }
    return { ok: false, error: result.error ?? 'Warm failed.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
}
