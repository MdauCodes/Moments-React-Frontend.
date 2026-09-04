import { AgeBadge, formatKes } from "@/components/admin/commerceUi";
import { GenericNextActionButton } from "@/components/admin/GenericNextActionButton";
import { resolveStatusDisplay } from "@/lib/orderStatusV2";
import {
  ALL_ORDERS_BOARD_COLUMNS,
  resolveAllOrdersColumnKey,
  fulfillmentTypeShortLabel,
} from "@/lib/allOrdersBoardColumns";
import type { OrderRecord } from "@/services/commerceMock";

/**
 * The same card/column board design used by the per-mode boards (Pickup/Manual Delivery/
 * TumaBoda — see FulfillmentBoard), extended to a mixed set of orders across every fulfillment
 * type at once. Reuses the exact same CSS classes (admin-board-card, admin-board-columns, …) so
 * it's visually identical, not just similar. Two real differences from the single-mode board:
 * columns are keyed by the legacy Order.status (the only status vocabulary every mode shares —
 * see allOrdersBoardColumns.ts), and each card carries its own fulfillment-type badge, since
 * "Pickup" vs "TumaBoda" isn't otherwise obvious once orders of every type sit in the same column.
 */
function AllOrdersCard({
  order,
  onOpen,
  onOrderUpdated,
  canAssign,
  selected,
  onToggleSelect,
}: {
  order: OrderRecord & Record<string, any>;
  onOpen: (id: string) => void;
  onOrderUpdated: (order: OrderRecord) => void;
  canAssign: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const display = resolveStatusDisplay(order.fulfillmentType, order.statusV2);

  return (
    <div
      className="admin-board-card"
      onClick={() => onOpen(order.id)}
      role="button"
      tabIndex={0}
    >
      <div className="admin-card-row" style={{ fontSize: 12.5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {canAssign && (
            <input
              type="checkbox"
              checked={selected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onToggleSelect(order.id)}
              aria-label={`Select ${order.reference}`}
            />
          )}
          <b>{order.reference}</b>
        </span>
        <AgeBadge since={order.createdAt} />
      </div>
      <div className="admin-card-row" style={{ fontSize: 11.5, color: "var(--admin-muted)" }}>
        <span className="admin-board-card-truncate">{order.customerName}</span>
        <span style={{ fontWeight: 600, color: "var(--admin-text)" }}>{formatKes(order.total)}</span>
      </div>
      <div className="admin-card-row" style={{ fontSize: 10.5 }}>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: 999,
            background: "var(--admin-surface-2, #f0ede6)",
            color: "var(--admin-muted)",
            fontWeight: 600,
          }}
        >
          {fulfillmentTypeShortLabel(order.fulfillmentType)}
        </span>
        {display && (
          <span style={{ color: display.fg, fontWeight: 600 }} title={display.hint}>
            {display.label}
          </span>
        )}
      </div>
      {/* Same quick one-tap advance the per-mode boards use — renders nothing once a mode's own
          fulfillment-specific flow (QR scan, delivery confirmation, etc.) takes over. */}
      <div onClick={(e) => e.stopPropagation()} className="admin-board-card-action">
        <GenericNextActionButton order={order} onOrderUpdated={onOrderUpdated} />
      </div>
    </div>
  );
}

export function AllOrdersBoard({
  orders,
  onOpenOrder,
  onOrderUpdated,
  canAssign = false,
  selectedIds,
  onToggleSelect,
}: {
  orders: (OrderRecord & Record<string, any>)[];
  onOpenOrder: (id: string) => void;
  onOrderUpdated: (order: OrderRecord) => void;
  canAssign?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const awaitingPaymentCount = orders.filter((o) => o.status === "PENDING_PAYMENT").length;

  const byColumn = new Map<string, (OrderRecord & Record<string, any>)[]>();
  for (const col of ALL_ORDERS_BOARD_COLUMNS) byColumn.set(col.key, []);
  for (const order of orders) {
    const key = resolveAllOrdersColumnKey(order);
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
        {ALL_ORDERS_BOARD_COLUMNS.map((col) => {
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
                    <AllOrdersCard
                      key={o.id}
                      order={o}
                      onOpen={onOpenOrder}
                      onOrderUpdated={onOrderUpdated}
                      canAssign={canAssign}
                      selected={!!selectedIds?.has(o.id)}
                      onToggleSelect={(id) => onToggleSelect?.(id)}
                    />
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
