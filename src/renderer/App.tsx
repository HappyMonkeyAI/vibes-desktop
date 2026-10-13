import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Button, Input, Message, Tabs } from '@arco-design/web-react';
import { FolderOpen, RadarTwo } from '@icon-park/react';
import type { LedgerEntry, LedgerSnapshot } from '@shared/channels';
import { useActivityPagination } from './useActivityPagination';
import { PaginationControls } from './PaginationControls';
import RolesTab from './RolesTab';
import VoiceInput from './VoiceInput';
import styles from './MissionControl.module.css';

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
};

/** CSS custom properties are not in the csstype map; widen for --accent. */
type AccentStyle = CSSProperties & Record<`--${string}`, string>;

const GROUPS: Array<{ group: string; label: string }> = [
  { group: 'needs-you', label: 'Needs you' },
  { group: 'running', label: 'Running' },
  { group: 'upcoming', label: 'Upcoming' },
  { group: 'recent', label: 'Recent' },
];

const Row: React.FC<{ entry: LedgerEntry }> = ({ entry }) => (
  <div className={styles.row} style={{ '--accent': STATUS_ACCENT[entry.status] ?? '#7a818c' } as AccentStyle}>
    <span className={`${styles.dot} ${entry.status === 'running' || entry.status === 'verifying' ? styles.dotLive : ''}`} />
    <div className={styles.main}>
      <span className={styles.rowTitle}>{entry.title}</span>
      {entry.detail ? <span className={styles.rowSub}>{entry.detail}</span> : null}
    </div>
    <span className={styles.pill} style={{ '--accent': STATUS_ACCENT[entry.status] ?? '#7a818c' } as AccentStyle}>
      {entry.status}
    </span>
  </div>
);

const OperationsView: React.FC = () => {
  const [snapshot, setSnapshot] = useState<LedgerSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [missionRequest, setMissionRequest] = useState('');
  const [starting, setStarting] = useState(false);
  // The mission's working directory. Empty means "the app's cwd" — the user can
  // point it anywhere with the native folder picker.
  const [workspaceRoot, setWorkspaceRoot] = useState('');

  const handleSelectWorkspace = async () => {
    try {
      const res = await window.vibesDesktop.workspace.select();
      if (res.path) setWorkspaceRoot(res.path);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const handleStart = async () => {
    const request = missionRequest.trim();
    if (!request || starting) return;
    setStarting(true);
    try {
      const result = await window.vibesDesktop.mission.start({ request, workspaceRoot: workspaceRoot || undefined });
      if (result.alreadyRunning) Message.warning('A mission is already running.');
      else if (!result.started && result.error) Message.error(result.error);
      // On success the live ledger begins filling on its own — no banner needed.
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setStarting(false);
    }
  };

  const entries = snapshot?.entries ?? [];
  const groupCounts = snapshot?.groupCounts ?? { 'needs-you': 0, running: 0, upcoming: 0, recent: 0 };
  // T13/T14 — a Stop control appears while any task is in flight.
  const hasRunning = entries.some((e) => e.status === 'running' || e.status === 'verifying');

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      try {
        const snap = (await window.vibesDesktop.ledger.get()) as LedgerSnapshot;
        setSnapshot(snap);
        unsubscribe = window.vibesDesktop.ledger.onNewEntry(({ entry }) => {
          setSnapshot((prev) => {
            if (!prev) return prev;
            // Upsert by id: a task updated in place (running → done) replaces its row,
            // never duplicates it. Counts are derived from the entries, not accumulated.
            const rest = prev.entries.filter((e) => e.id !== entry.id);
            const entries = [...rest, entry];
            const groupCounts: LedgerSnapshot['groupCounts'] = { 'needs-you': 0, running: 0, upcoming: 0, recent: 0 };
            for (const e of entries) groupCounts[e.group] += 1;
            return { entries, groupCounts };
          });
        });
      } finally {
        setLoading(false);
      }
    })();
    return () => unsubscribe?.();
  }, []);

  // Windowed rendering (T6): only a page of rows mounts at a time. The reset key
  // is the entry-id list — any change to the set returns the window to page 0.
  const windowResetKey = useMemo(() => entries.map((entry) => entry.id).join('|'), [entries]);
  const pagination = useActivityPagination(entries, windowResetKey);

  return (
    <div className={styles.ops}>
      <div className={styles.opsToolbar}>
        <span className={styles.live}>
          <span className={styles.liveDot} />
          Live
        </span>
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
        <Button type="primary" loading={starting} disabled={!missionRequest.trim()} onClick={() => void handleStart()}>
          Start mission
        </Button>
        {hasRunning && (
          <Button status="warning" onClick={() => void window.vibesDesktop.mission.stop()}>
            Stop mission
          </Button>
        )}
        <Button size="small" loading={loading} onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </div>
      <div className={styles.workspaceRow}>
        <FolderOpen size={14} className={styles.workspaceIcon} />
        <span className={styles.workspaceLabel}>Working directory</span>
        <span className={styles.workspacePath} title={workspaceRoot || undefined}>
          {workspaceRoot || 'App default (mission root)'}
        </span>
        <Button size="mini" type="outline" onClick={() => void handleSelectWorkspace()}>
          Choose…
        </Button>
        {workspaceRoot && (
          <Button size="mini" type="text" onClick={() => setWorkspaceRoot('')}>
            Clear
          </Button>
        )}
      </div>

      <div className={styles.statRow}>
        {GROUPS.map(({ group, label }) => {
          const count = groupCounts[group as keyof typeof groupCounts] ?? 0;
          return (
            <div key={group} className={`${styles.statTile} ${count === 0 ? styles.zero : ''}`} style={{ '--accent': STATUS_ACCENT[group === 'needs-you' ? 'failed' : group] ?? '#7a818c' } as AccentStyle}>
              <span className={styles.statNum}>{count}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
          );
        })}
      </div>

      {entries.length === 0 ? (
        // ADR-0003: a single-source ledger renders "All quiet", never an error banner.
        <div className={styles.empty}>
          <RadarTwo className={styles.emptyRadar} size={56} />
          <span className={styles.emptyTitle}>All quiet</span>
          <span className={styles.emptyHint}>Missions appear here the moment they start.</span>
        </div>
      ) : (
        <>
          <div id="mission-control-activity-window">
            {GROUPS.map(({ group, label }) => {
              const sectionEntries = pagination.visibleItems.filter((entry) => entry.group === group);
              if (sectionEntries.length === 0) return null;
              return (
                <div key={group} className={styles.section}>
                  <div className={styles.sectionHead} style={{ '--accent': STATUS_ACCENT[group === 'needs-you' ? 'failed' : group] ?? '#7a818c' } as AccentStyle}>
                    <span className={styles.sectionDot} />
                    <span className={styles.sectionLabel}>{label}</span>
                    <span className={styles.sectionCount}>{groupCounts[group as keyof typeof groupCounts] ?? 0}</span>
                  </div>
                  {sectionEntries.map((entry) => (
                    <Row key={entry.id} entry={entry} />
                  ))}
                </div>
              );
            })}
          </div>
          <PaginationControls
            totalCount={pagination.totalCount}
            remainingCount={pagination.remainingCount}
            pageSize={pagination.pageSize}
            firstVisibleIndex={pagination.firstVisibleIndex}
            lastVisibleIndex={pagination.lastVisibleIndex}
            hasPrevious={pagination.hasPrevious}
            hasMore={pagination.hasMore}
            onNextPage={pagination.nextPage}
            onPreviousPage={pagination.previousPage}
          />
        </>
      )}
    </div>
  );
};

const App: React.FC = () => (
  <div className={styles.page}>
    {/* Arco static Message API mounts here — required on React 18+ where ReactDOM.render is gone. */}
    <Message />
    <header className={styles.header}>
      <h1>Mission Control</h1>
      <span className={styles.subtitle}>Vibes missions, live in one place.</span>
    </header>
    <Tabs defaultActiveTab="operations">
      <Tabs.TabPane key="operations" title="Operations">
        <OperationsView />
      </Tabs.TabPane>
      <Tabs.TabPane key="roles" title="Roles">
        <RolesTab />
      </Tabs.TabPane>
    </Tabs>
  </div>
);

export default App;
