
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { priorRange } from "@/lib/analyticsInsights";
import {
  getTaxReport, getRewardsEconomics, getProfitability, getMonthlyProjection,
  type TaxReport, type RewardsEconomics, type Profitability, type MonthlyProjection,
} from "@/services/commerceApi";
import { TaxSection, taxExportPayload } from "@/components/admin/analyticsPages/TaxSection";
import { RewardsSection, rewardsExportPayload } from "@/components/admin/analyticsPages/RewardsSection";
import { ProfitabilitySection, profitabilityExportPayload } from "@/components/admin/analyticsPages/ProfitabilitySection";

type FinanceView = "profitability" | "tax" | "rewards";

const VIEW_LABELS: Record<FinanceView, string> = {
  profitability: "Profitability", tax: "Tax", rewards: "Rewards & Referrals",
};

// Finance stays to current-state financial reporting (Profitability + Tax + Rewards) —
// Profitability's former Products/Category/Subcategory/Industry breakdown tables moved to Data
// Visualization's Table mode, and its Trend view moved to Charts & Trends, since a trend line's
// natural home is the tab named for trend lines, not this one.
function AdminAnalyticsFinancePage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [view, setView] = useState<FinanceView>("profitability");

  const [profitability, setProfitability] = useState<Profitability | null>(null);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);
  const [priorProfitability, setPriorProfitability] = useState<Profitability | null>(null);
  const [projection, setProjection] = useState<MonthlyProjection | null>(null);
  const [projectionLoading, setProjectionLoading] = useState(false);

  const [tax, setTax] = useState<TaxReport | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [rewards, setRewards] = useState<RewardsEconomics | null>(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [priorRewards, setPriorRewards] = useState<RewardsEconomics | null>(null);

  useEffect(() => { document.title = "Finance · Moments admin"; }, []);

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
    const { from, to } = priorRange(range.from, range.to);
    getRewardsEconomics(from, to)
      .then((res) => { if (!cancelled) setPriorRewards(res); })
      .catch((err) => reportAdminError(err, "Failed to load prior-period rewards comparison"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  function exportPayload() {
    switch (view) {
      case "profitability": return profitabilityExportPayload(profitability, projection);
      case "tax": return taxExportPayload(tax);
      case "rewards": return rewardsExportPayload(rewards);
    }
  }

  return (
    <AdminLayout title="Analytics · Finance" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(Object.keys(VIEW_LABELS) as FinanceView[]).map((v) => (
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
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: `Analytics · Finance · ${VIEW_LABELS[view]}`,
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: `analytics-finance-${view}`,
                ...exportPayload(),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            {view === "profitability" && (
              <ProfitabilitySection
                profitability={profitability} profitabilityLoading={profitabilityLoading} priorProfitability={priorProfitability}
                projection={projection} projectionLoading={projectionLoading}
              />
            )}
            {view === "tax" && <TaxSection tax={tax} taxLoading={taxLoading} />}
            {view === "rewards" && <RewardsSection rewards={rewards} rewardsLoading={rewardsLoading} priorRewards={priorRewards} />}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsFinancePage;
