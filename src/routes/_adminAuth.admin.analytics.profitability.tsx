
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard } from "@/components/admin/analyticsUi";
import { getProfitability, getMonthlyProjection, type Profitability, type MonthlyProjection } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";

function AdminAnalyticsProfitabilityPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [profitability, setProfitability] = useState<Profitability | null>(null);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
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
        {/* Profitability — COGS uses each product's CURRENT cost price (no historical snapshot
            exists), so this is an estimate, labelled as such below. */}
        <div className="admin-panel" style={{ padding: 14 }}>
          <div className="admin-label" style={{ marginBottom: 10 }}>Profitability (estimated)</div>
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
