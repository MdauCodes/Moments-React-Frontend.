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
import { retryTumaBodaDelivery, restartTumaBodaDelivery, rerouteToManualDelivery, getOrder, checkTumaBodaStatusNow } from "@/services/commerceApi";
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
 * TumaBoda's journey: booking is automatic (a status line, never a button staff click). The only
 * OPTIONAL staff action here is the rider QR scan at pickup — an extra identity check, not a
 * requirement TumaBoda's own progress waits on (see PaymentService.handleTumaBodaStatusUpdate's
 * 2026-09-03 promotion note) — everything else is either shared early-stage progress
 * (GenericNextActionButton) or a passive status display.
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
  const [restartBusy, setRestartBusy] = useState(false);
  const [checkStatusBusy, setCheckStatusBusy] = useState(false);
  const readyOrBeyond = tumaBodaOrderIsReadyOrBeyond(order);
  const dispatchedOrLater = order.status === "DISPATCHED" || order.status === "DELIVERED";
  // Mirrors OrderService.TUMABODA_RESTARTABLE_STATUSES exactly — a rider verified at pickup or
  // later (or any terminal state) is intentionally NOT restartable, to avoid a second rider
  // converging on an already-moving or already-closed parcel. Checked on statusV2, not
  // dispatchedOrLater above: DELIVERY_FAILED's legacy Order.status is DISPATCHED, so that flag
  // alone would wrongly hide this action for exactly the case it exists for.
  const RESTARTABLE_STATUSES_V2 = ["READY_FOR_RIDER_PICKUP", "RIDER_ASSIGNED", "DELIVERY_FAILED"];
  const canRestart = RESTARTABLE_STATUSES_V2.includes(o.statusV2 ?? "");

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
    // Deliberately no "noopener"/"noreferrer" — "noopener" makes window.open() always return
    // null (per spec, since it means the two windows have no relationship at all), which meant
    // pendingTrackingWindow.current was always null and handleTumaBodaReadyUpdate's `if (!pending)
    // return;` guard always fired — this auto-open-tracking-tab feature never actually worked
    // since it shipped. Found while fixing the identical bug in the customer document downloads.
    // Only ever navigated to our own buildTumaBodaTrackingUrl() below, not attacker-controlled
    // content, so the window.opener access these flags would have blocked isn't a real risk here.
    pendingTrackingWindow.current = window.open("", "_blank");
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

  // A failed action (e.g. "TumaBoda delivery already created" — a 409 that fires precisely when
  // this panel's own local copy of the order is stale, still showing an older state than the
  // server actually has) previously left the modal showing exactly what it showed before the
  // click, with no visible sign anything happened beyond a toast that disappears in a few
  // seconds. Refetching on error re-syncs the displayed state (status, tumabodaDeliveryId, the
  // restart button's own visibility) to whatever's actually true server-side, instead of leaving
  // staff staring at a screen that looks unchanged no matter how many times they click.
  async function refreshAfterError() {
    try {
      const res = await getOrder(order.id);
      if (res.order) onOrderUpdated(res.order);
    } catch {
      // Best-effort — the original action's own error toast already told the admin something
      // went wrong; failing to also refresh isn't worth a second error message.
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
      await refreshAfterError();
    } finally {
      setRetryBusy(false);
    }
  }

  async function handleRestart() {
    if (!window.confirm(
      `Restart order ${order.reference}'s TumaBoda delivery? This clears the current booking ` +
      `(tracking link, rider assignment) and books a fresh one from scratch. Only do this if ` +
      `you've confirmed no rider actually has this parcel.`
    )) return;
    setRestartBusy(true);
    try {
      const res = await restartTumaBodaDelivery(order.id);
      if (res.order) {
        onOrderUpdated(res.order);
        toast.success("TumaBoda delivery restarted");
      }
    } catch (err) {
      reportAdminError(err, "Failed to restart TumaBoda delivery");
      await refreshAfterError();
    } finally {
      setRestartBusy(false);
    }
  }

  async function handleCheckStatus() {
    setCheckStatusBusy(true);
    try {
      const res = await checkTumaBodaStatusNow(order.id);
      if (res.order) {
        onOrderUpdated(res.order);
        toast.success("Status checked — up to date with TumaBoda");
      }
    } catch (err) {
      reportAdminError(err, "Failed to check TumaBoda status");
    } finally {
      setCheckStatusBusy(false);
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
      await refreshAfterError();
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
            <div className="flex items-center justify-between gap-2">
              <Row label="Status" value={(o.tumabodaStatus ?? "—").toString().replace(/_/g, " ")} />
              {/* Webhooks + a 10-minute reconciliation sweep keep this current automatically —
                  this is only for "I want to know right now", e.g. right after a grouped booking,
                  rather than waiting up to ~20-30 minutes for the next automatic sweep. */}
              <button
                className="admin-btn admin-btn-ghost"
                style={{ padding: "2px 8px", fontSize: 11 }}
                disabled={checkStatusBusy}
                onClick={handleCheckStatus}
                title="Poll TumaBoda for this delivery's current status right now"
              >
                {checkStatusBusy && <Loader2 size={12} className="mr-1 animate-spin inline" />}
                Check now
              </button>
            </div>
            <Row label="Delivery #" value={o.tumabodaDeliveryNumber || "—"} />
            {o.tumabodaCost != null && <Row label="Cost" value={formatKes(o.tumabodaCost)} />}
            {o.tumabodaTrackingCode && (
              <TumaBodaTrackingWidget trackingCode={o.tumabodaTrackingCode} status={o.tumabodaStatus} />
            )}
            {/* DELIVERY_FAILED gets the same destructive-callout treatment as the "booking
                failed" case above — this is the one restart scenario staff are actively looking
                to resolve, not an edge-case escape hatch, so it shouldn't read as just another
                ghost button among the info rows. */}
            {canRestart && o.statusV2 === "DELIVERY_FAILED" ? (
              <div className="mt-2 rounded-md border border-dashed bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <p>Delivery failed or was cancelled by TumaBoda. Restart to try again, or contact TumaBoda directly if the parcel needs manual recovery.</p>
                <button className="admin-btn admin-btn-ghost mt-2" disabled={restartBusy} onClick={handleRestart}>
                  {restartBusy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                  Restart TumaBoda delivery
                </button>
              </div>
            ) : (
              canRestart && (
                <div className="mt-2">
                  <button className="admin-btn admin-btn-ghost" disabled={restartBusy} onClick={handleRestart}>
                    {restartBusy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                    Restart TumaBoda delivery
                  </button>
                </div>
              )
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
      ) : o.tumabodaDeliveryId && !o.tumabodaRiderVerifiedAt ? (
        <Section title="Verify rider (optional)">
          <p className="mb-2 text-xs text-muted-foreground">
            {dispatchedOrLater
              ? "TumaBoda already reports this rider has the parcel and it's moving — scanning isn't required, but you can still confirm their identity below if you want the extra check."
              : "Confirms the right rider has the right parcel. Not required — TumaBoda's own status updates will move this order along either way."}
          </p>
          <RiderScanPanel
            orderId={order.id}
            verifiedAt={o.tumabodaRiderVerifiedAt}
            onVerified={(verifiedAt) => onOrderUpdated({ ...o, tumabodaRiderVerifiedAt: verifiedAt, status: "DISPATCHED" })}
          />
        </Section>
      ) : o.tumabodaRiderVerifiedAt ? (
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
