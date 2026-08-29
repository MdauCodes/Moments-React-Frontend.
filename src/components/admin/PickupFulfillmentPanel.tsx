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
 * physically arrive, gated on the item checklist AND (new) the order's verification code — ask
 * the customer to state/show the code emailed to them, same door-check TumaBoda/Manual Delivery
 * get via the printed delivery note, just enforced here since staff already have the order open.
 */
export function PickupFulfillmentPanel({
  order,
  onOrderUpdated,
}: {
  order: OrderRecord;
  onOrderUpdated: (order: OrderRecord) => void;
  /** Unused here — accepted only so this panel has the same call signature as
   *  TumaBodaFulfillmentPanel, letting the fulfillment-mode registry (src/lib/fulfillmentModes.tsx)
   *  render whichever panel is configured without a per-type prop mismatch. */
  onClose?: () => void;
}) {
  const { busy, advance } = useOrderStatusAction(order, onOrderUpdated);
  const [allTicked, setAllTicked] = useState(false);
  const [enteredCode, setEnteredCode] = useState("");
  const readyForPickup = order.statusV2 === "READY_FOR_PICKUP";
  const completed = order.statusV2 === "COMPLETED" || order.status === "DELIVERED";
  const codeMatches =
    !order.deliveryVerificationCode ||
    enteredCode.trim().toUpperCase() === order.deliveryVerificationCode.toUpperCase();

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
          {order.deliveryVerificationCode && (
            <label className="block">
              <span className="text-xs uppercase text-muted-foreground">
                Ask the customer for their verification code (emailed to them)
              </span>
              <input
                className="mt-1 w-full rounded-md border bg-background p-2 text-sm uppercase tracking-widest"
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value)}
                placeholder="e.g. ABCD1234"
              />
              {enteredCode.trim().length > 0 && !codeMatches && (
                <span className="mt-1 block text-xs text-destructive">
                  Doesn't match — don't release the order without a match.
                </span>
              )}
            </label>
          )}
          <button
            className="admin-btn admin-btn-primary w-full"
            disabled={
              busy ||
              !allTicked ||
              (!!order.deliveryVerificationCode && (enteredCode.trim().length === 0 || !codeMatches))
            }
            title={
              !allTicked
                ? "Tick every item before marking picked up"
                : order.deliveryVerificationCode && enteredCode.trim().length === 0
                  ? "Enter the customer's verification code before marking picked up"
                  : !codeMatches
                    ? "Code doesn't match this order"
                    : undefined
            }
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
