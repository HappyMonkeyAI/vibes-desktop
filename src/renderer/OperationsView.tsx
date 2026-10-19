import React, { useEffect, useState } from 'react';
import type { LedgerEntry, LedgerSnapshot, WorkspaceHistoryEntry } from '@shared/channels';
import { Button, Input, Modal, Message, Select } from '@arco-design/web-react';
import { Plus, Close } from '@icon-park/react';
import VoiceInput from './VoiceInput';
import styles from './OperationsView.module.css';

/** Accent color per status — ported from the fork's mission-control page. */
const STATUS_ACCENT: Record<string, string> = {
  running: '#ff6b35',
  verifying: '#b07bff',
  failed: '#ff4d4f',
  zombie: '#c0392b',
  blocked: '#ff9f43',
  pending: '#5b8def',
  done: '#2ec27e',
  idle: '#7a818c',
  archived: '#b0b0b0',
};

/** Status badge labels for the card view */
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

/** Checklist icons for the detail modal's live task list. */
const TASK_ICONS: Record<string, string> = {
  running: '⏳',
  verifying: '🔍',
  done: '✅',
  failed: '❌',
  blocked: '⛔',
  zombie: '💀',
  pending: '◻️',
  idle: '·',
};

/** A mission card: one per mission row, carrying that mission's task rows
 *  (matched by missionId, never by a global title or workspace collision). */
type MissionCard = {
  id: string;
  missionId?: string;
  title: string;
  status: LedgerEntry['status'];
  workspaceRoot?: string;
  updatedAt: number;
  tasks: LedgerEntry[];
};

/** Format timestamp to readable date string */
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * OperationsView — the card-based Operations canvas with modal workflow.
 * One card per mission (mission-level ledger row); task rows group under their
 * own mission via missionId.
 */
const OperationsView: React.FC = () => {
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [missionRequest, setMissionRequest] = useState('');
  const [starting, setStarting] = useState(false);
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [workspaceHistory, setWorkspaceHistory] = useState<WorkspaceHistoryEntry[]>([]);
  const [voiceReady, setVoiceReady] = useState<boolean | null>(null);

  // Modal state
  const [launchModalVisible, setLaunchModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState<MissionCard | null>(null);
  const [missionPrompt, setMissionPrompt] = useState('');
  const [proposedTasks, setProposedTasks] = useState<string[]>([]);
  const [planning, setPlanning] = useState(false);

  // Recent working directories for the picker.
  const refreshHistory = async () => {
    try {
      setWorkspaceHistory(await window.vibesDesktop.workspace.history.get());
    } catch {
      // History failing is non-fatal — the picker still offers Choose…
    }
  };

  useEffect(() => {
    void refreshHistory();
  }, []);

  // Handle workspace selection via the native dialog.
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

  // Handle workspace selection from the recent-directories dropdown.
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

  // Voice doctor on mount
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await window.vibesDesktop.voice.doctor();
        if (!cancelled) setVoiceReady(result.ready);
      } catch {
        // Doctor failing is non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
        // The service resolves as soon as the mission is dispatched — the
        // ledger streams live task updates from here on.
        Message.success('Mission started');
        setMissionRequest('');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  };

  // Launch New Agent Modal handlers
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

  // Review Modal handlers — Accept launches the SAME plan the user reviewed
  // (the planning child is kept alive by the service until accept or decline).
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
    // Discard the reviewed plan so its child doesn't linger.
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

  // Detail Modal handlers
  const handleRowClick = (card: MissionCard) => {
    setSelectedCard(card);
    setDetailModalVisible(true);
  };
  const handleCloseDetailModal = () => {
    setDetailModalVisible(false);
    setSelectedCard(null);
  };

  // Archive entry handler — archives the mission card row plus its task rows.
  const handleArchiveEntry = async (card: MissionCard) => {
    try {
      const ids = [card.id, ...card.tasks.map((t) => t.id)];
      const result = await window.vibesDesktop.ledger.archive(ids);
      if (result.ok) {
        // The ledger subscription will update the snapshot with the archived
        // entries and they drop out of the active view.
        Message.success('Mission archived');
      } else {
        Message.error(result.error || 'Failed to archive mission');
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to archive mission');
    }
  };

  // Retry mission handler — the card title IS the original request, so a retry
  // re-runs exactly what the user asked for.
  const handleRetryMission = async () => {
    if (!selectedCard || starting) return;
    setStarting(true);
    try {
      const result = await window.vibesDesktop.mission.start({
        request: selectedCard.title,
        workspaceRoot: selectedCard.workspaceRoot || workspaceRoot || undefined,
      });
      if (result.alreadyRunning) Message.warning('A mission is already running.');
      else if (!result.started && result.error) Message.error(result.error);
      else if (result.started) {
        Message.success('Mission restarted');
        handleCloseDetailModal();
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  };

  // Terminate mission handler — only meaningful while a mission runs; the
  // service records the stop itself (blocked rows), one toast here, no more.
  const handleTerminateMission = async () => {
    if (!selectedCard) return;
    if (selectedCard.status === 'running' || selectedCard.status === 'verifying') {
      try {
        await window.vibesDesktop.mission.stop();
        Message.success('Mission terminated');
        handleCloseDetailModal();
      } catch (error) {
        Message.error(error instanceof Error ? error.message : 'Failed to terminate mission');
      }
    } else {
      Message.info('Mission is not currently running');
    }
  };

  // Live stop from the toolbar.
  const handleStopMission = async () => {
    try {
      await window.vibesDesktop.mission.stop();
      Message.success('Mission terminated');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : 'Failed to terminate mission');
    }
  };

  // Ledger data filtered to non-archived entries.
  const [filteredSnapshot, setFilteredSnapshot] = useState<LedgerSnapshot | null>(null);

  useEffect(() => {
    if (!snapshot) {
      setFilteredSnapshot(null);
      return;
    }
    const activeEntries = snapshot.entries.filter((e) => e.status !== 'archived');
    setFilteredSnapshot({
      ...snapshot,
      entries: activeEntries,
    });
  }, [snapshot]);

  const entries = filteredSnapshot?.entries ?? snapshot?.entries ?? [];

  /** Group ledger rows into mission cards: one card per mission-level row,
   *  carrying that mission's task rows (matched by missionId). */
  const cards: MissionCard[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'mission') continue;
    cards.push({
      id: entry.id,
      missionId: entry.missionId,
      title: entry.title,
      status: entry.status,
      workspaceRoot: entry.workspaceRoot,
      updatedAt: entry.updatedAt,
      tasks: entry.missionId
        ? entries.filter((e) => e.kind !== 'mission' && e.missionId === entry.missionId)
        : [],
    });
  }

  const hasRunning = cards.some((c) => c.status === 'running' || c.status === 'verifying');

  /** Progress for a card's task rows. */
  const progressOf = (tasks: LedgerEntry[]) => {
    const done = tasks.filter((t) => t.status === 'done').length;
    return { done, total: tasks.length };
  };

  // Ledger subscription.
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const snap = (await window.vibesDesktop.ledger.get()) as LedgerSnapshot;
        setSnapshot(snap);
        unsubscribe = window.vibesDesktop.ledger.onNewEntry(({ entry }) => {
          setSnapshot((prev) => {
            if (!prev) return prev;
            const rest = prev.entries.filter((e) => e.id !== entry.id);
            const entries = [...rest, entry];
            return { entries, groupCounts: prev.groupCounts };
          });
        });
      } catch (error) {
        Message.error(error instanceof Error ? error.message : 'Failed to load the activity ledger.');
      }
    })();
    return () => unsubscribe?.();
  }, []);

  // Compute summary metrics from the grouped cards.
  const activeCount = cards.filter((c) => c.status === 'running' || c.status === 'verifying').length;
  const completedCount = cards.filter((c) => c.status === 'done').length;
  const tasksDoneCount = cards.reduce((sum, c) => sum + progressOf(c.tasks).done, 0);

  return (
    <div className={styles.ops}>
      {/* Summary Bar */}
      <div className={styles.summaryBar}>
        <div className={`${styles.metricCard} ${styles.metricActive}`}>
          <div className={styles.metricValue}>{activeCount}</div>
          <div className={styles.metricLabel}>ACTIVE</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricCompleted}`}>
          <div className={styles.metricValue}>{completedCount}</div>
          <div className={styles.metricLabel}>COMPLETED</div>
        </div>
        <div className={`${styles.metricCard} ${styles.metricTasks}`}>
          <div className={styles.metricValue}>{tasksDoneCount}</div>
          <div className={styles.metricLabel}>TASKS DONE</div>
        </div>
      </div>

      {/* Launch New Agent Card + Mission Cards Grid — the Launch card is always
          reachable, including the first-launch empty state. */}
      {cards.length === 0 ? (
        <>
          {/* ADR-0003: first launch is clean — "All quiet", never an error banner. */}
          <div className={styles.empty}>
            <span className={styles.emptyTitle}>All quiet</span>
            <span className={styles.emptyHint}>No missions yet. Launch a new agent to get started.</span>
          </div>
          <div className={styles.cardGrid}>
            <button className={styles.launchCard} onClick={handleLaunchModalOpen}>
              <Plus size={32} className={styles.launchIcon} />
              <span className={styles.launchLabel}>Launch New Agent</span>
            </button>
          </div>
        </>
      ) : (
        <div className={styles.cardGrid}>
          {/* Launch New Agent Card */}
          <button className={styles.launchCard} onClick={handleLaunchModalOpen}>
            <Plus size={32} className={styles.launchIcon} />
            <span className={styles.launchLabel}>Launch New Agent</span>
          </button>

          {/* Mission Status Cards */}
          {cards.map((card) => {
            const progress = progressOf(card.tasks);
            const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : (card.status === 'done' ? 100 : 0);
            return (
              <div
                key={card.id}
                className={`${styles.missionCard} ${card.status === 'running' || card.status === 'verifying' ? styles.runningMission : ''}`}
                onClick={() => handleRowClick(card)}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>{card.title}</span>
                  <button className={styles.closeBtn} title="Archive mission" onClick={(e) => { e.stopPropagation(); void handleArchiveEntry(card); }}>
                    <Close size={14} />
                  </button>
                </div>
                <div className={styles.statusBadge} style={{ '--accent': STATUS_ACCENT[card.status] ?? '#7a818c' } as any}>
                  {STATUS_LABELS[card.status] || card.status.toUpperCase()}
                </div>
                <div className={styles.workingDir}>
                  {card.workspaceRoot || 'App default'}
                </div>
                <div className={styles.progressTracker}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </div>
                  <span className={styles.progressText}>
                    {progress.total > 0 ? `${progress.done} / ${progress.total} tasks (${pct}%)` : 'no task activity yet'}
                  </span>
                </div>
                <div className={styles.missionDate}>
                  {formatDate(card.updatedAt)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toolbar */}
      <div className={styles.opsToolbar}>
        <span className={styles.live}>
          <span className={styles.liveDot} />
          Live
        </span>
        {voiceReady === false && (
          <span className={styles.voiceNotReady}>voice not ready</span>
        )}
      </div>

      <div className={styles.workspacePickerRow}>
        <span className={styles.workspacePickerLabel}>WORKING DIRECTORY</span>
        <div className={styles.workspacePickerInput}>
          <Select
            placeholder="Select a directory..."
            value={workspaceRoot || undefined}
            onChange={(v) => handlePickRecent(String(v))}
            allowClear
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
      </div>

      <div className={styles.composerRow}>
        <div className={styles.missionInput}>
          <Input.TextArea
            placeholder="Describe the mission — type it or hold-to-talk."
            value={missionRequest}
            onChange={(v) => setMissionRequest(v)}
            autoSize={{ minRows: 2, maxRows: 6 }}
          />
        </div>
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
          <Button status="warning" onClick={() => void handleStopMission()}>
            Stop mission
          </Button>
        )}
      </div>

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

      {/* Modal 3: Work-In-Progress & Execution Details */}
      <Modal
        visible={detailModalVisible}
        onCancel={handleCloseDetailModal}
        footer={[
          <Button key="close" onClick={handleCloseDetailModal}>Close</Button>,
          <Button key="retry" loading={starting} onClick={() => void handleRetryMission()}>Retry Mission</Button>,
          ...(selectedCard && (selectedCard.status === 'running' || selectedCard.status === 'verifying')
            ? [<Button key="terminate" status="warning" onClick={() => void handleTerminateMission()}>Terminate</Button>]
            : []),
        ]}
        style={{ top: 40, width: 700 }}
      >
        {selectedCard && (
          <div className={styles.detailModal}>
            {/* Header Navigation */}
            <div className={styles.detailHeader}>
              <button className={styles.backBtn} onClick={handleCloseDetailModal}>
                <Close size={18} />
              </button>
              <h3 className={styles.detailTitle}>{selectedCard.title}</h3>
            </div>

            {/* Stats Strip */}
            <div className={styles.statsStrip}>
              <div className={styles.statBox}>
                <div className={styles.statBoxLabel}>STATUS</div>
                <div className={styles.statBoxValue} style={{ color: STATUS_ACCENT[selectedCard.status] }}>
                  {selectedCard.status.toUpperCase()}
                </div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statBoxLabel}>PROGRESS</div>
                <div className={styles.statBoxValue}>
                  {progressOf(selectedCard.tasks).total > 0
                    ? `${Math.round((progressOf(selectedCard.tasks).done / progressOf(selectedCard.tasks).total) * 100)}%`
                    : '—'}
                </div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statBoxLabel}>WORKING DIRECTORY</div>
                <div className={styles.statBoxValue}>{selectedCard.workspaceRoot || workspaceRoot || 'App default'}</div>
              </div>
              <div className={styles.statBox}>
                <div className={styles.statBoxLabel}>LAST UPDATED</div>
                <div className={styles.statBoxValue}>{formatDate(selectedCard.updatedAt)}</div>
              </div>
            </div>

            {/* Goal Box */}
            <div className={styles.goalBox}>
              <div className={styles.goalBoxLabel}>GOAL</div>
              <div className={styles.goalBoxContent}>{selectedCard.title}</div>
            </div>

            {/* Live Task Checklist — real task rows from the ledger */}
            <div className={styles.taskChecklist}>
              <div className={styles.taskChecklistLabel}>TASKS</div>
              <div className={styles.taskChecklistItems}>
                {selectedCard.tasks.length > 0 ? (
                  selectedCard.tasks.map((task) => (
                    <div className={styles.checklistItem} key={task.id}>
                      <span className={styles.checklistIcon}>{TASK_ICONS[task.status] ?? '·'}</span>
                      <span className={styles.checklistTitle}>{task.title}</span>
                      <span className={styles.checklistStatus}>{STATUS_LABELS[task.status] || task.status.toUpperCase()}</span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyState}>
                    <span className={styles.emptyStateText}>No task activity recorded yet.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OperationsView;
