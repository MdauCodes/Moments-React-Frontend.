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
    setBusy(true);
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
      reportAdminError(err, "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  return { busy, advance };
}
