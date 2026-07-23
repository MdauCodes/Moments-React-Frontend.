
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard, accountTypeLabel } from "@/components/admin/analyticsUi";
import { ShareDonutChart, RankedBarChart } from "@/components/admin/analyticsCharts";
import { PeriodDeltaGrid, type MetricDeltaSpec } from "@/components/admin/PeriodDeltaGrid";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import { priorRange } from "@/lib/analyticsInsights";
import { getCustomerAnalytics, type CustomerAnalytics } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";

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

  const customerMetrics: MetricDeltaSpec[] | null = customers && priorCustomers ? [
    { label: "New paying customers", current: customers.newPayingCustomersInRange, prior: priorCustomers.newPayingCustomersInRange, goodDirection: "up", formatValue: (v) => v.toLocaleString() },
    { label: "First-order value", current: customers.newCustomerFirstOrderValueKes, prior: priorCustomers.newCustomerFirstOrderValueKes, goodDirection: "up", formatValue: formatKes },
  ] : null;

  return (
    <AdminLayout title="Analytics · Customers" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        {customerMetrics && <PeriodDeltaGrid title="What changed vs the prior period" metrics={customerMetrics} />}

        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div className="admin-label" style={{ marginBottom: 0 }}>Customers</div>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Customers",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-customers",
                kpis: [
                  { label: "New paying customers", value: customers ? customers.newPayingCustomersInRange.toLocaleString() : "—" },
                  { label: "First-order value", value: customers ? formatKes(customers.newCustomerFirstOrderValueKes) : "—" },
                ],
                tables: [
                  {
                    title: "Revenue by account type",
                    columns: ["Account type", "Customers", "Revenue (KES)"],
                    rows: (customers?.byAccountType ?? []).map((a) => [accountTypeLabel(a.accountType), a.customerCount, a.revenueKes]),
                  },
                  {
                    title: "Top customers by lifetime value",
                    columns: ["Name", "Account type", "Lifetime orders", "Lifetime revenue (KES)"],
                    rows: (customers?.topCustomersByLifetimeValue ?? []).map((c) => [
                      c.name || "—", accountTypeLabel(c.accountType), c.lifetimeOrderCount, c.lifetimeRevenueKes,
                    ]),
                  },
                ],
              })}
            />
          </div>
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
              <ShareDonutChart
                data={customers.byAccountType.map((a, i) => ({ name: accountTypeLabel(a.accountType), value: a.revenueKes, color: CATEGORICAL[i % CATEGORICAL.length] }))}
                valueFormatter={(v) => formatKes(v)}
                height={180}
              />
            </div>
          )}

          {!customersLoading && customers && customers.topCustomersByLifetimeValue.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>Top customers by lifetime value</div>
              <RankedBarChart
                data={customers.topCustomersByLifetimeValue.map((c) => ({ name: c.name || "—", value: c.lifetimeRevenueKes }))}
                dataKey="value"
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

export default AdminAnalyticsCustomersPage;
