/**
 * ProPerAgent-shaped gate: before interrupting the operator, map a KEV choice
 * onto continue / escalate / skip. Thresholds use `probabilities`, never
 * `confidence` (T29 spike). Abstention / outage → escalate (operator remains SoT).
 */

export type InterveneChoice = 'continue' | 'escalate' | 'skip';

export interface InterveneGateInput {
  /** Top choice from kev_evaluate (e.g. answers.action.choice). */
  choice?: string | null;
  /** Probability mass per criterion name. */
  probabilities?: Record<string, number> | null;
  /**
   * If the gap between the top two options is below this, treat as ambiguous
   * and escalate (default 0.05 — matches T29 near-tie continue≈0.37 escalate≈0.39).
   */
  minMargin?: number;
}

export interface InterveneGateResult {
  action: InterveneChoice;
  reason: string;
  topProbability?: number;
  margin?: number;
}

function normalizeChoice(raw: string | null | undefined): InterveneChoice | null {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if (key === 'continue' || key === 'escalate' || key === 'skip') return key;
  return null;
}

/** Pure decision — no I/O. Safe default is escalate. */
export function decideInterveneAction(input: InterveneGateInput): InterveneGateResult {
  const minMargin = input.minMargin ?? 0.05;
  const choice = normalizeChoice(input.choice ?? undefined);
  const probs = input.probabilities && typeof input.probabilities === 'object'
    ? input.probabilities
    : null;

  if (!choice) {
    return { action: 'escalate', reason: 'Decision model returned no usable choice — escalate to operator' };
  }

  if (!probs) {
    // Choice present without probs: trust only escalate/skip; continue needs margin proof.
    if (choice === 'continue') {
      return { action: 'escalate', reason: 'Continue chosen without probabilities — escalate to be safe' };
    }
    return { action: choice, reason: `Decision model chose ${choice} (no probability vector)` };
  }

  const ranked = Object.entries(probs)
    .filter(([, p]) => typeof p === 'number' && Number.isFinite(p))
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];
  const topProbability = top?.[1];
  const margin = top && second ? top[1] - second[1] : topProbability;

  if (top && normalizeChoice(top[0]) && normalizeChoice(top[0]) !== choice) {
    // Prefer the probability argmax when it disagrees with the string choice.
    const argmax = normalizeChoice(top[0])!;
    if (typeof margin === 'number' && margin < minMargin) {
      return {
        action: 'escalate',
        reason: `Ambiguous top options (margin ${margin.toFixed(3)} < ${minMargin}) — escalate`,
        topProbability,
        margin,
      };
    }
    return {
      action: argmax,
      reason: `Using probability argmax '${argmax}' over reported choice '${choice}'`,
      topProbability,
      margin,
    };
  }

  if (typeof margin === 'number' && margin < minMargin) {
    return {
      action: 'escalate',
      reason: `Ambiguous top options (margin ${margin.toFixed(3)} < ${minMargin}) — escalate`,
      topProbability,
      margin,
    };
  }

  return {
    action: choice,
    reason: `Decision model chose ${choice}`,
    topProbability,
    margin,
  };
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
