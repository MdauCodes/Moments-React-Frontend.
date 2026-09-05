import { useState } from "react";
import { AgeBadge, formatKes } from "@/components/admin/commerceUi";
import { GenericNextActionButton } from "@/components/admin/GenericNextActionButton";
import { TumaBodaOtpChip } from "@/components/admin/TumaBodaOtpCard";
import { BOARD_COLUMNS, resolveBoardColumnKey, isExceptionStatus, tumaBodaHasMovedPastPickup } from "@/lib/fulfillmentBoardColumns";
import type { FulfillmentModeKey } from "@/lib/fulfillmentModes";
import type { OrderRecord } from "@/services/commerceMock";

/** Human-readable sub-status for a TumaBoda card — the raw webhook status (accepted/
 *  heading_to_pickup/in_transit/etc.) TumaBoda already sends, previously captured on
 *  Order.tumabodaStatus but never shown anywhere. Surfacing it here is what fixes the
 *  repeat-click confusion from live testing: staff see real rider progress instead of a static
 *  button that looks unresponsive while booking/assignment happens.
 *
 *  Once TumaBoda reports the parcel actually moving (in_transit/picked_up/delivered), the order
 *  moves itself to the "Out for delivery" column even without a merchant QR scan (see
 *  PaymentService.handleTumaBodaStatusUpdate's 2026-09-03 promotion note) — the scan is an
 *  OPTIONAL extra identity check now, not a gate. The "not scanned" note below is purely
 *  informational (staff can still scan any time via the order detail panel or the Rider
 *  Verification queue), not a call to action. */
function tumaBodaSubLabel(order: OrderRecord & Record<string, any>): string | null {
  if (!order.tumabodaDeliveryId) {
    return order.tumabodaBookingFailureReason ? "Booking failed — needs retry" : "Booking rider…";
  }
  if (!order.tumabodaStatus) return null;
  const raw = String(order.tumabodaStatus).toLowerCase();
  const label = raw.replace(/_/g, " ");
  if (!order.tumabodaRiderVerifiedAt && tumaBodaHasMovedPastPickup(order.tumabodaStatus)) {
    return label + " — not scanned (optional)";
  }
  return label;
}

function OrderCard({
  order,
  mode,
  onOpen,
  onOrderUpdated,
}: {
  order: OrderRecord & Record<string, any>;
  mode: FulfillmentModeKey;
  onOpen: (id: string) => void;
  onOrderUpdated: (order: OrderRecord) => void;
}) {
  const columnKey = resolveBoardColumnKey(mode, order);
  const exception = isExceptionStatus(mode, order.statusV2)
    || (mode === "TUMABODA_DELIVERY" && !order.tumabodaDeliveryId && !!order.tumabodaBookingFailureReason);
  const subLabel =
    mode === "TUMABODA_DELIVERY" && columnKey !== "new" && columnKey !== "in_production"
      ? tumaBodaSubLabel(order)
      : null;
  // The pickup OTP is only actionable while the rider hasn't picked up yet — once the parcel is
  // out for delivery (or later), the code has already been used or is moot, and a full-size,
  // ticking-countdown chip just clutters a card there's nothing left to act on. Collapsed to a
  // small expandable toggle instead of hidden outright, so staff can still pull it up (e.g. to
  // confirm what code was given) without it competing for attention on every card.
  const [otpExpanded, setOtpExpanded] = useState(false);
  const hasLivePickupOtp = !!order.tumabodaPickupOtpCode && !order.tumabodaPickupOtpVerifiedAt;
  const pastPickup = tumaBodaHasMovedPastPickup(order.tumabodaStatus);

  return (
    <div
      className={`admin-board-card${exception ? " admin-board-card-exception" : ""}`}
      onClick={() => onOpen(order.id)}
      role="button"
      tabIndex={0}
    >
      <div className="admin-card-row" style={{ fontSize: 12.5 }}>
        <b>{order.reference}</b>
        {/* Completed/Closed cards badge time-SINCE-COMPLETION, not time-since-creation —
         *  otherwise an order that took days to fulfil but completed minutes ago reads as a stale
         *  "3d ago" card needing attention, when it's actually done and current. Also suppresses
         *  the warn/urgent red-amber coloring there (meaningless once an order is finished).
         *  order.completedAt is only set for orders that actually completed (not a plain
         *  cancel/refund), so this falls back to createdAt for those, unaffected. */}
        {columnKey === "completed" || columnKey === "closed" ? (
          <AgeBadge since={order.completedAt ?? order.createdAt} warnAfterHours={Infinity} urgentAfterHours={Infinity} />
        ) : (
          <AgeBadge since={order.createdAt} />
        )}
      </div>
      <div className="admin-card-row" style={{ fontSize: 11.5, color: "var(--admin-muted)" }}>
        <span className="admin-board-card-truncate">{order.customerName}</span>
        <span style={{ fontWeight: 600, color: "var(--admin-text)" }}>{formatKes(order.total)}</span>
      </div>
      {subLabel && (
        <div style={{ fontSize: 11, color: exception ? "#b91c1c" : "var(--admin-accent)", fontWeight: 600 }}>
          {subLabel}
        </div>
      )}
      {mode === "TUMABODA_DELIVERY" && !pastPickup && (
        <TumaBodaOtpChip
          code={order.tumabodaPickupOtpCode}
          expiresAt={order.tumabodaPickupOtpExpiresAt}
          verifiedAt={order.tumabodaPickupOtpVerifiedAt}
        />
      )}
      {mode === "TUMABODA_DELIVERY" && pastPickup && hasLivePickupOtp && (
        <div onClick={(e) => e.stopPropagation()}>
          {otpExpanded ? (
            <TumaBodaOtpChip
              code={order.tumabodaPickupOtpCode}
              expiresAt={order.tumabodaPickupOtpExpiresAt}
              verifiedAt={order.tumabodaPickupOtpVerifiedAt}
            />
          ) : (
            <button
              type="button"
              className="text-[10px] uppercase tracking-wide text-muted-foreground underline"
              onClick={() => setOtpExpanded(true)}
              title="Pickup already happened (or this order has moved past it) — the code is no longer actionable, shown here for reference only"
            >
              Show pickup OTP
            </button>
          )}
        </div>
      )}
      {/* Quick one-tap advance for the generic pre-fulfillment stages (start production, mark
       *  ready) — renders nothing once the mode's own fulfillment-specific flow takes over (QR
       *  scan, delivery confirmation), same rule GenericNextActionButton already follows inside
       *  the full modal, so the card and the modal never disagree about what's clickable. */}
      <div onClick={(e) => e.stopPropagation()} className="admin-board-card-action">
        <GenericNextActionButton order={order} onOrderUpdated={onOrderUpdated} />
      </div>
    </div>
  );
}

export function FulfillmentBoard({
  mode,
  orders,
  onOpenOrder,
  onOrderUpdated,
}: {
  mode: FulfillmentModeKey;
  /** Already filtered to this fulfillment mode. */
  orders: (OrderRecord & Record<string, any>)[];
  onOpenOrder: (id: string) => void;
  /** Patches the shared order cache (AdminOrdersContext.applyOrderPatch) so a quick inline
   *  advance moves the card to its next column immediately, without waiting for the next poll. */
  onOrderUpdated: (order: OrderRecord) => void;
}) {
  const columns = BOARD_COLUMNS[mode];
  const awaitingPaymentCount = orders.filter((o) => (o.statusV2 ?? o.status) === "PENDING_PAYMENT").length;

  // The "Completed" column used to just accumulate every completed order ever seen with no time
  // bound (a board left open across days turned into an ever-growing stale list) — fixed 2026-09-06
  // with a 24h client-side filter, then superseded the same day by resolveBoardColumnKey's own
  // auto-close: any order completed over an hour ago now reclassifies straight into "Closed" (see
  // fulfillmentBoardColumns.ts's AUTO_CLOSE_COMPLETED_AFTER_MS), so nothing can sit in "Completed"
  // long enough for a 24h filter to ever matter any more. Removed the now-dead filter/toggle here
  // rather than leaving unreachable code behind.
  const byColumn = new Map<string, (OrderRecord & Record<string, any>)[]>();
  for (const col of columns) byColumn.set(col.key, []);
  for (const order of orders) {
    const key = resolveBoardColumnKey(mode, order);
    if (key && byColumn.has(key)) byColumn.get(key)!.push(order);
  }

  return (
    <div>
      {awaitingPaymentCount > 0 && (
        <div className="admin-section-heading" style={{ padding: "0 4px 10px" }}>
          <span>Awaiting payment (not yet actionable)</span>
          <span className="admin-badge admin-badge-muted">{awaitingPaymentCount}</span>
        </div>
      )}
      <div className="admin-board-columns">
        {columns.map((col) => {
          const items = byColumn.get(col.key) ?? [];
          return (
            <div key={col.key} className="admin-board-column">
              <div className="admin-board-column-header">
                <span>{col.label}</span>
                <span className="admin-badge admin-badge-muted">{items.length}</span>
              </div>
              <div className="admin-board-column-body">
                {items.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--admin-muted)", padding: "8px 2px" }}>Empty</div>
                ) : (
                  items.map((o) => (
                    <OrderCard key={o.id} order={o} mode={mode} onOpen={onOpenOrder} onOrderUpdated={onOrderUpdated} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
