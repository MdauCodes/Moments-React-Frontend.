
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { getGeographicAnalytics, type GeographicAnalytics } from "@/services/commerceApi";
import { GeographicSection, geographicExportPayload } from "@/components/admin/analyticsPages/GeographicSection";

// Standalone tab (previously buried inside the "Sales" composite page's internal switcher) —
// narrowed per the analytics-restructuring pass so the nav name alone tells an admin what's here.
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

  return (
    <AdminLayout title="Analytics · Geographic" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div />
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Geographic",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-geographic",
                ...geographicExportPayload(geo),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            <GeographicSection geo={geo} geoLoading={geoLoading} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsGeographicPage;
