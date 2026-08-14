import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, TrendingDown, Truck } from "lucide-react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { AlertsPanel } from "@/components/admin/AlertsPanel";
import { formatKes, formatDate } from "@/components/admin/commerceUi";
import { STATUS } from "@/lib/analyticsPalette";
import { getNeedsAttention, type NeedsAttentionSummary } from "@/services/commerceApi";
import { fulfillmentLabel } from "@/components/admin/analyticsPages/DeliverySection";

const TUMABODA_REASON_LABEL: Record<string, string> = {
  NO_DELIVERY_CREATED: "Paid, delivery never booked",
  DELIVERY_FAILED: "TumaBoda reported: failed",
  DELIVERY_RETURNED: "TumaBoda reported: returned",
  DELIVERY_CANCELLED: "TumaBoda reported: cancelled",
};

// Proactive signals an admin would otherwise only notice by chance — combines the existing live
// AlertsPanel (stale orders, failed payments, stock, refunds) with five new signals computed
// server-side: customers who've gone quiet (2x their own average reorder gap), sales metrics down
// 20%+ vs. the prior 30 days, dead-stock products, flagged (never auto-restricted) accounts
// sharing a registration IP, and TumaBoda orders needing a human (never booked, or reported
// failed/returned/cancelled).
function AdminAnalyticsNeedsAttentionPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<NeedsAttentionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { document.title = "Needs Attention · Moments admin"; }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getNeedsAttention()
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => reportAdminError(err, "Failed to load Needs Attention"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  const nothingElseToShow = !loading && data
    && data.lapsedCustomers.length === 0
    && data.salesDropAlerts.length === 0
    && data.underperformingProducts.length === 0
    && data.suspiciousAccounts.length === 0
    && data.tumaBodaOrdersNeedingAttention.length === 0
    && data.unconfirmedDeliveries.length === 0;

  return (
    <AdminLayout title="Analytics · Needs Attention" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)" }}>
          A live snapshot, not date-ranged — refresh to recheck. Sales-drop and dead-stock signals
          compare the last 30 days against the 30 days before that.
        </div>

        {data && <AlertsPanel alerts={data.operationalAlerts} />}

        {nothingElseToShow && (
          <div className="admin-panel" style={{ padding: 14, display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: STATUS.good }}>
            <CheckCircle2 size={16} />
            <span>No lapsed customers, sales drops, dead stock, flagged accounts, stuck TumaBoda orders, or unconfirmed deliveries right now.</span>
          </div>
        )}

        {!loading && data && data.tumaBodaOrdersNeedingAttention.length > 0 && (
          <div className="admin-panel" style={{ padding: 14 }}>
            <div className="admin-label" style={{ marginBottom: 10 }}>
              TumaBoda orders needing attention ({data.tumaBodaOrdersNeedingAttention.length})
            </div>
            <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <Truck size={13} color={STATUS.warning} />
              Paid orders whose delivery was never booked, or deliveries TumaBoda itself reported as
              failed/returned/cancelled — previously only discoverable one order at a time.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Reason</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.tumaBodaOrdersNeedingAttention.map((t) => (
                    <tr key={t.orderId}>
                      <td>{t.reference}</td>
                      <td style={{ color: STATUS.warning, fontWeight: 600 }}>
                        {TUMABODA_REASON_LABEL[t.reason] ?? t.reason}
                      </td>
                      <td>{formatDate(t.createdAt)}</td>
                      <td>
                        <Link to={`/admin/orders/${t.orderId}`} className="admin-btn admin-btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && data && data.unconfirmedDeliveries.length > 0 && (
          <div className="admin-panel" style={{ padding: 14 }}>
            <div className="admin-label" style={{ marginBottom: 10 }}>
              Dispatched, unconfirmed by customer ({data.unconfirmedDeliveries.length})
            </div>
            <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 10 }}>
              Dispatched orders the customer hasn't self-confirmed as received on the track-order
              page yet. Not necessarily a problem — most customers won't bother confirming — but
              useful for spot-checking delivery reliability.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Delivery mode</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.unconfirmedDeliveries.map((d) => (
                    <tr key={d.orderId}>
                      <td>{d.reference}</td>
                      <td>{d.fulfillmentType ? fulfillmentLabel(d.fulfillmentType) : "—"}</td>
                      <td>{formatDate(d.createdAt)}</td>
                      <td>
                        <Link to={`/admin/orders/${d.orderId}`} className="admin-btn admin-btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && data && data.salesDropAlerts.length > 0 && (
          <div className="admin-panel" style={{ padding: 14 }}>
            <div className="admin-label" style={{ marginBottom: 10 }}>Sales drop alerts</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {data.salesDropAlerts.map((a, i) => (
                <div key={i} className="admin-panel" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <TrendingDown size={16} color={STATUS.critical} />
                  <div>
                    <div style={{ fontSize: 18, fontFamily: "var(--font-display)" }}>-{a.dropPercent}%</div>
                    <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>{a.metric}</div>
                    <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                      {Number.isInteger(a.currentValue) && Number.isInteger(a.priorValue) && a.metric.includes("orders")
                        ? `${a.currentValue} vs ${a.priorValue}`
                        : `${formatKes(a.currentValue)} vs ${formatKes(a.priorValue)}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && data && data.lapsedCustomers.length > 0 && (
          <div className="admin-panel" style={{ padding: 14 }}>
            <div className="admin-label" style={{ marginBottom: 10 }}>
              Lapsed customers ({data.lapsedCustomers.length})
            </div>
            <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 10 }}>
              Gone quiet for more than 2x their own average time between orders.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Last order</th>
                    <th>Usual gap</th>
                    <th>Days since</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lapsedCustomers.map((c) => (
                    <tr key={c.customerId}>
                      <td>{c.name}</td>
                      <td>{c.email}</td>
                      <td>{formatDate(c.lastOrderAt)}</td>
                      <td>{c.averageGapDays}d</td>
                      <td style={{ color: STATUS.warning, fontWeight: 600 }}>{c.daysSinceLastOrder}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && data && data.underperformingProducts.length > 0 && (
          <div className="admin-panel" style={{ padding: 14 }}>
            <div className="admin-label" style={{ marginBottom: 10 }}>
              Underperforming products ({data.underperformingProducts.length})
            </div>
            <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 10 }}>
              In stock, but zero paid units sold in the last 30 days.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock on hand</th>
                  </tr>
                </thead>
                <tbody>
                  {data.underperformingProducts.map((p) => (
                    <tr key={p.productId}>
                      <td>{p.name}</td>
                      <td>{p.stockCount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && data && data.suspiciousAccounts.length > 0 && (
          <div className="admin-panel" style={{ padding: 14 }}>
            <div className="admin-label" style={{ marginBottom: 10 }}>
              Flagged accounts ({data.suspiciousAccounts.length})
            </div>
            <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={13} color={STATUS.warning} />
              Flag only — a shared IP can be entirely legitimate (household, office, campus wifi). No action taken automatically.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Email</th>
                    <th>Registration IP</th>
                    <th>Accounts sharing it</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suspiciousAccounts.map((s) => (
                    <tr key={s.userId}>
                      <td>{s.name}</td>
                      <td>{s.email}</td>
                      <td>{s.registrationIp}</td>
                      <td>{s.accountsSharingIp}</td>
                      <td>{formatDate(s.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsNeedsAttentionPage;
