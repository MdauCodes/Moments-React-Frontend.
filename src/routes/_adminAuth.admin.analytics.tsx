
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { Download, Package, ShoppingBag, Users, MessageSquare, Sparkles } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard, statusLabel } from "@/components/admin/analyticsUi";
import {
  getAnalyticsOverview, exportOrders, exportCustomers, getRevenueSummary, getOperationsSummary,
  type AnalyticsResult, type RevenueSummary, type OperationsSummary,
} from "@/services/commerceApi";
import { downloadCsv, toCsv } from "@/lib/csv";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";

function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [range, setRange] = useState<DateRange | null>(null);
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [ops, setOps] = useState<OperationsSummary | null>(null);
  const [opsLoading, setOpsLoading] = useState(false);

  useEffect(() => { document.title = "Analytics · Moments admin"; }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAnalyticsOverview()
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => reportAdminError(err, "Failed to load analytics"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setRevenueLoading(true);
    getRevenueSummary(range.from, range.to)
      .then((res) => { if (!cancelled) setRevenue(res); })
      .catch((err) => reportAdminError(err, "Failed to load revenue summary"))
      .finally(() => { if (!cancelled) setRevenueLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setOpsLoading(true);
    getOperationsSummary(range.from, range.to)
      .then((res) => { if (!cancelled) setOps(res); })
      .catch((err) => reportAdminError(err, "Failed to load operations summary"))
      .finally(() => { if (!cancelled) setOpsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  async function handleExport(kind: "orders" | "customers") {
    try {
      setExporting(kind);
      const stamp = new Date().toISOString().slice(0, 10);
      if (kind === "orders") {
        const { rows } = await exportOrders();
        const flat = rows.map((o) => ({
          reference: o?.reference ?? "", status: o?.status ?? "", payment: o?.paymentStatus ?? "", gateway: o?.paymentGateway ?? "",
          customer: o?.customerName ?? "", email: o?.customerEmail ?? "", phone: o?.customerPhone ?? "", city: o?.city ?? "",
          items: o?.items?.length ?? 0, subtotal: o?.subtotal ?? 0, shipping: o?.shippingFee ?? 0, total: o?.total ?? 0,
          createdAt: o?.createdAt ?? "", tracking: o?.trackingNumber ?? "",
        }));
        downloadCsv(`orders-${stamp}.csv`, toCsv(flat));
      } else {
        const { rows } = await exportCustomers();
        downloadCsv(`customers-${stamp}.csv`, toCsv(rows.map((c) => ({
          name: c?.name ?? "", email: c?.email ?? "", phone: c?.phone ?? "", city: c?.city ?? "", segment: c?.segment ?? "", status: c?.status ?? "",
          orders: c?.ordersCount ?? 0, lifetimeValue: c?.lifetimeValue ?? 0, aov: c?.averageOrderValue ?? 0,
          firstOrder: c?.firstOrderAt ?? "", lastOrder: c?.lastOrderAt ?? "",
        }))));
      }
      toast.success(`Exported ${kind}.csv`);
    } catch (err) {
      reportAdminError(err, "Export failed");
    } finally {
      setExporting(null);
    }
  }

  const placeholder = loading || !data ? "—" : null;

  return (
    <AdminLayout title="Analytics · Overview" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ fontSize: 13, color: "var(--admin-muted)" }}>
            Live operational snapshot from the backend. See the Analytics section in the sidebar for Rewards, Tax, Products, Profitability and Customers.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="admin-btn admin-btn-ghost" disabled={!!exporting} onClick={() => handleExport("orders")}>
              <Download size={14} style={{ marginRight: 6 }} />Orders CSV
            </button>
            <button className="admin-btn admin-btn-ghost" disabled={!!exporting} onClick={() => handleExport("customers")}>
              <Download size={14} style={{ marginRight: 6 }} />Customers CSV
            </button>
          </div>
        </div>

        {/* Revenue & payment health — filterable by date range. */}
        <div className="admin-panel" style={{ padding: 14 }}>
          <div className="admin-label" style={{ marginBottom: 10 }}>Revenue & payment health</div>
          <DateRangePicker onChange={setRange} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
            <KpiCard
              label="Paid revenue"
              value={revenueLoading || !revenue ? "—" : formatKes(revenue.paidRevenue)}
              sub={revenueLoading || !revenue ? undefined : `${revenue.paidOrderCount} paid order(s) · avg ${formatKes(revenue.averageOrderValue)}`}
            />
            <KpiCard
              label="Pending payment"
              value={revenueLoading || !revenue ? "—" : formatKes(revenue.pendingPaymentValue)}
              sub={revenueLoading || !revenue ? undefined : `${revenue.pendingOrderCount} order(s) awaiting payment`}
              badges={revenueLoading || !revenue || revenue.pendingOrderCount === 0 ? undefined : [{ label: "not revenue", tone: "warn" }]}
            />
            <KpiCard
              label="Failed payment"
              value={revenueLoading || !revenue ? "—" : formatKes(revenue.failedPaymentValue)}
              sub={revenueLoading || !revenue ? undefined : `${revenue.failedOrderCount} order(s)`}
            />
            <KpiCard
              label="Refunded"
              value={revenueLoading || !revenue ? "—" : formatKes(revenue.refundedValue)}
              sub={revenueLoading || !revenue ? undefined : `${revenue.refundedOrderCount} order(s)`}
            />
          </div>

          {!revenueLoading && revenue && revenue.byMethod.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>Payment success rate by method</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {revenue.byMethod.map((m) => (
                  <div key={m.method} className="admin-panel" style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{m.method}</div>
                    <div style={{ fontSize: 20, fontFamily: "var(--font-display)" }}>{m.successRatePercent}%</div>
                    <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                      {m.successCount} success · {m.failedCount} failed{m.otherCount > 0 ? ` · ${m.otherCount} pending` : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Order funnel & operations — same date range as revenue above. */}
        <div className="admin-panel" style={{ padding: 14 }}>
          <div className="admin-label" style={{ marginBottom: 10 }}>Order funnel & operations</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <KpiCard
              label="Total orders"
              value={opsLoading || !ops ? "—" : ops.totalOrders.toLocaleString()}
            />
            <KpiCard
              label="Cancellation rate"
              value={opsLoading || !ops ? "—" : `${ops.cancellationRatePercent}%`}
              sub={opsLoading || !ops ? undefined : `${ops.cancelledOrders} cancelled`}
            />
            <KpiCard
              label="Repeat customers"
              value={opsLoading || !ops ? "—" : `${ops.repeatCustomerRatePercent}%`}
              sub={opsLoading || !ops ? undefined : `${ops.repeatCustomerCount} of ${ops.distinctCustomerCount} buyer(s) had ordered before`}
            />
            <KpiCard
              label="Refunds requested"
              value={opsLoading || !ops ? "—" : formatKes(ops.refundRequestedValue)}
              sub={opsLoading || !ops ? undefined : `${ops.refundRequestedCount} request(s) · ${ops.refundResolvedCount} resolved${ops.refundResolvedCount > 0 ? `, avg ${ops.avgRefundResolutionHours}h` : ""}`}
            />
          </div>

          {!opsLoading && ops && ops.funnel.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>Status funnel (orders placed in this period)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {ops.funnel.map((f) => {
                  const duration = ops.avgTimeInStage.find((d) => d.status === f.status);
                  return (
                    <div key={f.status} className="admin-panel" style={{ padding: "10px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{statusLabel(f.status)}</div>
                      <div style={{ fontSize: 20, fontFamily: "var(--font-display)" }}>{f.count}</div>
                      {duration && (
                        <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                          avg {duration.avgHours}h in stage ({duration.sampleCount} completed)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legacy operational snapshot — fixed today/week/MTD windows and counts (products, users,
            enquiries, leads) that the date-ranged sections above don't cover. Kept as-is: still the
            only source for these specific figures. Note its revenue figures use a different
            definition (not PAID-only) than "Revenue & payment health" above — treat them as a quick
            operational glance, not a reconciliation source. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }} data-admin-stats>
          <KpiCard
            label="Revenue (today)"
            value={placeholder ?? formatKes(data!.revenueToday)}
            sub={placeholder ? undefined : `Week ${formatKes(data!.revenueWeek)} · MTD ${formatKes(data!.revenueMTD)}`}
          />
          <KpiCard
            label="Orders (today)"
            value={placeholder ?? String(data!.ordersToday)}
            sub={placeholder ? undefined : `${data!.ordersTotal.toLocaleString()} orders all-time`}
            icon={<ShoppingBag size={16} />}
            badges={placeholder ? undefined : [
              { label: `${data!.ordersPending} pending`, tone: "warn" },
              { label: `${data!.ordersInProd} in production`, tone: "info" },
            ]}
          />
          <KpiCard
            label="Total products"
            value={placeholder ?? data!.totalProducts.toLocaleString()}
            icon={<Package size={16} />}
          />
          <KpiCard
            label="Total users"
            value={placeholder ?? data!.totalUsers.toLocaleString()}
            icon={<Users size={16} />}
          />
          <KpiCard
            label="Enquiries"
            value={placeholder ?? data!.totalEnquiries.toLocaleString()}
            icon={<MessageSquare size={16} />}
          />
          <KpiCard
            label="Leads"
            value={placeholder ?? data!.totalLeads.toLocaleString()}
            icon={<Sparkles size={16} />}
          />
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsPage;
