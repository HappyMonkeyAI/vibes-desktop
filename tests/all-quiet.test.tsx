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
        { id: 'm1', group: 'running', status: 'running', source: 'vibes-mission', title: 'Refactor auth module', updatedAt: Date.now() },
        { id: 'm2', group: 'needs-you', status: 'blocked', source: 'vibes-mission', title: 'Waiting on API key', needsHuman: true, updatedAt: Date.now() },
      ],
      groupCounts: { 'needs-you': 1, running: 1, upcoming: 0, recent: 0 },
    });
    render(<App />);
    expect(await screen.findByText('Refactor auth module')).toBeTruthy();
    expect(screen.getByText('Waiting on API key')).toBeTruthy();
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

    // A task starts running — pushed live.
    handlers[0]({ entry: { id: 't1', group: 'running', status: 'running', source: 'vibes-mission', title: 'Build widget', updatedAt: 1 } });
    expect(await screen.findByText('Build widget')).toBeTruthy();
    expect(document.body.textContent).not.toContain('All quiet');

    // The same task completes in place — must replace, not duplicate.
    handlers[0]({ entry: { id: 't1', group: 'recent', status: 'done', source: 'vibes-mission', title: 'Build widget', updatedAt: 2 } });
    await screen.findByText('Build widget');
    expect(screen.getAllByText('Build widget')).toHaveLength(1);
  });
});
