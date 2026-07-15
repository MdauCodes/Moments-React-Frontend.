import { Link, useParams } from "react-router-dom";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import {
  MockBanner,
  OrderStatusBadge,
  PaymentStatusBadge,
  formatKes,
  formatDate,
  formatDateShort,
} from "@/components/admin/commerceUi";
import { getCustomer, impersonateCustomer } from "@/services/commerceApi";
import type { CustomerRecord, OrderRecord } from "@/services/commerceMock";
import { downloadCustomerStatementPdf } from "@/lib/pdf";
import { FileText } from "lucide-react";



function AdminCustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerRecord | undefined>();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [source, setSource] = useState<"live" | "mock">("mock");
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(false);

  async function previewDashboard() {
    if (!id) return;
    setPreviewing(true);
    try {
      const session = await impersonateCustomer(id);
      const dashboardPath = session.accountType === "BUSINESS" ? "/account/business" : "/account/merchant";
      const url = `${window.location.origin}${dashboardPath}?impersonate=${encodeURIComponent(session.accessToken)}`;
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start preview");
    } finally {
      setPreviewing(false);
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
        setSource(res.source);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load customer"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

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
                        <td><OrderStatusBadge status={o.status} /></td>
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
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminCustomerDetailPage;
