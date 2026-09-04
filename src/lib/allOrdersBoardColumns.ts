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

/** Which column an order belongs to, or null for PENDING_PAYMENT (surfaced as its own "awaiting
 *  payment" counter above the board, same pattern as every per-mode board already uses). */
export function resolveAllOrdersColumnKey(order: { status?: string | null }): string | null {
  const status = order.status;
  if (!status || status === "PENDING_PAYMENT") return null;
  const col = ALL_ORDERS_BOARD_COLUMNS.find((c) => c.matches.includes(status));
  return col ? col.key : null;
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
