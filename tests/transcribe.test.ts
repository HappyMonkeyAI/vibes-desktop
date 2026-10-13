import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { transcribeFile, type CliRunner } from '../src/main/voice/transcribe';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'vibes-voice-test-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const input = () => path.join(dir, 'cap.webm');
const output = () => path.join(dir, 'cap.txt');

describe('transcribeFile (T11)', () => {
  it('reads the transcript from yapsnap\'s output file and cleans up both files', async () => {
    const runner: CliRunner = async (args) => {
      // Mimic yapsnap: write the transcript to the -o path, print it on stdout.
      const outIdx = args.indexOf('-o');
      writeFileSync(args[outIdx + 1], 'hello world\n', 'utf-8');
      return { code: 0, stdout: args[outIdx + 1] + '\n', stderr: '' };
    };
    const res = await transcribeFile(input(), output(), runner);
    expect(res).toEqual({ ok: true, text: 'hello world' });
    // Both the input audio and the transcript are removed after transcription.
    expect(existsSync(input())).toBe(false);
    expect(existsSync(output())).toBe(false);
  });

  it('passes --lang auto and the file path to the CLI', async () => {
    let seen: string[] = [];
    const runner: CliRunner = async (args) => {
      seen = args;
      writeFileSync(args[args.indexOf('-o') + 1], 'x\n', 'utf-8');
      return { code: 0, stdout: '', stderr: '' };
    };
    await transcribeFile(input(), output(), runner);
    expect(seen).toEqual([input(), '-o', output(), '--lang', 'auto']);
  });

  it('reports an actionable error when the CLI exits non-zero', async () => {
    const runner: CliRunner = async () => ({ code: 1, stdout: '', stderr: 'line1\nmodel error: no such model' });
    const res = await transcribeFile(input(), output(), runner);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('Transcription failed');
    expect(res.error).toContain('no such model');
  });

  it('reports a failure when the output file is missing after a zero exit', async () => {
    const runner: CliRunner = async () => ({ code: 0, stdout: '', stderr: '' }); // no file written
    const res = await transcribeFile(input(), output(), runner);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('could not be read');
  });

  it('reports empty transcription as a distinct error', async () => {
    const runner: CliRunner = async (args) => {
      writeFileSync(args[args.indexOf('-o') + 1], '', 'utf-8');
      return { code: 0, stdout: '', stderr: '' };
    };
    const res = await transcribeFile(input(), output(), runner);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('no text');
  });

  it('never throws when the runner itself rejects', async () => {
    const runner: CliRunner = async () => {
      throw new Error('spawn ENOENT');
    };
    const res = await transcribeFile(input(), output(), runner);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('ENOENT');
  });
});
