import { formatKes } from "@/components/admin/commerceUi";
import { TrendLineChart } from "@/components/admin/analyticsCharts";
import { STATUS, CATEGORICAL } from "@/lib/analyticsPalette";
import type { RevenueTrend, DailyProfitTrend, SignupTrend } from "@/services/commerceApi";

/** Charts & Trends mode of the Data Visualization tab — every trend-line chart on the
 *  dashboard gathered into one small-multiples grid, so this is the one place to see every
 *  metric's shape over time side by side. Each chart's underlying data/fetch already exists
 *  elsewhere (Overview for revenue, Finance/Profitability for daily profit, Sales for signups) —
 *  this mode is a display composition, not a new data source. */
export function ChartsTrendsSection({
  revenueTrend, revenueTrendLoading, profitTrend, profitTrendLoading, signupTrend, signupTrendLoading,
}: {
  revenueTrend: RevenueTrend | null;
  revenueTrendLoading: boolean;
  profitTrend: DailyProfitTrend | null;
  profitTrendLoading: boolean;
  signupTrend: SignupTrend | null;
  signupTrendLoading: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 20 }}>
      <div>
        <div className="admin-label" style={{ marginBottom: 8 }}>Revenue trend (daily)</div>
        {revenueTrendLoading || !revenueTrend || revenueTrend.points.length === 0 ? (
          <div className="admin-empty">{revenueTrendLoading ? "Loading…" : "No data for this period."}</div>
        ) : (
          <TrendLineChart
            data={revenueTrend.points.map((p) => ({ label: p.date.slice(5), paid: p.paidKes, pending: p.pendingKes, failed: p.failedKes }))}
            series={[
              { key: "paid", label: "Paid", color: STATUS.good },
              { key: "pending", label: "Pending", color: STATUS.warning },
              { key: "failed", label: "Failed", color: STATUS.critical },
            ]}
            valueFormatter={(v) => formatKes(v)}
            height={220}
          />
        )}
      </div>

      <div>
        <div className="admin-label" style={{ marginBottom: 8 }}>Daily profit trend</div>
        {profitTrendLoading || !profitTrend || profitTrend.points.length === 0 ? (
          <div className="admin-empty">{profitTrendLoading ? "Loading…" : "No data for this period."}</div>
        ) : (
          <TrendLineChart
            data={profitTrend.points.map((p) => ({
              label: p.date.slice(5), revenue: p.revenueKes, netRevenue: p.netRevenueKes, cogs: p.cogsKes, grossProfit: p.grossProfitKes,
            }))}
            series={[
              { key: "revenue", label: "Revenue", color: CATEGORICAL[0] },
              { key: "netRevenue", label: "Net Revenue", color: CATEGORICAL[1] },
              { key: "cogs", label: "COGS", color: CATEGORICAL[2] },
              { key: "grossProfit", label: "Gross Profit", color: CATEGORICAL[3] },
            ]}
            valueFormatter={(v) => formatKes(v)}
            height={220}
          />
        )}
      </div>

      <div>
        <div className="admin-label" style={{ marginBottom: 8 }}>Signups (daily)</div>
        {signupTrendLoading || !signupTrend || signupTrend.points.length === 0 ? (
          <div className="admin-empty">{signupTrendLoading ? "Loading…" : "No data for this period."}</div>
        ) : (
          <TrendLineChart
            data={signupTrend.points.map((p) => ({ label: p.date.slice(5), signups: p.signups }))}
            series={[{ key: "signups", label: "Signups", color: CATEGORICAL[4] }]}
            height={220}
          />
        )}
      </div>
    </div>
  );
}

export function chartsTrendsExportPayload(revenueTrend: RevenueTrend | null, profitTrend: DailyProfitTrend | null, signupTrend: SignupTrend | null) {
  return {
    kpis: [],
    tables: [
      { title: "Revenue trend (daily)", columns: ["Date", "Paid", "Pending", "Failed"],
        rows: (revenueTrend?.points ?? []).map((p) => [p.date, p.paidKes, p.pendingKes, p.failedKes]) },
      { title: "Daily profit trend", columns: ["Date", "Revenue", "Net Revenue", "COGS", "Gross Profit"],
        rows: (profitTrend?.points ?? []).map((p) => [p.date, p.revenueKes, p.netRevenueKes, p.cogsKes, p.grossProfitKes]) },
      { title: "Signups (daily)", columns: ["Date", "Signups"],
        rows: (signupTrend?.points ?? []).map((p) => [p.date, p.signups]) },
    ],
  };
}
