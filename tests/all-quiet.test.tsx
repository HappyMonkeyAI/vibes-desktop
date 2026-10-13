import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/renderer/App';

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
