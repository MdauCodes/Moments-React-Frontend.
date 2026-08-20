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

  // Not a hard block — staff can still mark ready without the ETR, it's just easy to miss since
  // nothing else on this button surfaces it. documentBundleStatus stays null until an admin
  // uploads the ETR at least once, so this is exactly "requested but nothing uploaded yet".
  const etrPending = next.nextLegacyStatus === "READY_FOR_DISPATCH"
    && order.etrRequested && !order.documentBundleStatus;

  return (
    <>
      {etrPending && (
        <div className="mb-1.5 rounded-md border border-dashed border-amber-400/60 bg-amber-400/10 px-2.5 py-1.5 text-xs text-amber-700">
          ETR requested but not uploaded yet
        </div>
      )}
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
    </>
  );
}
