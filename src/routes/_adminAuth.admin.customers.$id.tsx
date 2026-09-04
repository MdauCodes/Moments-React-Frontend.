import { Link, useParams } from "react-router-dom";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import {
  MockBanner,
  OrderStatusBadge,
  PaymentStatusBadge,
  formatKes,
  formatDate,
  formatDateShort,
} from "@/components/admin/commerceUi";
import { getCustomer, impersonateCustomer, setCustomerTestAccount } from "@/services/commerceApi";
import type { CustomerRecord, OrderRecord, ReferredCustomer } from "@/services/commerceMock";
import { downloadCustomerStatementPdf } from "@/lib/pdf";
import { FileText } from "lucide-react";
import { useAuth } from "@/contexts/AdminAuthContext";
import { resolveStaffRole } from "@/lib/roles";



function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isSuperAdmin = resolveStaffRole(user) === "SUPER_ADMIN";
  const [customer, setCustomer] = useState<CustomerRecord | undefined>();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [referrals, setReferrals] = useState<ReferredCustomer[]>([]);
  const [source, setSource] = useState<"live" | "mock">("mock");
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [savingTestAccount, setSavingTestAccount] = useState(false);
  // Opened synchronously in the click handler, before the (async) impersonateCustomer call —
  // window.open() after an await is silently blocked by most browsers' popup blockers since it's
  // no longer treated as a direct response to the click.
  const pendingPreviewWindow = useRef<Window | null>(null);

  async function toggleTestAccount() {
    if (!id || !customer) return;
    setSavingTestAccount(true);
    try {
      const updated = await setCustomerTestAccount(id, !customer.isTestAccount);
      setCustomer(updated);
      toast.success(updated.isTestAccount ? "Marked as a test account" : "Unmarked as a test account");
    } catch (err) {
      reportAdminError(err, "Couldn't update test-account status");
    } finally {
      setSavingTestAccount(false);
    }
  }

  function previewDashboard() {
    if (!id) return;
    pendingPreviewWindow.current?.close();
    // No "noopener" here — it makes window.open() always return null (per spec), which would
    // leave this blank tab un-navigable and stuck empty forever.
    pendingPreviewWindow.current = window.open("", "_blank");
    void startPreview(id);
  }

  async function startPreview(customerId: string) {
    setPreviewing(true);
    try {
      const session = await impersonateCustomer(customerId);
      const dashboardPath = session.accountType === "BUSINESS" ? "/account/business" : "/account/merchant";
      const url = `${window.location.origin}${dashboardPath}?impersonate=${encodeURIComponent(session.accessToken)}`;
      if (pendingPreviewWindow.current) {
        pendingPreviewWindow.current.location.href = url;
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch (err) {
      pendingPreviewWindow.current?.close();
      reportAdminError(err, "Couldn't start preview");
    } finally {
      setPreviewing(false);
      pendingPreviewWindow.current = null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getCustomer(id ?? "")
      .then((res) => {
        if (cancelled) return;
        setCustomer(res.customer);
        setOrders(res.orders);
        setReferrals(res.referrals);
        setSource(res.source);
      })
      .catch((err) => reportAdminError(err, "Failed to load customer"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  if (loading) {
    return <AdminLayout title="Customer"><div className="admin-empty">Loading customer…</div></AdminLayout>;
  }
  if (!customer) {
    return (
      <AdminLayout title="Customer not found">
        <div className="admin-empty">
          We couldn't find that customer. <Link to="/admin/customers" className="admin-btn admin-btn-ghost">Back to customers</Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={customer.name}
      actionLabel={previewing ? "Opening preview…" : "Preview dashboard"}
      onAction={previewDashboard}
      onReload={() => setReloadKey((k) => k + 1)}
    >
      <div className="admin-page-stack">
        <MockBanner source={source} />

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)", gap: 16 }} data-admin-detail-grid>
          <div className="admin-panel" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div className="admin-label">Order history</div>
              <button
                className="admin-btn admin-btn-ghost"
                disabled={orders.length === 0}
                onClick={() => {
                  downloadCustomerStatementPdf(customer, orders);
                  toast.success("Statement downloaded");
                }}
              ><FileText size={14} style={{ marginRight: 6 }} />Download statement (PDF)</button>
            </div>
            {orders.length === 0 ? (
              <div className="admin-empty" style={{ marginTop: 10 }}>No orders yet.</div>
            ) : (
              <div data-admin-table-scroll style={{ marginTop: 10 }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Reference</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th>Date</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><b>{o.reference}</b></td>
                        <td>{o.items.reduce((s, it) => s + it.qty, 0)} units</td>
                        <td><b>{formatKes(o.total)}</b></td>
                        <td><OrderStatusBadge status={o.status} fulfillmentType={o.fulfillmentType} statusV2={o.statusV2} /></td>
                        <td><PaymentStatusBadge status={o.paymentStatus} /></td>
                        <td>{formatDateShort(o.createdAt)}</td>
                        <td><Link to={`/admin/orders/${id}`} className="admin-btn admin-btn-ghost">View</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="admin-panel" style={{ padding: 18 }}>
              <div className="admin-label">Lifetime value</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 30, marginTop: 4 }}>{formatKes(customer.lifetimeValue)}</div>
              <div style={{ color: "var(--admin-muted)", fontSize: 12, marginTop: 4 }}>
                {customer.ordersCount} order{customer.ordersCount === 1 ? "" : "s"} · AOV {formatKes(customer.averageOrderValue ?? 0)}
              </div>
            </div>

            <div className="admin-panel" style={{ padding: 18 }}>
              <div className="admin-label">Referrals</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 30, marginTop: 4 }}>
                {customer.referralCount ?? 0}
              </div>
              <div style={{ color: "var(--admin-muted)", fontSize: 12, marginTop: 4 }}>
                customer{customer.referralCount === 1 ? "" : "s"} referred
                {referrals.some((r) => r.status === "CONFIRMED") &&
                  ` · ${referrals.filter((r) => r.status === "CONFIRMED").length} confirmed purchase${referrals.filter((r) => r.status === "CONFIRMED").length === 1 ? "" : "s"}`}
              </div>
              {referrals.length > 0 && (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {referrals.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        fontSize: 12, padding: "8px 0", borderTop: "1px solid var(--admin-border, rgba(0,0,0,0.08))",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.refereeFirstName || r.refereeEmail}</div>
                        <div style={{ color: "var(--admin-muted)" }}>{formatDateShort(r.createdAt)}</div>
                      </div>
                      <span
                        style={{
                          display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                          background: r.status === "CONFIRMED" ? "rgba(34, 197, 94, 0.15)" : r.status === "EXPIRED" ? "rgba(107, 114, 128, 0.18)" : "rgba(234, 179, 8, 0.18)",
                          color: r.status === "CONFIRMED" ? "#15803d" : r.status === "EXPIRED" ? "#374151" : "#a16207",
                        }}
                      >
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="admin-panel" style={{ padding: 18 }}>
              <div className="admin-label">Contact</div>
              <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.7 }}>
                <div><b>{customer.name}</b></div>
                <div>{customer.email}</div>
                <div>{customer.phone}</div>
              </div>
              <div className="admin-label" style={{ marginTop: 14 }}>Default address</div>
              <div style={{ marginTop: 6, fontSize: 13 }}>
                {customer.defaultAddress}<br />
                {customer.city}
              </div>
            </div>

            <div className="admin-panel" style={{ padding: 18 }}>
              <div className="admin-label">Activity</div>
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.8, color: "var(--admin-muted)" }}>
                <div>Segment: <b style={{ color: "var(--admin-text)" }}>{customer.segment}</b></div>
                <div>Status: <b style={{ color: "var(--admin-text)" }}>{customer.status.replace("_", " ")}</b></div>
                <div>First order: {formatDate(customer.firstOrderAt ?? undefined)}</div>
                <div>Last order: {formatDate(customer.lastOrderAt ?? undefined)}</div>
              </div>
            </div>

            {isSuperAdmin && (
              <div className="admin-panel" style={{ padding: 18 }}>
                <div className="admin-label">Sandbox / test mode</div>
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--admin-muted)", lineHeight: 1.6 }}>
                  A designated test account. Any order it places routes to sandbox payment/courier
                  gateways and is excluded from all revenue and analytics reporting. Never affects
                  orders already placed.
                </p>
                <label style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={!!customer.isTestAccount}
                    disabled={savingTestAccount}
                    onChange={() => void toggleTestAccount()}
                  />
                  This is a test account
                  {customer.isTestAccount && (
                    <span style={{
                      display: "inline-flex", padding: "1px 6px", borderRadius: 999,
                      fontSize: 10, fontWeight: 700, background: "rgba(234, 179, 8, 0.18)", color: "#a16207",
                    }}>TEST</span>
                  )}
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminCustomerDetailPage;
