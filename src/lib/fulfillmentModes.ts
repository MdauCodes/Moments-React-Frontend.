import type { ComponentType } from "react";
import { Store, Truck, Bike, type LucideIcon } from "lucide-react";
import { PickupFulfillmentPanel } from "@/components/admin/PickupFulfillmentPanel";
import { ManualDeliveryFulfillmentPanel } from "@/components/admin/ManualDeliveryFulfillmentPanel";
import { TumaBodaFulfillmentPanel } from "@/components/admin/TumaBodaFulfillmentPanel";
import type { OrderRecord } from "@/services/commerceMock";

export type FulfillmentModeKey = "PICKUP" | "MANUAL_DELIVERY" | "TUMABODA_DELIVERY";

export interface FulfillmentPanelProps {
  order: OrderRecord;
  onOrderUpdated: (order: OrderRecord) => void;
  /** Always passed by OrderDetailModal, even to panels (Pickup, Manual Delivery) that don't use
   *  it — see their own "unused here" prop comments. */
  onClose: () => void;
}

export interface FulfillmentModeConfig {
  label: string;
  icon: LucideIcon;
  Panel: ComponentType<FulfillmentPanelProps>;
  /** This mode's own status-stage sequence, in order — mirrors the backend's
   *  PickupOrderStatus/ManualDeliveryOrderStatus/TumaBodaOrderStatus enums (see
   *  order/entity/*OrderStatus.java). Used to group/sort the Orders list within this mode's tab
   *  so orders visually cluster by where they actually are in the journey, not just by date. */
  statusOrder: string[];
}

/**
 * Single source of truth for "what fulfillment modes exist and how do we render them" — the
 * Orders list tabs and OrderDetailModal's panel selection both read from this instead of each
 * independently naming every type. Adding a future provider (Bolt, etc.) means adding one entry
 * here plus its own panel component and backend status enum — not touching the tab bar or the
 * panel-selection logic in OrderDetailModal, which are both written to iterate this object
 * generically. See the combined scope doc from 2026-08-18 for the full reasoning.
 */
export const FULFILLMENT_MODES: Record<FulfillmentModeKey, FulfillmentModeConfig> = {
  PICKUP: {
    label: "Pickup",
    icon: Store,
    Panel: PickupFulfillmentPanel,
    statusOrder: [
      "PENDING_PAYMENT", "PAID", "PAYMENT_VERIFIED", "IN_PRODUCTION",
      "READY_FOR_PICKUP", "COMPLETED", "CANCELLED", "REFUNDED",
    ],
  },
  MANUAL_DELIVERY: {
    label: "Manual Delivery",
    icon: Truck,
    Panel: ManualDeliveryFulfillmentPanel,
    statusOrder: [
      "PENDING_PAYMENT", "PAID", "PAYMENT_VERIFIED", "IN_PRODUCTION",
      "READY_FOR_COURIER_HANDOFF", "OUT_FOR_DELIVERY", "COMPLETED",
      "DELIVERY_ISSUE", "CANCELLED", "REFUNDED",
    ],
  },
  TUMABODA_DELIVERY: {
    label: "TumaBoda Delivery",
    icon: Bike,
    Panel: TumaBodaFulfillmentPanel,
    statusOrder: [
      "PENDING_PAYMENT", "PAID", "IN_PRODUCTION", "READY_FOR_RIDER_PICKUP",
      "RIDER_ASSIGNED", "RIDER_VERIFIED_IN_TRANSIT", "DELIVERED_PENDING_CONFIRMATION",
      "COMPLETED", "DELIVERY_FAILED", "CANCELLED", "REFUNDED",
    ],
  },
};

export const FULFILLMENT_MODE_KEYS = Object.keys(FULFILLMENT_MODES) as FulfillmentModeKey[];

/** Where an order's statusV2 (or, if unset, its legacy status) sits in its own mode's stage
 *  order — lower sorts first. Unknown/unset statuses sort last within the tab rather than
 *  crashing or defaulting to first, so a not-yet-backfilled order doesn't jump the queue. */
export function stageSortIndex(order: OrderRecord & Record<string, any>): number {
  const mode = FULFILLMENT_MODES[order.fulfillmentType as FulfillmentModeKey];
  if (!mode) return Number.MAX_SAFE_INTEGER;
  const current = order.statusV2 ?? order.status;
  const idx = mode.statusOrder.indexOf(current);
  return idx === -1 ? mode.statusOrder.length : idx;
}
