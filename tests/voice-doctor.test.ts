import { describe, expect, it, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';

// Mock spawn so the doctor never needs real ffmpeg/yapsnap on PATH. vi.mock is
// hoisted above imports, so the factory must not reference outer `const`s — use
// vi.hoisted to create the mock in a hoisted scope instead.
const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: spawnMock }));

import { runVoiceDoctor } from '../src/main/voice/doctor';

/** A fake child that emits `close` with a given code, or `error`. */
function fakeChild(opts: { code?: number; error?: string }): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess & { kill: () => void };
  (emitter as unknown as { kill: () => void }).kill = vi.fn();
  queueMicrotask(() => {
    if (opts.error) emitter.emit('error', new Error(opts.error));
    else emitter.emit('close', opts.code ?? 0);
  });
  return emitter;
}

afterEach(() => {
  spawnMock.mockReset();
});

describe('runVoiceDoctor (T12)', () => {
  it('reports ready when both ffmpeg and yapsnap exit 0', async () => {
    spawnMock.mockReturnValue(fakeChild({ code: 0 }));
    const res = await runVoiceDoctor();
    expect(res).toEqual({
      ffmpegAvailable: true,
      yapsnapAvailable: true,
      ready: true,
      ffmpegHint: null,
      yapsnapHint: null,
    });
  });

  it('gives an install hint for a missing ffmpeg', async () => {
    // First spawn (ffmpeg) errors; second (yapsnap) succeeds.
    spawnMock.mockReturnValueOnce(fakeChild({ error: 'ENOENT' })).mockReturnValueOnce(fakeChild({ code: 0 }));
    const res = await runVoiceDoctor();
    expect(res.ffmpegAvailable).toBe(false);
    expect(res.yapsnapAvailable).toBe(true);
    expect(res.ready).toBe(false);
    expect(res.ffmpegHint).toContain('winget install ffmpeg');
    expect(res.yapsnapHint).toBeNull();
  });

  it('gives an install hint for a missing yapsnap', async () => {
    spawnMock.mockReturnValueOnce(fakeChild({ code: 0 })).mockReturnValueOnce(fakeChild({ error: 'ENOENT' }));
    const res = await runVoiceDoctor();
    expect(res.ffmpegAvailable).toBe(true);
    expect(res.yapsnapAvailable).toBe(false);
    expect(res.ready).toBe(false);
    expect(res.ffmpegHint).toBeNull();
    expect(res.yapsnapHint).toContain('pip install yapsnap');
  });

  it('treats a non-zero exit as "not available"', async () => {
    spawnMock.mockReturnValue(fakeChild({ code: 1 }));
    const res = await runVoiceDoctor();
    expect(res.ready).toBe(false);
    expect(res.ffmpegAvailable).toBe(false);
  });
});
