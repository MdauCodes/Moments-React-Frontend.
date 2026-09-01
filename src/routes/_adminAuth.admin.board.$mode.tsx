import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { FulfillmentBoard } from "@/components/admin/FulfillmentBoard";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { listOrders } from "@/services/commerceApi";
import type { OrderRecord } from "@/services/commerceMock";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import { QueueFreshness } from "@/components/admin/QueueFreshness";
import { FULFILLMENT_MODES, type FulfillmentModeKey } from "@/lib/fulfillmentModes";

const SLUG_TO_MODE: Record<string, FulfillmentModeKey> = {
  pickup: "PICKUP",
  "manual-delivery": "MANUAL_DELIVERY",
  tumaboda: "TUMABODA_DELIVERY",
};

// "CBD / Hand Delivery" isn't a real FulfillmentType — it's a courierType narrowing of
// MANUAL_DELIVERY (Nairobi CBD, Moments' own team) — so it deliberately doesn't get its own
// FulfillmentModeKey/FULFILLMENT_MODES entry (that registry, and everything keyed off it —
// BOARD_COLUMNS, OrderDetailModal's panel selection — is for real fulfillment types). Hand
// Delivery orders share the exact same ManualDeliveryOrderStatus lifecycle and admin panel as
// every other Manual Delivery order, so this board reuses "MANUAL_DELIVERY" mode internally for
// columns/status logic and only narrows which orders populate it.
const HAND_DELIVERY_SLUG = "hand-delivery";

const MODE_HELP: Record<FulfillmentModeKey, string> = {
  PICKUP:
    "Orders move left to right as staff act on them: start production once paid, mark ready once packed, mark picked up once the customer collects it. \"Awaiting payment\" orders don't need action — nothing to click until they pay.",
  MANUAL_DELIVERY:
    "Start production once paid, mark ready once packed, mark out for delivery once handed to the courier, mark completed (or flag a delivery issue) once it's resolved. A red card means it needs attention, not that it failed.",
  TUMABODA_DELIVERY:
    "Start production once paid, then \"Mark ready for rider pickup\" books the rider automatically. The card shows TumaBoda's live status (accepted, heading to pickup, arrived at pickup) — wait for it to say the rider has arrived before scanning their QR code, which is the one manual step at that stage.",
};

function FulfillmentBoardPage() {
  const allowed = useRequirePermission([
    PERM.ORDER_VERIFY_PAYMENT,
    PERM.ORDER_PREPARE,
    PERM.ORDER_DISPATCH,
    PERM.ORDER_MANAGE_ALL,
  ]);
  const { mode: modeSlug } = useParams<{ mode: string }>();
  const isHandDeliveryBoard = modeSlug === HAND_DELIVERY_SLUG;
  const mode = isHandDeliveryBoard ? "MANUAL_DELIVERY" : modeSlug ? SLUG_TO_MODE[modeSlug] : undefined;
  const { orders, initialLoading, refresh, applyOrderPatch } = useAdminOrders();
  const [openId, setOpenId] = useState<string | null>(null);

  // The board otherwise only ever shows what's in the shared 500-most-recent cache, with no way
  // to reach an older order in this mode — mirrors the Orders page's own search-bypass pattern:
  // a typed query fetches directly from the backend (filtered to this mode) instead of filtering
  // the capped cache.
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [searchResults, setSearchResults] = useState<OrderRecord[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchGen = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (!mode || !debouncedQ) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    const gen = ++searchGen.current;
    setSearching(true);
    (async () => {
      try {
        // Backend can only filter by fulfillmentType, not courierType — modeOrders below
        // narrows to Hand Delivery specifically for both this and the cache-backed path.
        const res = await listOrders({ fulfillmentType: mode, q: debouncedQ, page: 0, size: 200 });
        if (gen === searchGen.current) setSearchResults(res.rows);
      } catch (err) {
        if (gen === searchGen.current) {
          toast.error(err instanceof Error ? err.message : "Search failed");
          setSearchResults([]);
        }
      } finally {
        if (gen === searchGen.current) setSearching(false);
      }
    })();
  }, [debouncedQ, mode]);

  const modeOrders = useMemo(() => {
    if (!mode) return [];
    const base = searchResults ?? orders.filter((o) => o.fulfillmentType === mode);
    return isHandDeliveryBoard
      ? base.filter((o) => (o as OrderRecord & Record<string, any>).courierType === "HAND_DELIVERY")
      : base;
  }, [orders, mode, searchResults, isHandDeliveryBoard]);

  if (!allowed) return null;
  if (!mode) {
    return (
      <AdminLayout title="Not found">
        <div className="admin-empty">Unknown fulfillment mode.</div>
      </AdminLayout>
    );
  }

  const config = FULFILLMENT_MODES[mode];
  const pageLabel = isHandDeliveryBoard ? "CBD / Hand Delivery" : config.label;
  const helpText = isHandDeliveryBoard
    ? "Same journey as Manual Delivery (start production, mark ready, mark out for delivery, " +
      "mark completed) — this board just shows Nairobi CBD Hand Delivery orders on their own, " +
      "since Moments' own team (not a phone-arranged courier) delivers these."
    : MODE_HELP[mode];

  return (
    <AdminLayout title={pageLabel} onReload={() => void refresh()}>
      <div className="admin-page-stack">
        <HelpAnchor>
          <div className="admin-panel">
            <HelpPanel title={`${pageLabel} board`}>
              <p>{helpText}</p>
            </HelpPanel>
            <div className="admin-section-heading">
              <span>{pageLabel}</span>
              <QueueFreshness />
            </div>
            <div style={{ padding: "0 10px 10px" }}>
              <input
                className="admin-input"
                placeholder="Search by reference, customer, phone… (searches every order in this mode, not just what's shown)"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ maxWidth: 420, width: "100%" }}
              />
            </div>
            {initialLoading ? (
              <div className="admin-empty">Loading…</div>
            ) : searching ? (
              <div className="admin-empty">Searching…</div>
            ) : (
              <div style={{ padding: "0 10px 10px" }}>
                <FulfillmentBoard
                  mode={mode}
                  orders={modeOrders}
                  onOpenOrder={setOpenId}
                  onOrderUpdated={(o) => applyOrderPatch(o.id, o)}
                />
              </div>
            )}
          </div>
        </HelpAnchor>
      </div>

      <OrderDetailModal orderId={openId} onClose={() => setOpenId(null)} onChanged={() => void refresh()} />
    </AdminLayout>
  );
}

export default FulfillmentBoardPage;
