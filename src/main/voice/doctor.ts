import { spawn } from 'node:child_process';
import type { VoiceDoctorResult } from '@shared/channels';

/**
 * T12 — yapsnap-doctor. Checks that ffmpeg and the yapsnap CLI are both on PATH
 * BEFORE any capture attempt, and returns actionable install hints for whatever
 * is missing. Runs `ffmpeg -version` / `yapsnap --help` with a bounded timeout so
 * a wedged binary can't hang the settings pane. Never throws: absence is a result,
 * not an error.
 */

const CHECK_TIMEOUT_MS = 5_000;

function commandExists(command: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok: boolean): void => {
      if (!settled) {
        settled = true;
        resolve(ok);
      }
    };
    let child;
    try {
      child = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    } catch {
      done(false);
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // already gone
      }
      done(false);
    }, CHECK_TIMEOUT_MS);
    child.on('error', () => {
      clearTimeout(timer);
      done(false);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      // `ffmpeg -version` exits 0; a missing binary surfaces as an 'error' event.
      done(code === 0);
    });
  });
}

export async function runVoiceDoctor(): Promise<VoiceDoctorResult> {
  const [ffmpegAvailable, yapsnapAvailable] = await Promise.all([
    commandExists('ffmpeg', ['-version']),
    commandExists('yapsnap', ['--help']),
  ]);
  return {
    ffmpegAvailable,
    yapsnapAvailable,
    ready: ffmpegAvailable && yapsnapAvailable,
    ffmpegHint: ffmpegAvailable ? null : 'Install ffmpeg (winget install ffmpeg on Windows) and restart the app.',
    yapsnapHint: yapsnapAvailable ? null : 'Install yapsnap (pip install yapsnap) and restart the app. The first transcription downloads ~80 MB of models.',
  };
}
