import fs from 'node:fs';
import path from 'node:path';
import type { PersistedHarnessLesson } from '@shared/harnessLesson';

const FILE_NAME = 'harness-lesson.json';

export function harnessLessonPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.vibes', FILE_NAME);
}

/** Persist the single latest harness lesson for this workspace (overwrite). */
export function writeHarnessLesson(
  workspaceRoot: string,
  lesson: string,
  missionTitle: string,
): PersistedHarnessLesson | null {
  if (!workspaceRoot || !path.isAbsolute(workspaceRoot)) return null;
  const text = lesson.trim();
  if (!text) return null;
  const record: PersistedHarnessLesson = {
    v: 1,
    at: Date.now(),
    missionTitle: missionTitle.trim().slice(0, 200) || 'mission',
    lesson: text.slice(0, 400),
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
    if (raw?.v !== 1 || typeof raw.lesson !== 'string' || !raw.lesson.trim()) return null;
    return {
      v: 1,
      at: typeof raw.at === 'number' ? raw.at : 0,
      missionTitle: typeof raw.missionTitle === 'string' ? raw.missionTitle : 'mission',
      lesson: raw.lesson.trim(),
    };
  } catch {
    return null;
  }
}
