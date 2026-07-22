import { pctDelta, ptsDelta } from "@/lib/analyticsInsights";
import { formatKes } from "@/components/admin/commerceUi";
import { PeriodDeltaGrid, type MetricDeltaSpec } from "@/components/admin/PeriodDeltaGrid";
import type { RevenueSummary, OperationsSummary } from "@/services/commerceApi";

function buildInsights(current: RevenueSummary, prior: RevenueSummary, currentOps: OperationsSummary, priorOps: OperationsSummary): string[] {
  const insights: string[] = [];
  const revenueDelta = pctDelta(current.paidRevenue, prior.paidRevenue);

  if (prior.paidRevenue === 0 && current.paidRevenue > 0) {
    insights.push("First paid revenue recorded this period — no prior period to compare against.");
  } else if (revenueDelta !== null && revenueDelta <= -10) {
    let sentence = `Revenue down ${Math.abs(revenueDelta).toFixed(0)}% vs the prior period.`;
    const failedDelta = pctDelta(current.failedPaymentValue, prior.failedPaymentValue);
    const orderDelta = pctDelta(current.paidOrderCount, prior.paidOrderCount);
    if (failedDelta !== null && failedDelta >= 20) {
      sentence += ` Failed payments rose ${failedDelta.toFixed(0)}% in the same window — worth checking for payment friction.`;
    } else if (orderDelta !== null && orderDelta >= -5) {
      sentence += " Order volume held roughly steady, so this points at lower order values rather than fewer sales.";
    }
    insights.push(sentence);
  } else if (revenueDelta !== null && revenueDelta >= 10) {
    insights.push(`Revenue up ${revenueDelta.toFixed(0)}% vs the prior period.`);
  }

  const cancellationDelta = ptsDelta(currentOps.cancellationRatePercent, priorOps.cancellationRatePercent);
  if (Math.abs(cancellationDelta) >= 3) {
    insights.push(`Cancellation rate ${cancellationDelta > 0 ? "up" : "down"} ${Math.abs(cancellationDelta).toFixed(1)}pts vs the prior period.`);
  }

  const currentSuccessRate = current.byMethod.length > 0 ? current.byMethod[0].successRatePercent : null;
  const priorSuccessRate = prior.byMethod.length > 0 ? prior.byMethod[0].successRatePercent : null;
  if (currentSuccessRate !== null && priorSuccessRate !== null) {
    const successDelta = ptsDelta(currentSuccessRate, priorSuccessRate);
    if (successDelta <= -10) {
      insights.push(`Payment success rate down ${Math.abs(successDelta).toFixed(0)}pts vs the prior period — possible STK or gateway issue.`);
    }
  }

  return insights;
}

/**
 * Rule-based period-over-period comparison — no AI synthesis, just arithmetic against the
 * immediately preceding equal-length period plus a handful of hand-written correlation rules.
 * Sample sizes here are small (a young store), so a low-N disclaimer replaces false confidence.
 */
export function WhatChangedPanel({
  current, prior, currentOps, priorOps,
}: {
  current: RevenueSummary;
  prior: RevenueSummary;
  currentOps: OperationsSummary;
  priorOps: OperationsSummary;
}) {
  const metrics: MetricDeltaSpec[] = [
    { label: "Paid revenue", current: current.paidRevenue, prior: prior.paidRevenue, goodDirection: "up", formatValue: formatKes },
    { label: "Paid orders", current: current.paidOrderCount, prior: prior.paidOrderCount, goodDirection: "up", formatValue: (v) => v.toLocaleString() },
    { label: "Average order value", current: current.averageOrderValue, prior: prior.averageOrderValue, goodDirection: "up", formatValue: formatKes },
    { label: "Cancellation rate", current: currentOps.cancellationRatePercent, prior: priorOps.cancellationRatePercent, isPercent: true, goodDirection: "down", formatValue: (v) => `${v}%` },
  ];

  return (
    <PeriodDeltaGrid
      title="What changed vs the prior period"
      metrics={metrics}
      insights={buildInsights(current, prior, currentOps, priorOps)}
      lowSample={current.paidOrderCount < 10 || prior.paidOrderCount < 10}
    />
  );
}
