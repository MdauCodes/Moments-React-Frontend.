
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard, accountTypeLabel } from "@/components/admin/analyticsUi";
import { getCustomerAnalytics, type CustomerAnalytics } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";

function AdminAnalyticsCustomersPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [customers, setCustomers] = useState<CustomerAnalytics | null>(null);
  const [customersLoading, setCustomersLoading] = useState(false);

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

  return (
    <AdminLayout title="Analytics · Customers" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div className="admin-label" style={{ marginBottom: 10 }}>Customers</div>
          <DateRangePicker onChange={setRange} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
            <KpiCard
              label="New paying customers"
              value={customersLoading || !customers ? "—" : customers.newPayingCustomersInRange.toLocaleString()}
              sub={customersLoading || !customers ? undefined : `${formatKes(customers.newCustomerFirstOrderValueKes)} in first-order value`}
            />
          </div>

          {!customersLoading && customers && customers.byAccountType.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>Revenue by account type (this period)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {customers.byAccountType.map((a) => (
                  <div key={a.accountType} className="admin-panel" style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{accountTypeLabel(a.accountType)}</div>
                    <div style={{ fontSize: 20, fontFamily: "var(--font-display)" }}>{formatKes(a.revenueKes)}</div>
                    <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>{a.customerCount} customer(s)</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!customersLoading && customers && customers.topCustomersByLifetimeValue.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>Top customers by lifetime value</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {customers.topCustomersByLifetimeValue.map((c, i) => (
                  <div key={i} className="admin-panel" style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{c.name || "—"}</div>
                    <div style={{ fontSize: 20, fontFamily: "var(--font-display)" }}>{formatKes(c.lifetimeRevenueKes)}</div>
                    <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                      {accountTypeLabel(c.accountType)} · {c.lifetimeOrderCount} order(s)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsCustomersPage;
