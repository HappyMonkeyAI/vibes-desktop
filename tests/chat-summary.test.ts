import { describe, expect, it } from 'vitest';
import { buildChatMissionSummary } from '../src/shared/chatSummary';
import type { LedgerEntry } from '../src/shared/channels';

const task = (partial: Partial<LedgerEntry> & Pick<LedgerEntry, 'title' | 'status'>): LedgerEntry => ({
  id: partial.id ?? partial.title,
  group: partial.group ?? 'recent',
  source: 'vibes-mission',
  updatedAt: Date.now(),
  ...partial,
});

describe('buildChatMissionSummary', () => {
  it('lists completed steps on success', () => {
    const text = buildChatMissionSummary({
      request: 'Add a footer',
      mission: task({ title: 'Add a footer', status: 'done', kind: 'mission', group: 'recent' }),
      tasks: [
        task({ title: 'HTML', status: 'done', group: 'recent' }),
        task({ title: 'CSS', status: 'done', group: 'recent' }),
      ],
    });
    expect(text).toContain('Finished');
    expect(text).toContain('2/2');
    expect(text).toContain('• HTML');
    expect(text).toContain('• CSS');
  });

  it('surfaces failure detail', () => {
    const text = buildChatMissionSummary({
      request: 'Add a footer',
      mission: task({
        title: 'Add a footer',
        status: 'failed',
        kind: 'mission',
        group: 'needs-you',
        detail: 'Evidence verification failed',
      }),
      tasks: [task({ title: 'HTML', status: 'failed', group: 'needs-you', detail: 'timeout' })],
    });
    expect(text).toContain('Stopped (failed)');
    expect(text).toContain('Evidence verification failed');
    expect(text).toContain('HTML');
  });
});
