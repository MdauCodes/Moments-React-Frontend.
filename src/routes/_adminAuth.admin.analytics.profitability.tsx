
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard } from "@/components/admin/analyticsUi";
import { RankedBarChart } from "@/components/admin/analyticsCharts";
import { PeriodDeltaGrid, type MetricDeltaSpec } from "@/components/admin/PeriodDeltaGrid";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import { priorRange } from "@/lib/analyticsInsights";
import { getProfitability, getMonthlyProjection, type Profitability, type MonthlyProjection } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";

function AdminAnalyticsProfitabilityPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [profitability, setProfitability] = useState<Profitability | null>(null);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [priorProfitability, setPriorProfitability] = useState<Profitability | null>(null);
  const [projection, setProjection] = useState<MonthlyProjection | null>(null);
  const [projectionLoading, setProjectionLoading] = useState(false);

  useEffect(() => { document.title = "Profitability · Moments admin"; }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setProfitabilityLoading(true);
    getProfitability(range.from, range.to)
      .then((res) => { if (!cancelled) setProfitability(res); })
      .catch((err) => reportAdminError(err, "Failed to load profitability"))
      .finally(() => { if (!cancelled) setProfitabilityLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    const { from, to } = priorRange(range.from, range.to);
    getProfitability(from, to)
      .then((res) => { if (!cancelled) setPriorProfitability(res); })
      .catch((err) => reportAdminError(err, "Failed to load prior-period profitability comparison"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  const profitabilityMetrics: MetricDeltaSpec[] | null = profitability && priorProfitability ? [
    { label: "Gross profit", current: profitability.estimatedGrossProfitKes, prior: priorProfitability.estimatedGrossProfitKes, goodDirection: "up", formatValue: formatKes },
    { label: "Net margin", current: profitability.netMarginPercent, prior: priorProfitability.netMarginPercent, isPercent: true, goodDirection: "up", formatValue: (v) => `${v}%` },
  ] : null;

  useEffect(() => {
    let cancelled = false;
    setProjectionLoading(true);
    getMonthlyProjection()
      .then((res) => { if (!cancelled) setProjection(res); })
      .catch((err) => reportAdminError(err, "Failed to load monthly projection"))
      .finally(() => { if (!cancelled) setProjectionLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  return (
    <AdminLayout title="Analytics · Profitability" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        {profitabilityMetrics && <PeriodDeltaGrid title="What changed vs the prior period" metrics={profitabilityMetrics} />}

        {/* Profitability — COGS uses each product's CURRENT cost price (no historical snapshot
            exists), so this is an estimate, labelled as such below. */}
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div className="admin-label" style={{ marginBottom: 0 }}>Profitability (estimated)</div>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Profitability",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-profitability",
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
                tables: profitability ? [
                  {
                    title: "Where the money goes (this period)",
                    columns: ["Line", "Amount (KES)"],
                    rows: [
                      ["Paid revenue", profitability.paidRevenueKes],
                      ["Estimated COGS", profitability.estimatedCogsKes],
                      ["Gross profit", profitability.estimatedGrossProfitKes],
                      ["Coupon cost", profitability.couponRedemptionCostKes],
                      ["Net profit", profitability.estimatedNetProfitKes],
                    ],
                  },
                ] : [],
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
            <KpiCard
              label="Gross profit"
              value={profitabilityLoading || !profitability ? "—" : formatKes(profitability.estimatedGrossProfitKes)}
              sub={profitabilityLoading || !profitability ? undefined : `${profitability.grossMarginPercent}% margin on ${formatKes(profitability.paidRevenueKes)} revenue`}
            />
            <KpiCard
              label="Estimated COGS"
              value={profitabilityLoading || !profitability ? "—" : formatKes(profitability.estimatedCogsKes)}
              sub={profitabilityLoading || !profitability ? undefined : profitability.unitsMissingCostPriceCount > 0 ? `${profitability.unitsMissingCostPriceCount} unit(s) sold with no cost price on file` : "all sold units have a cost price"}
              badges={profitabilityLoading || !profitability || profitability.unitsMissingCostPriceCount === 0 ? undefined : [{ label: "floor, not exact", tone: "warn" }]}
            />
            <KpiCard
              label="Net profit"
              value={profitabilityLoading || !profitability ? "—" : formatKes(profitability.estimatedNetProfitKes)}
              sub={profitabilityLoading || !profitability ? undefined : `${profitability.netMarginPercent}% margin, after ${formatKes(profitability.couponRedemptionCostKes)} coupon cost`}
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
        </div>

        {/* Monthly projection — always the current month, not tied to the date-range picker above. */}
        <div className="admin-panel" style={{ padding: 14 }}>
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
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsProfitabilityPage;
