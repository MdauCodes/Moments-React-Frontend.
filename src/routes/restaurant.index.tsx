// Restaurant portal home (PortalHome / PortalHomePhone, doc 15 §17). What the store already has is
// live: the restaurant, its team, its catalogue and requests, its credit limit and terms. Orders,
// approvals, balances and payments wait for the store's PO and credit-ledger steps (3b, 4, 5), so
// those boxes say what will appear there instead of showing made-up numbers.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";

import { PortalShell, usePortal } from "@/components/restaurant/PortalShell";
import { OrderList, usePurchaseOrders } from "@/components/restaurant/PoList";
import { useCredit } from "@/lib/useCredit";
import { BalanceCard } from "@/components/restaurant/BalanceCard";
import { OrderAlerts } from "@/components/restaurant/OrderAlerts";
import {
  ComingSoon,
  Muted,
  Pill,
  PortalButtonLink,
  PortalCard,
  portalColors as c,
} from "@/components/restaurant/portalUi";
import { randomWhatsAppNumber } from "@/data/products";
import { restaurantApi, type HeadRequestRow, type MyCatalogue } from "@/services/restaurantApi";
import {
  describeChange,
  describeHeadRequest,
  firstName,
  isHeadRole,
  isPoClosed,
  creditUsedPct,
  kes,
  ruleText,
  shortDate,
  splitTeam,
} from "@/lib/restaurantPortal";

export default function RestaurantHomePage() {
  useEffect(() => {
    document.title = "Your restaurant · Moments Packaging";
  }, []);
  return (
    <PortalShell page="home">
      <HomeBody />
    </PortalShell>
  );
}

function HomeBody() {
  const { restaurant, me } = usePortal();
  const isHead = isHeadRole(restaurant.myRole);
  const team = splitTeam(restaurant.members, restaurant.invites);
  const [catalogue, setCatalogue] = useState<MyCatalogue | null>(null);
  const [headRequests, setHeadRequests] = useState<HeadRequestRow[]>([]);

  useEffect(() => {
    let live = true;
    restaurantApi
      .catalogue()
      .then((cat) => live && setCatalogue(cat))
      .catch(() => undefined);
    restaurantApi
      .headRequests()
      .then((rows) => live && setHeadRequests(rows.filter((r) => r.status === "PENDING")))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const nextChange = catalogue?.upcoming[0];
  const greeting = me ? `Hello ${firstName(me.name)}` : "Welcome";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-[22px] font-bold">{greeting}</h1>
          <Muted>{restaurant.businessName} orders packaging from Moments at its own prices.</Muted>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <PortalButtonLink to="/restaurant/order" className="min-h-[52px]">
            New order
          </PortalButtonLink>
          <PortalButtonLink
            to="/restaurant/browse"
            variant="secondary"
            className="min-h-[52px] text-center"
          >
            Browse products
          </PortalButtonLink>
        </div>
        <Muted className="-mt-2 text-[12.5px]">
          You order at your own prices. Need something new? Browse the products and ask for a quote;
          Moments prices it for you.
        </Muted>

        <HomeOrders isHead={isHead} rule={restaurant.approvalRule} />

        <HomeMoney />
        <BalanceCard />
      </div>

      <div className="flex flex-col gap-4">
        <OrderAlerts />
        <PortalCard aria-labelledby="h-cat">
          <h2 id="h-cat" className="text-[18px] font-bold">
            Your catalogue{catalogue?.version ? ` · ${catalogue.version}` : ""}
          </h2>
          {catalogue == null ? (
            <Muted>Loading…</Muted>
          ) : catalogue.version ? (
            <Muted>
              {catalogue.lines.length} {catalogue.lines.length === 1 ? "product" : "products"} at
              your own prices.
            </Muted>
          ) : (
            <Muted>
              No prices yet, so there's nothing to order from. Ask Moments to price the products you
              buy.
            </Muted>
          )}
          {nextChange?.changes[0] && (
            <div
              className="mt-2 rounded-[10px] p-2.5 text-[13.5px]"
              style={{ background: "#FFF8E6" }}
            >
              {describeChange(nextChange.effectiveFrom, nextChange.changes[0])}
              {nextChange.changes.length > 1 ? ` And ${nextChange.changes.length - 1} more.` : ""}
            </div>
          )}
          <div className="mt-3 flex flex-col gap-2">
            <PortalButtonLink to="/restaurant/catalogue" variant="secondary">
              Open your catalogue (and PDF)
            </PortalButtonLink>
            <PortalButtonLink to="/restaurant/browse" variant="secondary">
              Ask prices for new products
            </PortalButtonLink>
          </div>
        </PortalCard>

        <PortalCard aria-labelledby="h-team">
          <div className="flex items-center justify-between gap-2">
            <h2 id="h-team" className="text-[18px] font-bold">
              Team
            </h2>
            <Link
              to="/restaurant/team"
              className="inline-flex min-h-11 items-center text-[14px] font-semibold"
              style={{ color: c.green }}
            >
              Open
            </Link>
          </div>
          <Muted>
            {team.heads.length} {team.heads.length === 1 ? "head" : "heads"} · {team.staff.length}{" "}
            staff. Rule: {ruleText(restaurant.approvalRule)}.
          </Muted>
          {headRequests.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              {headRequests.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-2 text-[13.5px]">
                  <span className="min-w-0 first-letter:uppercase">{describeHeadRequest(r)}</span>
                  <Pill tone="wait">With Moments</Pill>
                </div>
              ))}
            </div>
          )}
        </PortalCard>

        <PortalCard aria-label="Your contact at Moments">
          <div className="flex items-center justify-between gap-3">
            <div>
              <strong>Moments Packaging</strong>
              <div className="text-[13px]" style={{ color: c.muted }}>
                Your contact at Moments
              </div>
            </div>
            <a
              href={`https://wa.me/${randomWhatsAppNumber()}?text=${encodeURIComponent(`Hello Moments, this is ${restaurant.businessName}.`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-4 font-bold text-white"
              style={{ background: c.green }}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
            </a>
          </div>
        </PortalCard>
      </div>
    </div>
  );
}

/**
 * The POs on the home page: those waiting for this person's signed copy ("For you to sign"; any
 * head, or the person who placed it) and the rest in progress. Until the store has POs (step 4),
 * both boxes say what will appear there.
 */
function HomeOrders({ isHead, rule }: { isHead: boolean; rule: string }) {
  const { rows } = usePurchaseOrders();
  if (!Array.isArray(rows)) {
    return (
      <>
        {isHead && (
          <PortalCard aria-labelledby="h-approve">
            <h2 id="h-approve" className="text-[18px] font-bold">
              For you to sign
            </h2>
            <ComingSoon
              title="Nothing waiting yet"
              text={`When your staff place orders, they wait here until ${ruleText(rule)}. You'll download each purchase order, sign it with the other heads, and upload the signed copy.`}
            />
          </PortalCard>
        )}
        <PortalCard aria-labelledby="h-progress">
          <h2 id="h-progress" className="text-[18px] font-bold">
            Orders in progress
          </h2>
          {rows === null ? (
            <Muted>Loading…</Muted>
          ) : (
            <ComingSoon
              title="Purchase orders open soon"
              text="Each order will show where it is: waiting for the signed copy, being prepared, waiting for Moments' final signature, or on its way."
            />
          )}
        </PortalCard>
      </>
    );
  }
  const mine = rows.filter((r) => r.needsMe || r.awaitingPayment);
  const open = rows.filter((r) => !r.needsMe && !r.awaitingPayment && !isPoClosed(r.stage));
  return (
    <>
      {mine.length > 0 && <OrderList title={`Needs you · ${mine.length}`} rows={mine} highlight />}
      {mine.length === 0 && isHead && (
        <PortalCard aria-labelledby="h-approve">
          <h2 id="h-approve" className="text-[18px] font-bold">
            For you to sign
          </h2>
          <Muted>
            Nothing is waiting for you: no PO needs your signature or payment right now.
          </Muted>
        </PortalCard>
      )}
      {open.length > 0 ? (
        <OrderList title="Orders in progress" rows={open.slice(0, 6)} />
      ) : (
        <PortalCard aria-labelledby="h-progress">
          <h2 id="h-progress" className="text-[18px] font-bold">
            Orders in progress
          </h2>
          <Muted>No orders are in progress. Place one from New order.</Muted>
        </PortalCard>
      )}
      <Link
        to="/restaurant/orders"
        className="-mt-2 inline-flex min-h-11 items-center text-[14px] font-semibold"
        style={{ color: c.green }}
      >
        All orders
      </Link>
    </>
  );
}

/**
 * Money on the home page (PortalHomePhone): credit available with a used bar, owed now with the next
 * due date, anything overdue, and the way to the statement and Pay by M-Pesa. Live from the store's
 * credit account (§19); a restaurant without credit pays each order by M-Pesa or bank.
 */
function HomeMoney() {
  const { restaurant } = usePortal();
  const { credit } = useCredit();
  const live = credit && credit !== "unavailable" ? credit : null;
  return (
    <PortalCard aria-labelledby="h-money">
      <h2 id="h-money" className="text-[18px] font-bold">
        Money
      </h2>
      {live && live.creditEnabled ? (
        <>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <div className="rounded-[10px] p-3" style={{ background: c.soft }}>
              <div className="text-[12.5px]" style={{ color: c.muted }}>
                Credit available
              </div>
              <div className="text-[18px] font-bold tabular-nums">{kes(live.available)}</div>
            </div>
            <div className="rounded-[10px] p-3" style={{ background: c.soft }}>
              <div className="text-[12.5px]" style={{ color: c.muted }}>
                Owed now
              </div>
              <div className="text-[18px] font-bold tabular-nums">{kes(live.owed)}</div>
              {live.nextDueOn && (
                <div className="text-[12.5px] tabular-nums" style={{ color: c.muted }}>
                  next {shortDate(live.nextDueOn)}
                  {live.nextDueAmount ? ` · ${kes(live.nextDueAmount)}` : ""}
                </div>
              )}
            </div>
          </div>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full"
            style={{ background: c.soft }}
            role="img"
            aria-label={`${kes(live.owed)} of ${kes(live.creditLimit)} credit used`}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${creditUsedPct(live.owed, live.creditLimit)}%`,
                background: live.overdue > 0 ? c.danger : c.green,
              }}
            />
          </div>
          <div
            className="mt-1.5 text-[13px]"
            style={{ color: live.overdue > 0 ? c.danger : c.muted }}
          >
            {kes(live.owed)} used of {kes(live.creditLimit)} ·{" "}
            {live.overdue > 0 ? `${kes(live.overdue)} overdue` : "nothing overdue"}
          </div>
          <div className="mt-3">
            <PortalButtonLink
              to="/restaurant/statement"
              variant={live.owed > 0 ? "primary" : "secondary"}
            >
              {live.owed > 0 ? "Pay by M-Pesa" : "Open the statement"}
            </PortalButtonLink>
          </div>
        </>
      ) : (
        <Muted className="mt-1">
          {credit === null
            ? "Loading…"
            : `You pay for each order by M-Pesa or bank. Moments can open credit for ${restaurant.businessName}; ask your contact at Moments.`}
        </Muted>
      )}
    </PortalCard>
  );
}
