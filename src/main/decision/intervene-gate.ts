/**
 * ProPerAgent-shaped gate: before interrupting the operator, map a KEV/Laya
 * choice onto continue / escalate / skip.
 *
 * Thresholds: probability margin (T29) + optional answer `confidence` (T54).
 * Missing confidence (classic KEV) skips the confidence check. Abstention /
 * outage → escalate (operator remains SoT).
 */

export type InterveneChoice = 'continue' | 'escalate' | 'skip';

/** Default Laya/System One floor — probe saw continue@0.62 with conf≈0.22. */
export const DEFAULT_MIN_CONFIDENCE = 0.35;

export interface InterveneGateInput {
  /** Top choice from kev_evaluate / system_one (e.g. answers.action.choice). */
  choice?: string | null;
  /** Probability mass per criterion name. */
  probabilities?: Record<string, number> | null;
  /**
   * Optional calibrated confidence from System One / Laya. When present and
   * below `minConfidence`, continue/skip become escalate. Omitted on classic KEV.
   */
  confidence?: number | null;
  /**
   * If the gap between the top two options is below this, treat as ambiguous
   * and escalate (default 0.05 — matches T29 near-tie continue≈0.37 escalate≈0.39).
   */
  minMargin?: number;
  /**
   * Floor for `confidence` when that field is present (default 0.35).
   * Pass `null` to disable the confidence check.
   */
  minConfidence?: number | null;
}

export interface InterveneGateResult {
  action: InterveneChoice;
  reason: string;
  topProbability?: number;
  margin?: number;
  confidence?: number;
}

function normalizeChoice(raw: string | null | undefined): InterveneChoice | null {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if (key === 'continue' || key === 'escalate' || key === 'skip') return key;
  return null;
}

function applyConfidenceFloor(
  result: InterveneGateResult,
  confidence: number | null | undefined,
  minConfidence: number | null,
): InterveneGateResult {
  if (minConfidence === null) return result;
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return result;
  if (result.action !== 'continue' && result.action !== 'skip') {
    return { ...result, confidence };
  }
  if (confidence >= minConfidence) {
    return { ...result, confidence };
  }
  return {
    action: 'escalate',
    reason: `Decision confidence ${confidence.toFixed(3)} < ${minConfidence} — escalate to operator`,
    topProbability: result.topProbability,
    margin: result.margin,
    confidence,
  };
}

/** Pure decision — no I/O. Safe default is escalate. */
export function decideInterveneAction(input: InterveneGateInput): InterveneGateResult {
  const minMargin = input.minMargin ?? 0.05;
  const minConfidence =
    input.minConfidence === null ? null : (input.minConfidence ?? DEFAULT_MIN_CONFIDENCE);
  const choice = normalizeChoice(input.choice ?? undefined);
  const probs = input.probabilities && typeof input.probabilities === 'object'
    ? input.probabilities
    : null;

  if (!choice) {
    return applyConfidenceFloor(
      { action: 'escalate', reason: 'Decision model returned no usable choice — escalate to operator' },
      input.confidence,
      minConfidence,
    );
  }

  if (!probs) {
    // Choice present without probs: trust only escalate/skip; continue needs margin proof.
    if (choice === 'continue') {
      return applyConfidenceFloor(
        { action: 'escalate', reason: 'Continue chosen without probabilities — escalate to be safe' },
        input.confidence,
        minConfidence,
      );
    }
    return applyConfidenceFloor(
      { action: choice, reason: `Decision model chose ${choice} (no probability vector)` },
      input.confidence,
      minConfidence,
    );
  }

  const ranked = Object.entries(probs)
    .filter(([, p]) => typeof p === 'number' && Number.isFinite(p))
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  const topProbability = top?.[1];
  const margin = top && second ? top[1] - second[1] : topProbability;

  let result: InterveneGateResult;

  if (top && normalizeChoice(top[0]) && normalizeChoice(top[0]) !== choice) {
    // Prefer the probability argmax when it disagrees with the string choice.
    const argmax = normalizeChoice(top[0])!;
    if (typeof margin === 'number' && margin < minMargin) {
      result = {
        action: 'escalate',
        reason: `Ambiguous top options (margin ${margin.toFixed(3)} < ${minMargin}) — escalate`,
        topProbability,
        margin,
      };
    } else {
      result = {
        action: argmax,
        reason: `Using probability argmax '${argmax}' over reported choice '${choice}'`,
        topProbability,
        margin,
      };
    }
  } else if (typeof margin === 'number' && margin < minMargin) {
    result = {
      action: 'escalate',
      reason: `Ambiguous top options (margin ${margin.toFixed(3)} < ${minMargin}) — escalate`,
      topProbability,
      margin,
    };
  } else {
    result = {
      action: choice,
      reason: `Decision model chose ${choice}`,
      topProbability,
      margin,
    };
  }

  return applyConfidenceFloor(result, input.confidence, minConfidence);
}

/**
 * Map gate action onto an automatic vibes `resolve_intervention` when safe.
 * `null` = escalate — do not auto-resolve; leave Needs You / operator path.
 */
export function toAutoResolution(action: InterveneChoice): { action: 'retry' | 'skip'; message: string } | null {
  if (action === 'continue') {
    return { action: 'retry', message: 'Decision model: continue — auto-retry without operator' };
  }
  if (action === 'skip') {
    return { action: 'skip', message: 'Decision model: skip blocked work' };
  }
  return null;
}
