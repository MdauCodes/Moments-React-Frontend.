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
      matches: ["RIDER_IN_TRANSIT", "RIDER_VERIFIED_IN_TRANSIT", "DELIVERY_FAILED"],
      exceptionMatches: ["DELIVERY_FAILED"],
    },
    // DELIVERED_PENDING_CONFIRMATION moved here from "out_for_delivery" 2026-09-06 — TumaBoda's
    // own webhook already reported the parcel delivered; the only thing left pending is the
    // CUSTOMER's own OTP confirmation on the track-order page, which they may never do. Staff
    // have nothing left to act on for a delivered parcel, so leaving it in "Out for delivery"
    // made a genuinely finished order look like it was still stuck mid-route, with no way for it
    // to ever move on its own if the customer simply doesn't visit that page. Customer
    // confirmation remains a real, separate signal (see customerConfirmedDeliveredAt) — it's just
    // not something staff should have to babysit an order over.
    { key: "completed", label: "Completed", matches: ["COMPLETED", "DELIVERED_PENDING_CONFIRMATION"] },
    { key: "closed", label: "Closed", matches: ["CANCELLED", "REFUNDED"] },
  ],
};

/** How long a finished order sits in "Completed" before it's reclassified into "Closed" — see
 *  resolveBoardColumnKey below. A pure display-bucket move, not a backend status transition:
 *  there's no real reason for it to keep occupying the "Completed" column once staff have had a
 *  reasonable window to notice it landed there; CANCELLED/REFUNDED orders already share "Closed"
 *  with nothing further needed from staff either. Deliberately NOT a new backend statusV2 value
 *  (e.g. a stamped-in-the-database "CLOSED") — that would risk a later webhook or reconciliation
 *  sweep recomputing statusV2 from scratch and clobbering it back to COMPLETED, and would need a
 *  scheduled job + new enum value across three per-mode status enums for what's really just a
 *  display grouping. Reads completedAt (Order.completedAt, stamped once — see its backend
 *  Javadoc), so it can't be tricked by unrelated background saves the way updatedAt could.
 */
const AUTO_CLOSE_COMPLETED_AFTER_MS = 60 * 60 * 1000; // 1 hour

/** Which column an order belongs to on its mode's board, or null if it's PENDING_PAYMENT
 *  (not shown as a column — see the board's own "awaiting payment" counter instead) or in a
 *  status this mode's board doesn't recognize. */
export function resolveBoardColumnKey(
  mode: FulfillmentModeKey,
  order: { statusV2?: string | null; status?: string | null; completedAt?: string | null },
): string | null {
  const current = order.statusV2 ?? order.status;
  if (!current || current === "PENDING_PAYMENT") return null;
  const columns = BOARD_COLUMNS[mode];
  for (const col of columns) {
    if (col.matches.includes(current)) {
      if (col.key === "completed" && order.completedAt) {
        const age = Date.now() - new Date(order.completedAt).getTime();
        if (age >= AUTO_CLOSE_COMPLETED_AFTER_MS) return "closed";
      }
      return col.key;
    }
  }
  return null;
}

/** Whether this order's current statusV2 is one that should render with an exception badge on
 *  its card, within whichever column it's bucketed into. */
export function isExceptionStatus(mode: FulfillmentModeKey, statusV2: string | null | undefined): boolean {
  if (!statusV2) return false;
  return BOARD_COLUMNS[mode].some((col) => col.exceptionMatches?.includes(statusV2));
}

/** Whether TumaBoda's raw tumabodaStatus indicates the rider has already collected the parcel —
 *  shared by FulfillmentBoard (the sub-label/OTP-collapse logic) and TumaBodaFulfillmentPanel
 *  (the order modal's own OTP card), so both agree on the exact same cutoff rather than each
 *  keeping its own copy of this list. Once true, the pickup OTP is no longer actionable — it was
 *  either already keyed into TumaBoda's app or never will be, so it should collapse rather than
 *  keep occupying space with a ticking countdown. */
export function tumaBodaHasMovedPastPickup(rawStatus?: string | null): boolean {
  if (!rawStatus) return false;
  const s = rawStatus.toLowerCase();
  return s === "in_transit" || s === "picked_up" || s === "delivered";
}
