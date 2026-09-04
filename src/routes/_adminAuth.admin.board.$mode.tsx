import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { FulfillmentBoard } from "@/components/admin/FulfillmentBoard";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
import { listOrders, resyncStuckTumaBodaOrders } from "@/services/commerceApi";
import { adminResources } from "@/services/adminResources";
import { reportAdminError } from "@/lib/adminErrorToast";
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
    "Start production once paid, then \"Mark ready for rider pickup\" books the rider automatically. From there the card moves itself — TumaBoda's own status updates (arriving live via webhook, or checked periodically) carry it from \"Ready for rider pickup\" to \"Out for delivery\" to \"Completed\" with no staff click needed. Scanning the rider's QR at pickup is an OPTIONAL extra identity check, not a requirement — a card can reach \"Out for delivery\" without one, shown there as \"in transit — not scanned (optional)\" instead of \"Rider verified\". Scan any time (from this card, the order detail panel, or the Rider Verification page) to upgrade that label; skipping it never blocks the order. If a card looks stuck, use \"Check now\" on that order first — it's an immediate poll, not a 10-30 minute wait for the next automatic sweep.",
};

/** How out-of-date data (a status recorded before a status-derivation bugfix shipped, that's had
 *  no reason to receive a fresh webhook since) gets caught up — see the backend's
 *  TumaBodaReconciliationService.resyncFromStoredStatus. Re-derives from what's already stored,
 *  no TumaBoda API calls, so it's safe to run any time and a no-op for anything already correct. */
function ResyncStuckOrdersButton({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const { resynced } = await resyncStuckTumaBodaOrders();
      toast.success(
        resynced > 0
          ? `Resynced ${resynced} order${resynced === 1 ? "" : "s"} — moved to reflect TumaBoda's already-known status.`
          : "Nothing to resync — every order already matches its known TumaBoda status.",
      );
      onDone();
    } catch (err) {
      reportAdminError(err, "Failed to resync stuck orders");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="admin-btn admin-btn-ghost"
      style={{ fontSize: 11.5, padding: "4px 10px" }}
      disabled={busy}
      onClick={handleClick}
      title="Re-check every order still showing 'Ready for rider pickup' against what TumaBoda already told us — fixes cards stuck from before a status fix, no waiting for the next automatic sweep"
    >
      {busy && <Loader2 size={12} className="mr-1 animate-spin inline" />}
      Resync stuck orders
    </button>
  );
}

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

  // Clears this tab's own sidebar badge the moment it's actually visited — see
  // AdminNotificationService.markReadForFulfillmentType's Javadoc. `mode` is already the exact
  // FulfillmentType enum name the endpoint expects (PICKUP/MANUAL_DELIVERY/TUMABODA_DELIVERY).
  // Best-effort: a failure here shouldn't block the board from rendering, and the sidebar's own
  // poll will just show a stale (not wrong-forever) count until the next successful attempt.
  useEffect(() => {
    if (!mode) return;
    void adminResources.notifications.markReadByFulfillmentType(mode).catch(() => {});
  }, [mode]);

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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {mode === "TUMABODA_DELIVERY" && <ResyncStuckOrdersButton onDone={() => void refresh()} />}
                <QueueFreshness />
              </div>
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
