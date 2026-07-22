
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard } from "@/components/admin/analyticsUi";
import { RankedBarChart } from "@/components/admin/analyticsCharts";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import { getGeographicAnalytics, type GeographicAnalytics } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";

function AdminAnalyticsGeographicPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [geo, setGeo] = useState<GeographicAnalytics | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => { document.title = "Geographic · Moments admin"; }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setGeoLoading(true);
    getGeographicAnalytics(range.from, range.to)
      .then((res) => { if (!cancelled) setGeo(res); })
      .catch((err) => reportAdminError(err, "Failed to load geographic analytics"))
      .finally(() => { if (!cancelled) setGeoLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  const totalRevenue = geo?.byCounty.reduce((sum, c) => sum + c.revenueKes, 0) ?? 0;
  const topCounty = geo?.byCounty[0];

  return (
    <AdminLayout title="Analytics · Geographic" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div className="admin-label" style={{ marginBottom: 10 }}>Revenue by county</div>
          <DateRangePicker onChange={setRange} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
            <KpiCard
              label="Counties with paid orders"
              value={geoLoading || !geo ? "—" : geo.byCounty.length.toLocaleString()}
              sub="this period"
            />
            <KpiCard
              label="Top county"
              value={geoLoading || !topCounty ? "—" : topCounty.region}
              sub={geoLoading || !topCounty ? undefined : `${formatKes(topCounty.revenueKes)} · ${topCounty.orderCount} order(s)`}
            />
            <KpiCard
              label="Total paid revenue"
              value={geoLoading || !geo ? "—" : formatKes(totalRevenue)}
              sub="across all counties, this period"
            />
          </div>

          {!geoLoading && geo && geo.byCounty.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>Revenue by county (this period)</div>
              <RankedBarChart
                data={geo.byCounty.map((c) => ({ name: c.region, revenue: c.revenueKes }))}
                dataKey="revenue"
                nameKey="name"
                color={CATEGORICAL[0]}
                valueFormatter={(v) => formatKes(v)}
              />
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsGeographicPage;
