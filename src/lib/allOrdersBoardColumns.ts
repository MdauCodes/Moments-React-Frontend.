// ----------------------------------------------------------------------------
// Column layout for the "All Orders" board — unlike the per-mode boards
// (fulfillmentBoardColumns.ts), this mixes Pickup/Manual Delivery/TumaBoda in one view, so it
// can't group by statusV2 (each mode's vocabulary is different and not comparable). Groups by
// the legacy Order.status instead — the one status value every fulfillment type shares — which
// is coarser (no "rider assigned" vs "in transit" distinction here) but that finer detail is
// still visible per-card via resolveStatusDisplay's own label, just not what buckets a card into
// a column.
// ----------------------------------------------------------------------------
import type { OrderRecord } from "@/services/commerceMock";
import { isCompletedOldEnoughToClose } from "@/lib/fulfillmentBoardColumns";

export interface AllOrdersBoardColumn {
  key: string;
  label: string;
  matches: string[];
}

export const ALL_ORDERS_BOARD_COLUMNS: AllOrdersBoardColumn[] = [
  { key: "new", label: "New", matches: ["PAID", "PAYMENT_VERIFIED"] },
  { key: "in_production", label: "In production", matches: ["IN_PRODUCTION"] },
  { key: "ready", label: "Ready", matches: ["READY_FOR_DISPATCH"] },
  { key: "out_for_delivery", label: "Out for delivery", matches: ["DISPATCHED"] },
  { key: "completed", label: "Completed", matches: ["DELIVERED"] },
  { key: "closed", label: "Closed", matches: ["CANCELLED", "REFUNDED"] },
];

/** The extra lane the "Show awaiting payment" toggle reveals: orders that were placed and saved at
 *  the back but never got paid (abandoned or still-waiting checkouts). Off by default so the
 *  working board stays clean. */
export const AWAITING_PAYMENT_COLUMN: AllOrdersBoardColumn = {
  key: "awaiting_payment",
  label: "Awaiting payment",
  matches: ["PENDING_PAYMENT"],
};

/** statusV2 values that mean an order is effectively done even though the legacy Order.status
 *  it's otherwise grouped by hasn't caught up to DELIVERED yet — currently just TumaBoda's
 *  DELIVERED_PENDING_CONFIRMATION (see fulfillmentBoardColumns.ts's own reclassification of the
 *  same value): TumaBoda's webhook already reported the parcel delivered, and legacy status only
 *  advances to DELIVERED once the CUSTOMER separately confirms via their own OTP, which they may
 *  never do. Without this override, this board disagreed with the per-mode TumaBoda board — the
 *  same order showed "Completed" there and "Out for delivery" here, confusing enough on its own
 *  to be a bug report. Checked before the legacy-status matching below, not merged into it,
 *  since every other bucket here is genuinely legacy-status-only. */
const STATUS_V2_MEANS_COMPLETED_DESPITE_LEGACY_STATUS = new Set(["DELIVERED_PENDING_CONFIRMATION"]);

/** Which column an order belongs to, or null for PENDING_PAYMENT (surfaced as its own "awaiting
 *  payment" counter above the board, same pattern as every per-mode board already uses). Also
 *  reclassifies a completed order into "closed" once it's been done for over an hour — same
 *  cutoff and same reasoning as the per-mode boards (fulfillmentBoardColumns.ts's
 *  AUTO_CLOSE_COMPLETED_AFTER_MS): there's no reason for a finished order to keep occupying
 *  "Completed" indefinitely, and CANCELLED/REFUNDED orders already share "Closed" with nothing
 *  further needed from staff either. */
export function resolveAllOrdersColumnKey(
  order: {
    status?: string | null;
    statusV2?: string | null;
    completedAt?: string | null;
  },
  opts: { showAwaitingPayment?: boolean } = {},
): string | null {
  const status = order.status;
  if (!status) return null;
  if (status === "PENDING_PAYMENT") return opts.showAwaitingPayment ? AWAITING_PAYMENT_COLUMN.key : null;

  const key = order.statusV2 && STATUS_V2_MEANS_COMPLETED_DESPITE_LEGACY_STATUS.has(order.statusV2)
    ? "completed"
    : ALL_ORDERS_BOARD_COLUMNS.find((c) => c.matches.includes(status))?.key ?? null;

  if (key === "completed") {
    // An order delivered before completedAt was recorded has no timestamp to age: it is long done,
    // so it belongs with the closed ones rather than sitting in Completed forever.
    if (!order.completedAt && order.status === "DELIVERED") return "closed";
    if (isCompletedOldEnoughToClose(order.completedAt)) return "closed";
  }
  return key;
}

/** Short label for the fulfillment-type badge every card needs here (and only here — a
 *  single-mode board doesn't, since the whole board is already that one mode). */
export function fulfillmentTypeShortLabel(fulfillmentType: string | null | undefined): string {
  switch (fulfillmentType) {
    case "PICKUP": return "Pickup";
    case "MANUAL_DELIVERY": return "Manual";
    case "TUMABODA_DELIVERY": return "TumaBoda";
    default: return fulfillmentType ?? "—";
  }
}
