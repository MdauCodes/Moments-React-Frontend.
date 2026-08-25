// ----------------------------------------------------------------------------
// Per-fulfillment-mode order status — mirrors the backend's TumaBodaOrderStatus /
// ManualDeliveryOrderStatus / PickupOrderStatus enums (order/entity/*.java) and
// OrderStatusResolver. Values here must match those Java enum constant names exactly, since
// `statusV2` flows through as the raw enum name.
//
// Order.status (the legacy 9-value OrderStatus) is still what every write endpoint accepts —
// see the per-fulfillment-mode order statuses plan's migration-safety section. This module only
// governs DISPLAY (labels/tones) and the mode-aware "what's the next action" logic; the value
// actually submitted to PATCH /admin/orders/{id}/status is always resolved back to its
// `legacyEquivalent`, exactly like the backend's own legacyEquivalent().
// ----------------------------------------------------------------------------
import type { OrderStatus } from "@/services/commerceMock";

export type FulfillmentTypeV2 = "PICKUP" | "MANUAL_DELIVERY" | "TUMABODA_DELIVERY";

export type TumaBodaOrderStatusV2 =
  | "PENDING_PAYMENT"
  | "PAID"
  | "IN_PRODUCTION"
  | "READY_FOR_RIDER_PICKUP"
  | "RIDER_ASSIGNED"
  | "RIDER_VERIFIED_IN_TRANSIT"
  | "DELIVERED_PENDING_CONFIRMATION"
  | "COMPLETED"
  | "DELIVERY_FAILED"
  | "CANCELLED"
  | "REFUNDED";

export type ManualDeliveryOrderStatusV2 =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PAYMENT_VERIFIED"
  | "IN_PRODUCTION"
  | "READY_FOR_COURIER_HANDOFF"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "DELIVERY_ISSUE"
  | "CANCELLED"
  | "REFUNDED";

export type PickupOrderStatusV2 =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PAYMENT_VERIFIED"
  | "IN_PRODUCTION"
  | "READY_FOR_PICKUP"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

interface StatusMeta {
  label: string;
  bg: string;
  fg: string;
  /** null = legacy value has no manual next-action; the entry itself IS the action's target. */
  legacyEquivalent: OrderStatus;
}

const TUMABODA_META: Record<TumaBodaOrderStatusV2, StatusMeta> = {
  PENDING_PAYMENT: { label: "Awaiting payment", bg: "rgba(234, 179, 8, 0.15)", fg: "#a16207", legacyEquivalent: "PENDING_PAYMENT" },
  PAID: { label: "Paid", bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d", legacyEquivalent: "PAID" },
  IN_PRODUCTION: { label: "In production", bg: "rgba(59, 130, 246, 0.15)", fg: "#1d4ed8", legacyEquivalent: "IN_PRODUCTION" },
  READY_FOR_RIDER_PICKUP: { label: "Ready for rider pickup", bg: "rgba(99, 102, 241, 0.15)", fg: "#4338ca", legacyEquivalent: "READY_FOR_DISPATCH" },
  RIDER_ASSIGNED: { label: "Rider assigned", bg: "rgba(99, 102, 241, 0.15)", fg: "#4338ca", legacyEquivalent: "READY_FOR_DISPATCH" },
  RIDER_VERIFIED_IN_TRANSIT: { label: "Rider verified — in transit", bg: "rgba(168, 85, 247, 0.15)", fg: "#7e22ce", legacyEquivalent: "DISPATCHED" },
  DELIVERED_PENDING_CONFIRMATION: { label: "Delivered — awaiting confirmation", bg: "rgba(168, 85, 247, 0.15)", fg: "#7e22ce", legacyEquivalent: "DISPATCHED" },
  COMPLETED: { label: "Completed", bg: "rgba(20, 184, 166, 0.18)", fg: "#0f766e", legacyEquivalent: "DELIVERED" },
  DELIVERY_FAILED: { label: "Delivery failed", bg: "rgba(239, 68, 68, 0.15)", fg: "#b91c1c", legacyEquivalent: "DISPATCHED" },
  CANCELLED: { label: "Cancelled", bg: "rgba(107, 114, 128, 0.18)", fg: "#374151", legacyEquivalent: "CANCELLED" },
  REFUNDED: { label: "Refunded", bg: "rgba(244, 63, 94, 0.15)", fg: "#be123c", legacyEquivalent: "REFUNDED" },
};

const MANUAL_META: Record<ManualDeliveryOrderStatusV2, StatusMeta> = {
  PENDING_PAYMENT: { label: "Awaiting payment", bg: "rgba(234, 179, 8, 0.15)", fg: "#a16207", legacyEquivalent: "PENDING_PAYMENT" },
  PAID: { label: "Paid", bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d", legacyEquivalent: "PAID" },
  PAYMENT_VERIFIED: { label: "Payment verified", bg: "rgba(13, 148, 136, 0.18)", fg: "#0f766e", legacyEquivalent: "PAYMENT_VERIFIED" },
  IN_PRODUCTION: { label: "In production", bg: "rgba(59, 130, 246, 0.15)", fg: "#1d4ed8", legacyEquivalent: "IN_PRODUCTION" },
  READY_FOR_COURIER_HANDOFF: { label: "Ready for courier handoff", bg: "rgba(99, 102, 241, 0.15)", fg: "#4338ca", legacyEquivalent: "READY_FOR_DISPATCH" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", bg: "rgba(168, 85, 247, 0.15)", fg: "#7e22ce", legacyEquivalent: "DISPATCHED" },
  COMPLETED: { label: "Completed", bg: "rgba(20, 184, 166, 0.18)", fg: "#0f766e", legacyEquivalent: "DELIVERED" },
  DELIVERY_ISSUE: { label: "Delivery issue", bg: "rgba(239, 68, 68, 0.15)", fg: "#b91c1c", legacyEquivalent: "DISPATCHED" },
  CANCELLED: { label: "Cancelled", bg: "rgba(107, 114, 128, 0.18)", fg: "#374151", legacyEquivalent: "CANCELLED" },
  REFUNDED: { label: "Refunded", bg: "rgba(244, 63, 94, 0.15)", fg: "#be123c", legacyEquivalent: "REFUNDED" },
};

const PICKUP_META: Record<PickupOrderStatusV2, StatusMeta> = {
  PENDING_PAYMENT: { label: "Awaiting payment", bg: "rgba(234, 179, 8, 0.15)", fg: "#a16207", legacyEquivalent: "PENDING_PAYMENT" },
  PAID: { label: "Paid", bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d", legacyEquivalent: "PAID" },
  PAYMENT_VERIFIED: { label: "Payment verified", bg: "rgba(13, 148, 136, 0.18)", fg: "#0f766e", legacyEquivalent: "PAYMENT_VERIFIED" },
  IN_PRODUCTION: { label: "In production", bg: "rgba(59, 130, 246, 0.15)", fg: "#1d4ed8", legacyEquivalent: "IN_PRODUCTION" },
  READY_FOR_PICKUP: { label: "Ready for pickup", bg: "rgba(99, 102, 241, 0.15)", fg: "#4338ca", legacyEquivalent: "READY_FOR_DISPATCH" },
  COMPLETED: { label: "Picked up", bg: "rgba(20, 184, 166, 0.18)", fg: "#0f766e", legacyEquivalent: "DELIVERED" },
  CANCELLED: { label: "Cancelled", bg: "rgba(107, 114, 128, 0.18)", fg: "#374151", legacyEquivalent: "CANCELLED" },
  REFUNDED: { label: "Refunded", bg: "rgba(244, 63, 94, 0.15)", fg: "#be123c", legacyEquivalent: "REFUNDED" },
};

function metaFor(fulfillmentType: string | null | undefined, statusV2: string | null | undefined): StatusMeta | null {
  if (!statusV2) return null;
  switch (fulfillmentType) {
    case "TUMABODA_DELIVERY":
      return TUMABODA_META[statusV2 as TumaBodaOrderStatusV2] ?? null;
    case "MANUAL_DELIVERY":
      return MANUAL_META[statusV2 as ManualDeliveryOrderStatusV2] ?? null;
    case "PICKUP":
      return PICKUP_META[statusV2 as PickupOrderStatusV2] ?? null;
    default:
      return null;
  }
}

/** Resolved {label, bg, fg} for display — prefers statusV2 (mode-specific wording) and falls
 *  back to the caller's legacy-status badge for orders not yet backfilled. */
export function resolveStatusDisplay(
  fulfillmentType: string | null | undefined,
  statusV2: string | null | undefined,
): { label: string; bg: string; fg: string } | null {
  const meta = metaFor(fulfillmentType, statusV2);
  return meta ? { label: meta.label, bg: meta.bg, fg: meta.fg } : null;
}

/** Mode-aware "next action" — replaces commerceUi.tsx's fulfillment-agnostic getNextAction.
 *  Returns null once the order has passed the last STAFF-CLICKABLE step for its mode (e.g. a
 *  TumaBoda order at "ready for rider pickup" advances only via the rider QR scan, never a
 *  manual click — see DispatchChecklist/RiderScanPanel). The returned `nextLegacyStatus` is
 *  what actually gets submitted to the existing PATCH /admin/orders/{id}/status endpoint; the
 *  backend's own syncStatusV2 resolves the precise statusV2 value from context automatically. */
export function getNextActionV2(
  fulfillmentType: string | null | undefined,
  statusV2: string | null | undefined,
  legacyStatus: OrderStatus,
): { nextLegacyStatus: OrderStatus; label: string; busyLabel?: string } | null {
  const current = statusV2 ?? legacyStatus;

  if (fulfillmentType === "TUMABODA_DELIVERY") {
    switch (current) {
      case "PAID":
        return { nextLegacyStatus: "IN_PRODUCTION", label: "Start production" };
      case "IN_PRODUCTION":
        // This click does more than flip a status — it synchronously books the TumaBoda rider
        // server-side too, which can take several seconds. A generic spinner on unchanged
        // label text reads as unresponsive; naming what's actually happening doesn't.
        return {
          nextLegacyStatus: "READY_FOR_DISPATCH",
          label: "Mark ready for rider pickup",
          busyLabel: "Booking rider…",
        };
      // READY_FOR_RIDER_PICKUP / RIDER_ASSIGNED / RIDER_VERIFIED_IN_TRANSIT /
      // DELIVERED_PENDING_CONFIRMATION: no manual action — the rider scan and the customer's
      // own confirmation drive these, not a staff click.
      default:
        return null;
    }
  }

  if (fulfillmentType === "MANUAL_DELIVERY") {
    switch (current) {
      case "PAID":
        return { nextLegacyStatus: "PAYMENT_VERIFIED", label: "Mark payment verified" };
      case "PAYMENT_VERIFIED":
        return { nextLegacyStatus: "IN_PRODUCTION", label: "Start production" };
      case "IN_PRODUCTION":
        return { nextLegacyStatus: "READY_FOR_DISPATCH", label: "Mark ready for courier handoff" };
      case "READY_FOR_COURIER_HANDOFF":
        return { nextLegacyStatus: "DISPATCHED", label: "Mark out for delivery" };
      case "OUT_FOR_DELIVERY":
        return { nextLegacyStatus: "DELIVERED", label: "Mark completed" };
      default:
        return null;
    }
  }

  if (fulfillmentType === "PICKUP") {
    switch (current) {
      case "PAID":
        return { nextLegacyStatus: "PAYMENT_VERIFIED", label: "Mark payment verified" };
      case "PAYMENT_VERIFIED":
        return { nextLegacyStatus: "IN_PRODUCTION", label: "Start production" };
      case "IN_PRODUCTION":
        return { nextLegacyStatus: "READY_FOR_DISPATCH", label: "Mark ready for pickup" };
      case "READY_FOR_PICKUP":
        // Pickup never goes through DISPATCHED — collection is the whole rest of the journey.
        return { nextLegacyStatus: "DELIVERED", label: "Mark picked up" };
      default:
        return null;
    }
  }

  return null;
}

/** Whether this fulfillment mode's completion is customer self-confirmed (TumaBoda/Manual,
 *  reusing the OTP track-order flow) or staff-marked in person (Pickup — see getNextActionV2's
 *  "Mark picked up"). Used to gate the track-order page's self-confirm UI. */
export function isCustomerSelfConfirmMode(fulfillmentType: string | undefined): boolean {
  return fulfillmentType === "TUMABODA_DELIVERY" || fulfillmentType === "MANUAL_DELIVERY";
}
