
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { updateOrderStatus } from "@/services/commerceApi";
import { AgeBadge, formatDateShort, OrderStatusBadge } from "@/components/admin/commerceUi";
import { QueueFreshness } from "@/components/admin/QueueFreshness";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import type { OrderRecord, OrderStatus } from "@/services/commerceMock";



function PreparationQueuePage() {
  const allowed = useRequirePermission([PERM.ORDER_PREPARE, PERM.ORDER_MANAGE_ALL]);
  const { user } = useAuth();
  const { orders, initialLoading, refresh } = useAdminOrders();
  const [busyId, setBusyId] = useState<string | null>(null);

  const currentUserId = user?.id;
  const rows = useMemo(
    () =>
      orders
        .filter((o) =>
          ((o.status === "PAYMENT_VERIFIED" || o.status === "IN_PRODUCTION") && o.paymentStatus === "PAID") ||
          (!!currentUserId && o.assignedToId === currentUserId),
        )
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [orders, currentUserId],
  );

  if (!allowed) return null;

  const advance = async (o: OrderRecord, next: OrderStatus, label: string) => {
    setBusyId(o.id);
    try {
      await updateOrderStatus(o.id, next);
      toast.success(`${label}: ${o.reference}`);
      await refresh();
    } catch (err) {
      reportAdminError(err, "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout title="Preparation queue" onReload={() => void refresh()}>
      <div className="admin-page-stack">
        <HelpAnchor>
          <div className="admin-panel">
            <HelpPanel title="Preparation queue">
              <p>Verified orders land here. Click <b>Start Production</b> when you begin assembling, then <b>Mark Ready</b> once packed and labelled. Orders then flow to the Dispatch queue.</p>
            </HelpPanel>
            <QueueFreshness />

            {/* Desktop table */}
            <div data-admin-table-scroll className="admin-hide-on-mobile-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>County</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {initialLoading ? (
                    <tr><td colSpan={7}><div className="admin-empty">Loading…</div></td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={7}><div className="admin-empty"><b>Nothing to pack yet</b><div style={{fontSize:12,marginTop:4,color:"var(--admin-muted)"}}>Orders appear here after the payments team verifies them. You'll see work as soon as it's ready.</div></div></td></tr>
                  ) : rows.map((o) => (
                    <tr key={o.id}>
                      <td><b>{o.reference}</b></td>
                      <td>{o.customerName}</td>
                      <td style={{ maxWidth: 340 }}>{o.items.map((i) => i.name).join(", ")}</td>
                      <td>{o.county ?? "—"}</td>
                      <td><OrderStatusBadge status={o.status} /></td>
                      <td>
                        {formatDateShort(o.createdAt)} <AgeBadge since={o.createdAt} />
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {o.status === "PAYMENT_VERIFIED" && (
                          <button
                            className="admin-btn admin-btn-primary"
                            disabled={busyId === o.id}
                            onClick={() => void advance(o, "IN_PRODUCTION", "Started production")}
                          >
                            Start Production
                          </button>
                        )}
                        {o.status === "IN_PRODUCTION" && (
                          <button
                            className="admin-btn admin-btn-primary"
                            disabled={busyId === o.id}
                            onClick={() => void advance(o, "READY_FOR_DISPATCH", "Marked ready")}
                          >
                            Mark Ready
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="admin-show-mobile admin-card-list" style={{ marginTop: 8 }}>
              {initialLoading ? (
                <div className="admin-empty">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="admin-empty"><b>Nothing to pack yet</b><div style={{fontSize:12,marginTop:4,color:"var(--admin-muted)"}}>Orders appear here after the payments team verifies them. You'll see work as soon as it's ready.</div></div>
              ) : rows.map((o) => (
                <div key={o.id} className="admin-card">
                  <div className="admin-card-row"><b>{o.reference}</b><OrderStatusBadge status={o.status} /></div>
                  <div className="admin-card-row"><span>{o.customerName}</span><span style={{ color: "var(--admin-muted)" }}>{o.county ?? "—"}</span></div>
                  <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>{o.items.map((i) => i.name).join(", ")}</div>
                  <div className="admin-card-row" style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                    <span>Created {formatDateShort(o.createdAt)}</span>
                    <AgeBadge since={o.createdAt} />
                  </div>
                  <div className="admin-card-actions">
                    {o.status === "PAYMENT_VERIFIED" && (
                      <button
                        className="admin-btn admin-btn-primary"
                        disabled={busyId === o.id}
                        onClick={() => void advance(o, "IN_PRODUCTION", "Started production")}
                      >
                        Start Production
                      </button>
                    )}
                    {o.status === "IN_PRODUCTION" && (
                      <button
                        className="admin-btn admin-btn-primary"
                        disabled={busyId === o.id}
                        onClick={() => void advance(o, "READY_FOR_DISPATCH", "Marked ready")}
                      >
                        Mark Ready
                      </button>
                    )}
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

export default PreparationQueuePage;
