import { AgeBadge, formatKes } from "@/components/admin/commerceUi";
import { GenericNextActionButton } from "@/components/admin/GenericNextActionButton";
import { BOARD_COLUMNS, resolveBoardColumnKey, isExceptionStatus } from "@/lib/fulfillmentBoardColumns";
import type { FulfillmentModeKey } from "@/lib/fulfillmentModes";
import type { OrderRecord } from "@/services/commerceMock";

/** Human-readable sub-status for a TumaBoda card sitting in "Ready for rider pickup" — the raw
 *  webhook status (accepted/heading_to_pickup/arrived_at_pickup/etc.) TumaBoda already sends,
 *  previously captured on Order.tumabodaStatus but never shown anywhere. Surfacing it here is
 *  what fixes the repeat-click confusion from live testing: staff see real rider progress
 *  instead of a static button that looks unresponsive while booking/assignment happens. */
function tumaBodaSubLabel(order: OrderRecord & Record<string, any>): string | null {
  if (!order.tumabodaDeliveryId) {
    return order.tumabodaBookingFailureReason ? "Booking failed — needs retry" : "Booking rider…";
  }
  if (!order.tumabodaStatus) return null;
  return String(order.tumabodaStatus).replace(/_/g, " ");
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
  const exception = isExceptionStatus(mode, order.statusV2)
    || (mode === "TUMABODA_DELIVERY" && !order.tumabodaDeliveryId && !!order.tumabodaBookingFailureReason);
  const subLabel =
    mode === "TUMABODA_DELIVERY" && resolveBoardColumnKey(mode, order) === "ready"
      ? tumaBodaSubLabel(order)
      : null;

  return (
    <div
      className={`admin-board-card${exception ? " admin-board-card-exception" : ""}`}
      onClick={() => onOpen(order.id)}
      role="button"
      tabIndex={0}
    >
      <div className="admin-card-row" style={{ fontSize: 12.5 }}>
        <b>{order.reference}</b>
        <AgeBadge since={order.createdAt} />
      </div>
      <div className="admin-card-row" style={{ fontSize: 11.5, color: "var(--admin-muted)" }}>
        <span className="admin-board-card-truncate">{order.customerName}</span>
        <span style={{ fontWeight: 600, color: "var(--admin-text)" }}>{formatKes(order.totalAmount)}</span>
      </div>
      {subLabel && (
        <div style={{ fontSize: 11, color: exception ? "#b91c1c" : "var(--admin-accent)", fontWeight: 600 }}>
          {subLabel}
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
