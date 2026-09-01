// ----------------------------------------------------------------------------
// Shared UI helpers for the e-commerce admin (orders / payments / dashboard).
// Pure presentation — no business logic.
// ----------------------------------------------------------------------------
import type { OrderStatus, PaymentStatus, PaymentGateway } from "@/services/commerceMock";
import { resolveStatusDisplay } from "@/lib/orderStatusV2";

export function formatKes(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `KES ${safe.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

export function formatDateShort(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", { day: "2-digit", month: "short" });
}

// Matches backend OrderStatus enum exactly
const ORDER_TONE: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
  PENDING_PAYMENT: { bg: "rgba(234, 179, 8, 0.15)", fg: "#a16207", label: "Pending payment" },
  PAID: { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d", label: "Paid" },
  PAYMENT_VERIFIED: { bg: "rgba(13, 148, 136, 0.18)", fg: "#0f766e", label: "Payment verified" },
  IN_PRODUCTION: { bg: "rgba(59, 130, 246, 0.15)", fg: "#1d4ed8", label: "In production" },
  READY_FOR_DISPATCH: { bg: "rgba(99, 102, 241, 0.15)", fg: "#4338ca", label: "Ready for dispatch" },
  DISPATCHED: { bg: "rgba(168, 85, 247, 0.15)", fg: "#7e22ce", label: "Dispatched" },
  DELIVERED: { bg: "rgba(20, 184, 166, 0.18)", fg: "#0f766e", label: "Delivered" },
  CANCELLED: { bg: "rgba(107, 114, 128, 0.18)", fg: "#374151", label: "Cancelled" },
  REFUNDED: { bg: "rgba(244, 63, 94, 0.15)", fg: "#be123c", label: "Refunded" },
};

// Matches backend PaymentStatus enum exactly
const PAYMENT_TONE: Record<PaymentStatus, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: "rgba(234, 179, 8, 0.15)", fg: "#a16207", label: "Pending" },
  PAID: { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d", label: "Paid" },
  FAILED: { bg: "rgba(239, 68, 68, 0.15)", fg: "#b91c1c", label: "Failed" },
  REFUNDED: { bg: "rgba(244, 63, 94, 0.15)", fg: "#be123c", label: "Refunded" },
};

// Matches backend PaymentMethod enum exactly
const GATEWAY_LABEL: Record<PaymentGateway, string> = {
  PAYHERO: "PayHero",
  MPESA: "M-Pesa",
  BANK_TRANSFER: "Bank transfer",
  CASH_ON_DELIVERY: "Cash on delivery",
};

export function OrderStatusBadge({
  status,
  fulfillmentType,
  statusV2,
}: {
  status: OrderStatus;
  /** When provided alongside statusV2, shows the mode-specific label/tone (e.g. "Ready for
   *  pickup" instead of the generic "Ready for dispatch") instead of the legacy badge. Falls
   *  back to the legacy badge for orders not yet backfilled with a statusV2. */
  fulfillmentType?: string | null;
  statusV2?: string | null;
}) {
  const resolved = resolveStatusDisplay(fulfillmentType, statusV2);
  const tone = resolved ?? ORDER_TONE[status] ?? { bg: "rgba(107,114,128,0.15)", fg: "#374151", label: status };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {tone.label}
    </span>
  );
}

/**
 * Elapsed time since a timestamp, color-coded so a stuck order is visible at
 * a glance instead of requiring staff to notice a plain date. Default
 * thresholds (6h / 24h) are tuned for same-day-Nairobi / up-to-3-day delivery
 * — an order sitting untouched that long in one status is worth a second look.
 */
export function AgeBadge({
  since,
  warnAfterHours = 6,
  urgentAfterHours = 24,
}: {
  since: string | undefined;
  warnAfterHours?: number;
  urgentAfterHours?: number;
}) {
  if (!since) return null;
  const ms = Date.now() - new Date(since).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = ms / (1000 * 60 * 60);

  const text =
    hours < 1
      ? `${Math.max(1, Math.round(hours * 60))}m ago`
      : hours < 24
        ? `${Math.round(hours)}h ago`
        : `${Math.round(hours / 24)}d ago`;

  const tone =
    hours >= urgentAfterHours
      ? { bg: "rgba(239, 68, 68, 0.15)", fg: "#b91c1c" }
      : hours >= warnAfterHours
        ? { bg: "rgba(234, 179, 8, 0.15)", fg: "#a16207" }
        : { bg: "rgba(107, 114, 128, 0.12)", fg: "#4b5563" };

  return (
    <span
      title={new Date(since).toLocaleString("en-KE")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone = PAYMENT_TONE[status] ?? { bg: "rgba(234,179,8,0.15)", fg: "#a16207", label: status };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      {tone.label}
    </span>
  );
}

const FULFILLMENT_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  PICKUP: { bg: "rgba(99, 102, 241, 0.15)", fg: "#4338ca", label: "Pickup" },
  MANUAL_DELIVERY: { bg: "rgba(234, 179, 8, 0.15)", fg: "#a16207", label: "Manual" },
  TUMABODA_DELIVERY: { bg: "rgba(20, 184, 166, 0.18)", fg: "#0f766e", label: "TumaBoda" },
};

/** Per-row fulfillment-mode indicator for the Orders table — previously the only fulfillment
 *  signal in that table was the narrow TumaBoda "No delivery" chip; every other row gave no
 *  visual hint of Pickup vs Manual vs TumaBoda at a glance. */
export function FulfillmentBadge({ fulfillmentType }: { fulfillmentType: string | undefined }) {
  if (!fulfillmentType) return null;
  const tone = FULFILLMENT_TONE[fulfillmentType] ?? { bg: "rgba(107,114,128,0.15)", fg: "#374151", label: fulfillmentType };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.02em",
        background: tone.bg,
        color: tone.fg,
        whiteSpace: "nowrap",
      }}
    >
      {tone.label}
    </span>
  );
}

const DELIVERY_FEE_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  UNPAID: { bg: "rgba(239, 68, 68, 0.15)", fg: "#b91c1c", label: "Fee unpaid" },
  PENDING_STK: { bg: "rgba(234, 179, 8, 0.15)", fg: "#a16207", label: "Fee: STK sent" },
  PAID: { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d", label: "Fee paid" },
};

/** Manual Delivery's fee-collection status — genuinely useful at a glance since, unlike every
 *  other fulfillment type, this fee isn't known/charged at checkout and needs an admin follow-up
 *  call to actually collect. Only meaningful for MANUAL_DELIVERY orders. */
export function DeliveryFeeStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const tone = DELIVERY_FEE_TONE[status];
  if (!tone) return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 600,
        background: tone.bg,
        color: tone.fg,
        whiteSpace: "nowrap",
      }}
    >
      {tone.label}
    </span>
  );
}

/** Hand Delivery (Nairobi CBD, Manual Delivery's one courier type with a real checkout-time fee)
 *  is paid upfront as part of the order's own M-Pesa charge, not collected later like every other
 *  Manual Delivery courier type — DeliveryFeeStatusBadge's "unpaid/STK sent" states don't apply to
 *  it and would misleadingly suggest a fee still needs collecting. shippingFee is the order's own
 *  stored, checkout-time-resolved amount (server-computed, not re-derived from the current free-
 *  delivery threshold setting), so it stays accurate even if that setting changes later. */
export function HandDeliveryFeeBadge({ shippingFee }: { shippingFee: number }) {
  const isFree = shippingFee === 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 600,
        background: isFree ? "rgba(34, 197, 94, 0.15)" : "rgba(59, 130, 246, 0.15)",
        color: isFree ? "#15803d" : "#1d4ed8",
        whiteSpace: "nowrap",
      }}
    >
      {isFree ? "Free delivery" : `Paid ${formatKes(shippingFee)}`}
    </span>
  );
}

export function GatewayChip({ gateway }: { gateway: PaymentGateway }) {
  const label = GATEWAY_LABEL[gateway] ?? gateway;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 7px",
        borderRadius: 6,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.04em",
        background: "var(--admin-surface-2)",
        color: "var(--admin-text)",
        border: "1px solid var(--admin-border)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export function MockBanner({ source }: { source: "live" | "mock" }) {
  if (source === "live") return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        background: "rgba(234, 179, 8, 0.12)",
        border: "1px solid rgba(234, 179, 8, 0.3)",
        color: "#92400e",
        fontSize: 12,
        marginBottom: 14,
      }}
    >
      <span style={{ fontWeight: 600 }}>Demo data</span>
      <span style={{ opacity: 0.85 }}>
        Showing illustrative figures. Live data will appear once the backend endpoint is reachable.
      </span>
    </div>
  );
}

// Matches backend OrderStatus enum exactly — used in status update dropdowns
export const ORDER_STATUS_OPTIONS: { value: OrderStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING_PAYMENT", label: "Pending payment" },
  { value: "PAID", label: "Paid" },
  { value: "PAYMENT_VERIFIED", label: "Payment Verified" },
  { value: "IN_PRODUCTION", label: "In production" },
  { value: "READY_FOR_DISPATCH", label: "Ready for dispatch" },
  { value: "DISPATCHED", label: "Dispatched" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUNDED", label: "Refunded" },
];

// Linear happy-path progression — the payment/preparation/dispatch queue pages
// already only show the one valid next action instead of every status button
// always-visible; this brings the same pattern to the order detail page and
// drawer. Branches (CANCELLED, REFUNDED) and the starting state
// (PENDING_PAYMENT — nothing staff can do until the customer pays) have no
// forward action.
const FORWARD_FLOW: OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PAYMENT_VERIFIED",
  "IN_PRODUCTION",
  "READY_FOR_DISPATCH",
  "DISPATCHED",
  "DELIVERED",
];

const NEXT_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  PAID: "Mark payment verified",
  PAYMENT_VERIFIED: "Start production",
  IN_PRODUCTION: "Mark ready for dispatch",
  READY_FOR_DISPATCH: "Mark dispatched",
  DISPATCHED: "Mark delivered",
};

export function getNextAction(status: OrderStatus): { nextStatus: OrderStatus; label: string } | null {
  const idx = FORWARD_FLOW.indexOf(status);
  if (idx === -1 || idx === FORWARD_FLOW.length - 1) return null;
  const nextStatus = FORWARD_FLOW[idx + 1];
  const label = NEXT_ACTION_LABEL[status];
  return label ? { nextStatus, label } : null;
}

export const PAYMENT_STATUS_OPTIONS: { value: PaymentStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

export const GATEWAY_OPTIONS: { value: PaymentGateway | "ALL"; label: string }[] = [
  { value: "ALL", label: "All gateways" },
  { value: "PAYHERO", label: "PayHero" },
  { value: "MPESA", label: "M-Pesa" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CASH_ON_DELIVERY", label: "Cash on delivery" },
];
