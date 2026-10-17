import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AgeBadge, formatKes } from "@/components/admin/commerceUi";
import { GenericNextActionButton } from "@/components/admin/GenericNextActionButton";
import { TumaBodaOtpChip } from "@/components/admin/TumaBodaOtpCard";
import { resolveStatusDisplay } from "@/lib/orderStatusV2";
import {
  ALL_ORDERS_BOARD_COLUMNS,
  AWAITING_PAYMENT_COLUMN,
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
  columnKey,
  onOpen,
  onOrderUpdated,
  canAssign,
  selected,
  onToggleSelect,
}: {
  order: OrderRecord & Record<string, any>;
  columnKey: string | null;
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
        {/* Same treatment as FulfillmentBoard's own cards: badge time-since-completion, not
         *  time-since-creation, once an order is done — otherwise an order that took days to
         *  fulfil but completed minutes ago reads as stale when it's actually current. */}
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
      {order.fulfillmentType === "TUMABODA_DELIVERY" && (
        <TumaBodaOtpChip
          code={order.tumabodaPickupOtpCode}
          expiresAt={order.tumabodaPickupOtpExpiresAt}
          verifiedAt={order.tumabodaPickupOtpVerifiedAt}
        />
      )}
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

  // Orders that were placed and saved but never paid. Hidden by default (they are mostly abandoned
  // checkouts, not work); the toggle reveals them as their own lane. Remembered per browser.
  const [showAwaiting, setShowAwaiting] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("allOrdersBoard.showAwaiting") === "1";
    } catch {
      return false;
    }
  });
  const toggleAwaiting = (on: boolean) => {
    setShowAwaiting(on);
    try {
      window.localStorage.setItem("allOrdersBoard.showAwaiting", on ? "1" : "0");
    } catch {
      /* storage unavailable: the toggle simply is not remembered */
    }
  };
  const columns = showAwaiting ? [AWAITING_PAYMENT_COLUMN, ...ALL_ORDERS_BOARD_COLUMNS] : ALL_ORDERS_BOARD_COLUMNS;

  const byColumn = new Map<string, (OrderRecord & Record<string, any>)[]>();
  for (const col of columns) byColumn.set(col.key, []);
  for (const order of orders) {
    const key = resolveAllOrdersColumnKey(order, { showAwaitingPayment: showAwaiting });
    if (key && byColumn.has(key)) byColumn.get(key)!.push(order);
  }

  // Same UX fix as FulfillmentBoard: "Closed" collapses to a slim strip by default (a cancelled/
  // refunded/long-closed order essentially never needs a click), and scroll-arrow buttons cover
  // whatever horizontal scrolling the fluid column widths (styles.css) don't fully eliminate.
  const [closedExpanded, setClosedExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollButtons();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateScrollButtons();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(updateScrollButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [closedExpanded]);

  const scrollByAmount = (dir: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  };

  return (
    <div>
      <label
        className="admin-section-heading"
        style={{ padding: "0 4px 10px", display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
      >
        <input type="checkbox" checked={showAwaiting} onChange={(e) => toggleAwaiting(e.target.checked)} />
        <span>Show orders awaiting payment (placed, not yet paid)</span>
        <span className="admin-badge admin-badge-muted">{awaitingPaymentCount}</span>
      </label>
      <div className="admin-board-columns-wrap">
        {canScrollLeft && (
          <button
            type="button"
            className="admin-board-scroll-btn admin-board-scroll-btn-left"
            onClick={() => scrollByAmount(-1)}
            aria-label="Scroll columns left"
          >
            <ChevronLeft size={16} />
          </button>
        )}
        {canScrollRight && (
          <button
            type="button"
            className="admin-board-scroll-btn admin-board-scroll-btn-right"
            onClick={() => scrollByAmount(1)}
            aria-label="Scroll columns right"
          >
            <ChevronRight size={16} />
          </button>
        )}
        <div className="admin-board-columns" ref={scrollRef}>
          {columns.map((col) => {
            const items = byColumn.get(col.key) ?? [];
            if (col.key === "closed" && !closedExpanded) {
              return (
                <div
                  key={col.key}
                  className="admin-board-column admin-board-column-collapsed"
                  onClick={() => setClosedExpanded(true)}
                  role="button"
                  tabIndex={0}
                  title="Show closed orders"
                >
                  <span className="admin-board-column-collapsed-label">
                    {col.label}
                    <span className="admin-badge admin-badge-muted">{items.length}</span>
                  </span>
                </div>
              );
            }
            return (
              <div key={col.key} className="admin-board-column">
                <div className="admin-board-column-header">
                  <span>{col.label}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="admin-badge admin-badge-muted">{items.length}</span>
                    {col.key === "closed" && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost"
                        style={{ fontSize: 10, padding: "1px 6px" }}
                        onClick={() => setClosedExpanded(false)}
                        title="Collapse back to a strip"
                      >
                        Collapse
                      </button>
                    )}
                  </span>
                </div>
                <div className="admin-board-column-body">
                  {items.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--admin-muted)", padding: "8px 2px" }}>Empty</div>
                  ) : (
                    items.map((o) => (
                      <AllOrdersCard
                        key={o.id}
                        order={o}
                        columnKey={col.key}
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
    </div>
  );
}
