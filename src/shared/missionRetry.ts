/**
 * Dimakis-style "forget except best": when Retrying a failed mission, seed the
 * new plan with the original request plus a short lesson from the prior run —
 * not the full ledger transcript.
 */

export type RetrySeedInput = {
  title: string;
  missionDetail?: string;
  systemFailures?: Array<{ title: string; detail?: string }>;
  failedTasks?: Array<{ title: string; detail?: string }>;
  doneTaskTitles?: string[];
};

const SKIP_DETAIL = /^(Left |Mission failed\.)/;
const PRIOR_MARKER = /\n---\nPrior attempt/;

/** Strip nested retry lessons so Retry of a Retry does not stack essays. */
export function cleanMissionTitle(title: string): string {
  const cut = title.search(PRIOR_MARKER);
  return (cut >= 0 ? title.slice(0, cut) : title).trim();
}

export function buildRetryRequest(input: RetrySeedInput): string {
  const title = cleanMissionTitle(input.title);
  if (!title) return '';

  const lessons: string[] = [];
  const missionDetail = input.missionDetail?.trim();
  // Prefer a short outcome line; drop nested prior-attempt essays from detail.
  if (missionDetail) {
    const cleaned = cleanMissionTitle(missionDetail);
    const firstLine = cleaned.split(/\n/)[0]?.trim();
    if (firstLine && !PRIOR_MARKER.test(`\n${firstLine}`)) lessons.push(firstLine.slice(0, 400));
  }

  for (const row of input.systemFailures ?? []) {
    const detail = row.detail?.trim();
    if (!detail) continue;
    // Prefer the actionable ghost-done hint over the misleading circular-deps essay.
    const short = detail.includes('done but not credited')
      ? detail.slice(0, 500)
      : detail.replace(/\s+/g, ' ').slice(0, 400);
    lessons.push(`[${row.title}] ${short}`);
  }

  for (const task of input.failedTasks ?? []) {
    const detail = task.detail?.trim();
    if (!detail || SKIP_DETAIL.test(detail)) continue;
    lessons.push(`Failed step "${task.title}": ${detail.slice(0, 300)}`);
  }

  const unique = [...new Set(lessons)].slice(0, 3);
  const best = (input.doneTaskTitles ?? []).filter(Boolean).slice(0, 5);

  if (unique.length === 0 && best.length === 0) return title;

  const parts = [
    title,
    '',
    '---',
    'Prior attempt — keep ONLY this lesson (ignore earlier chat/history):',
  ];
  if (best.length > 0) {
    parts.push(`Best progress so far: ${best.join('; ')}`);
  }
  parts.push(...unique);
  return parts.join('\n');
}
