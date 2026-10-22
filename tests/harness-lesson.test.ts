import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { distillHarnessLesson } from '../src/shared/harnessLesson';
import { buildRetryRequest } from '../src/shared/missionRetry';
import { readHarnessLesson, writeHarnessLesson } from '../src/main/harness/lesson-store';

describe('distillHarnessLesson (T35)', () => {
  it('maps css_orphan fingerprints to stylesheet harness advice', () => {
    const lesson = distillHarnessLesson({
      failedTasks: [{ title: 'Style footer', detail: 'css_orphan: styles.css not imported' }],
    });
    expect(lesson).toMatch(/stylesheet|HTML <link>/i);
  });

  it('maps evidence/ghost failures to handoff advice', () => {
    const lesson = distillHarnessLesson({
      systemFailures: [{ title: 'Mission Scheduler', detail: 'done but not credited complete' }],
    });
    expect(lesson).toMatch(/evidence handoff/i);
  });

  it('returns null when there is only noise', () => {
    expect(
      distillHarnessLesson({
        missionDetail: 'Mission failed. Completed 0/1 tasks.',
        failedTasks: [{ title: 'X', detail: 'Left pending when the mission ended.' }],
      }),
    ).toBeNull();
  });
});

describe('harness lesson store + retry seed', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vibes-harness-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('persists and reloads the latest lesson', () => {
    const written = writeHarnessLesson(dir, 'Harness: verify links', 'Add header');
    expect(written?.lesson).toMatch(/verify links/);
    const read = readHarnessLesson(dir);
    expect(read?.lesson).toBe(written?.lesson);
    expect(fs.existsSync(path.join(dir, '.vibes', 'harness-lesson.json'))).toBe(true);
  });

  it('puts harness lesson first in the Retry seed', () => {
    const text = buildRetryRequest({
      title: 'Add header',
      harnessLesson: 'Harness: confirm <link> before CSS done',
      doneTaskTitles: ['HTML structure'],
      failedTasks: [{ title: 'CSS', detail: 'css_orphan on styles.css' }],
    });
    expect(text).toContain('Harness: confirm <link>');
    const afterPrior = text.split('Prior attempt')[1] ?? '';
    expect(afterPrior.indexOf('Harness:')).toBeLessThan(afterPrior.indexOf('Failed step'));
  });
});
