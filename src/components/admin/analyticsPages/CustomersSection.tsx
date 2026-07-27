import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard, accountTypeLabel } from "@/components/admin/analyticsUi";
import { ShareDonutChart, RankedBarChart } from "@/components/admin/analyticsCharts";
import { PeriodDeltaGrid, type MetricDeltaSpec } from "@/components/admin/PeriodDeltaGrid";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import type { CustomerAnalytics } from "@/services/commerceApi";

/** Extracted verbatim from the former standalone Customers page — presentational only, data
 *  fetching lives in the Sales tab's composite page. */
export function CustomersSection({
  customers, customersLoading, priorCustomers,
}: {
  customers: CustomerAnalytics | null;
  customersLoading: boolean;
  priorCustomers: CustomerAnalytics | null;
}) {
  const customerMetrics: MetricDeltaSpec[] | null = customers && priorCustomers ? [
    { label: "New paying customers", current: customers.newPayingCustomersInRange, prior: priorCustomers.newPayingCustomersInRange, goodDirection: "up", formatValue: (v) => v.toLocaleString() },
    { label: "First-order value", current: customers.newCustomerFirstOrderValueKes, prior: priorCustomers.newCustomerFirstOrderValueKes, goodDirection: "up", formatValue: formatKes },
  ] : null;

  return (
    <>
      {customerMetrics && <div style={{ marginBottom: 14 }}><PeriodDeltaGrid title="What changed vs the prior period" metrics={customerMetrics} /></div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard
          label="New paying customers"
          value={customersLoading || !customers ? "—" : customers.newPayingCustomersInRange.toLocaleString()}
          sub={customersLoading || !customers ? undefined : `${formatKes(customers.newCustomerFirstOrderValueKes)} in first-order value`}
          info="A customer's first-ever PAID order falling in this period — not the same as when they signed up (see Signups & Demographics)."
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
    </>
  );
}

export function customersExportPayload(customers: CustomerAnalytics | null) {
  return {
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
  };
}
