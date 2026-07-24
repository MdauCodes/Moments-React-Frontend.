
import { useCallback, useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard } from "@/components/admin/analyticsUi";
import { RankedBarChart, TrendLineChart } from "@/components/admin/analyticsCharts";
import { MetricInfoTooltip } from "@/components/admin/MetricInfoTooltip";
import { PeriodDeltaGrid, type MetricDeltaSpec } from "@/components/admin/PeriodDeltaGrid";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import { priorRange } from "@/lib/analyticsInsights";
import { useVisibilityInterval } from "@/lib/useVisibilityInterval";
import {
  getProfitability, getMonthlyProjection, getProfitabilityBreakdown, getDailyProfitTrend,
  type Profitability, type MonthlyProjection, type ProfitabilityBreakdown, type ProfitabilityLine,
  type ProfitabilityByProduct, type DailyProfitTrend,
} from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";

type BreakdownView = "products" | "category" | "subcategory" | "industry" | "trend";

const VIEW_LABELS: Record<BreakdownView, string> = {
  products: "Products", category: "Category", subcategory: "Subcategory", industry: "Industry", trend: "Trend",
};

function LineTable({ rows, caveat }: { rows: ProfitabilityLine[]; caveat?: string }) {
  return (
    <>
      {caveat && <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 8 }}>{caveat}</div>}
      <div className="admin-panel" data-admin-table-scroll>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th><th>Units</th><th>Revenue</th><th>COGS</th><th>Gross Profit</th><th>Margin %</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6}><div className="admin-empty">No data for this period.</div></td></tr>
            ) : rows.map((r) => (
              <tr key={r.groupId}>
                <td>{r.groupName}</td>
                <td>{r.unitsSold.toLocaleString()}</td>
                <td>{formatKes(r.revenueKes)}</td>
                <td>{formatKes(r.cogsKes)}</td>
                <td>{formatKes(r.grossProfitKes)}</td>
                <td>{r.marginPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProductsTable({ rows }: { rows: ProfitabilityByProduct[] }) {
  return (
    <div className="admin-panel" data-admin-table-scroll>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Product</th><th>Units</th><th>Revenue</th><th>COGS</th><th>Gross Profit</th>
            <th>Margin %</th><th>List GP% (Riseller)</th><th>Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8}><div className="admin-empty">No data for this period.</div></td></tr>
          ) : rows.map((r) => (
            <tr key={r.productId}>
              <td>{r.productName}</td>
              <td>{r.unitsSold.toLocaleString()}</td>
              <td>{formatKes(r.revenueKes)}</td>
              <td>{formatKes(r.cogsKes)}</td>
              <td>{formatKes(r.grossProfitKes)}</td>
              <td>{r.marginPercent}%</td>
              <td>{r.listGrossProfitPercent != null ? `${r.listGrossProfitPercent}%` : "—"}</td>
              <td>{r.marginGapPercent != null ? `${r.marginGapPercent > 0 ? "+" : ""}${r.marginGapPercent}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminAnalyticsProfitabilityPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [profitability, setProfitability] = useState<Profitability | null>(null);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [priorProfitability, setPriorProfitability] = useState<Profitability | null>(null);
  const [projection, setProjection] = useState<MonthlyProjection | null>(null);
  const [projectionLoading, setProjectionLoading] = useState(false);

  const [view, setView] = useState<BreakdownView>("products");
  const [breakdown, setBreakdown] = useState<ProfitabilityBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);
  const [trend, setTrend] = useState<DailyProfitTrend | null>(null);
  const [trendLoading, setTrendLoading] = useState(false);

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

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setBreakdownLoading(true);
    getProfitabilityBreakdown(range.from, range.to)
      .then((res) => { if (!cancelled) setBreakdown(res); })
      .catch((err) => reportAdminError(err, "Failed to load profitability breakdown"))
      .finally(() => { if (!cancelled) setBreakdownLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  const fetchTrend = useCallback(() => {
    if (!range) return;
    setTrendLoading((prev) => (trend ? prev : true));
    getDailyProfitTrend(range.from, range.to)
      .then((res) => setTrend(res))
      .catch((err) => reportAdminError(err, "Failed to load daily profit trend"))
      .finally(() => setTrendLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => { fetchTrend(); }, [fetchTrend, reloadKey]);

  // "Reasonably realtime" — re-fetches the (cheap) daily trend every 20s while this tab is
  // visible, pauses while it's hidden. Does not re-run the breakdown's taxonomy joins.
  useVisibilityInterval(fetchTrend, 20000);

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
                tables: [
                  ...(profitability ? [{
                    title: "Where the money goes (this period)",
                    columns: ["Line", "Amount (KES)"],
                    rows: [
                      ["Paid revenue", profitability.paidRevenueKes],
                      ["Estimated COGS", profitability.estimatedCogsKes],
                      ["Gross profit", profitability.estimatedGrossProfitKes],
                      ["Coupon cost", profitability.couponRedemptionCostKes],
                      ["Net profit", profitability.estimatedNetProfitKes],
                    ],
                  }] : []),
                  ...(breakdown ? [
                    { title: "Products", columns: ["Product", "Units", "Revenue", "COGS", "Gross Profit", "Margin %", "List GP%", "Gap"],
                      rows: breakdown.byProduct.map((r) => [r.productName, r.unitsSold, r.revenueKes, r.cogsKes, r.grossProfitKes, r.marginPercent, r.listGrossProfitPercent ?? "—", r.marginGapPercent ?? "—"]) },
                    { title: "Category", columns: ["Category", "Units", "Revenue", "COGS", "Gross Profit", "Margin %"],
                      rows: breakdown.byCategory.map((r) => [r.groupName, r.unitsSold, r.revenueKes, r.cogsKes, r.grossProfitKes, r.marginPercent]) },
                    { title: "Subcategory", columns: ["Subcategory", "Units", "Revenue", "COGS", "Gross Profit", "Margin %"],
                      rows: breakdown.bySubcategory.map((r) => [r.groupName, r.unitsSold, r.revenueKes, r.cogsKes, r.grossProfitKes, r.marginPercent]) },
                    { title: "Industry", columns: ["Industry", "Units", "Revenue", "COGS", "Gross Profit", "Margin %"],
                      rows: breakdown.byIndustry.map((r) => [r.groupName, r.unitsSold, r.revenueKes, r.cogsKes, r.grossProfitKes, r.marginPercent]) },
                  ] : []),
                  ...(trend ? [{
                    title: "Daily trend",
                    columns: ["Date", "Revenue", "Net Revenue", "COGS", "Gross Profit"],
                    rows: trend.points.map((p) => [p.date, p.revenueKes, p.netRevenueKes, p.cogsKes, p.grossProfitKes]),
                  }] : []),
                ],
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
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
        </div>

        {/* Gross-profit breakdown — Products/Category/Subcategory/Industry/Trend */}
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div className="admin-label" style={{ marginBottom: 0 }}>Gross profit breakdown — {VIEW_LABELS[view]}</div>
              <MetricInfoTooltip title={VIEW_LABELS[view]}>
                {view === "products" && "Realized Gross Profit = revenue actually collected this period (after any coupon or referral discount) minus Cost of Goods Sold (unit cost × units sold). List GP% is Riseller's own margin at full list price, before any site discount — the Gap shows how much discounting ate into this SKU's margin."}
                {(view === "category" || view === "subcategory") && "Same Gross Profit formula, aggregated by each product's current classification — reflects today's category/subcategory, not what it was at the time of the original sale."}
                {view === "industry" && "Same Gross Profit formula. A product can be tagged to more than one industry, so its sale is counted under every industry it belongs to — industry totals can add up to more than this page's overall total, by design."}
                {view === "trend" && "Revenue = total paid that day. Net Revenue = Revenue minus VAT collected that day. COGS = unit cost × units sold that day. Gross Profit = Revenue − COGS (kept consistent with this page's own overall Gross Profit above, not Net Revenue − COGS)."}
              </MetricInfoTooltip>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(Object.keys(VIEW_LABELS) as BreakdownView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`admin-btn ${view === v ? "admin-btn-primary" : "admin-btn-ghost"}`}
                  onClick={() => setView(v)}
                >
                  {VIEW_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {view === "products" && (
            breakdownLoading || !breakdown ? <div className="admin-empty">Loading…</div> : (
              <>
                {breakdown.unitsMissingCostPriceCount > 0 && (
                  <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 8 }}>
                    {breakdown.unitsMissingCostPriceCount} unit(s) sold with no cost price on file — their COGS/Gross Profit is a floor, not exact.
                  </div>
                )}
                <ProductsTable rows={breakdown.byProduct} />
              </>
            )
          )}

          {view === "category" && (
            breakdownLoading || !breakdown ? <div className="admin-empty">Loading…</div> :
              <LineTable rows={breakdown.byCategory} caveat="Reflects each product's current classification, not its classification at time of sale." />
          )}

          {view === "subcategory" && (
            breakdownLoading || !breakdown ? <div className="admin-empty">Loading…</div> :
              <LineTable rows={breakdown.bySubcategory} caveat="Reflects each product's current classification, not its classification at time of sale." />
          )}

          {view === "industry" && (
            breakdownLoading || !breakdown ? <div className="admin-empty">Loading…</div> : (
              <>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: "#fef3c7", color: "#92400e" }}>
                    totals can exceed grand total
                  </span>
                </div>
                <LineTable rows={breakdown.byIndustry} />
              </>
            )
          )}

          {view === "trend" && (
            trendLoading || !trend ? <div className="admin-empty">Loading…</div> : (
              <TrendLineChart
                data={trend.points.map((p) => ({
                  label: p.date.slice(5),
                  revenue: p.revenueKes,
                  netRevenue: p.netRevenueKes,
                  cogs: p.cogsKes,
                  grossProfit: p.grossProfitKes,
                }))}
                series={[
                  { key: "revenue", label: "Revenue", color: CATEGORICAL[0] },
                  { key: "netRevenue", label: "Net Revenue", color: CATEGORICAL[1] },
                  { key: "cogs", label: "COGS", color: CATEGORICAL[2] },
                  { key: "grossProfit", label: "Gross Profit", color: CATEGORICAL[3] },
                ]}
                valueFormatter={(v) => formatKes(v)}
              />
            )
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
