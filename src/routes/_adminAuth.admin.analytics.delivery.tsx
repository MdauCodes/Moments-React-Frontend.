
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { getDeliveryAnalytics, type DeliveryAnalytics } from "@/services/commerceApi";
import { DeliverySection, deliveryExportPayload } from "@/components/admin/analyticsPages/DeliverySection";

// Standalone tab (previously buried inside the "Sales" composite page's internal switcher) —
// narrowed per the analytics-restructuring pass so the nav name alone tells an admin what's here.
function AdminAnalyticsDeliveryPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);

  const [delivery, setDelivery] = useState<DeliveryAnalytics | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  useEffect(() => { document.title = "Delivery · Moments admin"; }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setDeliveryLoading(true);
    getDeliveryAnalytics(range.from, range.to)
      .then((res) => { if (!cancelled) setDelivery(res); })
      .catch((err) => reportAdminError(err, "Failed to load delivery analytics"))
      .finally(() => { if (!cancelled) setDeliveryLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  return (
    <AdminLayout title="Analytics · Delivery" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div />
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Delivery",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-delivery",
                ...deliveryExportPayload(delivery),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            <DeliverySection delivery={delivery} deliveryLoading={deliveryLoading} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsDeliveryPage;
