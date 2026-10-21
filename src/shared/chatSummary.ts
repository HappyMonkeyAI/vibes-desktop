import type { LedgerEntry } from './channels';

/** Build the phase-1 completion/failure comment for the Chat transcript. */
export function buildChatMissionSummary(opts: {
  request: string;
  mission?: LedgerEntry;
  tasks: LedgerEntry[];
}): string {
  const planTasks = opts.tasks.filter((t) => t.title !== 'Mission Scheduler');
  const done = planTasks.filter((t) => t.status === 'done').length;
  const failed = planTasks.filter((t) => t.status === 'failed' || t.status === 'blocked');
  const status = opts.mission?.status ?? (failed.length > 0 ? 'failed' : 'done');
  const title = opts.request.trim() || opts.mission?.title || 'Mission';

  if (status === 'done' || status === 'archived') {
    const names = planTasks.filter((t) => t.status === 'done').map((t) => t.title);
    const list = names.length ? names.map((n) => `• ${n}`).join('\n') : '• (no task titles recorded)';
    return `Finished — ${done}/${planTasks.length || done} steps complete.\n${list}`;
  }

  const why =
    opts.mission?.detail ||
    failed.map((t) => t.detail || t.title).filter(Boolean)[0] ||
    'Mission ended without a detail string.';
  const failedList = failed.length
    ? failed.map((t) => `• ${t.title}${t.detail ? ` — ${t.detail}` : ''}`).join('\n')
    : '';
  return `Stopped (${status}) on “${title.slice(0, 80)}${title.length > 80 ? '…' : ''}” — ${done}/${planTasks.length} done.\n${why}${failedList ? `\n${failedList}` : ''}`;
}
