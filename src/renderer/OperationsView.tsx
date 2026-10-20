import React, { useEffect, useMemo, useState } from 'react';
import type { ActivityGroup, LedgerEntry, LedgerSnapshot, WorkspaceHistoryEntry } from '@shared/channels';
import { classify } from '@shared/classify';
import { Button, Input, Modal, Message, Select } from '@arco-design/web-react';
import { Plus, Close } from '@icon-park/react';
import VoiceInput from './VoiceInput';
import styles from './OperationsView.module.css';

/** Accent color per status — ported from the fork's mission-control page. */
const STATUS_ACCENT: Record<string, string> = {
  running: '#38bdf8',
  verifying: '#b07bff',
  failed: '#fb7185',
  zombie: '#c0392b',
  blocked: '#fbbf24',
  pending: '#5b8def',
  done: '#34d399',
  idle: '#7a818c',
  archived: '#b0b0b0',
};

const STATUS_LABELS: Record<string, string> = {
  running: 'EXECUTING',
  verifying: 'VERIFYING',
  failed: 'FAILED',
  zombie: 'ZOMBIE',
  blocked: 'BLOCKED',
  pending: 'PENDING',
  done: 'COMPLETE',
  idle: 'IDLE',
  archived: 'ARCHIVED',
};

const TASK_ICONS: Record<string, string> = {
  running: '⏳',
  verifying: '🔍',
  done: '✓',
  failed: '✕',
  blocked: '⛔',
  zombie: '💀',
  pending: '·',
  idle: '·',
};

const METRIC_DEFS: Array<{ group: ActivityGroup; label: string; hint: string; accent: string }> = [
  { group: 'needs-you', label: 'Needs you', hint: 'Failed / intervention', accent: '#fb7185' },
  { group: 'running', label: 'Running', hint: 'Agents executing', accent: '#38bdf8' },
  { group: 'upcoming', label: 'Upcoming', hint: 'Queued', accent: '#64748b' },
  { group: 'recent', label: 'Recent', hint: 'Delivered', accent: '#34d399' },
];

type MissionCard = {
  id: string;
  missionId?: string;
  title: string;
  status: LedgerEntry['status'];
  group: ActivityGroup;
  workspaceRoot?: string;
  updatedAt: number;
  detail?: string;
  tasks: LedgerEntry[];
  /** Synthetic rows (e.g. Mission Scheduler) kept for failure detail, not progress. */
  systemFailures: LedgerEntry[];
};

type LogLine = { at: number; text: string };

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatLogTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** Internal scheduler rows are not plan steps — exclude from progress/checklist. */
const isPlanTask = (entry: LedgerEntry) => entry.title !== 'Mission Scheduler';

const progressOf = (tasks: LedgerEntry[]) => {
  const planTasks = tasks.filter(isPlanTask);
  const done = planTasks.filter((t) => t.status === 'done').length;
  return { done, total: planTasks.length };
};

const logTextFor = (entry: LedgerEntry): string => {
  const kind = entry.kind === 'mission' ? 'MISSION' : 'TASK';
  const base = `[${kind}] ${entry.status.toUpperCase()} — ${entry.title}`;
  return entry.detail ? `${base} — ${entry.detail}` : base;
};

/**
 * OperationsView — Hybrid C: always-on dispatch, classify() metrics, card grid,
 * and a live depth panel (checklist + detail + ledger-derived logs).
 */
const OperationsView: React.FC = () => {
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [missionRequest, setMissionRequest] = useState('');
  const [starting, setStarting] = useState(false);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [workspaceHistory, setWorkspaceHistory] = useState<WorkspaceHistoryEntry[]>([]);
  const [voiceReady, setVoiceReady] = useState<boolean | null>(null);

  const [launchModalVisible, setLaunchModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<ActivityGroup | 'all'>('all');
  const [missionPrompt, setMissionPrompt] = useState('');
  const [proposedTasks, setProposedTasks] = useState<string[]>([]);
  const [planning, setPlanning] = useState(false);
  const [logsByMission, setLogsByMission] = useState<Record<string, LogLine[]>>({});

  const refreshHistory = async () => {
    try {
      setWorkspaceHistory(await window.vibesDesktop.workspace.history.get());
    } catch {
      // History failing is non-fatal
    }
  };

  useEffect(() => {
    void refreshHistory();
  }, []);

  const handleSelectWorkspace = async () => {
    try {
      const res = await window.vibesDesktop.workspace.select();
      if (res.path) {
        setWorkspaceRoot(res.path);
        void window.vibesDesktop.workspace.history.save(res.path).then(refreshHistory).catch(() => {});
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handlePickRecent = (path: string) => {
    setWorkspaceRoot(path);
    void window.vibesDesktop.workspace.history.save(path).then(refreshHistory).catch(() => {});
  };

  const handleClearHistory = async () => {
    try {
      await window.vibesDesktop.workspace.history.clear();
      setWorkspaceHistory([]);
    } catch {
      // non-fatal
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const settings = await window.vibesDesktop.settings.get();
        if (settings.speechEngine === 'builtin' || settings.speechEngine === 'server') {
          if (!cancelled) setVoiceReady(true);
          return;
        }
        const result = await window.vibesDesktop.voice.doctor();
        if (!cancelled) setVoiceReady(result.ready);
      } catch {
        if (!cancelled) setVoiceReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const appendLog = (missionId: string | undefined, entry: LedgerEntry) => {
    if (!missionId) return;
    const text = logTextFor(entry);
    setLogsByMission((prev) => {
      const existing = prev[missionId] ?? [];
      const last = existing[existing.length - 1];
      if (last && last.text === text) return prev;
      return {
        ...prev,
        [missionId]: [...existing, { at: entry.updatedAt || Date.now(), text }].slice(-120),
      };
    });
  };

  const seedLogsFromEntries = (entries: LedgerEntry[]) => {
    const next: Record<string, LogLine[]> = {};
    const ordered = [...entries].sort((a, b) => a.updatedAt - b.updatedAt);
    for (const entry of ordered) {
      const mid = entry.missionId;
      if (!mid) continue;
      const text = logTextFor(entry);
      const bucket = next[mid] ?? (next[mid] = []);
      const last = bucket[bucket.length - 1];
      if (!last || last.text !== text) bucket.push({ at: entry.updatedAt, text });
    }
    setLogsByMission(next);
  };

  const handleStartMission = async () => {
    const request = missionRequest.trim();
    if (!request || starting) return;
    if (!workspaceRoot) {
      Message.warning('Choose a working directory before starting a mission.');
      return;
    }
    setStarting(true);
    try {
      const result = await window.vibesDesktop.mission.start({ request, workspaceRoot });
      if (result.alreadyRunning) Message.warning('A mission is already running.');
      else if (!result.started && result.error) Message.error(result.error);
      else if (result.started) {
        Message.success('Mission started');
        setMissionRequest('');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  };

  const handleLaunchModalOpen = () => setLaunchModalVisible(true);
  const handleLaunchModalClose = () => setLaunchModalVisible(false);

  const handleGenerateTasks = async () => {
    const request = missionRequest.trim();
    if (planning) return;
    if (!request) {
      Message.warning('Describe the mission before generating tasks.');
      return;
    }
    if (!workspaceRoot) {
      Message.warning('Choose a working directory before planning a mission.');
      return;
    }
    setPlanning(true);
    try {
      const planResponse = await window.vibesDesktop.mission.plan({ request, workspaceRoot });
      if (planResponse.error) {
        Message.error(planResponse.error);
        return;
      }
      setProposedTasks(planResponse.tasks || []);
      setMissionPrompt(request);
      setLaunchModalVisible(false);
      setReviewModalVisible(true);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to generate tasks');
    } finally {
      setPlanning(false);
    }
  };

  const handleOpenReviewFromDispatch = () => {
    void handleGenerateTasks();
  };

  const handleReviewAccept = async () => {
    if (starting) return;
    setStarting(true);
    try {
      const result = await window.vibesDesktop.mission.start({
        request: missionPrompt,
        workspaceRoot,
        acceptPlan: true,
      });
      if (result.alreadyRunning) Message.warning('A mission is already running.');
      else if (!result.started && result.error) Message.error(result.error);
      else if (result.started) {
        Message.success('Mission started');
        setReviewModalVisible(false);
        setProposedTasks([]);
        setMissionPrompt('');
        setMissionRequest('');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  };

  const handleReviewDecline = () => {
    setReviewModalVisible(false);
    setProposedTasks([]);
    void window.vibesDesktop.mission.cancelPlan().catch(() => {});
  };

  const handleRegeneratePlan = async () => {
    if (planning) return;
    setPlanning(true);
    try {
      const planResponse = await window.vibesDesktop.mission.plan({ request: missionPrompt, workspaceRoot });
      if (planResponse.error) {
        Message.error(planResponse.error);
        return;
      }
      setProposedTasks(planResponse.tasks || []);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to regenerate tasks');
    } finally {
      setPlanning(false);
    }
  };

  const handleArchiveEntry = async (card: MissionCard) => {
    try {
      const ids = [card.id, ...card.tasks.map((t) => t.id)];
      const result = await window.vibesDesktop.ledger.archive(ids);
      if (result.ok) {
        Message.success('Mission archived');
        if (selectedCardId === card.id) setSelectedCardId(null);
      } else {
        Message.error(result.error || 'Failed to archive mission');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to archive mission');
    }
  };

  const handleRetryMission = async (card: MissionCard) => {
    if (starting) return;
    setStarting(true);
    try {
      const result = await window.vibesDesktop.mission.start({
        request: card.title,
        workspaceRoot: card.workspaceRoot || workspaceRoot || undefined,
      });
      if (result.alreadyRunning) Message.warning('A mission is already running.');
      else if (!result.started && result.error) Message.error(result.error);
      else if (result.started) Message.success('Mission restarted');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  };

  const handleTerminateMission = async () => {
    try {
      await window.vibesDesktop.mission.stop();
      Message.success('Mission terminated');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to terminate mission');
    }
  };

  const handleStopMission = async () => {
    try {
      await window.vibesDesktop.mission.stop();
      Message.success('Mission terminated');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to terminate mission');
    }
  };

  const entries = useMemo(() => {
    const all = snapshot?.entries ?? [];
    return all.filter((e) => e.status !== 'archived');
  }, [snapshot]);

  const cards: MissionCard[] = useMemo(() => {
    const result: MissionCard[] = [];
    for (const entry of entries) {
      if (entry.kind !== 'mission') continue;
      const related = entry.missionId
        ? entries.filter((e) => e.kind !== 'mission' && e.missionId === entry.missionId)
        : [];
      result.push({
        id: entry.id,
        missionId: entry.missionId,
        title: entry.title,
        status: entry.status,
        group: classify(entry),
        workspaceRoot: entry.workspaceRoot,
        updatedAt: entry.updatedAt,
        detail: entry.detail,
        tasks: related.filter(isPlanTask),
        systemFailures: related.filter((e) => !isPlanTask(e) && (e.status === 'failed' || e.status === 'blocked')),
      });
    }
    return result;
  }, [entries]);

  const metricCounts = useMemo(() => {
    const counts: Record<ActivityGroup, number> = {
      'needs-you': 0,
      running: 0,
      upcoming: 0,
      recent: 0,
    };
    for (const card of cards) counts[card.group] += 1;
    return counts;
  }, [cards]);

  const visibleCards = useMemo(
    () => (groupFilter === 'all' ? cards : cards.filter((c) => c.group === groupFilter)),
    [cards, groupFilter],
  );

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) ?? null,
    [cards, selectedCardId],
  );

  // Keep selection on a live mission; clear if the card vanished.
  useEffect(() => {
    if (selectedCardId && !cards.some((c) => c.id === selectedCardId)) {
      setSelectedCardId(null);
      return;
    }
    if (!selectedCardId) {
      const running = cards.find((c) => c.status === 'running' || c.status === 'verifying');
      if (running) setSelectedCardId(running.id);
    }
  }, [cards, selectedCardId]);

  const hasRunning = cards.some((c) => c.status === 'running' || c.status === 'verifying');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const snap = (await window.vibesDesktop.ledger.get()) as LedgerSnapshot;
        setSnapshot(snap);
        seedLogsFromEntries(snap.entries.filter((e) => e.status !== 'archived'));
        unsubscribe = window.vibesDesktop.ledger.onNewEntry(({ entry }) => {
          setSnapshot((prev) => {
            if (!prev) return prev;
            const rest = prev.entries.filter((e) => e.id !== entry.id);
            return { entries: [...rest, entry], groupCounts: prev.groupCounts };
          });
          appendLog(entry.missionId, entry);
        });
      } catch (error) {
        Message.error(error instanceof Error ? error.message : 'Failed to load the activity ledger.');
      }
    })();
    return () => unsubscribe?.();
  }, []);

  const selectedLogs = selectedCard?.missionId ? (logsByMission[selectedCard.missionId] ?? []) : [];
  const selectedProgress = selectedCard ? progressOf(selectedCard.tasks) : { done: 0, total: 0 };
  const selectedPct =
    selectedProgress.total > 0
      ? Math.round((selectedProgress.done / selectedProgress.total) * 100)
      : selectedCard?.status === 'done'
        ? 100
        : 0;

  const failedPlanTasks = selectedCard
    ? selectedCard.tasks.filter((t) => t.status === 'failed' || t.status === 'blocked')
    : [];
  const showFailurePanel = Boolean(
    selectedCard
    && (selectedCard.status === 'failed'
      || selectedCard.status === 'blocked'
      || selectedCard.detail
      || failedPlanTasks.some((t) => t.detail)
      || selectedCard.systemFailures.length > 0),
  );

  return (
    <div className={styles.ops}>
      {/* T16 — Always-on dispatch */}
      <section className={styles.dispatch} aria-label="Dispatch">
        <div className={styles.dispatchRow}>
          <div className={styles.missionInput}>
            <Input.TextArea
              placeholder="Describe the mission — type it or hold-to-talk."
              value={missionRequest}
              onChange={(v) => setMissionRequest(v)}
              autoSize={{ minRows: 2, maxRows: 5 }}
            />
          </div>
          <div className={styles.dispatchActions}>
            <VoiceInput onTranscript={(text) => setMissionRequest((prev) => (prev ? `${prev} ${text}` : text))} />
            <Button
              type="primary"
              loading={starting}
              disabled={!missionRequest.trim() || !workspaceRoot}
              title={!workspaceRoot ? 'Choose a working directory first' : undefined}
              onClick={() => void handleStartMission()}
            >
              Start mission
            </Button>
            {hasRunning && (
              <Button status="danger" onClick={() => void handleStopMission()}>
                Stop
              </Button>
            )}
            <Button
              type="outline"
              loading={planning}
              disabled={!missionRequest.trim() || !workspaceRoot || planning}
              onClick={() => void handleOpenReviewFromDispatch()}
            >
              Review plan…
            </Button>
          </div>
        </div>
        <div className={styles.workspaceBar}>
          <span className={styles.workspaceLabel}>Working directory</span>
          <div className={styles.workspaceControls}>
            <Select
              placeholder="Select a directory…"
              value={workspaceRoot || undefined}
              onChange={(v) => handlePickRecent(String(v))}
              allowClear
              style={{ minWidth: 220, flex: 1 }}
              triggerProps={{ autoAlignPopupWidth: true }}
            >
              {workspaceHistory.map((h) => (
                <Select.Option key={h.path} value={h.path}>{h.path}</Select.Option>
              ))}
            </Select>
            <Button size="small" type="outline" onClick={handleSelectWorkspace}>Choose…</Button>
            {workspaceHistory.length > 0 && (
              <Button size="small" type="text" onClick={() => void handleClearHistory()}>Clear</Button>
            )}
          </div>
          {voiceReady === false && <span className={styles.voiceNotReady}>voice not ready</span>}
        </div>
      </section>

      {/* T17 — Metric strip */}
      <section className={styles.metrics} aria-label="Status metrics">
        {METRIC_DEFS.map((m) => {
          const active = groupFilter === m.group;
          return (
            <button
              key={m.group}
              type="button"
              className={`${styles.metric} ${active ? styles.metricActive : ''}`}
              style={{ ['--accent' as string]: m.accent }}
              onClick={() => setGroupFilter(active ? 'all' : m.group)}
            >
              <div className={styles.metricValue}>{metricCounts[m.group]}</div>
              <div className={styles.metricLabel}>{m.label}</div>
              <div className={styles.metricHint}>{m.hint}</div>
            </button>
          );
        })}
      </section>

      {/* Cards + depth */}
      <section className={`${styles.split} ${selectedCard ? styles.splitOpen : ''}`}>
        <div className={styles.cardsCol}>
          {cards.length === 0 ? (
            <>
              <div className={styles.empty}>
                <span className={styles.emptyTitle}>All quiet</span>
                <span className={styles.emptyHint}>No missions yet. Launch a new agent or start from the dispatch bar.</span>
              </div>
              <div className={styles.cardGrid}>
                <button type="button" className={styles.launchCard} onClick={handleLaunchModalOpen}>
                  <Plus size={32} className={styles.launchIcon} />
                  <span className={styles.launchLabel}>Launch New Agent</span>
                </button>
              </div>
            </>
          ) : (
            <div className={styles.cardGrid}>
              <button type="button" className={styles.launchCard} onClick={handleLaunchModalOpen}>
                <Plus size={32} className={styles.launchIcon} />
                <span className={styles.launchLabel}>Launch New Agent</span>
              </button>
              {visibleCards.map((card) => {
                const progress = progressOf(card.tasks);
                const pct = progress.total > 0
                  ? Math.round((progress.done / progress.total) * 100)
                  : (card.status === 'done' ? 100 : 0);
                const selected = card.id === selectedCardId;
                return (
                  <div
                    key={card.id}
                    role="button"
                    tabIndex={0}
                    className={`${styles.missionCard} ${selected ? styles.missionCardSelected : ''} ${card.status === 'running' || card.status === 'verifying' ? styles.runningMission : ''}`}
                    style={{ ['--accent' as string]: STATUS_ACCENT[card.status] ?? '#7a818c' }}
                    onClick={() => setSelectedCardId(card.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCardId(card.id);
                      }
                    }}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>{card.title}</span>
                      <button
                        type="button"
                        className={styles.closeBtn}
                        title="Archive mission"
                        onClick={(e) => { e.stopPropagation(); void handleArchiveEntry(card); }}
                      >
                        <Close size={14} />
                      </button>
                    </div>
                    <div className={styles.statusBadge}>
                      {STATUS_LABELS[card.status] || card.status.toUpperCase()}
                    </div>
                    <div className={styles.workingDir}>{card.workspaceRoot || 'App default'}</div>
                    <div className={styles.progressTracker}>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={styles.progressText}>
                        {progress.total > 0 ? `${progress.done} / ${progress.total} tasks (${pct}%)` : 'no task activity yet'}
                      </span>
                    </div>
                    <div className={styles.missionDate}>{formatDate(card.updatedAt)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* T18 / T19 — Depth panel */}
        {selectedCard && (
          <aside className={styles.depth} aria-label="Mission depth">
            <div className={styles.depthHead}>
              <div className={styles.depthHeadMain}>
                <h3 className={styles.depthTitle}>{selectedCard.title}</h3>
                <div
                  className={styles.depthStatus}
                  style={{ color: STATUS_ACCENT[selectedCard.status] }}
                >
                  <span className={styles.depthStatusDot} style={{ background: STATUS_ACCENT[selectedCard.status] }} />
                  {STATUS_LABELS[selectedCard.status] || selectedCard.status.toUpperCase()}
                </div>
              </div>
              <button type="button" className={styles.closeBtn} title="Close panel" onClick={() => setSelectedCardId(null)}>
                <Close size={16} />
              </button>
            </div>

            {/* Actions stay above the fold on short screens — body may scroll. */}
            <div className={styles.depthActions}>
              {(selectedCard.status === 'running' || selectedCard.status === 'verifying') && (
                <Button status="danger" size="small" onClick={() => void handleTerminateMission()}>
                  Terminate
                </Button>
              )}
              <div className={styles.depthActionsRight}>
                <Button size="small" type="outline" onClick={() => void handleArchiveEntry(selectedCard)}>
                  Archive
                </Button>
                <Button size="small" type="primary" loading={starting} onClick={() => void handleRetryMission(selectedCard)}>
                  Retry
                </Button>
              </div>
            </div>

            <div className={styles.depthBody}>
              <div className={styles.depthMeta}>
                <div>
                  <div className={styles.fieldLabel}>Working directory</div>
                  <div className={styles.workingDir}>{selectedCard.workspaceRoot || workspaceRoot || 'App default'}</div>
                </div>
                <div>
                  <div className={styles.fieldLabel}>Progress</div>
                  <div>
                    {selectedProgress.total > 0
                      ? `${selectedProgress.done} / ${selectedProgress.total} tasks · ${selectedPct}%`
                      : '—'}
                  </div>
                </div>
              </div>

              {showFailurePanel ? (
                <details
                  className={styles.failurePanel}
                  open={selectedCard.status === 'failed' || selectedCard.status === 'blocked'}
                >
                  <summary className={styles.failureSummary}>
                    <span>Stack trace / diagnostics</span>
                    <span className={styles.failureMeta}>{STATUS_LABELS[selectedCard.status] || selectedCard.status}</span>
                  </summary>
                  <div className={styles.failureBody}>
                    {/* Prefer scheduler/system detail (richest), then mission summary. */}
                    {(selectedCard.systemFailures[0]?.detail || selectedCard.detail) ? (
                      <pre className={styles.diag}>
                        {selectedCard.systemFailures
                          .map((row) => (row.detail ? `[${row.title}] ${row.detail}` : null))
                          .filter(Boolean)
                          .join('\n\n')
                          || selectedCard.detail}
                      </pre>
                    ) : null}
                    {failedPlanTasks.some((t) => t.detail && !t.detail.startsWith('Mission failed.') && !t.detail.startsWith('Left ')) ? (
                      <div className={styles.failureBlock}>
                        <div className={styles.fieldLabel}>Failed steps</div>
                        <ul className={styles.failureStepList}>
                          {failedPlanTasks
                            .filter((t) => t.detail && !t.detail.startsWith('Mission failed.') && !t.detail.startsWith('Left '))
                            .map((task) => (
                              <li key={task.id}>
                                <strong>{task.title}</strong>
                                <pre className={styles.diag}>{task.detail}</pre>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}
                    {selectedCard.detail && selectedCard.systemFailures.some((r) => r.detail) ? (
                      <div className={styles.failureBlock}>
                        <div className={styles.fieldLabel}>Mission outcome</div>
                        <pre className={styles.diag}>{selectedCard.detail}</pre>
                      </div>
                    ) : null}
                    {!selectedCard.detail && selectedCard.systemFailures.length === 0 ? (
                      <p className={styles.failureEmpty}>
                        No failure detail was recorded. Newer runs capture step errors from the mission child.
                      </p>
                    ) : null}
                  </div>
                </details>
              ) : null}

              <div>
                <div className={styles.fieldLabel}>Tasks</div>
                <div className={styles.taskChecklistItems}>
                  {selectedCard.tasks.length > 0 ? (
                    selectedCard.tasks.map((task) => {
                      const expandable = Boolean(task.detail) || task.status === 'failed' || task.status === 'blocked';
                      if (!expandable) {
                        return (
                          <div
                            key={task.id}
                            className={`${styles.checklistItem} ${task.status === 'running' || task.status === 'verifying' ? styles.checklistActive : ''}`}
                          >
                            <span className={styles.checklistIcon}>{TASK_ICONS[task.status] ?? '·'}</span>
                            <span className={styles.checklistTitle}>{task.title}</span>
                            <span className={styles.checklistStatus}>{STATUS_LABELS[task.status] || task.status.toUpperCase()}</span>
                          </div>
                        );
                      }
                      return (
                        <details
                          key={task.id}
                          className={`${styles.checklistItem} ${styles.checklistExpandable} ${task.status === 'failed' || task.status === 'blocked' ? styles.checklistFailed : ''}`}
                          open={task.status === 'failed' || task.status === 'blocked'}
                        >
                          <summary className={styles.checklistSummary}>
                            <span className={styles.checklistIcon}>{TASK_ICONS[task.status] ?? '·'}</span>
                            <span className={styles.checklistTitle}>{task.title}</span>
                            <span className={styles.checklistStatus}>{STATUS_LABELS[task.status] || task.status.toUpperCase()}</span>
                          </summary>
                          <pre className={styles.taskDetail}>{task.detail || 'No step-level error was recorded.'}</pre>
                        </details>
                      );
                    })
                  ) : (
                    <div className={styles.emptyState}>
                      <span className={styles.emptyStateText}>No task activity recorded yet.</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className={styles.fieldLabel}>Live logs</div>
                <div className={styles.logs}>
                  {selectedLogs.length > 0 ? (
                    selectedLogs.map((line, i) => (
                      <div key={`${line.at}-${i}`} className={styles.logLine}>
                        <span className={styles.logTs}>{formatLogTime(line.at)}</span>
                        <span>{line.text}</span>
                      </div>
                    ))
                  ) : (
                    <div className={styles.logsEmpty}>No ledger events for this mission yet.</div>
                  )}
                </div>
              </div>
            </div>
          </aside>
        )}
      </section>

      {/* Modal 1: Launch New Agent */}
      <Modal
        visible={launchModalVisible}
        onCancel={handleLaunchModalClose}
        title="Launch New Agent"
        footer={[
          <Button key="cancel" onClick={handleLaunchModalClose}>Cancel</Button>,
          <Button key="generate" type="primary" loading={planning} onClick={() => void handleGenerateTasks()}>Generate Tasks</Button>,
        ]}
        style={{ top: 60 }}
      >
        <div className={styles.modalForm}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>WORKING DIRECTORY</label>
            <div className={styles.dirInputRow}>
              <Input value={workspaceRoot || ''} readOnly placeholder="Select a directory..." />
              <Button size="small" type="outline" onClick={handleSelectWorkspace}>Choose…</Button>
            </div>
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>MISSION</label>
            <div className={styles.missionTextareaRow}>
              <Input.TextArea
                placeholder="Describe the mission — type it or hold-to-talk."
                value={missionRequest}
                onChange={(v) => setMissionRequest(v)}
                autoSize={{ minRows: 4, maxRows: 8 }}
              />
              <VoiceInput onTranscript={(text) => setMissionRequest((prev) => (prev ? `${prev} ${text}` : text))} />
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Review Proposed Tasks */}
      <Modal
        visible={reviewModalVisible}
        onCancel={handleReviewDecline}
        title="Review Proposed Tasks"
        footer={[
          <Button key="decline" onClick={handleReviewDecline}>Decline</Button>,
          <Button key="regenerate" loading={planning} onClick={() => void handleRegeneratePlan()}>Regenerate Plan</Button>,
          <Button key="accept" type="primary" loading={starting} onClick={() => void handleReviewAccept()}>Accept & Launch</Button>,
        ]}
        style={{ top: 60 }}
      >
        <div className={styles.reviewModalContent}>
          <div className={styles.reviewPrompt}>
            <strong>Mission Objective:</strong>
            <p>{missionPrompt || 'No mission description provided.'}</p>
          </div>
          <div className={styles.taskList}>
            {proposedTasks.length > 0 ? (
              proposedTasks.map((task, index) => (
                <div className={styles.taskItem} key={index}>
                  <span className={styles.taskNumber}>{index + 1}.</span>
                  <span className={styles.taskTitle}>{task}</span>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <span className={styles.emptyStateText}>The planner returned no tasks — check the endpoint in Roles and try again.</span>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OperationsView;
