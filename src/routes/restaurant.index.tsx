// Restaurant portal home (PortalHome / PortalHomePhone, doc 15 §17). What the store already has is
// live: the restaurant, its team, its catalogue and requests, its credit limit and terms. Orders,
// approvals, balances and payments wait for the store's PO and credit-ledger steps (3b, 4, 5), so
// those boxes say what will appear there instead of showing made-up numbers.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";

import { PortalShell, usePortal } from "@/components/restaurant/PortalShell";
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
  kes,
  ruleText,
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
          <PortalButtonLink to="/restaurant/catalogue" className="min-h-[52px]">
            New order
          </PortalButtonLink>
          <PortalButtonLink to="/products" variant="secondary" className="min-h-[52px] text-center">
            Quick purchase (pay now)
          </PortalButtonLink>
        </div>
        <Muted className="-mt-2 text-[12.5px]">
          Quick purchase is at the shop price and is paid at once by M-Pesa or bank; it skips your
          heads' approval and never goes on credit.
        </Muted>

        {isHead && (
          <PortalCard aria-labelledby="h-approve">
            <h2 id="h-approve" className="text-[18px] font-bold">
              For you to approve
            </h2>
            <ComingSoon
              title="Nothing waiting yet"
              text={`When your staff place orders, they wait here until ${ruleText(restaurant.approvalRule)}. You'll be able to look at each one and approve and sign it from your phone.`}
            />
          </PortalCard>
        )}

        <PortalCard aria-labelledby="h-progress">
          <h2 id="h-progress" className="text-[18px] font-bold">
            Orders in progress
          </h2>
          <ComingSoon
            title="Purchase orders open soon"
            text="Each order will show where it is: with your heads, being prepared, waiting for Moments' final signature, or on its way. Orders you place in the shop meanwhile are under My orders in your account."
          />
          <Link
            to="/account/orders"
            className="mt-2 inline-flex min-h-11 items-center text-[14px] font-semibold"
            style={{ color: c.green }}
          >
            My shop orders
          </Link>
        </PortalCard>

        <PortalCard aria-labelledby="h-money">
          <h2 id="h-money" className="text-[18px] font-bold">
            Money
          </h2>
          {restaurant.creditEnabled && restaurant.creditLimit != null ? (
            <div className="mt-1 grid grid-cols-2 gap-2">
              <div className="rounded-[10px] p-3" style={{ background: c.soft }}>
                <div className="text-[12.5px]" style={{ color: c.muted }}>
                  Credit limit
                </div>
                <div className="text-[18px] font-bold">{kes(restaurant.creditLimit)}</div>
              </div>
              <div className="rounded-[10px] p-3" style={{ background: c.soft }}>
                <div className="text-[12.5px]" style={{ color: c.muted }}>
                  Time to pay
                </div>
                <div className="text-[18px] font-bold">
                  {restaurant.paymentTermsDays ?? "—"} days
                </div>
              </div>
            </div>
          ) : (
            <Muted className="mt-1">
              You pay for each order by M-Pesa or bank. Moments can open credit for{" "}
              {restaurant.businessName}; ask your contact at Moments.
            </Muted>
          )}
          <div className="mt-3">
            <ComingSoon
              title="Balance, payments due and statements"
              text="What you owe, the next due date, what you spent this month and Pay by M-Pesa appear here once ordering on credit opens."
            />
          </div>
        </PortalCard>
      </div>

      <div className="flex flex-col gap-4">
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
            <Muted>No approved prices yet.</Muted>
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
              Open your catalogue
            </PortalButtonLink>
            <PortalButtonLink to="/restaurant/catalogue" variant="secondary">
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
