import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  LedgerEntry,
  LedgerSnapshot,
  MissionQueueSnapshot,
  WorkspaceHistoryEntry,
} from '@shared/channels';
import { buildChatMissionSummary } from '@shared/chatSummary';
import { Button, Input, Message, Select } from '@arco-design/web-react';
import VoiceInput from './VoiceInput';
import styles from './ChatView.module.css';

type ChatRole = 'user' | 'assistant' | 'system';

type ChatMessage = {
  id: string;
  role: ChatRole;
  text: string;
  at: number;
};

type PlanStep = {
  title: string;
  status: LedgerEntry['status'] | 'queued';
  detail?: string;
};

const TASK_ICON: Record<string, string> = {
  running: '⏳',
  verifying: '🔍',
  done: '✓',
  failed: '✕',
  blocked: '⛔',
  pending: '·',
  idle: '·',
  queued: '·',
  zombie: '💀',
  archived: '·',
};

const mintId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const isPlanTask = (entry: LedgerEntry) => entry.title !== 'Mission Scheduler';

/**
 * Chat — phase 1: request → plan (RHS) → auto-launch → ledger summaries → done comment.
 * Same missionService / ledger as Operations (ADR-0001).
 */
const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [workspaceHistory, setWorkspaceHistory] = useState<WorkspaceHistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [planTitles, setPlanTitles] = useState<string[]>([]);
  const [planSteps, setPlanSteps] = useState<PlanStep[]>([]);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState('');
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [summarizedFor, setSummarizedFor] = useState<string | null>(null);
  const [queue, setQueue] = useState<MissionQueueSnapshot>({ paused: false, items: [] });
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const pushMessage = (role: ChatRole, text: string) => {
    setMessages((prev) => [...prev, { id: mintId(), role, text, at: Date.now() }]);
  };

  const refreshHistory = () => {
    void window.vibesDesktop.workspace.history.get().then(setWorkspaceHistory).catch(() => {});
  };

  const refreshQueue = () => {
    void window.vibesDesktop.mission.queue.get().then(setQueue).catch(() => {});
  };

  useEffect(() => {
    refreshHistory();
    refreshQueue();
  }, []);

  useEffect(() => {
    if (queue.items.length === 0 && !queue.paused) return;
    const id = window.setInterval(refreshQueue, 2500);
    return () => window.clearInterval(id);
  }, [queue.items.length, queue.paused]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const snap = (await window.vibesDesktop.ledger.get()) as LedgerSnapshot;
        setSnapshot(snap);
        unsubscribe = window.vibesDesktop.ledger.onNewEntry(({ entry }) => {
          setSnapshot((prev) => {
            if (!prev) return { entries: [entry], groupCounts: { 'needs-you': 0, running: 0, upcoming: 0, recent: 0 } };
            const idx = prev.entries.findIndex((e) => e.id === entry.id);
            const entries = idx === -1 ? [...prev.entries, entry] : prev.entries.map((e, i) => (i === idx ? entry : e));
            return { ...prev, entries };
          });
        });
      } catch {
        /* Chat still usable for compose; ledger optional until start */
      }
    })();
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages.length]);

  // Sync RHS checklist + completion comment from ledger for the active mission.
  useEffect(() => {
    if (!activeMissionId || !snapshot) return;
    const related = snapshot.entries.filter((e) => e.missionId === activeMissionId);
    const mission = related.find((e) => e.kind === 'mission');
    const tasks = related.filter((e) => e.kind !== 'mission' && isPlanTask(e));

    if (planTitles.length > 0) {
      const byTitle = new Map(tasks.map((t) => [t.title, t]));
      setPlanSteps(
        planTitles.map((title) => {
          const hit = byTitle.get(title);
          return hit
            ? { title, status: hit.status, detail: hit.detail }
            : { title, status: 'queued' as const };
        }),
      );
    } else if (tasks.length > 0) {
      setPlanSteps(tasks.map((t) => ({ title: t.title, status: t.status, detail: t.detail })));
    }

    const terminal =
      mission &&
      (mission.status === 'done' ||
        mission.status === 'failed' ||
        mission.status === 'blocked' ||
        mission.status === 'archived');
    if (terminal && summarizedFor !== activeMissionId) {
      pushMessage(
        'assistant',
        buildChatMissionSummary({
          request: activeRequest,
          mission,
          tasks,
        }),
      );
      setSummarizedFor(activeMissionId);
      setBusy(false);
    }
  }, [snapshot, activeMissionId, planTitles, activeRequest, summarizedFor]);

  const handleBrowseWorkspace = async () => {
    const res = await window.vibesDesktop.workspace.select();
    if (res.path) {
      setWorkspaceRoot(res.path);
      void window.vibesDesktop.workspace.history.save(res.path).then(refreshHistory).catch(() => {});
    }
  };

  const handlePickWorkspace = (path: string) => {
    setWorkspaceRoot(path);
    void window.vibesDesktop.workspace.history.save(path).then(refreshHistory).catch(() => {});
  };

  const handleSend = async () => {
    const request = draft.trim();
    if (!request) return;

    // Chat phase 2 — mid-run steering while this Chat session owns a mission.
    if (activeMissionId) {
      setDraft('');
      pushMessage('user', request);
      try {
        const steered = await window.vibesDesktop.mission.steer({ message: request });
        if (steered.ok) {
          pushMessage('assistant', 'Steering queued for the next task.');
        } else {
          pushMessage('assistant', steered.error || 'Could not steer the running mission.');
        }
      } catch (error) {
        pushMessage('assistant', error instanceof Error ? error.message : String(error));
      }
      return;
    }

    if (busy) return;
    if (!workspaceRoot) {
      Message.warning('Choose a working directory before chatting a mission.');
      return;
    }

    setBusy(true);
    setDraft('');
    setPlanTitles([]);
    setPlanSteps([]);
    setActiveMissionId(null);
    setSummarizedFor(null);
    setActiveRequest(request);
    pushMessage('user', request);

    try {
      pushMessage('system', 'Planning…');
      const planResponse = await window.vibesDesktop.mission.plan({ request, workspaceRoot });
      if (planResponse.error) {
        const missionBusy =
          /already running/i.test(planResponse.error)
          || /wait for it to finish/i.test(planResponse.error);
        if (missionBusy) {
          const queued = await window.vibesDesktop.mission.start({
            request,
            workspaceRoot,
            enqueueIfBusy: true,
          });
          if (queued.queued) {
            pushMessage(
              'assistant',
              `Mission busy — queued follow-up (${queued.queueDepth ?? 1} waiting). It starts when the current run finishes.`,
            );
            refreshQueue();
            setBusy(false);
            return;
          }
        }
        pushMessage('assistant', `Could not plan: ${planResponse.error}`);
        setBusy(false);
        return;
      }
      const tasks = planResponse.tasks || [];
      if (tasks.length === 0) {
        pushMessage('assistant', 'Planner returned no tasks.');
        setBusy(false);
        return;
      }
      setPlanTitles(tasks);
      setPlanSteps(tasks.map((title) => ({ title, status: 'queued' as const })));
      pushMessage(
        'assistant',
        `Planned ${tasks.length} step${tasks.length === 1 ? '' : 's'}. Launching mission…`,
      );

      const result = await window.vibesDesktop.mission.start({
        request,
        workspaceRoot,
        acceptPlan: true,
        enqueueIfBusy: true,
      });
      if (result.queued) {
        pushMessage(
          'assistant',
          `Mission busy — queued follow-up (${result.queueDepth ?? 1} waiting). It starts when the current run finishes.`,
        );
        refreshQueue();
        setBusy(false);
        return;
      }
      if (result.alreadyRunning) {
        pushMessage('assistant', 'A mission is already running — wait, stop it, or send again to queue.');
        setBusy(false);
        return;
      }
      if (!result.started) {
        pushMessage('assistant', result.error || 'Mission failed to start.');
        setBusy(false);
        return;
      }
      if (result.missionId) setActiveMissionId(result.missionId);
      pushMessage('system', result.missionId ? `Mission ${result.missionId.slice(0, 8)}… running` : 'Mission running');
    } catch (error) {
      pushMessage('assistant', error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  };

  const handleStop = async () => {
    const res = await window.vibesDesktop.mission.stop();
    if (res.stopped) {
      pushMessage('system', 'Stop requested.');
      setBusy(false);
    } else {
      Message.info('Nothing to stop.');
    }
  };

  const handleQueuePauseToggle = async () => {
    try {
      const next = await window.vibesDesktop.mission.queue.setPaused(!queue.paused);
      setQueue(next);
      pushMessage(
        'system',
        next.paused
          ? 'Follow-up queue paused — waiting items will not auto-start.'
          : 'Follow-up queue resumed.',
      );
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Could not update queue pause.');
    }
  };

  const handleQueueClear = async () => {
    try {
      const next = await window.vibesDesktop.mission.queue.clear();
      setQueue(next);
      pushMessage('system', 'Follow-up queue cleared.');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Could not clear queue.');
    }
  };

  const planLabel = useMemo(() => {
    if (planSteps.length === 0) return 'No plan yet';
    const done = planSteps.filter((s) => s.status === 'done').length;
    return `${done}/${planSteps.length}`;
  }, [planSteps]);

  return (
    <div className={styles.chat} data-purpose="chat-mission">
      <div className={styles.split}>
        <section className={styles.panel} aria-label="Chat transcript">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Chat</h2>
            <span className={styles.panelMeta}>{activeMissionId ? activeMissionId.slice(0, 8) : 'idle'}</span>
          </div>
          <div className={styles.transcript}>
            {messages.length === 0 ? (
              <div className={styles.empty}>
                Describe what you want done. Chat plans a mission, shows steps on the right, then streams
                progress from the same ledger as Operations.
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={[
                    styles.bubble,
                    m.role === 'user'
                      ? styles.bubbleUser
                      : m.role === 'system'
                        ? styles.bubbleSystem
                        : styles.bubbleAssistant,
                  ].join(' ')}
                >
                  {m.role !== 'system' && (
                    <span className={styles.role}>{m.role === 'user' ? 'You' : 'Vibes'}</span>
                  )}
                  {m.text}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
        </section>

        <aside className={styles.panel} aria-label="Mission plan">
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>Plan</h2>
            <span className={styles.panelMeta}>{planLabel}</span>
          </div>
          <div className={styles.planBody}>
            {planSteps.length === 0 ? (
              <div className={styles.planEmpty}>Task checklist appears after you send a request.</div>
            ) : (
              <ul className={styles.planList}>
                {planSteps.map((step) => (
                  <li
                    key={step.title}
                    className={[
                      styles.planItem,
                      step.status === 'running' || step.status === 'verifying' ? styles.planItemRunning : '',
                      step.status === 'done' ? styles.planItemDone : '',
                      step.status === 'failed' || step.status === 'blocked' ? styles.planItemFailed : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span className={styles.planIcon}>{TASK_ICON[step.status] ?? '·'}</span>
                    <span>
                      {step.title}
                      {step.detail ? (
                        <div className={styles.panelMeta} style={{ marginTop: 4 }}>
                          {step.detail}
                        </div>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      <div className={styles.composer}>
        {(queue.items.length > 0 || queue.paused) && (
          <div className={styles.queueBar} aria-label="Follow-up mission queue">
            <div className={styles.queueMeta}>
              <span className={styles.workspaceLabel}>Queue</span>
              <span className={styles.panelMeta}>
                {queue.paused ? 'paused · ' : ''}
                {queue.items.length} waiting
              </span>
            </div>
            <ul className={styles.queueList}>
              {queue.items.slice(0, 4).map((item) => (
                <li key={item.id} className={styles.queueItem} title={item.request}>
                  {item.request.length > 72 ? `${item.request.slice(0, 72)}…` : item.request}
                </li>
              ))}
              {queue.items.length > 4 ? (
                <li className={styles.queueItem}>+{queue.items.length - 4} more</li>
              ) : null}
            </ul>
            <div className={styles.queueActions}>
              <Button size="mini" onClick={() => void handleQueuePauseToggle()}>
                {queue.paused ? 'Resume' : 'Pause'}
              </Button>
              <Button size="mini" status="danger" onClick={() => void handleQueueClear()}>
                Clear
              </Button>
            </div>
          </div>
        )}
        <div className={styles.workspaceRow}>
          <span className={styles.workspaceLabel}>Workspace</span>
          <Select
            className={styles.workspaceSelect}
            size="small"
            placeholder="Working directory"
            value={workspaceRoot || undefined}
            onChange={(v) => handlePickWorkspace(String(v))}
            allowClear
            showSearch
          >
            {workspaceHistory.map((h) => (
              <Select.Option key={h.path} value={h.path}>
                {h.path}
              </Select.Option>
            ))}
          </Select>
          <Button size="small" onClick={() => void handleBrowseWorkspace()}>
            Browse…
          </Button>
        </div>
        <div className={styles.inputRow}>
          <Input.TextArea
            className={styles.input}
            value={draft}
            onChange={setDraft}
            placeholder={
              activeMissionId
                ? 'Steer the running mission…'
                : 'Ask for a change — Chat will plan and run a mission…'
            }
            autoSize={{ minRows: 2, maxRows: 5 }}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={busy}
          />
          <VoiceInput onTranscript={(text) => setDraft((prev) => (prev ? `${prev} ${text}` : text))} />
          <div className={styles.actions}>
            <Button type="primary" loading={busy} disabled={!draft.trim() || !workspaceRoot} onClick={() => void handleSend()}>
              Send
            </Button>
            <Button status="warning" disabled={!busy && !activeMissionId} onClick={() => void handleStop()}>
              Stop
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
