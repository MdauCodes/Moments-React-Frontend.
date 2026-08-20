import { Loader2, CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Section, Row } from "@/components/admin/AdminSectionUi";
import { GenericNextActionButton } from "@/components/admin/GenericNextActionButton";
import { RiderScanPanel } from "@/components/admin/RiderScanPanel";
import { DeliveryConfirmationSection } from "@/components/admin/DeliveryConfirmationSection";
import { DeliveryNoteButton } from "@/components/admin/DeliveryNoteButton";
import { TumaBodaTrackingWidget, buildTumaBodaTrackingUrl } from "@/components/TumaBodaTrackingWidget";
import { formatKes, formatDate } from "@/components/admin/commerceUi";
import { retryTumaBodaDelivery, rerouteToManualDelivery } from "@/services/commerceApi";
import { reportAdminError } from "@/lib/adminErrorToast";
import type { OrderRecord } from "@/services/commerceMock";

/** Order.status has reached READY_FOR_DISPATCH — the order has been marked ready, even if
 *  TumaBoda hasn't finished assigning a rider yet. Exported as a pure function (not derived
 *  inside the component) so OrderDetailModal can decide whether the dialog is dismissible
 *  before deciding what to render. */
export function tumaBodaOrderIsReadyOrBeyond(order: OrderRecord): boolean {
  return order.status !== "PENDING_PAYMENT" && order.status !== "PAID" && order.status !== "IN_PRODUCTION";
}

/**
 * TumaBoda's journey: booking is automatic (a status line, never a button staff click), so the
 * only staff action here is the rider QR scan at pickup — everything before that is either
 * shared early-stage progress (GenericNextActionButton) or a passive status display.
 */
export function TumaBodaFulfillmentPanel({
  order,
  onOrderUpdated,
  onClose,
}: {
  order: OrderRecord;
  onOrderUpdated: (order: OrderRecord) => void;
  /** Modal's own dismiss handler — called automatically once "Mark ready" succeeds and the
   *  live tracking tab has been opened, so staff land straight on the map instead of having to
   *  close the modal themselves. */
  onClose: () => void;
}) {
  const o = order as OrderRecord & Record<string, any>;
  const [retryBusy, setRetryBusy] = useState(false);
  const [rerouteBusy, setRerouteBusy] = useState(false);
  const readyOrBeyond = tumaBodaOrderIsReadyOrBeyond(order);
  const dispatchedOrLater = order.status === "DISPATCHED" || order.status === "DELIVERED";

  // Holds the blank tab opened synchronously at click time (see openPendingTrackingTab) until
  // the booking response tells us the real tracking URL to navigate it to. Only ever set for
  // the specific IN_PRODUCTION -> READY_FOR_DISPATCH transition (see isMarkReadyTransition
  // below) — every other GenericNextActionButton use in this panel (e.g. "Start production")
  // passes no onBeforeAdvance at all, so this never gets set for those.
  const pendingTrackingWindow = useRef<Window | null>(null);
  // This specific button instance only ever represents ONE transition at a time (whatever
  // getNextActionV2 currently returns for this order), so checking the order's current status
  // here tells us exactly which transition the upcoming click will attempt.
  const isMarkReadyTransition = order.status === "IN_PRODUCTION";

  function openPendingTrackingTab() {
    // Close any orphaned blank tab from a previous attempt that failed before the window ever
    // got navigated (see the failure branch in handleTumaBodaReadyUpdate below for the normal
    // case — this only matters if that cleanup somehow didn't run, e.g. an unmount mid-request).
    pendingTrackingWindow.current?.close();
    pendingTrackingWindow.current = window.open("", "_blank", "noopener,noreferrer");
  }

  function handleTumaBodaReadyUpdate(updated: OrderRecord) {
    onOrderUpdated(updated);
    const u = updated as OrderRecord & Record<string, any>;
    const pending = pendingTrackingWindow.current;
    if (!pending) return; // not the ready-for-dispatch transition — nothing to do
    pendingTrackingWindow.current = null;
    if (u.tumabodaTrackingCode) {
      pending.location.href = buildTumaBodaTrackingUrl(u.tumabodaTrackingCode);
      onClose();
    } else {
      // Booking failed server-side (tumabodaBookingFailureReason set, already surfaced by
      // useOrderStatusAction's own toast) — no tracking code to show, so there's nothing useful
      // to navigate to. Close the blank tab rather than leaving it stranded, and leave the modal
      // open so staff sees the failure toast in context.
      pending.close();
    }
  }

  async function handleRetry() {
    setRetryBusy(true);
    try {
      const res = await retryTumaBodaDelivery(order.id);
      if (res.order) {
        onOrderUpdated(res.order);
        toast.success("TumaBoda delivery created");
      }
    } catch (err) {
      reportAdminError(err, "Failed to create TumaBoda delivery");
    } finally {
      setRetryBusy(false);
    }
  }

  async function handleReroute() {
    if (!window.confirm(
      `Switch order ${order.reference} to Manual Delivery? The delivery fee already charged at ` +
      `checkout will carry over as paid — no new charge — but TumaBoda will no longer be involved.`
    )) return;
    setRerouteBusy(true);
    try {
      const res = await rerouteToManualDelivery(order.id);
      if (res.order) {
        onOrderUpdated(res.order);
        toast.success("Order switched to Manual Delivery");
      }
    } catch (err) {
      reportAdminError(err, "Failed to switch order to Manual Delivery");
    } finally {
      setRerouteBusy(false);
    }
  }

  return (
    <>
      <Section title="TumaBoda delivery">
        <div className="mb-2">
          <DeliveryNoteButton orderId={order.id} />
        </div>
        {!readyOrBeyond && (
          <div className="text-sm text-muted-foreground">
            A rider will be booked automatically once this order is marked ready — nothing to do
            here yet.
          </div>
        )}

        {readyOrBeyond && !o.tumabodaDeliveryId && (
          <>
            <div className="mb-2 rounded-md border border-dashed bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {o.tumabodaBookingFailureReason
                ? `Booking failed: ${o.tumabodaBookingFailureReason}`
                : "Payment succeeded but the TumaBoda delivery hasn't been created yet."}{" "}
              No rider has been summoned for this order.
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="admin-btn admin-btn-ghost" disabled={retryBusy} onClick={handleRetry}>
                {retryBusy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                Retry TumaBoda delivery
              </button>
              {/* Only for a genuine recorded failure, not "hasn't been booked yet" — retrying is
                  always the first thing to try; this is the escape hatch once retrying is known
                  not to work (matches OrderService.rerouteToManualDelivery's own requirement). */}
              {o.tumabodaBookingFailureReason && (
                <button className="admin-btn admin-btn-ghost" disabled={rerouteBusy} onClick={handleReroute}>
                  {rerouteBusy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                  Switch to Manual Delivery
                </button>
              )}
            </div>
          </>
        )}

        {o.tumabodaDeliveryId && (
          <>
            <Row label="Status" value={(o.tumabodaStatus ?? "—").toString().replace(/_/g, " ")} />
            <Row label="Delivery #" value={o.tumabodaDeliveryNumber || "—"} />
            {o.tumabodaCost != null && <Row label="Cost" value={formatKes(o.tumabodaCost)} />}
            {o.tumabodaTrackingCode && (
              <TumaBodaTrackingWidget trackingCode={o.tumabodaTrackingCode} status={o.tumabodaStatus} />
            )}
          </>
        )}
      </Section>

      {!readyOrBeyond ? (
        <div className="mt-1">
          <GenericNextActionButton
            order={order}
            onOrderUpdated={isMarkReadyTransition ? handleTumaBodaReadyUpdate : onOrderUpdated}
            onBeforeAdvance={isMarkReadyTransition ? openPendingTrackingTab : undefined}
          />
        </div>
      ) : o.tumabodaDeliveryId && !dispatchedOrLater ? (
        <Section title="Verify rider">
          <RiderScanPanel
            orderId={order.id}
            verifiedAt={o.tumabodaRiderVerifiedAt}
            onVerified={(verifiedAt) => onOrderUpdated({ ...o, tumabodaRiderVerifiedAt: verifiedAt, status: "DISPATCHED" })}
          />
        </Section>
      ) : dispatchedOrLater ? (
        <div className="flex items-center gap-2 text-sm font-medium text-green-700">
          <CheckCircle2 size={16} /> Rider verified — in transit
        </div>
      ) : null}

      {dispatchedOrLater && (
        <DeliveryConfirmationSection order={order} onOrderUpdated={onOrderUpdated} />
      )}
    </>
  );
}
