/**
 * Harness²-lite (T35): distill ONE process-level lesson from a failed mission.
 * Not a full harness rewrite — a short note the Retry seed (and `.vibes`) can keep.
 */

export type HarnessLessonInput = {
  missionTitle?: string;
  missionDetail?: string;
  systemFailures?: Array<{ title: string; detail?: string }>;
  failedTasks?: Array<{ title: string; detail?: string }>;
};

const SKIP = /^(Left |Mission failed\.|Mission completed)/i;

/** Map known failure fingerprints to harness-facing advice. */
const ADVICE: Array<{ test: RegExp; lesson: string }> = [
  {
    test: /css_orphan|stylesheet|styles\.css/i,
    lesson: 'Harness: before finishing CSS work, confirm HTML <link> (or import) references the stylesheet by basename.',
  },
  {
    test: /done but not credited|ghost|evidence handoff|requeue/i,
    lesson: 'Harness: never leave a task done without completing the evidence handoff / completedTasks credit.',
  },
  {
    test: /owner adversary|malformed|completion gate/i,
    lesson: 'Harness: treat malformed Owner reviews as advisory; only fail on explicit approved:false or missing evidence.',
  },
  {
    test: /circular depends_on|dependency deadlock/i,
    lesson: 'Harness: when dependents stall, check ghost done/failed prerequisites before blaming circular depends_on.',
  },
  {
    test: /ENOENT|npm\.cmd|not recognized/i,
    lesson: 'Harness: skip dummy package scripts on non-Node workspaces; verify toolchain exists before npm verify.',
  },
];

function firstUsefulDetail(input: HarnessLessonInput): string | null {
  for (const row of input.systemFailures ?? []) {
    const d = row.detail?.trim();
    if (d && !SKIP.test(d)) return d;
  }
  for (const row of input.failedTasks ?? []) {
    const d = row.detail?.trim();
    if (d && !SKIP.test(d)) return `${row.title}: ${d}`;
  }
  const mission = input.missionDetail?.trim();
  if (mission && !SKIP.test(mission)) return mission.split(/\n/)[0]?.trim() || null;
  return null;
}

/**
 * Produce at most one harness lesson. Returns null when there is nothing actionable.
 */
export function distillHarnessLesson(input: HarnessLessonInput): string | null {
  const detail = firstUsefulDetail(input);
  if (!detail) return null;

  for (const rule of ADVICE) {
    if (rule.test.test(detail)) return rule.lesson.slice(0, 280);
  }

  // Generic: frame the failure as a harness note, not a transcript dump.
  const compact = detail.replace(/\s+/g, ' ').slice(0, 200);
  return `Harness: on retry, avoid repeating — ${compact}`;
}

export type PersistedHarnessLesson = {
  v: 1;
  at: number;
  missionTitle: string;
  lesson: string;
};
