// Period-over-period comparison helpers — rule-based, no AI: diff the current range against
// the immediately preceding range of equal length, and surface plain-sentence observations from
// simple correlations between metrics already computed elsewhere on the page.

export function priorRange(from: Date, to: Date): { from: Date; to: Date } {
  const durationMs = to.getTime() - from.getTime();
  const priorTo = new Date(from.getTime());
  const priorFrom = new Date(from.getTime() - durationMs);
  return { from: priorFrom, to: priorTo };
}

/** Percent change, current vs prior. Null when prior is zero — a percent change from zero is
 *  undefined (not "infinite"), so callers should show an absolute figure instead in that case. */
export function pctDelta(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

/** Percentage-point delta — for rates that are already percentages (cancellation rate, success rate). */
export function ptsDelta(current: number, prior: number): number {
  return current - prior;
}
