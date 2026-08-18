import { Loader2 } from "lucide-react";
import { getNextActionV2 } from "@/lib/orderStatusV2";
import { useOrderStatusAction } from "@/lib/useOrderStatusAction";
import type { OrderRecord, OrderStatus } from "@/services/commerceMock";

/**
 * The pre-fulfillment stages (payment verified → in production → ready) are genuinely shared
 * across all three fulfillment modes — only wording differs, and getNextActionV2 already
 * handles that per-mode wording. This renders nothing once there's no more generic next action
 * (i.e. once a mode's own fulfillment-specific flow takes over — the rider scan for TumaBoda,
 * the checklist-gated action for Manual/Pickup) so each panel only needs to render its own
 * fulfillment-specific UI below this.
 */
export function GenericNextActionButton({
  order,
  onOrderUpdated,
  onBeforeAdvance,
}: {
  order: OrderRecord;
  onOrderUpdated: (order: OrderRecord) => void;
  /** Fires synchronously inside the click handler, before the (async) status update starts.
   *  Exists so a caller can do something that must be a direct, synchronous product of the user
   *  gesture — e.g. TumaBodaFulfillmentPanel opening a blank tab to navigate later, since
   *  window.open() calls made after an awaited fetch are frequently popup-blocked. */
  onBeforeAdvance?: () => void;
}) {
  const { busy, advance } = useOrderStatusAction(order, onOrderUpdated);
  const next = getNextActionV2(order.fulfillmentType, order.statusV2, order.status as OrderStatus);
  if (!next) return null;

  return (
    <button
      className="admin-btn admin-btn-primary w-full"
      disabled={busy}
      onClick={() => {
        onBeforeAdvance?.();
        void advance(next.nextLegacyStatus, `Status updated`);
      }}
    >
      {busy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
      {busy ? (next.busyLabel ?? "Saving…") : next.label}
    </button>
  );
}
