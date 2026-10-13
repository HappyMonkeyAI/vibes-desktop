import type { ActivityGroup, LedgerEntry } from './channels';

/**
 * Derives the activity group for an entry — ported verbatim from the fork's
 * TaskLedgerService.classify (wayland-fork src/process/services/missionControl).
 * The approval-provenance branch is dropped: v1 has a single source and no
 * approvals flow (ADR-0003).
 */
export function classify(entry: Pick<LedgerEntry, 'status' | 'needsHuman' | 'nextRunAtMs'>): ActivityGroup {
  if (entry.needsHuman || ['blocked', 'failed', 'zombie'].includes(entry.status)) return 'needs-you';
  if (entry.status === 'running' || entry.status === 'verifying') return 'running';
  if (entry.status === 'pending' && entry.nextRunAtMs !== undefined) return 'upcoming';
  return 'recent';
}
