
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { priorRange } from "@/lib/analyticsInsights";
import {
  getProductsInventory, getProfitabilityBreakdown, getRevenueTrend, getDailyProfitTrend, getSignupTrend,
  getCustomerAnalytics, getRewardsEconomics, getTaxReport, getDemographicsBreakdown,
  type ProductsInventory, type ProfitabilityBreakdown, type RevenueTrend, type DailyProfitTrend, type SignupTrend,
  type CustomerAnalytics, type RewardsEconomics, type TaxReport, type DemographicsBreakdown,
} from "@/services/commerceApi";
import { TableSection, tableExportPayload } from "@/components/admin/analyticsPages/TableSection";
import { ChartsTrendsSection, chartsTrendsExportPayload } from "@/components/admin/analyticsPages/ChartsTrendsSection";
import { DonutPieSection, donutPieExportPayload } from "@/components/admin/analyticsPages/DonutPieSection";

type DataVizMode = "table" | "charts" | "donuts";

const MODE_LABELS: Record<DataVizMode, string> = {
  table: "Table", charts: "Charts & Trends", donuts: "Donut & Pie",
};

// The outer mode switcher here is deliberately the visually dominant control on this page —
// Table mode has its own internal 5-way switcher, so keeping this one full-width and styled
// as the primary control avoids it reading as "buried" beneath Table's own switcher.
function AdminAnalyticsDataVisualizationPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [mode, setMode] = useState<DataVizMode>("table");

  const [inventory, setInventory] = useState<ProductsInventory | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [priorInventory, setPriorInventory] = useState<ProductsInventory | null>(null);
  const [breakdown, setBreakdown] = useState<ProfitabilityBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  const [revenueTrend, setRevenueTrend] = useState<RevenueTrend | null>(null);
  const [revenueTrendLoading, setRevenueTrendLoading] = useState(false);
  const [profitTrend, setProfitTrend] = useState<DailyProfitTrend | null>(null);
  const [profitTrendLoading, setProfitTrendLoading] = useState(false);
  const [signupTrend, setSignupTrend] = useState<SignupTrend | null>(null);
  const [signupTrendLoading, setSignupTrendLoading] = useState(false);

  const [customers, setCustomers] = useState<CustomerAnalytics | null>(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [rewards, setRewards] = useState<RewardsEconomics | null>(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [tax, setTax] = useState<TaxReport | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [demographics, setDemographics] = useState<DemographicsBreakdown | null>(null);
  const [demographicsLoading, setDemographicsLoading] = useState(false);

  useEffect(() => { document.title = "Data Visualization · Moments admin"; }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setInventoryLoading(true);
    getProductsInventory(range.from, range.to)
      .then((res) => { if (!cancelled) setInventory(res); })
      .catch((err) => reportAdminError(err, "Failed to load products & inventory"))
      .finally(() => { if (!cancelled) setInventoryLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    const { from, to } = priorRange(range.from, range.to);
    getProductsInventory(from, to)
      .then((res) => { if (!cancelled) setPriorInventory(res); })
      .catch((err) => reportAdminError(err, "Failed to load prior-period products comparison"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

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

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setCustomersLoading(true);
    getCustomerAnalytics(range.from, range.to)
      .then((res) => { if (!cancelled) setCustomers(res); })
      .catch((err) => reportAdminError(err, "Failed to load customer analytics"))
      .finally(() => { if (!cancelled) setCustomersLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setRewardsLoading(true);
    getRewardsEconomics(range.from, range.to)
      .then((res) => { if (!cancelled) setRewards(res); })
      .catch((err) => reportAdminError(err, "Failed to load rewards economics"))
      .finally(() => { if (!cancelled) setRewardsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setTaxLoading(true);
    getTaxReport(range.from, range.to)
      .then((res) => { if (!cancelled) setTax(res); })
      .catch((err) => reportAdminError(err, "Failed to load tax report"))
      .finally(() => { if (!cancelled) setTaxLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setDemographicsLoading(true);
    getDemographicsBreakdown(range.from, range.to)
      .then((res) => { if (!cancelled) setDemographics(res); })
      .catch((err) => reportAdminError(err, "Failed to load demographics breakdown"))
      .finally(() => { if (!cancelled) setDemographicsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  function exportPayload() {
    switch (mode) {
      case "table": return tableExportPayload(inventory, breakdown);
      case "charts": return chartsTrendsExportPayload(revenueTrend, profitTrend, signupTrend);
      case "donuts": return donutPieExportPayload(customers, rewards, inventory, tax, demographics);
    }
  }

  return (
    <AdminLayout title="Analytics · Data Visualization" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {(Object.keys(MODE_LABELS) as DataVizMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`admin-btn ${mode === m ? "admin-btn-primary" : "admin-btn-ghost"}`}
                  style={{ fontWeight: 600 }}
                  onClick={() => setMode(m)}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: `Analytics · Data Visualization · ${MODE_LABELS[mode]}`,
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: `analytics-data-viz-${mode}`,
                ...exportPayload(),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            {mode === "table" && (
              <TableSection
                inventory={inventory} inventoryLoading={inventoryLoading} priorInventory={priorInventory}
                breakdown={breakdown} breakdownLoading={breakdownLoading}
              />
            )}
            {mode === "charts" && (
              <ChartsTrendsSection
                revenueTrend={revenueTrend} revenueTrendLoading={revenueTrendLoading}
                profitTrend={profitTrend} profitTrendLoading={profitTrendLoading}
                signupTrend={signupTrend} signupTrendLoading={signupTrendLoading}
              />
            )}
            {mode === "donuts" && (
              <DonutPieSection
                customers={customers} customersLoading={customersLoading}
                rewards={rewards} rewardsLoading={rewardsLoading}
                inventory={inventory} inventoryLoading={inventoryLoading}
                tax={tax} taxLoading={taxLoading}
                demographics={demographics} demographicsLoading={demographicsLoading}
              />
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsDataVisualizationPage;
