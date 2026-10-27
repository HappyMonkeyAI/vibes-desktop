import { describe, expect, it } from 'vitest';
import { buildRetryRequest } from '../src/shared/missionRetry';

describe('buildRetryRequest (T31 forget-except-best)', () => {
  it('returns the title alone when there is no prior lesson', () => {
    expect(buildRetryRequest({ title: 'Add a column layout' })).toBe('Add a column layout');
  });

  it('seeds a short lesson from mission detail and best done steps', () => {
    const text = buildRetryRequest({
      title: 'Add Unsplash columns',
      missionDetail: 'Mission failed. Completed 1/4 tasks.',
      doneTaskTitles: ['Create HTML structure'],
      failedTasks: [
        { title: 'Add CSS', detail: 'Left pending when the mission ended.' },
        { title: 'Add images', detail: 'Scheduler deadlock: waiting on ghost uuid' },
      ],
      systemFailures: [
        { title: 'Mission Scheduler', detail: 'Scheduler deadlock: done but not credited complete' },
      ],
    });
    expect(text.startsWith('Add Unsplash columns')).toBe(true);
    expect(text).toContain('Prior attempt — keep ONLY this lesson');
    expect(text).toContain('Best progress so far: Create HTML structure');
    expect(text).toContain('Scheduler deadlock: done but not credited complete');
    expect(text).toContain('Failed step "Add images"');
    // Generic "Left pending…" noise is dropped.
    expect(text).not.toContain('Left pending');
  });

  it('caps lesson length and dedupes', () => {
    const long = 'x'.repeat(2000);
    const text = buildRetryRequest({
      title: 'T',
      missionDetail: long,
      systemFailures: [{ title: 'Mission Scheduler', detail: long }],
    });
    const lessonBlock = text.split('Prior attempt')[1] ?? '';
    expect(lessonBlock.length).toBeLessThan(long.length * 2);
  });
});
