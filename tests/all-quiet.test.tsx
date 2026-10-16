import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/renderer/App';
import type { LedgerEntry } from '@shared/channels';

// S1 acceptance: a fresh install (empty ledger) renders "All quiet" — never
// an error banner or warning text. ADR-0003.

describe('first-launch empty state (S1)', () => {
  it('renders All quiet with zero entries and no error copy', async () => {
    render(<App />);
    expect(await screen.findByText('All quiet')).toBeTruthy();
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/incomplete|error|failed to load|unhealthy/i);
  });

  it('renders grouped entries when the ledger has activity', async () => {
    vi.mocked(window.vibesDesktop.ledger.get).mockResolvedValueOnce({
      entries: [
        { id: 'm1', kind: 'mission', group: 'running', status: 'running', source: 'vibes-mission', title: 'Refactor auth module', workspaceRoot: '/w/one', updatedAt: Date.now() },
        { id: 't1', group: 'running', status: 'running', source: 'vibes-mission', title: 'Update index.html title', workspaceRoot: '/w/one', updatedAt: Date.now() },
        { id: 'm2', kind: 'mission', group: 'needs-you', status: 'blocked', source: 'vibes-mission', title: 'Waiting on API key', needsHuman: true, workspaceRoot: '/w/two', updatedAt: Date.now() },
      ],
      groupCounts: { 'needs-you': 1, running: 2, upcoming: 0, recent: 0 },
    });
    render(<App />);
    expect(await screen.findByText('Refactor auth module')).toBeTruthy();
    expect(screen.getByText('Waiting on API key')).toBeTruthy();
    // Task rows are grouped under their mission card, not shown as separate cards.
    expect(screen.queryByText('Update index.html title')).toBeNull();
    expect(document.body.textContent).not.toContain('All quiet');
  });
});

// T5 live path: new entries pushed over `ledger:new-entry` appear without a
// refresh, and an in-place task update replaces its row (no duplicate).
describe('live ledger push (T5)', () => {
  it('appends a pushed entry and updates counts without refreshing', async () => {
    const handlers: Array<(e: { entry: LedgerEntry }) => void> = [];
    vi.mocked(window.vibesDesktop.ledger.onNewEntry).mockImplementation((cb) => {
      handlers.push(cb as (e: { entry: LedgerEntry }) => void);
      return () => undefined;
    });

    render(<App />);
    expect(await screen.findByText('All quiet')).toBeTruthy();

    // A mission starts — its event row is pushed live and becomes a card.
    handlers[0]({ entry: { id: 'm1', kind: 'mission', group: 'running', status: 'running', source: 'vibes-mission', title: 'Planning: Build widget', workspaceRoot: '/w/widget', updatedAt: 1 } });
    expect(await screen.findByText('Build widget')).toBeTruthy();
    expect(document.body.textContent).not.toContain('All quiet');

    // The mission completes in place — must replace, not duplicate.
    handlers[0]({ entry: { id: 'm1', kind: 'mission', group: 'recent', status: 'done', source: 'vibes-mission', title: 'Mission complete', workspaceRoot: '/w/widget', updatedAt: 2 } });
    await screen.findByText('Mission complete');
    expect(screen.getAllByText('Mission complete')).toHaveLength(1);
  });
});
