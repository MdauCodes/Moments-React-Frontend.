
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import {
  getRevenueTrend, getDailyProfitTrend, getSignupTrend,
  type RevenueTrend, type DailyProfitTrend, type SignupTrend,
} from "@/services/commerceApi";
import { ChartsTrendsSection, chartsTrendsExportPayload } from "@/components/admin/analyticsPages/ChartsTrendsSection";

// Last tab in the Analytics section, deliberately. Every other tab now already carries its own
// relevant chart/donut for its own metrics (Customers, Geographic, Delivery, Products &
// Inventory, Profitability, Tax, Rewards all have one embedded) — repeating those here would just
// be the same numbers shown twice. What's genuinely not duplicated anywhere else is seeing
// revenue, profit, and signups as three trend lines side by side, for spotting correlations
// (e.g. did signups spike when revenue dipped?) that no single domain tab surfaces on its own.
function AdminAnalyticsDataVisualizationPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);

  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend | null>(null);
  const [revenueTrendLoading, setRevenueTrendLoading] = useState(false);
  const [profitTrend, setProfitTrend] = useState<DailyProfitTrend | null>(null);
  const [profitTrendLoading, setProfitTrendLoading] = useState(false);
  const [signupTrend, setSignupTrend] = useState<SignupTrend | null>(null);
  const [signupTrendLoading, setSignupTrendLoading] = useState(false);

  useEffect(() => { document.title = "Data Visualization · Moments admin"; }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setRevenueTrendLoading(true);
    getRevenueTrend(range.from, range.to)
      .then((res) => { if (!cancelled) setRevenueTrend(res); })
      .catch((err) => reportAdminError(err, "Failed to load revenue trend"))
      .finally(() => { if (!cancelled) setRevenueTrendLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setProfitTrendLoading(true);
    getDailyProfitTrend(range.from, range.to)
      .then((res) => { if (!cancelled) setProfitTrend(res); })
      .catch((err) => reportAdminError(err, "Failed to load daily profit trend"))
      .finally(() => { if (!cancelled) setProfitTrendLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setSignupTrendLoading(true);
    getSignupTrend(range.from, range.to)
      .then((res) => { if (!cancelled) setSignupTrend(res); })
      .catch((err) => reportAdminError(err, "Failed to load signup trend"))
      .finally(() => { if (!cancelled) setSignupTrendLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  return (
    <AdminLayout title="Analytics · Data Visualization" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Data Visualization",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-data-visualization",
                ...chartsTrendsExportPayload(revenueTrend, profitTrend, signupTrend),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            <ChartsTrendsSection
              revenueTrend={revenueTrend} revenueTrendLoading={revenueTrendLoading}
              profitTrend={profitTrend} profitTrendLoading={profitTrendLoading}
              signupTrend={signupTrend} signupTrendLoading={signupTrendLoading}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsDataVisualizationPage;
