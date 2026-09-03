// ----------------------------------------------------------------------------
// Column layout for the per-fulfillment-mode admin boards (Pickup / Manual Delivery /
// TumaBoda). Deliberately leaner than FULFILLMENT_MODES.statusOrder's full per-mode stopover
// list: only stages a staff member actually acts on get their own column. Pass-through stages
// (Awaiting payment, Payment verified for M-Pesa orders, TumaBoda's rider-assigned/in-transit/
// delivered-pending-confirmation) are folded into the column they lead into or out of, since an
// order sitting there needs no click — see the 2026-08-19 board-scoping conversation for why.
// ----------------------------------------------------------------------------
import type { FulfillmentModeKey } from "@/lib/fulfillmentModes";

export interface BoardColumn {
  key: string;
  label: string;
  /** statusV2 (or, for orders not yet backfilled, legacy status) values that land in this
   *  column. */
  matches: string[];
  /** statusV2 values within this column that should render with a warning/exception badge
   *  instead of the plain label — the order hasn't failed out of the board, but needs attention. */
  exceptionMatches?: string[];
}

export const BOARD_COLUMNS: Record<FulfillmentModeKey, BoardColumn[]> = {
  PICKUP: [
    { key: "new", label: "New", matches: ["PAID", "PAYMENT_VERIFIED"] },
    { key: "in_production", label: "In production", matches: ["IN_PRODUCTION"] },
    { key: "ready", label: "Ready for pickup", matches: ["READY_FOR_PICKUP"] },
    { key: "completed", label: "Completed", matches: ["COMPLETED"] },
    { key: "closed", label: "Closed", matches: ["CANCELLED", "REFUNDED"] },
  ],
  MANUAL_DELIVERY: [
    { key: "new", label: "New", matches: ["PAID", "PAYMENT_VERIFIED"] },
    { key: "in_production", label: "In production", matches: ["IN_PRODUCTION"] },
    { key: "ready", label: "Ready for courier handoff", matches: ["READY_FOR_COURIER_HANDOFF"] },
    {
      key: "out_for_delivery",
      label: "Out for delivery",
      matches: ["OUT_FOR_DELIVERY", "DELIVERY_ISSUE"],
      exceptionMatches: ["DELIVERY_ISSUE"],
    },
    { key: "completed", label: "Completed", matches: ["COMPLETED"] },
    { key: "closed", label: "Closed", matches: ["CANCELLED", "REFUNDED"] },
  ],
  TUMABODA_DELIVERY: [
    { key: "new", label: "New", matches: ["PAID"] },
    { key: "in_production", label: "In production", matches: ["IN_PRODUCTION"] },
    {
      key: "ready",
      label: "Ready for rider pickup",
      matches: ["READY_FOR_RIDER_PICKUP", "RIDER_ASSIGNED"],
    },
    {
      key: "out_for_delivery",
      label: "Out for delivery",
      matches: ["RIDER_IN_TRANSIT", "RIDER_VERIFIED_IN_TRANSIT", "DELIVERED_PENDING_CONFIRMATION", "DELIVERY_FAILED"],
      exceptionMatches: ["DELIVERY_FAILED"],
    },
    { key: "completed", label: "Completed", matches: ["COMPLETED"] },
    { key: "closed", label: "Closed", matches: ["CANCELLED", "REFUNDED"] },
  ],
};

/** Which column an order belongs to on its mode's board, or null if it's PENDING_PAYMENT
 *  (not shown as a column — see the board's own "awaiting payment" counter instead) or in a
 *  status this mode's board doesn't recognize. */
export function resolveBoardColumnKey(
  mode: FulfillmentModeKey,
  order: { statusV2?: string | null; status?: string | null },
): string | null {
  const current = order.statusV2 ?? order.status;
  if (!current || current === "PENDING_PAYMENT") return null;
  const columns = BOARD_COLUMNS[mode];
  for (const col of columns) {
    if (col.matches.includes(current)) return col.key;
  }
  return null;
}

/** Whether this order's current statusV2 is one that should render with an exception badge on
 *  its card, within whichever column it's bucketed into. */
export function isExceptionStatus(mode: FulfillmentModeKey, statusV2: string | null | undefined): boolean {
  if (!statusV2) return false;
  return BOARD_COLUMNS[mode].some((col) => col.exceptionMatches?.includes(statusV2));
}
