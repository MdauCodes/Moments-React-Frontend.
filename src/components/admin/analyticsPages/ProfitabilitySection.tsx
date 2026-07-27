import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard } from "@/components/admin/analyticsUi";
import { RankedBarChart } from "@/components/admin/analyticsCharts";
import { PeriodDeltaGrid, type MetricDeltaSpec } from "@/components/admin/PeriodDeltaGrid";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import type { Profitability, MonthlyProjection } from "@/services/commerceApi";

/** Extracted from the former standalone Profitability page's top ("Profitability (estimated)")
 *  and bottom ("Monthly projection") sections — its middle "Gross profit breakdown" switcher
 *  (Products/Category/Subcategory/Industry/Trend) moved to Data Visualization instead (Table
 *  mode for the first four, Charts & Trends for Trend). These two panels are current-state
 *  financial reporting, same as Tax and Rewards, so they live here in Finance instead of being
 *  left homeless by that split. */
export function ProfitabilitySection({
  profitability, profitabilityLoading, priorProfitability, projection, projectionLoading,
}: {
  profitability: Profitability | null;
  profitabilityLoading: boolean;
  priorProfitability: Profitability | null;
  projection: MonthlyProjection | null;
  projectionLoading: boolean;
}) {
  const profitabilityMetrics: MetricDeltaSpec[] | null = profitability && priorProfitability ? [
    { label: "Gross profit", current: profitability.estimatedGrossProfitKes, prior: priorProfitability.estimatedGrossProfitKes, goodDirection: "up", formatValue: formatKes },
    { label: "Net margin", current: profitability.netMarginPercent, prior: priorProfitability.netMarginPercent, isPercent: true, goodDirection: "up", formatValue: (v) => `${v}%` },
  ] : null;

  return (
    <>
      {profitabilityMetrics && <div style={{ marginBottom: 14 }}><PeriodDeltaGrid title="What changed vs the prior period" metrics={profitabilityMetrics} /></div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard
          label="Gross profit"
          value={profitabilityLoading || !profitability ? "—" : formatKes(profitability.estimatedGrossProfitKes)}
          sub={profitabilityLoading || !profitability ? undefined : `${profitability.grossMarginPercent}% margin on ${formatKes(profitability.paidRevenueKes)} revenue`}
          info="Gross Profit = paid revenue minus estimated Cost of Goods Sold (each sold unit's current cost price × units sold). Estimated because cost prices aren't snapshotted at sale time."
        />
        <KpiCard
          label="Estimated COGS"
          value={profitabilityLoading || !profitability ? "—" : formatKes(profitability.estimatedCogsKes)}
          sub={profitabilityLoading || !profitability ? undefined : profitability.unitsMissingCostPriceCount > 0 ? `${profitability.unitsMissingCostPriceCount} unit(s) sold with no cost price on file` : "all sold units have a cost price"}
          badges={profitabilityLoading || !profitability || profitability.unitsMissingCostPriceCount === 0 ? undefined : [{ label: "floor, not exact", tone: "warn" }]}
          info="Cost of Goods Sold = each sold unit's current cost price (synced from Riseller) × units sold this period. A floor, not exact — units missing a cost price contribute revenue but not cost."
        />
        <KpiCard
          label="Net profit"
          value={profitabilityLoading || !profitability ? "—" : formatKes(profitability.estimatedNetProfitKes)}
          sub={profitabilityLoading || !profitability ? undefined : `${profitability.netMarginPercent}% margin, after ${formatKes(profitability.couponRedemptionCostKes)} coupon cost`}
          info="Net Profit = Gross Profit minus the cost of redeemed Reward Coupons this period — a redeemed coupon is a discount the business absorbed, so it's deducted again here for a more honest 'net' figure."
        />
      </div>

      {!profitabilityLoading && profitability && (
        <div style={{ marginTop: 16 }}>
          <div className="admin-label" style={{ marginBottom: 8 }}>Where the money goes (this period)</div>
          <RankedBarChart
            data={[
              { name: "Paid revenue", amount: profitability.paidRevenueKes },
              { name: "Estimated COGS", amount: profitability.estimatedCogsKes },
              { name: "Gross profit", amount: profitability.estimatedGrossProfitKes },
              { name: "Coupon cost", amount: profitability.couponRedemptionCostKes },
              { name: "Net profit", amount: profitability.estimatedNetProfitKes },
            ]}
            dataKey="amount"
            nameKey="name"
            color={CATEGORICAL[0]}
            valueFormatter={(v) => formatKes(v)}
          />
        </div>
      )}

      <div style={{ marginTop: 20, borderTop: "1px solid var(--admin-border)", paddingTop: 16 }}>
        <div className="admin-label" style={{ marginBottom: 10 }}>
          Monthly projection
          {!projectionLoading && projection && (
            <span style={{ fontWeight: 400, color: "var(--admin-muted)", marginLeft: 8 }}>
              — run-rate from the first {projection.sampleDays} day(s) of this month, scaled to {projection.daysInMonth} days
            </span>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <KpiCard
            label="Projected revenue"
            value={projectionLoading || !projection ? "—" : formatKes(projection.projectedRevenueKes)}
            sub={projectionLoading || !projection ? undefined : `${formatKes(projection.sampleRevenueKes)} so far`}
          />
          <KpiCard
            label="Projected gross profit"
            value={projectionLoading || !projection ? "—" : formatKes(projection.projectedGrossProfitKes)}
            sub={projectionLoading || !projection ? undefined : `${formatKes(projection.sampleGrossProfitKes)} so far`}
          />
          <KpiCard
            label="Projected costs"
            value={projectionLoading || !projection ? "—" : formatKes(projection.projectedCostsKes)}
            sub="COGS + coupon redemption cost"
          />
        </div>
      </div>
    </>
  );
}

export function profitabilityExportPayload(profitability: Profitability | null, projection: MonthlyProjection | null) {
  return {
    kpis: [
      { label: "Gross profit", value: profitability ? formatKes(profitability.estimatedGrossProfitKes) : "—" },
      { label: "Gross margin", value: profitability ? `${profitability.grossMarginPercent}%` : "—" },
      { label: "Estimated COGS", value: profitability ? formatKes(profitability.estimatedCogsKes) : "—" },
      { label: "Net profit", value: profitability ? formatKes(profitability.estimatedNetProfitKes) : "—" },
      { label: "Net margin", value: profitability ? `${profitability.netMarginPercent}%` : "—" },
      { label: "Projected revenue (month)", value: projection ? formatKes(projection.projectedRevenueKes) : "—" },
      { label: "Projected gross profit (month)", value: projection ? formatKes(projection.projectedGrossProfitKes) : "—" },
      { label: "Projected costs (month)", value: projection ? formatKes(projection.projectedCostsKes) : "—" },
    ],
    tables: profitability ? [{
      title: "Where the money goes (this period)",
      columns: ["Line", "Amount (KES)"],
      rows: [
        ["Paid revenue", profitability.paidRevenueKes],
        ["Estimated COGS", profitability.estimatedCogsKes],
        ["Gross profit", profitability.estimatedGrossProfitKes],
        ["Coupon cost", profitability.couponRedemptionCostKes],
        ["Net profit", profitability.estimatedNetProfitKes],
      ],
    }] : [],
  };
}
