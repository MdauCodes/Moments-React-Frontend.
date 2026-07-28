
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { priorRange } from "@/lib/analyticsInsights";
import { getCustomerAnalytics, type CustomerAnalytics } from "@/services/commerceApi";
import { CustomersSection, customersExportPayload } from "@/components/admin/analyticsPages/CustomersSection";

// Standalone tab (previously buried inside the "Sales" composite page's internal switcher) —
// narrowed per the analytics-restructuring pass so the nav name alone tells an admin what's here.
function AdminAnalyticsCustomersPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);

  const [customers, setCustomers] = useState<CustomerAnalytics | null>(null);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [priorCustomers, setPriorCustomers] = useState<CustomerAnalytics | null>(null);

  useEffect(() => { document.title = "Customers · Moments admin"; }, []);

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
    const { from, to } = priorRange(range.from, range.to);
    getCustomerAnalytics(from, to)
      .then((res) => { if (!cancelled) setPriorCustomers(res); })
      .catch((err) => reportAdminError(err, "Failed to load prior-period customer comparison"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  return (
    <AdminLayout title="Analytics · Customers" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div />
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Customers",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-customers",
                ...customersExportPayload(customers),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            <CustomersSection customers={customers} customersLoading={customersLoading} priorCustomers={priorCustomers} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsCustomersPage;
