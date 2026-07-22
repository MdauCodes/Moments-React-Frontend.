import { ArrowUp, ArrowDown, Minus, AlertTriangle } from "lucide-react";
import { STATUS } from "@/lib/analyticsPalette";
import { pctDelta, ptsDelta } from "@/lib/analyticsInsights";
import { formatKes } from "@/components/admin/commerceUi";
import type { RevenueSummary, OperationsSummary } from "@/services/commerceApi";

/** A metric's direction can mean "good" or "bad" depending what it is (revenue up = good,
 *  cancellation rate up = bad) — this decides which status color and arrow to show, per the
 *  dataviz skill's rule that a series meaning good/bad wears status tokens, always icon + label. */
function DeltaChip({ label, current, prior, isPercent, goodDirection, formatValue }: {
  label: string;
  current: number;
  prior: number;
  isPercent?: boolean;
  goodDirection: "up" | "down";
  formatValue: (v: number) => string;
}) {
  const delta = isPercent ? ptsDelta(current, prior) : pctDelta(current, prior);
  const noPriorBase = !isPercent && prior === 0;

  let Icon = Minus;
  let color: string = STATUS.serious;
  let text = "flat vs prior period";

  if (noPriorBase) {
    Icon = current > 0 ? ArrowUp : Minus;
    color = current > 0 ? STATUS.good : STATUS.serious;
    text = current > 0 ? "new this period (no prior activity)" : "no activity, either period";
  } else if (delta !== null) {
    const isUp = delta > 0.5;
    const isDown = delta < -0.5;
    Icon = isUp ? ArrowUp : isDown ? ArrowDown : Minus;
    const isGood = (isUp && goodDirection === "up") || (isDown && goodDirection === "down");
    const isBad = (isUp && goodDirection === "down") || (isDown && goodDirection === "up");
    color = isGood ? STATUS.good : isBad ? STATUS.critical : STATUS.serious;
    const sign = delta > 0 ? "+" : "";
    text = isPercent ? `${sign}${delta.toFixed(1)}pts vs prior period` : `${sign}${delta.toFixed(1)}% vs prior period`;
  }

  return (
    <div className="admin-panel" style={{ padding: "10px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--admin-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: "var(--font-display)", marginTop: 2 }}>{formatValue(current)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11, color }}>
        <Icon size={12} />
        <span>{text}</span>
      </div>
    </div>
  );
}

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
  const insights = buildInsights(current, prior, currentOps, priorOps);
  const lowSample = current.paidOrderCount < 10 || prior.paidOrderCount < 10;

  return (
    <div className="admin-panel" style={{ padding: 14 }}>
      <div className="admin-label" style={{ marginBottom: 10 }}>What changed vs the prior period</div>

      {lowSample && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: STATUS.serious, marginBottom: 10 }}>
          <AlertTriangle size={13} />
          <span>Fewer than 10 paid orders in one of these periods — read these as early signals, not firm trends.</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <DeltaChip label="Paid revenue" current={current.paidRevenue} prior={prior.paidRevenue} goodDirection="up" formatValue={formatKes} />
        <DeltaChip label="Paid orders" current={current.paidOrderCount} prior={prior.paidOrderCount} goodDirection="up" formatValue={(v) => v.toLocaleString()} />
        <DeltaChip label="Average order value" current={current.averageOrderValue} prior={prior.averageOrderValue} goodDirection="up" formatValue={formatKes} />
        <DeltaChip label="Cancellation rate" current={currentOps.cancellationRatePercent} prior={priorOps.cancellationRatePercent} isPercent goodDirection="down" formatValue={(v) => `${v}%`} />
      </div>

      {insights.length > 0 && (
        <ul style={{ marginTop: 14, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {insights.map((s, i) => (
            <li key={i} style={{ fontSize: 13, color: "var(--admin-text)" }}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
