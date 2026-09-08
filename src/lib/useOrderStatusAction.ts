import { useState } from "react";
import { toast } from "sonner";
import { updateOrderStatus } from "@/services/commerceApi";
import { reportAdminError, reportTumaBodaBookingFailure } from "@/lib/adminErrorToast";
import type { OrderRecord, OrderStatus } from "@/services/commerceMock";

/**
 * Shared "advance this order's legacy status, surface a TumaBoda booking failure loudly if one
 * happened, otherwise a plain success toast" action — the same pattern repeated at every
 * updateOrderStatus call site, extracted once for the three per-fulfillment-mode order panels
 * so each of them doesn't reimplement it. See Order.tumabodaBookingFailureReason.
 */
export function useOrderStatusAction(order: OrderRecord, onOrderUpdated: (order: OrderRecord) => void) {
  const [busy, setBusy] = useState(false);

  async function advance(nextStatus: OrderStatus, successLabel: string, staffNotes?: string) {
    // Belt-and-suspenders: the button's own `disabled={busy}` should already prevent this, but
    // costs nothing to guard directly against a second invocation landing while the first is
    // still in flight.
    if (busy) return;
    setBusy(true);
    const previous = order;
    // Move the card immediately — staff shouldn't wait on a network round trip to see their own
    // click take effect. statusV2 is a best-effort mirror of nextStatus, not a real computation
    // (the backend resolves the precise value from context, e.g. TumaBoda's finer-grained
    // sub-states — see getNextActionV2's Javadoc); the real response below corrects it the
    // instant it arrives, typically well under a second later. Reverted in the catch block below
    // if the request actually fails, so this never leaves the board showing a move that didn't
    // happen — only ever wrong for the brief window while a request is genuinely in flight.
    onOrderUpdated({ ...order, status: nextStatus, statusV2: nextStatus });
    try {
      const res = await updateOrderStatus(order.id, nextStatus, staffNotes);
      if (res.order) {
        onOrderUpdated(res.order);
        if (res.order.tumabodaBookingFailureReason) {
          reportTumaBodaBookingFailure(res.order.reference, res.order.tumabodaBookingFailureReason);
        } else {
          toast.success(successLabel);
        }
      }
    } catch (err) {
      onOrderUpdated(previous);
      reportAdminError(err, "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  return { busy, advance };
}
