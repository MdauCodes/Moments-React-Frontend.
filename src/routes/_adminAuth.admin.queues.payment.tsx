
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { updateOrderStatus } from "@/services/commerceApi";
import { AgeBadge, formatDateShort, formatKes } from "@/components/admin/commerceUi";
import { QueueFreshness } from "@/components/admin/QueueFreshness";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import type { OrderRecord } from "@/services/commerceMock";



function PaymentQueuePage() {
  const allowed = useRequirePermission([PERM.ORDER_VERIFY_PAYMENT, PERM.ORDER_MANAGE_ALL]);
  const { user } = useAuth();
  const { orders, initialLoading, refresh } = useAdminOrders();
  const [busyId, setBusyId] = useState<string | null>(null);

  // Strictly PAID + paymentStatus PAID. Also include orders explicitly assigned
  // to the current user so an assignee never loses sight of their work.
  const currentUserId = user?.id;
  const rows = useMemo(
    () => orders.filter(
      (o) =>
        (o.status === "PAID" && o.paymentStatus === "PAID") ||
        (!!currentUserId && o.assignedToId === currentUserId),
    ),
    [orders, currentUserId],
  );

  if (!allowed) return null;

  const verify = async (o: OrderRecord) => {
    if (!confirm(`Confirm payment of ${formatKes(o.total)} is correct for order ${o.reference}?`)) return;
    setBusyId(o.id);
    try {
      await updateOrderStatus(o.id, "PAYMENT_VERIFIED");
      toast.success(`Payment verified for ${o.reference}`);
      await refresh();
    } catch (err) {
      reportAdminError(err, "Verification failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout title="Payment queue" onReload={() => void refresh()}>
      <div className="admin-page-stack">
        <HelpAnchor>
          <div className="admin-panel">
            <HelpPanel title="Payment queue">
              <p>Orders here are awaiting M-Pesa payment confirmation. Cross-check the customer's name, phone and amount against the M-Pesa SMS, then click <b>Verify Payment</b>. Verified orders move automatically to the Preparation queue.</p>
            </HelpPanel>
            <QueueFreshness />
          <div data-admin-table-scroll className="admin-hide-on-mobile-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Total (KES)</th>
                  <th>Items</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {initialLoading ? (
                  <tr><td colSpan={7}><div className="admin-empty">Loading…</div></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7}><div className="admin-empty"><b>No payments to verify</b><div style={{fontSize:12,marginTop:4,color:"var(--admin-muted)"}}>Orders paid via M-Pesa appear here once customers complete payment. Check back shortly.</div></div></td></tr>
                ) : rows.map((o) => (
                  <tr key={o.id}>
                    <td><b>{o.reference}</b></td>
                    <td>{o.customerName}</td>
                    <td>{o.customerPhone}</td>
                    <td><b>{formatKes(o.total)}</b></td>
                    <td>{o.items.reduce((s, i) => s + Number(i.qty ?? 0), 0)} units</td>
                    <td>
                      {formatDateShort(o.createdAt)} <AgeBadge since={o.createdAt} />
                    </td>
                    <td>
                      <button
                        className="admin-btn admin-btn-primary"
                        disabled={busyId === o.id}
                        onClick={() => void verify(o)}
                      >
                        Verify Payment
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="admin-show-mobile admin-card-list" style={{ marginTop: 8, padding: 12 }}>
            {initialLoading ? (
              <div className="admin-empty">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="admin-empty"><b>No payments to verify</b><div style={{fontSize:12,marginTop:4,color:"var(--admin-muted)"}}>Orders paid via M-Pesa appear here once customers complete payment. Check back shortly.</div></div>
            ) : rows.map((o) => (
              <div key={o.id} className="admin-card">
                <div className="admin-card-row"><b>{o.reference}</b><b>{formatKes(o.total)}</b></div>
                <div className="admin-card-row"><span>{o.customerName}</span><span style={{ color: "var(--admin-muted)" }}>{o.customerPhone}</span></div>
                <div className="admin-card-row" style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                  <span>{o.items.reduce((s, i) => s + Number(i.qty ?? 0), 0)} units</span>
                  <span>Created {formatDateShort(o.createdAt)}</span>
                  <AgeBadge since={o.createdAt} />
                </div>
                <div className="admin-card-actions">
                  <button
                    className="admin-btn admin-btn-primary"
                    disabled={busyId === o.id}
                    onClick={() => void verify(o)}
                    style={{ flex: 1 }}
                  >
                    Verify Payment
                  </button>
                </div>
              </div>
            ))}
          </div>
          </div>
        </HelpAnchor>
      </div>
    </AdminLayout>
  );
}

export default PaymentQueuePage;
