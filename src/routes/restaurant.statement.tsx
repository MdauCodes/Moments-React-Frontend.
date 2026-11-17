// The restaurant's credit account (doc 15 §19): what is available, owed and overdue, the next
// payment, Pay by M-Pesa, the open charges (one per credit order, due a set number of days after
// delivery) and recent payments. The monthly statement PDF comes with step 5.
import { useEffect } from "react";

import { PortalShell, usePortal } from "@/components/restaurant/PortalShell";
import { PayByMpesa } from "@/components/restaurant/PayByMpesa";
import { BalanceCard } from "@/components/restaurant/BalanceCard";
import {
  ComingSoon,
  ErrorText,
  Muted,
  Pill,
  PortalButton,
  PortalCard,
  portalColors as c,
} from "@/components/restaurant/portalUi";
import {
  chargeDueText,
  creditUsedPct,
  dateTime,
  kes,
  paymentMethodText,
  paymentStatusText,
  shortDate,
} from "@/lib/restaurantPortal";
import { useCredit } from "@/lib/useCredit";

export default function RestaurantStatementPage() {
  useEffect(() => {
    document.title = "Statement · Moments Packaging";
  }, []);
  return (
    <PortalShell page="statement">
      <StatementBody />
    </PortalShell>
  );
}

function StatementBody() {
  const { me } = usePortal();
  const { credit, error, reload } = useCredit();

  if (error) {
    return (
      <PortalCard>
        <ErrorText>{error}</ErrorText>
        <PortalButton className="mt-3" onClick={() => void reload()}>
          Try again
        </PortalButton>
      </PortalCard>
    );
  }
  if (credit === null) {
    return <div className="h-48 animate-pulse rounded-2xl bg-black/5" aria-busy="true" />;
  }
  if (credit === "unavailable") {
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <h1 className="text-[24px] font-bold">Statement</h1>
        <ComingSoon
          title="Coming soon"
          text="Your credit account will be here: what you owe, when it's due, and Pay by M-Pesa."
        />
        <BalanceCard history />
      </div>
    );
  }
  if (!credit.creditEnabled) {
    return (
      <div className="flex max-w-xl flex-col gap-3">
        <h1 className="text-[24px] font-bold">Statement</h1>
        <Muted>
          {credit.restaurantName} pays for each order by M-Pesa or bank. Moments can open a credit
          account for you; ask your contact at Moments.
        </Muted>
        <BalanceCard history />
      </div>
    );
  }

  const used = creditUsedPct(credit.owed, credit.creditLimit);
  const payments = credit.recentPayments;
  const charges = credit.openCharges.filter((ch) => ch.status === "OPEN");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-[24px] font-bold">Statement</h1>
          <Muted>
            Credit of {kes(credit.creditLimit)}; each order is due {credit.paymentTermsDays ?? "—"}{" "}
            days after delivery.
          </Muted>
        </div>

        <PortalCard aria-label="Your credit">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Available" value={kes(credit.available)} />
            <Tile label="Owed now" value={kes(credit.owed)} />
            <Tile
              label="Overdue"
              value={credit.overdue > 0 ? kes(credit.overdue) : "Nothing"}
              danger={credit.overdue > 0}
            />
            <Tile
              label="Next payment"
              value={credit.nextDueOn ? shortDate(credit.nextDueOn) : "—"}
              sub={credit.nextDueAmount ? kes(credit.nextDueAmount) : undefined}
            />
          </div>
          <div
            className="mt-3 h-2.5 overflow-hidden rounded-full"
            style={{ background: c.soft }}
            role="img"
            aria-label={`${kes(credit.owed)} of ${kes(credit.creditLimit)} credit used`}
          >
            <div
              className="h-full rounded-full"
              style={{ width: `${used}%`, background: credit.overdue > 0 ? c.danger : c.green }}
            />
          </div>
          <div className="mt-1.5 text-[13px]" style={{ color: c.muted }}>
            {kes(credit.owed)} used of {kes(credit.creditLimit)}
            {credit.overdue > 0
              ? ` · ${kes(credit.overdue)} overdue: new orders wait for Moments until it's paid`
              : " · nothing overdue"}
          </div>
          {credit.unallocated > 0 && (
            <div className="mt-1 text-[13px]" style={{ color: c.muted }}>
              {kes(credit.unallocated)} paid in advance goes to your next order.
            </div>
          )}
        </PortalCard>

        <PortalCard aria-labelledby="h-charges">
          <h2 id="h-charges" className="text-[18px] font-bold">
            Orders on credit
          </h2>
          {charges.length === 0 ? (
            <Muted className="mt-1">Nothing open.</Muted>
          ) : (
            <ul className="mt-2 flex flex-col divide-y text-[14px]" style={{ borderColor: c.line }}>
              {charges.map((ch) => {
                const due = chargeDueText(ch);
                return (
                  <li key={ch.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="font-semibold tabular-nums">{ch.orderReference}</div>
                      <div className="text-[12.5px]" style={{ color: c.muted }}>
                        {shortDate(ch.chargedAt)} · {kes(ch.amount)}
                        {ch.paid > 0 ? ` · ${kes(ch.paid)} paid` : ""}
                      </div>
                      <div className="mt-1">
                        <Pill tone={due.tone}>{due.label}</Pill>
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-bold tabular-nums">{kes(ch.open)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </PortalCard>

        <PortalCard aria-labelledby="h-payments">
          <h2 id="h-payments" className="text-[18px] font-bold">
            Payments
          </h2>
          {payments.length === 0 ? (
            <Muted className="mt-1">No payments yet.</Muted>
          ) : (
            <ul className="mt-2 flex flex-col divide-y text-[14px]" style={{ borderColor: c.line }}>
              {payments.map((p) => {
                const st = paymentStatusText(p.status);
                return (
                  <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="font-semibold">{paymentMethodText(p.method)}</div>
                      <div className="break-words text-[12.5px]" style={{ color: c.muted }}>
                        {dateTime(p.paidOn ?? p.createdAt)}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </div>
                      <div className="mt-1">
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </div>
                      {p.rejectReason && (
                        <div className="mt-1 text-[13px]">
                          <strong>Moments:</strong> {p.rejectReason}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right font-bold tabular-nums">
                      {kes(p.amount)}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </PortalCard>

        <BalanceCard history />

        <ComingSoon
          title="Monthly statement (PDF)"
          text="Moments will email a statement on the 1st of each month, and you'll be able to download it here."
        />
      </div>

      <div className="flex flex-col gap-4">
        <PortalCard aria-labelledby="h-pay">
          <h2 id="h-pay" className="text-[18px] font-bold">
            Pay by M-Pesa
          </h2>
          {credit.owed > 0 ? (
            <div className="mt-2">
              <PayByMpesa
                owed={credit.owed}
                defaultPhone={me?.phone ?? ""}
                onDone={() => void reload()}
              />
            </div>
          ) : (
            <Muted className="mt-1">Nothing to pay right now.</Muted>
          )}
          <Muted className="mt-3 text-[12.5px]">
            Paying by bank or cheque? Send it as usual and tell your contact at Moments; it shows
            here once Moments records it.
          </Muted>
        </PortalCard>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-[10px] p-3" style={{ background: c.soft }}>
      <div className="text-[12.5px]" style={{ color: c.muted }}>
        {label}
      </div>
      <div
        className="text-[18px] font-bold tabular-nums"
        style={{ color: danger ? c.danger : undefined }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[12.5px] tabular-nums" style={{ color: c.muted }}>
          {sub}
        </div>
      )}
    </div>
  );
}
