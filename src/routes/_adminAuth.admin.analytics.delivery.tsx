
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { useAuth } from "@/contexts/AdminAuthContext";
import { resolveStaffRole } from "@/lib/roles";
import { getDeliveryAnalytics, getCheckoutFunnelByMode, type DeliveryAnalytics, type CheckoutFunnelModeSummary } from "@/services/commerceApi";
import { DeliverySection, deliveryExportPayload } from "@/components/admin/analyticsPages/DeliverySection";
import { FunnelByModeSection, funnelByModeExportTable } from "@/components/admin/analyticsPages/FunnelByModeSection";

// Standalone tab (previously buried inside the "Sales" composite page's internal switcher) —
// narrowed per the analytics-restructuring pass so the nav name alone tells an admin what's here.
function AdminAnalyticsDeliveryPage() {
  const { user } = useAuth();
  const isSuperAdmin = resolveStaffRole(user) === "SUPER_ADMIN";

  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [funnelDays, setFunnelDays] = useState(30);

  const [delivery, setDelivery] = useState<DeliveryAnalytics | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);

  const [funnelByMode, setFunnelByMode] = useState<CheckoutFunnelModeSummary[] | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);

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

  // Sessions that carry customer email/phone are super-admin-only data (matches the backend's
  // @IsSuperAdmin gate on the checkout-funnel endpoints) — only fetch it for admins who can see
  // it, so a staff/admin viewer just doesn't get this section rather than seeing a 403 toast.
  useEffect(() => {
    if (!isSuperAdmin) return;
    let cancelled = false;
    setFunnelLoading(true);
    getCheckoutFunnelByMode(funnelDays)
      .then((res) => { if (!cancelled) setFunnelByMode(res); })
      .catch((err) => reportAdminError(err, "Failed to load checkout funnel by mode"))
      .finally(() => { if (!cancelled) setFunnelLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, funnelDays, reloadKey]);

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
                tables: [
                  ...deliveryExportPayload(delivery).tables,
                  ...(isSuperAdmin ? [funnelByModeExportTable(funnelByMode)] : []),
                ],
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            <DeliverySection delivery={delivery} deliveryLoading={deliveryLoading} />
          </div>
        </div>

        {isSuperAdmin && (
          <div className="admin-panel" style={{ padding: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Checkout funnel drop-off, by delivery mode</h3>
              <label className="admin-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Window
                <select className="admin-input" value={funnelDays} onChange={(e) => setFunnelDays(Number(e.target.value))}>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </label>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--admin-muted)", margin: "0 0 14px" }}>
              Of the anonymous checkout sessions that settled on each delivery mode, how many
              actually went on to place an order. Super-admin only, since sessions carry the
              customer's email/phone once they reach the contact step.
            </p>
            <FunnelByModeSection modes={funnelByMode} loading={funnelLoading} />
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsDeliveryPage;
