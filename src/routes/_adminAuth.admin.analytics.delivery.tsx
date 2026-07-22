
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { KpiCard } from "@/components/admin/analyticsUi";
import { RankedBarChart } from "@/components/admin/analyticsCharts";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import { getDeliveryAnalytics, type DeliveryAnalytics } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";

function fulfillmentLabel(type: string): string {
  const labels: Record<string, string> = {
    ZONE_DELIVERY: "Zone delivery", PICKUP: "Pickup", OWN_COURIER: "Own courier",
  };
  return labels[type] ?? type;
}

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
          <div className="admin-label" style={{ marginBottom: 10 }}>Delivery performance</div>
          <DateRangePicker onChange={setRange} />
          <div style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 6 }}>
            Delivery rate counts only orders that reached a resolved outcome (delivered or cancelled) —
            orders still in transit aren't counted as a failure.
          </div>

          {!deliveryLoading && delivery && delivery.byFulfillmentType.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
                {delivery.byFulfillmentType.map((d) => (
                  <KpiCard
                    key={d.fulfillmentType}
                    label={fulfillmentLabel(d.fulfillmentType)}
                    value={`${d.deliveryRatePercent}%`}
                    sub={`${d.deliveredCount} delivered · ${d.cancelledCount} cancelled · ${d.totalOrders} total orders`}
                    badges={d.deliverySampleCount === 0 ? undefined : [{ label: `avg ${d.avgDeliveryHours}h dispatch→delivery`, tone: "info" }]}
                  />
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <div className="admin-label" style={{ marginBottom: 8 }}>Orders by fulfillment type (this period)</div>
                <RankedBarChart
                  data={delivery.byFulfillmentType.map((d) => ({ name: fulfillmentLabel(d.fulfillmentType), total: d.totalOrders }))}
                  dataKey="total"
                  nameKey="name"
                  color={CATEGORICAL[0]}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsDeliveryPage;
