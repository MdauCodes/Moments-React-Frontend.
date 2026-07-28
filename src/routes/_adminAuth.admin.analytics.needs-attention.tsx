import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { AlertsPanel } from "@/components/admin/AlertsPanel";
import { formatKes, formatDate } from "@/components/admin/commerceUi";
import { STATUS } from "@/lib/analyticsPalette";
import { getNeedsAttention, type NeedsAttentionSummary } from "@/services/commerceApi";

// Proactive signals an admin would otherwise only notice by chance — combines the existing live
// AlertsPanel (stale orders, failed payments, stock, refunds) with four new signals computed
// server-side: customers who've gone quiet (2x their own average reorder gap), sales metrics down
// 20%+ vs. the prior 30 days, dead-stock products, and flagged (never auto-restricted) accounts
// sharing a registration IP.
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
    && data.suspiciousAccounts.length === 0;

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
            <span>No lapsed customers, sales drops, dead stock, or flagged accounts right now.</span>
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
