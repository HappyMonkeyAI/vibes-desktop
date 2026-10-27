import fs from 'node:fs';
import path from 'node:path';
import type { DistilledHarnessLesson, PersistedHarnessLesson } from '@shared/harnessLesson';

const FILE_NAME = 'harness-lesson.json';

export function harnessLessonPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vibes', FILE_NAME);
}

/** Persist the single latest harness lesson for this workspace (overwrite). */
export function writeHarnessLesson(
  workspaceRoot: string,
  distilled: DistilledHarnessLesson | string,
  missionTitle: string,
): PersistedHarnessLesson | null {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return null;
  const lessonText = typeof distilled === 'string' ? distilled.trim() : distilled.lesson.trim();
  if (!lessonText) return null;
  const record: PersistedHarnessLesson = {
    v: 2,
    at: Date.now(),
    missionTitle: missionTitle.trim().slice(0, 200) || 'mission',
    lesson: lessonText.slice(0, 400),
    helped: typeof distilled === 'string' ? undefined : distilled.helped.slice(0, 200),
    failed: typeof distilled === 'string' ? undefined : distilled.failed.slice(0, 200),
    harnessClass: typeof distilled === 'string' ? null : distilled.harnessClass,
  };
  try {
    const target = harnessLessonPath(workspaceRoot);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    return record;
  } catch {
    return null;
  }
}

export function readHarnessLesson(workspaceRoot: string): PersistedHarnessLesson | null {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return null;
  try {
    const target = harnessLessonPath(workspaceRoot);
    if (!fs.existsSync(target)) return null;
    const raw = JSON.parse(fs.readFileSync(target, 'utf8')) as Partial<PersistedHarnessLesson>;
    if ((raw?.v !== 1 && raw?.v !== 2) || typeof raw.lesson !== 'string' || !raw.lesson.trim()) {
      return null;
    }
    return {
      v: raw.v === 2 ? 2 : 1,
      at: typeof raw.at === 'number' ? raw.at : 0,
      missionTitle: typeof raw.missionTitle === 'string' ? raw.missionTitle : 'mission',
      lesson: raw.lesson.trim(),
      helped: typeof raw.helped === 'string' ? raw.helped.trim() : undefined,
      failed: typeof raw.failed === 'string' ? raw.failed.trim() : undefined,
      harnessClass: typeof raw.harnessClass === 'string' ? raw.harnessClass : raw.harnessClass === null ? null : undefined,
    };
  } catch {
    return null;
  }
}
