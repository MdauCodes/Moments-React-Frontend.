import { Loader2, CheckCircle2 } from "lucide-react";
import { Section, Row } from "@/components/admin/AdminSectionUi";
import { GenericNextActionButton } from "@/components/admin/GenericNextActionButton";
import { ItemChecklist } from "@/components/admin/ItemChecklist";
import { useOrderStatusAction } from "@/lib/useOrderStatusAction";
import { useState } from "react";
import type { OrderRecord } from "@/services/commerceMock";

/**
 * Pickup's whole journey: no destination, no courier, no dispatch — the customer collects in
 * person. The only fulfillment-specific action is staff clicking "Mark picked up" when they
 * physically arrive, gated on the item checklist so nothing gets handed over unverified.
 */
export function PickupFulfillmentPanel({
  order,
  onOrderUpdated,
}: {
  order: OrderRecord;
  onOrderUpdated: (order: OrderRecord) => void;
}) {
  const { busy, advance } = useOrderStatusAction(order, onOrderUpdated);
  const [allTicked, setAllTicked] = useState(false);
  const readyForPickup = order.statusV2 === "READY_FOR_PICKUP";
  const completed = order.statusV2 === "COMPLETED" || order.status === "DELIVERED";

  return (
    <Section title="Fulfillment — pickup at shop">
      <Row label="Method" value="Customer pickup at our shop" />
      {!readyForPickup && !completed && (
        <div className="mt-2 rounded-md border border-dashed bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          No delivery address required. Call the customer when the order is ready for pickup.
        </div>
      )}

      {completed ? (
        <div className="mt-3 flex items-center gap-2 text-sm font-medium text-green-700">
          <CheckCircle2 size={16} /> Picked up
        </div>
      ) : readyForPickup ? (
        <div className="mt-3 space-y-3">
          <ItemChecklist orderId={order.id} items={order.items ?? []} onAllTickedChange={setAllTicked} />
          <button
            className="admin-btn admin-btn-primary w-full"
            disabled={busy || !allTicked}
            title={!allTicked ? "Tick every item before marking picked up" : undefined}
            onClick={() => void advance("DELIVERED", "Order marked picked up")}
          >
            {busy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
            Mark picked up
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <GenericNextActionButton order={order} onOrderUpdated={onOrderUpdated} />
        </div>
      )}
    </Section>
  );
}
