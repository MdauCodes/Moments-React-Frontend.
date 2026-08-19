import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { OrderDetailModal } from "@/components/admin/OrderDetailModal";
import { FulfillmentBoard } from "@/components/admin/FulfillmentBoard";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";
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
  const mode = modeSlug ? SLUG_TO_MODE[modeSlug] : undefined;
  const { orders, initialLoading, refresh, applyOrderPatch } = useAdminOrders();
  const [openId, setOpenId] = useState<string | null>(null);

  const modeOrders = useMemo(
    () => (mode ? orders.filter((o) => o.fulfillmentType === mode) : []),
    [orders, mode],
  );

  if (!allowed) return null;
  if (!mode) {
    return (
      <AdminLayout title="Not found">
        <div className="admin-empty">Unknown fulfillment mode.</div>
      </AdminLayout>
    );
  }

  const config = FULFILLMENT_MODES[mode];

  return (
    <AdminLayout title={config.label} onReload={() => void refresh()}>
      <div className="admin-page-stack">
        <HelpAnchor>
          <div className="admin-panel">
            <HelpPanel title={`${config.label} board`}>
              <p>{MODE_HELP[mode]}</p>
            </HelpPanel>
            <div className="admin-section-heading">
              <span>{config.label}</span>
              <QueueFreshness />
            </div>
            {initialLoading ? (
              <div className="admin-empty">Loading…</div>
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
