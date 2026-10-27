/**
 * Harness²-lite (T35) + OO-Harness-lite (T46): distill ONE process-level lesson
 * from a failed mission, with helped/failed design notes for the Retry seed.
 */

export type HarnessLessonInput = {
  missionTitle?: string;
  missionDetail?: string;
  systemFailures?: Array<{ title: string; detail?: string }>;
  failedTasks?: Array<{ title: string; detail?: string }>;
};

export type DistilledHarnessLesson = {
  lesson: string;
  /** What to keep doing on retry (OO-Harness “design lesson” — helped). */
  helped: string;
  /** What not to repeat (OO-Harness — failed). */
  failed: string;
  /** Fingerprint class for optional routing / subclass hints. */
  harnessClass: string | null;
};

const SKIP = /^(Left |Mission failed\.|Mission completed)/i;

/** Map known failure fingerprints to harness-facing advice. */
const ADVICE: Array<{
  test: RegExp;
  harnessClass: string;
  lesson: string;
  helped: string;
  failed: string;
}> = [
  {
    test: /css_orphan|stylesheet|styles\.css/i,
    harnessClass: 'css_orphan',
    lesson: 'Harness: before finishing CSS work, confirm HTML <link> (or import) references the stylesheet by basename.',
    helped: 'Verify HTML↔CSS linkage before marking style tasks done.',
    failed: 'Declaring CSS complete while the page never loads the stylesheet.',
  },
  {
    test: /done but not credited|ghost|evidence handoff|requeue/i,
    harnessClass: 'evidence_handoff',
    lesson: 'Harness: never leave a task done without completing the evidence handoff / completedTasks credit.',
    helped: 'Complete evidence handoff so done tasks stay credited.',
    failed: 'Leaving ghost-done tasks that block dependents.',
  },
  {
    test: /owner adversary|malformed|completion gate/i,
    harnessClass: 'completion_gate',
    lesson: 'Harness: treat malformed Owner reviews as advisory; only fail on explicit approved:false or missing evidence.',
    helped: 'Soft-pass malformed Owner JSON; require explicit rejection.',
    failed: 'Failing the mission on unverified/malformed adversary output.',
  },
  {
    test: /circular depends_on|dependency deadlock/i,
    harnessClass: 'dependency_deadlock',
    lesson: 'Harness: when dependents stall, check ghost done/failed prerequisites before blaming circular depends_on.',
    helped: 'Inspect prerequisite credit before rewiring depends_on.',
    failed: 'Treating ghost-done stalls as circular dependency essays.',
  },
  {
    test: /ENOENT|npm\.cmd|not recognized/i,
    harnessClass: 'toolchain_missing',
    lesson: 'Harness: skip dummy package scripts on non-Node workspaces; verify toolchain exists before npm verify.',
    helped: 'Preflight toolchain presence for Node/npm verify steps.',
    failed: 'Running npm verify when the workspace has no Node toolchain.',
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
 * Structured distill (T46). Returns null when there is nothing actionable.
 */
export function distillHarnessLessonRecord(input: HarnessLessonInput): DistilledHarnessLesson | null {
  const detail = firstUsefulDetail(input);
  if (!detail) return null;

  for (const rule of ADVICE) {
    if (rule.test.test(detail)) {
      return {
        lesson: rule.lesson.slice(0, 280),
        helped: rule.helped.slice(0, 200),
        failed: rule.failed.slice(0, 200),
        harnessClass: rule.harnessClass,
      };
    }
  }

  const compact = detail.replace(/\s+/g, ' ').slice(0, 200);
  return {
    lesson: `Harness: on retry, avoid repeating — ${compact}`.slice(0, 280),
    helped: 'Reuse any steps that already reached done with evidence.',
    failed: compact.slice(0, 200),
    harnessClass: null,
  };
}

/** String-only distill for callers that only need the primary line (T35 compat). */
export function distillHarnessLesson(input: HarnessLessonInput): string | null {
  return distillHarnessLessonRecord(input)?.lesson ?? null;
}

export type PersistedHarnessLesson = {
  /** v1 = lesson only; v2 = + helped/failed/harnessClass (OO-Harness-lite). */
  v: 1 | 2;
  at: number;
  missionTitle: string;
  lesson: string;
  helped?: string;
  failed?: string;
  harnessClass?: string | null;
};

/** Format helped/failed into a Retry-seed block (keeps primary lesson first). */
export function formatHarnessLessonForRetry(record: {
  lesson: string;
  helped?: string;
  failed?: string;
}): string {
  const lines = [record.lesson.trim()];
  const helped = record.helped?.trim();
  const failed = record.failed?.trim();
  if (helped) lines.push(`Keep: ${helped}`);
  if (failed) lines.push(`Avoid: ${failed}`);
  return lines.join('\n').slice(0, 500);
}
