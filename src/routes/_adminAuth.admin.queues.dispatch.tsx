
import { useCallback, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { AgeBadge, formatDateShort } from "@/components/admin/commerceUi";
import { DispatchChecklist } from "@/components/admin/DispatchChecklist";
import { QueueFreshness } from "@/components/admin/QueueFreshness";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import type { OrderRecord } from "@/services/commerceMock";



const DISPATCHED_STATUSES = new Set(["DISPATCHED", "DELIVERED"]);

function DispatchedBadge({ status }: { status: string }) {
  return (
    <span
      className="admin-badge"
      style={{
        background: "#dcfce7",
        color: "#166534",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <CheckCircle2 size={11} />
      {status === "DELIVERED" ? "Delivered" : "Dispatched"}
    </span>
  );
}

function ReadyBadge() {
  return (
    <span
      className="admin-badge"
      style={{ background: "#fef3c7", color: "#92400e" }}
    >
      Ready
    </span>
  );
}

function DispatchQueuePage() {
  const allowed = useRequirePermission([PERM.ORDER_DISPATCH, PERM.ORDER_MANAGE_ALL]);
  const { user } = useAuth();
  const { orders, initialLoading, refresh } = useAdminOrders();
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const currentUserId = user?.id;

  const ready = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "READY_FOR_DISPATCH" &&
          o.paymentStatus === "PAID" &&
          !DISPATCHED_STATUSES.has(o.status) &&
          // Pickup never gets "dispatched" — the customer collects in person, staff mark it
          // picked up from the order detail page instead. See getNextActionV2.
          o.fulfillmentType !== "PICKUP",
      ),
    [orders],
  );

  const recentlyDispatched = useMemo(
    () =>
      orders.filter(
        (o) =>
          !!currentUserId &&
          o.assignedToId === currentUserId &&
          DISPATCHED_STATUSES.has(o.status),
      ),
    [orders, currentUserId],
  );

  const openOrder: OrderRecord | null = useMemo(
    () =>
      openOrderId
        ? [...ready, ...recentlyDispatched].find((o) => o.id === openOrderId) ?? null
        : null,
    [openOrderId, ready, recentlyDispatched],
  );

  const handleClose = useCallback(() => setOpenOrderId(null), []);
  const handleDispatched = useCallback(async () => {
    setOpenOrderId(null);
    await refresh();
  }, [refresh]);

  if (!allowed) return null;

  const renderDesktopRow = (o: OrderRecord, dispatched: boolean) => (
    <tr key={o.id} style={dispatched ? { background: "color-mix(in oklab, #dcfce7 28%, transparent)" } : undefined}>
      <td>
        <b>{o.reference}</b>{" "}
        {dispatched ? <DispatchedBadge status={o.status} /> : <ReadyBadge />}
      </td>
      <td>{o.customerName}</td>
      <td>{o.customerPhone}</td>
      <td>{o.county ?? "—"}</td>
      <td>
        {o.fulfillmentType ?? "—"}
        {o.fulfillmentType === "MANUAL_DELIVERY" && o.courierType && (
          <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>{o.courierType}</div>
        )}
      </td>
      <td>
        {formatDateShort(o.createdAt)} {!dispatched && <AgeBadge since={o.createdAt} />}
      </td>
      <td>
        {dispatched ? (
          <button
            className="admin-btn admin-btn-ghost"
            onClick={() => setOpenOrderId(o.id)}
            title="Already dispatched — view details only"
          >
            View details
          </button>
        ) : (
          <button className="admin-btn admin-btn-primary" onClick={() => setOpenOrderId(o.id)}>
            Open Checklist
          </button>
        )}
      </td>
    </tr>
  );

  const renderMobileCard = (o: OrderRecord, dispatched: boolean) => (
    <div
      key={o.id}
      className="admin-card"
      style={dispatched ? { background: "color-mix(in oklab, #dcfce7 22%, var(--admin-surface))", borderColor: "#86efac" } : undefined}
    >
      <div className="admin-card-row">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <b>{o.reference}</b>
          {dispatched ? <DispatchedBadge status={o.status} /> : <ReadyBadge />}
        </span>
        <span style={{ fontSize: 11, color: "var(--admin-muted)" }}>{o.fulfillmentType ?? "—"}</span>
      </div>
      <div className="admin-card-row">
        <span>{o.customerName}</span>
        <span style={{ color: "var(--admin-muted)" }}>{o.county ?? "—"}</span>
      </div>
      <div className="admin-card-row" style={{ fontSize: 11, color: "var(--admin-muted)" }}>
        <span>{o.customerPhone}</span>
        <span>Created {formatDateShort(o.createdAt)}</span>
        {!dispatched && <AgeBadge since={o.createdAt} />}
      </div>
      <div className="admin-card-actions">
        {dispatched ? (
          <button
            className="admin-btn admin-btn-ghost"
            onClick={() => setOpenOrderId(o.id)}
            style={{ flex: 1 }}
          >
            View details
          </button>
        ) : (
          <button
            className="admin-btn admin-btn-primary"
            onClick={() => setOpenOrderId(o.id)}
            style={{ flex: 1 }}
          >
            Open Checklist
          </button>
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout title="Dispatch queue" onReload={() => void refresh()}>
      <div className="admin-page-stack">
        <HelpAnchor>
          <div className="admin-panel">
            <HelpPanel title="Dispatch queue">
              <p>
                Orders in <b>Ready</b> are produced and waiting for hand-off. Click <b>Open Checklist</b>, tick what
                you packed and confirm. Already dispatched orders move into the <b>Recently dispatched</b> section
                so you never send the same order twice.
              </p>
            </HelpPanel>
            <QueueFreshness />

            {/* READY SECTION */}
            <div className="admin-section-heading">
              <span>Ready to dispatch</span>
              <span className="admin-badge admin-badge-muted">{ready.length}</span>
            </div>
            <div data-admin-table-scroll className="admin-hide-on-mobile-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>County</th>
                    <th>Fulfillment</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {initialLoading ? (
                    <tr><td colSpan={7}><div className="admin-empty">Loading…</div></td></tr>
                  ) : ready.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="admin-empty">
                          <b>No orders ready to dispatch</b>
                          <div style={{ fontSize: 12, marginTop: 4, color: "var(--admin-muted)" }}>
                            Orders appear here once the packaging team marks them ready.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ready.map((o) => renderDesktopRow(o, false))
                  )}
                </tbody>
              </table>
            </div>
            <div className="admin-show-mobile admin-card-list" style={{ marginTop: 8, padding: 12 }}>
              {initialLoading ? (
                <div className="admin-empty">Loading…</div>
              ) : ready.length === 0 ? (
                <div className="admin-empty">
                  <b>No orders ready to dispatch</b>
                </div>
              ) : (
                ready.map((o) => renderMobileCard(o, false))
              )}
            </div>

            {/* RECENTLY DISPATCHED SECTION */}
            {recentlyDispatched.length > 0 && (
              <>
                <div className="admin-section-heading" style={{ marginTop: 8 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle2 size={14} color="#166534" />
                    Recently dispatched
                  </span>
                  <span
                    className="admin-badge"
                    style={{ background: "#dcfce7", color: "#166534" }}
                  >
                    {recentlyDispatched.length}
                  </span>
                </div>
                <div data-admin-table-scroll className="admin-hide-on-mobile-table">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Reference</th>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>County</th>
                        <th>Fulfillment</th>
                        <th>Created</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {recentlyDispatched.map((o) => renderDesktopRow(o, true))}
                    </tbody>
                  </table>
                </div>
                <div className="admin-show-mobile admin-card-list" style={{ marginTop: 8, padding: 12 }}>
                  {recentlyDispatched.map((o) => renderMobileCard(o, true))}
                </div>
              </>
            )}
          </div>
        </HelpAnchor>
      </div>
      <DispatchChecklist order={openOrder} onClose={handleClose} onDispatched={handleDispatched} />
    </AdminLayout>
  );
}

export default DispatchQueuePage;
