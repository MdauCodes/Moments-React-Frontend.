// The restaurant's purchase orders (doc 15 §21): those that need the signed copy first, then the
// rest in progress, then finished ones. Buyers see the POs they placed; heads see all (the store
// decides). Until the store has step 4, the list endpoint is missing and the page says so.
import { useEffect } from "react";

import { PortalShell } from "@/components/restaurant/PortalShell";
import { OrderList, usePurchaseOrders } from "@/components/restaurant/PoList";
import {
  ComingSoon,
  ErrorText,
  Muted,
  PortalButton,
  PortalButtonLink,
  PortalCard,
} from "@/components/restaurant/portalUi";
import type { PoRow } from "@/services/restaurantApi";
import { isPoClosed } from "@/lib/restaurantPortal";

export default function RestaurantOrdersPage() {
  useEffect(() => {
    document.title = "Orders · Moments Packaging";
  }, []);
  return (
    <PortalShell page="orders">
      <OrdersBody />
    </PortalShell>
  );
}

function OrdersBody() {
  const { rows, error, reload } = usePurchaseOrders();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[24px] font-bold">Orders</h1>
          <PortalButtonLink to="/restaurant/order">New order</PortalButtonLink>
        </div>
        <Muted>
          Your purchase orders at your catalogue prices. Each one is printed, signed by your heads,
          and the signed copy uploaded here; then Moments prepares it.
        </Muted>
      </div>

      {error && (
        <PortalCard>
          <ErrorText>{error}</ErrorText>
          <PortalButton className="mt-3" onClick={() => void reload()}>
            Try again
          </PortalButton>
        </PortalCard>
      )}
      {rows === null && !error && (
        <div className="h-40 animate-pulse rounded-2xl bg-black/5" aria-busy="true" />
      )}
      {rows === "unavailable" && (
        <ComingSoon
          title="Purchase orders open soon"
          text="Orders from your catalogue will be listed here with their PO number and where each one is. Until then, order through your contact at Moments."
        />
      )}
      {Array.isArray(rows) && <OrderGroups rows={rows} />}
    </div>
  );
}

function OrderGroups({ rows }: { rows: PoRow[] }) {
  if (rows.length === 0) {
    return (
      <Muted>
        No orders yet. Place one from New order; it shows here with where it is at each step.
      </Muted>
    );
  }
  const needsYou = (r: PoRow) => r.needsMe || !!r.awaitingPayment;
  const mine = rows.filter(needsYou);
  const open = rows.filter((r) => !needsYou(r) && !isPoClosed(r.stage));
  const done = rows.filter((r) => !needsYou(r) && isPoClosed(r.stage));
  return (
    <>
      {mine.length > 0 && <OrderList title={`Needs you · ${mine.length}`} rows={mine} highlight />}
      {open.length > 0 && <OrderList title="In progress" rows={open} />}
      {done.length > 0 && <OrderList title="Done" rows={done} />}
    </>
  );
}
