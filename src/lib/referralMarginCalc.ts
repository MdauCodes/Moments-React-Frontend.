/**
 * Pure, client-side margin math for the Auto Mode referral tier calculator.
 * Everything here runs instantly in the browser off a single fetched
 * MarginSummaryDto snapshot — no backend round-trip per keystroke.
 */

export type Band = {
  id: string;
  tierName: string;
  minOrderAmount: number;
  /** null = open-ended top band ("10,000+") */
  maxOrderAmount: number | null;
};

export type BandResult = Band & {
  /** Order value used to price this band — midpoint, or min*1.5 for an open-ended top band. */
  representativeOrderValue: number;
  marginKes: number;
  minimumProfitKes: number;
  rewardPoolKes: number;
  referrerCredits: number;
  refereeCredits: number;
  remainingProfitKes: number;
  remainingProfitPercent: number;
};

export type TuningInputs = {
  /** Blended catalog gross-profit %, e.g. 35 = 35%. */
  blendedGrossProfitPercent: number;
  /** Minimum profit % of order value the business always keeps, before any reward. */
  minimumProfitPercent: number;
  /** % of the margin remaining above the profit floor that gets shared as rewards. */
  rewardSharePercent: number;
  /** How the reward pool splits between referrer and referee, e.g. 50 = 50/50. */
  referrerSplitPercent: number;
  creditsPerKes: number;
};

export const PRESETS: Record<"decent" | "generous", { minimumProfitPercent: number; rewardSharePercent: number }> = {
  decent:   { minimumProfitPercent: 20, rewardSharePercent: 15 },
  generous: { minimumProfitPercent: 10, rewardSharePercent: 35 },
};

function representativeValue(band: Band): number {
  if (band.maxOrderAmount == null) return band.minOrderAmount * 1.5 || band.minOrderAmount + 1000;
  return (band.minOrderAmount + band.maxOrderAmount) / 2;
}

export function computeBand(band: Band, inputs: TuningInputs): BandResult {
  const orderValue = representativeValue(band);
  const marginKes = orderValue * (inputs.blendedGrossProfitPercent / 100);
  const minimumProfitKes = orderValue * (inputs.minimumProfitPercent / 100);
  const available = Math.max(0, marginKes - minimumProfitKes);
  const rewardPoolKes = available * (inputs.rewardSharePercent / 100);

  const referrerKes = rewardPoolKes * (inputs.referrerSplitPercent / 100);
  const refereeKes = rewardPoolKes - referrerKes;

  const referrerCredits = Math.round(referrerKes * inputs.creditsPerKes);
  const refereeCredits = Math.round(refereeKes * inputs.creditsPerKes);

  const remainingProfitKes = marginKes - rewardPoolKes;
  const remainingProfitPercent = orderValue > 0 ? (remainingProfitKes / orderValue) * 100 : 0;

  return {
    ...band,
    representativeOrderValue: orderValue,
    marginKes,
    minimumProfitKes,
    rewardPoolKes,
    referrerCredits,
    refereeCredits,
    remainingProfitKes,
    remainingProfitPercent,
  };
}

export function computeBands(bands: Band[], inputs: TuningInputs): BandResult[] {
  return bands.map((b) => computeBand(b, inputs));
}

/** Generates a band list from a start value, fixed width, and open-ended top cutoff. */
export function generateBands(startValue: number, bandWidth: number, maxCutoff: number): Band[] {
  const bands: Band[] = [];
  let cursor = Math.max(0, startValue);
  let idx = 1;
  while (cursor < maxCutoff) {
    const next = Math.min(cursor + bandWidth, maxCutoff);
    bands.push({
      id: `gen-${idx}`,
      tierName: `Tier ${idx}`,
      minOrderAmount: cursor,
      maxOrderAmount: next,
    });
    cursor = next;
    idx++;
  }
  bands.push({
    id: `gen-${idx}`,
    tierName: `Tier ${idx} (${maxCutoff.toLocaleString()}+)`,
    minOrderAmount: maxCutoff,
    maxOrderAmount: null,
  });
  return bands;
}

export const DEFAULT_BANDS: Band[] = [
  { id: "b1", tierName: "Standard", minOrderAmount: 0, maxOrderAmount: 2000 },
  { id: "b2", tierName: "Mid", minOrderAmount: 2000, maxOrderAmount: 5000 },
  { id: "b3", tierName: "Large", minOrderAmount: 5000, maxOrderAmount: 10000 },
  { id: "b4", tierName: "Bulk", minOrderAmount: 10000, maxOrderAmount: null },
];
