import { useState } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { AgeBadge, formatDateShort } from "@/components/admin/commerceUi";
import { RiderScanPanel } from "@/components/admin/RiderScanPanel";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import type { OrderRecord } from "@/services/commerceMock";

/**
 * A focused, mobile-first view for the one job staff actually do standing at the loading area
 * with a phone: scan the rider's QR and move on. Deliberately skips DispatchChecklist's contents
 * checklist entirely — that's a separate concern already handled before an order reaches here.
 * Lists TumaBoda orders that haven't been scanned yet — including ones TumaBoda's own webhook
 * has already advanced past "ready for dispatch" on its own, since the scan is an OPTIONAL extra
 * identity check now, not a precondition for the order to move (see
 * PaymentService.handleTumaBodaStatusUpdate's 2026-09-03 promotion note). A successful scan
 * always drops the order out of this list, whichever way it got here.
 */
function RiderVerificationQueuePage() {
  const allowed = useRequirePermission([PERM.ORDER_DISPATCH, PERM.ORDER_MANAGE_ALL]);
  const { orders, initialLoading, refresh } = useAdminOrders();
  const [scanningId, setScanningId] = useState<string | null>(null);

  const awaitingScan = orders.filter(
    (o) =>
      o.fulfillmentType === "TUMABODA_DELIVERY" &&
      !!o.tumabodaDeliveryId &&
      !o.tumabodaRiderVerifiedAt &&
      o.status !== "DELIVERED" &&
      o.status !== "CANCELLED" &&
      o.status !== "REFUNDED",
  );

  if (!allowed) return null;

  const handleVerified = () => {
    setScanningId(null);
    void refresh();
  };

  const renderRow = (o: OrderRecord) => {
    const isScanning = scanningId === o.id;
    return (
      <div key={o.id} className="admin-card" style={{ padding: 14 }}>
        <div className="admin-card-row">
          <b>{o.reference}</b>
          <AgeBadge since={o.createdAt} />
        </div>
        <div className="admin-card-row" style={{ fontSize: 12, color: "var(--admin-muted)" }}>
          <span>{o.customerName}</span>
          <span>{formatDateShort(o.createdAt)}</span>
        </div>
        <div style={{ marginTop: 10 }}>
          {isScanning ? (
            <RiderScanPanel
              orderId={o.id}
              verifiedAt={o.tumabodaRiderVerifiedAt}
              onVerified={handleVerified}
            />
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => setScanningId(o.id)}
            >
              Scan rider QR
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <AdminLayout title="Rider Verification" onReload={() => void refresh()}>
      <div className="admin-page-stack">
        <HelpAnchor>
          <div className="admin-panel">
            <HelpPanel title="Rider verification">
              <p>
                Ask the rider which order they've come for, tap that order below, then scan the QR shown in
                their TumaBoda app. A successful scan verifies the rider and dispatches the order in one step —
                the order drops off this list automatically. Scanning the wrong rider against the wrong order
                is rejected, so a mix-up never gets marked as dispatched.
              </p>
              <p>
                This step is optional — TumaBoda's own status updates move an order along on their own even
                without a scan — but scanning gives you an extra identity check before handoff, and some orders
                here may already show as "in transit" for exactly that reason.
              </p>
            </HelpPanel>

            <div className="admin-section-heading">
              <span>Awaiting rider scan</span>
              <span className="admin-badge admin-badge-muted">{awaitingScan.length}</span>
            </div>

            <div className="admin-card-list" style={{ marginTop: 8 }}>
              {initialLoading ? (
                <div className="admin-empty">Loading…</div>
              ) : awaitingScan.length === 0 ? (
                <div className="admin-empty">
                  <b>Nothing waiting on a rider scan right now</b>
                  <div style={{ fontSize: 12, marginTop: 4, color: "var(--admin-muted)" }}>
                    TumaBoda orders appear here once they're ready for pickup and a rider has been booked.
                  </div>
                </div>
              ) : (
                awaitingScan.map(renderRow)
              )}
            </div>
          </div>
        </HelpAnchor>
      </div>
    </AdminLayout>
  );
}

export default RiderVerificationQueuePage;
