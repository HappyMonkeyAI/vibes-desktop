import { readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { VoiceTranscribeResult } from '@shared/channels';

/**
 * T11 — yapsnap transcriber. Writes the captured audio to a temp file, runs
 * `yapsnap <file> -o <out.txt> --lang auto` as a child process, and reads the
 * transcript back from the output file (yapsnap prints the path on stdout; all
 * progress/errors go to stderr). Both temp files are deleted afterwards. The CLI
 * invocation is injectable so tests can drive it without spawning real yapsnap.
 */

const TRANSCRIBE_TIMEOUT_MS = 120_000; // a long recording can take a while on CPU

export interface CliRunner {
  (args: string[]): Promise<{ code: number; stdout: string; stderr: string }>;
}

/** Default runner: spawn the yapsnap CLI and capture stdout/stderr. */
export const spawnYapsnap: CliRunner = (args) =>
  new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (code: number): void => {
      if (!settled) {
        settled = true;
        resolve({ code, stdout, stderr });
      }
    };
    let child;
    try {
      child = spawn('yapsnap', args, { windowsHide: true });
    } catch (error) {
      finish(1);
      stderr += error instanceof Error ? error.message : String(error);
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // already gone
      }
      stderr += '\nerror: transcription timed out.';
      finish(124);
    }, TRANSCRIBE_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      stderr += error.message.includes('ENOENT') ? '\nerror: yapsnap not found on PATH.' : `\nerror: ${error.message}`;
      finish(1);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish(code ?? 1);
    });
  });

/**
 * Transcribe a file to text via yapsnap. The output path is where yapsnap writes
 * its transcript; on success it is read and returned, then both input and output
 * are deleted (SPEC S5: the wav is removed after transcription). Returns an
 * actionable error on any failure — never throws.
 */
export async function transcribeFile(
  inputPath: string,
  outPath: string,
  runner: CliRunner = spawnYapsnap,
  lang = 'auto',
): Promise<VoiceTranscribeResult> {
  const language = lang.trim() || 'auto';
  const args = [inputPath, '-o', outPath, '--lang', language];
  let result;
  try {
    result = await runner(args);
  } catch (error) {
    cleanup(inputPath, outPath);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (result.code !== 0) {
    cleanup(inputPath, outPath);
    const detail = result.stderr.trim().split('\n').slice(-3).join(' ').trim();
    return { ok: false, error: `Transcription failed${detail ? ` — ${detail}` : ''}.` };
  }
  let text = '';
  try {
    text = readFileSync(outPath, 'utf-8').trim();
  } catch (error) {
    cleanup(inputPath, outPath);
    return { ok: false, error: `Transcription finished but the output could not be read (${error instanceof Error ? error.message : String(error)}).` };
  }
  cleanup(inputPath, outPath);
  if (!text) return { ok: false, error: 'Transcription produced no text (silent or too-short audio).' };
  return { ok: true, text };
}

function cleanup(...paths: string[]): void {
  for (const p of paths) {
    try {
      rmSync(p, { force: true });
    } catch {
      // best-effort; a leftover temp file is not fatal
    }
  }
}

/** The temp dir a capture should land in — the OS temp, never the app cwd. */
export function voiceTempDir(): string {
  const base = process.env['TEMP'] ?? process.env['TMPDIR'] ?? tmpdir();
  return path.join(base, 'vibes-voice');
}
