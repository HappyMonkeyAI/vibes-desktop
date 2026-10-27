import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Tabs } from '@arco-design/web-react';
import ChatView from '../src/renderer/ChatView';
import type { LedgerEntry } from '../src/shared/channels';

describe('ChatView phase 1', () => {
  beforeEach(() => {
    vi.mocked(window.vibesDesktop.workspace.history.get).mockResolvedValue([
      { path: 'C:/work/site', lastUsed: Date.now() },
    ]);
    vi.mocked(window.vibesDesktop.mission.plan).mockResolvedValue({
      tasks: ['Add footer HTML', 'Style footer'],
    });
    vi.mocked(window.vibesDesktop.mission.start).mockResolvedValue({
      started: true,
      alreadyRunning: false,
      missionId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
    vi.mocked(window.vibesDesktop.ledger.get).mockResolvedValue({
      entries: [],
      groupCounts: { 'needs-you': 0, running: 0, upcoming: 0, recent: 0 },
    });
  });

  it('plans, shows RHS steps, and launches with acceptPlan', async () => {
    vi.mocked(window.vibesDesktop.workspace.select).mockResolvedValue({ path: 'C:/work/site' });

    render(
      <Tabs defaultActiveTab="chat">
        <Tabs.TabPane key="chat" title="Chat">
          <ChatView />
        </Tabs.TabPane>
      </Tabs>,
    );

    expect(await screen.findByText(/Describe what you want done/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Browse/i }));
    await waitFor(() => expect(window.vibesDesktop.workspace.select).toHaveBeenCalled());

    const textarea = screen.getByPlaceholderText(/Ask for a change/i);
    fireEvent.change(textarea, { target: { value: 'Add a dark footer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => {
      expect(window.vibesDesktop.mission.plan).toHaveBeenCalledWith({
        request: 'Add a dark footer',
        workspaceRoot: 'C:/work/site',
      });
    });

    expect(await screen.findByText('Add footer HTML')).toBeTruthy();
    expect(screen.getByText('Style footer')).toBeTruthy();
    expect(await screen.findByText(/Planned 2 steps/i)).toBeTruthy();

    await waitFor(() => {
      expect(window.vibesDesktop.mission.start).toHaveBeenCalledWith({
        request: 'Add a dark footer',
        workspaceRoot: 'C:/work/site',
        acceptPlan: true,
        enqueueIfBusy: true,
      });
    });
  });

  it('appends a summary when the mission completes', async () => {
    vi.mocked(window.vibesDesktop.workspace.select).mockResolvedValue({ path: 'C:/work/site' });
    const handlers: Array<(e: { entry: LedgerEntry }) => void> = [];
    vi.mocked(window.vibesDesktop.ledger.onNewEntry).mockImplementation((cb) => {
      handlers.push(cb);
      return () => undefined;
    });

    render(<ChatView />);

    fireEvent.click(screen.getByRole('button', { name: /Browse/i }));
    await waitFor(() => expect(window.vibesDesktop.workspace.select).toHaveBeenCalled());
    const textarea = screen.getByPlaceholderText(/Ask for a change/i);
    fireEvent.change(textarea, { target: { value: 'Add a dark footer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    await waitFor(() => expect(window.vibesDesktop.mission.start).toHaveBeenCalled());

    const missionId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    for (const cb of handlers) {
      cb({
        entry: {
          id: 'm1',
          kind: 'mission',
          missionId,
          title: 'Add a dark footer',
          status: 'done',
          group: 'recent',
          source: 'vibes-mission',
          updatedAt: Date.now(),
        },
      });
      cb({
        entry: {
          id: 't1',
          missionId,
          title: 'Add footer HTML',
          status: 'done',
          group: 'recent',
          source: 'vibes-mission',
          updatedAt: Date.now(),
        },
      });
    }

    expect(await screen.findByText(/Finished/i)).toBeTruthy();
  });
});
