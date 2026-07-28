
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { priorRange } from "@/lib/analyticsInsights";
import { getProfitability, getMonthlyProjection, type Profitability, type MonthlyProjection } from "@/services/commerceApi";
import { ProfitabilitySection, profitabilityExportPayload } from "@/components/admin/analyticsPages/ProfitabilitySection";

// Standalone tab (previously buried inside the "Finance" composite page's internal switcher) —
// narrowed per the analytics-restructuring pass so the nav name alone tells an admin what's here.
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
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Profitability",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-profitability",
                ...profitabilityExportPayload(profitability, projection),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            <ProfitabilitySection
              profitability={profitability} profitabilityLoading={profitabilityLoading} priorProfitability={priorProfitability}
              projection={projection} projectionLoading={projectionLoading}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsProfitabilityPage;
