// The restaurant's PO list pieces, shared by the Orders page and the portal home (doc 15 §21).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { Pill, PortalCard, portalColors as c } from "./portalUi";
import { restaurantApi, RestaurantApiError, type PoRow } from "@/services/restaurantApi";
import { dateTime, kes, poStageText } from "@/lib/restaurantPortal";

/** Loads the POs; `null` while loading, "unavailable" until the store has the endpoint. */
export function usePurchaseOrders() {
  const [rows, setRows] = useState<PoRow[] | null | "unavailable">(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setRows(await restaurantApi.purchaseOrders());
      setError(null);
    } catch (e) {
      if (e instanceof RestaurantApiError && (e.status === 404 || e.status === 405)) {
        setRows("unavailable");
      } else {
        setError(e instanceof Error ? e.message : "Couldn't load your orders.");
      }
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { rows, error, reload: load };
}

export function OrderList({
  title,
  rows,
  highlight,
}: {
  title: string;
  rows: PoRow[];
  highlight?: boolean;
}) {
  return (
    <PortalCard aria-label={title}>
      <h2 className="text-[18px] font-bold">{title}</h2>
      <ul className="mt-2 flex flex-col divide-y" style={{ borderColor: c.line }}>
        {rows.map((r) => {
          const st = poStageText(r.stage);
          return (
            <li key={r.orderId} className="list-none">
              <Link
                to={`/restaurant/orders/${r.orderId}`}
                className="flex min-h-14 items-center gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <strong className="tabular-nums">{r.poNumber}</strong>
                    <span className="tabular-nums">{kes(r.total)}</span>
                  </div>
                  <div className="text-[13px]" style={{ color: c.muted }}>
                    {r.placedBy.name} · {r.itemCount} {r.itemCount === 1 ? "item" : "items"} ·{" "}
                    {dateTime(r.placedAt)}
                  </div>
                  <div className="mt-1">
                    <Pill tone={highlight ? "wait" : st.tone}>
                      {highlight && r.stage !== "SENT_BACK" ? "Sign and upload" : st.label}
                    </Pill>
                  </div>
                </div>
                <ChevronRight
                  className="h-5 w-5 shrink-0"
                  style={{ color: c.muted }}
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </PortalCard>
  );
}
