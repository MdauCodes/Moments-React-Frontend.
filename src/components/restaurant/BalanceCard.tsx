// "Moments owes you" (owner, 17 Nov; doc 15 §23.4 B): money Moments holds for the restaurant, from
// a cancelled or lowered order. It is used first on the next order that isn't on credit; Moments can
// also refund it or set it against credit owed. Hidden when there is nothing to show.
import { useEffect, useState } from "react";

import { Muted, PortalCard, portalColors as c } from "./portalUi";
import { restaurantApi, type BalanceView } from "@/services/restaurantApi";
import { balanceMovementText, dateTime, kes } from "@/lib/restaurantPortal";

export function BalanceCard({ history = false }: { history?: boolean }) {
  const [view, setView] = useState<BalanceView | null>(null);

  useEffect(() => {
    let live = true;
    restaurantApi
      .balance()
      .then((v) => live && setView(v))
      .catch(() => undefined); // an older store without balances: show nothing
    return () => {
      live = false;
    };
  }, []);

  if (!view || (view.balance <= 0 && (!history || view.movements.length === 0))) return null;

  return (
    <PortalCard aria-labelledby="h-balance">
      <h2 id="h-balance" className="text-[18px] font-bold">
        Moments owes you
      </h2>
      <div className="mt-1 text-[22px] font-bold tabular-nums" style={{ color: c.green }}>
        {kes(view.balance)}
      </div>
      <Muted className="text-[13px]">
        {view.balance > 0
          ? "Used first on your next order that isn't on credit. Moments can also refund it."
          : "Moments isn't holding any money for you right now."}
      </Muted>
      {history && view.movements.length > 0 && (
        <ul className="mt-3 flex flex-col divide-y text-[14px]" style={{ borderColor: c.line }}>
          {view.movements.map((m) => (
            <li key={m.id} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="font-semibold">{balanceMovementText(m.kind)}</div>
                <div className="break-words text-[12.5px]" style={{ color: c.muted }}>
                  {dateTime(m.at)}
                  {m.orderReference ? ` · ${m.orderReference}` : ""}
                  {m.reference ? ` · ${m.reference}` : ""}
                </div>
                {m.note && (
                  <div className="text-[12.5px]" style={{ color: c.muted }}>
                    {m.note}
                  </div>
                )}
              </div>
              <div
                className="shrink-0 text-right font-bold tabular-nums"
                style={{ color: m.balanceChange < 0 ? c.muted : c.green }}
              >
                {m.balanceChange < 0 ? "−" : "+"} {kes(Math.abs(m.balanceChange))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PortalCard>
  );
}
