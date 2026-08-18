import { Loader2, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { Section, Row } from "@/components/admin/AdminSectionUi";
import { GenericNextActionButton } from "@/components/admin/GenericNextActionButton";
import { ItemChecklist } from "@/components/admin/ItemChecklist";
import { DeliveryConfirmationSection } from "@/components/admin/DeliveryConfirmationSection";
import { DeliveryNoteButton } from "@/components/admin/DeliveryNoteButton";
import { DeliveryFeeStatusBadge, formatDate } from "@/components/admin/commerceUi";
import { useOrderStatusAction } from "@/lib/useOrderStatusAction";
import type { OrderRecord } from "@/services/commerceMock";

/**
 * Manual Delivery's journey: staff arrange a courier by phone, no API integration, so every
 * step here is staff-attested. "Out for delivery" is the mode-specific equivalent of
 * "dispatched" — gated on the item checklist, same as Pickup's "Mark picked up."
 */
export function ManualDeliveryFulfillmentPanel({
  order,
  onOrderUpdated,
}: {
  order: OrderRecord;
  onOrderUpdated: (order: OrderRecord) => void;
  /** Unused here — see PickupFulfillmentPanel's identical comment. */
  onClose?: () => void;
}) {
  const o = order as OrderRecord & Record<string, any>;
  const { busy, advance } = useOrderStatusAction(order, onOrderUpdated);
  const [allTicked, setAllTicked] = useState(false);
  const readyForHandoff = order.statusV2 === "READY_FOR_COURIER_HANDOFF";
  const dispatchedOrLater = order.status === "DISPATCHED" || order.status === "DELIVERED";

  return (
    <>
      <Section title="1. Destination — where the customer collects">
        <div className="mb-2">
          <DeliveryNoteButton orderId={order.id} />
        </div>
        <Row label="Town" value={o.city || "—"} />
        <Row label="County" value={o.county || "—"} />
        <Row label="Nearest courier office (customer-side)" value={o.shippingAddress || "—"} />
        {o.postalCode && <Row label="Postal code" value={o.postalCode} />}
      </Section>

      <Section title="2. Dispatch — sacco / courier we use">
        <Row label="Courier type" value={(o.courierType ?? "—").toString().replace(/_/g, " ")} />
        <Row label="Sacco / service name" value={o.courierServiceName || "— (to confirm with customer)"} />
        <Row label="Nairobi stage / office" value={o.courierStageOrOffice || "— (to confirm)"} />
        <Row
          label="Delivery fee"
          value={
            <span className="inline-flex items-center gap-2">
              {o.deliveryFeeAmount != null ? `KES ${o.deliveryFeeAmount}` : "Not yet arranged"}
              <DeliveryFeeStatusBadge status={o.deliveryFeeStatus ?? "UNPAID"} />
            </span>
          }
        />
        <div className="mt-2 rounded-md border border-dashed bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          Transport cost is paid by the customer directly to the sacco / courier on collection
          (or at dispatch, confirmed by phone). Not included in the order total.
        </div>

        {dispatchedOrLater ? (
          <div className="mt-3 flex items-center gap-2 text-sm font-medium text-green-700">
            <CheckCircle2 size={16} /> Out for delivery
          </div>
        ) : readyForHandoff ? (
          <div className="mt-3 space-y-3">
            <ItemChecklist orderId={order.id} items={order.items ?? []} onAllTickedChange={setAllTicked} />
            <button
              className="admin-btn admin-btn-primary w-full"
              disabled={busy || !allTicked}
              title={!allTicked ? "Tick every item before marking out for delivery" : undefined}
              onClick={() => void advance("DISPATCHED", "Order marked out for delivery")}
            >
              {busy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
              Mark out for delivery
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <GenericNextActionButton order={order} onOrderUpdated={onOrderUpdated} />
          </div>
        )}
      </Section>

      {dispatchedOrLater && (
        <DeliveryConfirmationSection order={order} onOrderUpdated={onOrderUpdated} />
      )}
    </>
  );
}
