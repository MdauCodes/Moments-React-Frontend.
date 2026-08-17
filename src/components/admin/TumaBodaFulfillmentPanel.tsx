import { Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Section, Row } from "@/components/admin/AdminSectionUi";
import { GenericNextActionButton } from "@/components/admin/GenericNextActionButton";
import { RiderScanPanel } from "@/components/admin/RiderScanPanel";
import { TumaBodaTrackingWidget } from "@/components/TumaBodaTrackingWidget";
import { formatKes, formatDate } from "@/components/admin/commerceUi";
import { retryTumaBodaDelivery } from "@/services/commerceApi";
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
}: {
  order: OrderRecord;
  onOrderUpdated: (order: OrderRecord) => void;
}) {
  const o = order as OrderRecord & Record<string, any>;
  const [retryBusy, setRetryBusy] = useState(false);
  const readyOrBeyond = tumaBodaOrderIsReadyOrBeyond(order);
  const dispatchedOrLater = order.status === "DISPATCHED" || order.status === "DELIVERED";

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

  return (
    <>
      <Section title="TumaBoda delivery">
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
            <button className="admin-btn admin-btn-ghost" disabled={retryBusy} onClick={handleRetry}>
              {retryBusy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
              Retry TumaBoda delivery
            </button>
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
          <GenericNextActionButton order={order} onOrderUpdated={onOrderUpdated} />
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
        <Section title="Customer confirmation">
          {o.customerConfirmedDeliveredAt ? (
            <Row label="Confirmed by customer" value={formatDate(o.customerConfirmedDeliveredAt)} />
          ) : (
            <div className="text-sm text-muted-foreground">
              Not yet confirmed by the customer on the track-order page.
            </div>
          )}
        </Section>
      )}
    </>
  );
}
