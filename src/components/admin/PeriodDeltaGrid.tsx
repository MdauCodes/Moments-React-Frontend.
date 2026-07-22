import { AlertTriangle, ArrowDown, ArrowUp, Minus } from "lucide-react";
import { STATUS } from "@/lib/analyticsPalette";
import { pctDelta, ptsDelta } from "@/lib/analyticsInsights";

export interface MetricDeltaSpec {
  label: string;
  current: number;
  prior: number;
  /** true when current/prior are already percentages/rates (delta shown in points), false for
   *  plain amounts (delta shown as a percent change). */
  isPercent?: boolean;
  /** Whether an increase means the metric got better or worse — decides the status color. */
  goodDirection: "up" | "down";
  formatValue: (v: number) => string;
}

/** A metric's direction can mean "good" or "bad" depending what it is (revenue up = good,
 *  cancellation rate up = bad) — this decides which status color and arrow to show, per the
 *  dataviz skill's rule that a series meaning good/bad wears status tokens, always icon + label. */
export function DeltaChip({ label, current, prior, isPercent, goodDirection, formatValue }: MetricDeltaSpec) {
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

/**
 * Generic period-over-period panel — every analytics sub-page uses this same shape so "what
 * changed" reads consistently everywhere: a row of delta chips, optional rule-based insight
 * sentences, and a low-sample disclaimer when either period's activity is too thin to trust.
 */
export function PeriodDeltaGrid({
  title, metrics, insights, lowSample,
}: {
  title: string;
  metrics: MetricDeltaSpec[];
  insights?: string[];
  lowSample?: boolean;
}) {
  return (
    <div className="admin-panel" style={{ padding: 14 }}>
      <div className="admin-label" style={{ marginBottom: 10 }}>{title}</div>

      {lowSample && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: STATUS.serious, marginBottom: 10 }}>
          <AlertTriangle size={13} />
          <span>Low activity in one of these periods — read this as an early signal, not a firm trend.</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {metrics.map((m, i) => <DeltaChip key={i} {...m} />)}
      </div>

      {insights && insights.length > 0 && (
        <ul style={{ marginTop: 14, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {insights.map((s, i) => (
            <li key={i} style={{ fontSize: 13, color: "var(--admin-text)" }}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
