import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatKes } from "@/components/admin/commerceUi";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import {
  tumaBodaSettlementApi,
  type TumaBodaFunding,
  type TumaBodaFundingMode,
} from "@/services/tumaBodaSettlementService";

const H3 = { margin: "16px 0 0", fontSize: 14, fontWeight: 700 } as const;
const OL = { margin: "6px 0 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.6, listStyleType: "decimal" } as const;
const UL = { margin: "6px 0 0", paddingLeft: 20, fontSize: 13, lineHeight: 1.6, listStyleType: "disc" } as const;
const P = { margin: "6px 0 0", fontSize: 13, lineHeight: 1.6 } as const;

const MODE_LABEL: Record<TumaBodaFundingMode, string> = {
  WALLET: "Wallet (prepaid)",
  CREDIT_LINE: "Credit line",
};

/** The Dashboard copy of the guide. It has no close button, so it stays there for reference. */
export function TumaBodaStrategyNotice() {
  return (
    <section
      className="admin-panel"
      aria-labelledby="tumaboda-strategy-title"
      style={{ padding: 20, borderLeft: "4px solid var(--admin-accent)" }}
    >
      <TumaBodaStrategyGuideContent titleId="tumaboda-strategy-title" />
    </section>
  );
}

/**
 * How TumaBoda deliveries are paid for and how to change it. Shared by the Dashboard panel and
 * the guide every staff member must read once. Balance figures are for admins only, the same as
 * the Settlements page.
 */
export function TumaBodaStrategyGuideContent({ titleId }: { titleId: string }) {
  const { isAdmin, hasPermission } = useAuth();
  const [mode, setMode] = useState<TumaBodaFundingMode | null>(null);
  const [funding, setFunding] = useState<TumaBodaFunding | null>(null);

  useEffect(() => {
    // A failed read only hides the "active now" line: the instructions still show.
    if (isAdmin) {
      tumaBodaSettlementApi
        .getFunding()
        .then((f) => {
          setFunding(f);
          setMode(f.mode);
        })
        .catch(() => undefined);
    } else {
      tumaBodaSettlementApi
        .getActiveFundingMode()
        .then((r) => setMode(r.mode))
        .catch(() => undefined);
    }
  }, [isAdmin]);

  const canSettle = isAdmin || hasPermission(PERM.SETTINGS_MANAGE);
  const walletColor =
    funding && funding.estimatedBalance <= funding.criticalBalanceKes
      ? "#dc2626"
      : funding && funding.estimatedBalance <= funding.lowBalanceKes
        ? "var(--admin-clay)"
        : undefined;

  const walletEmpty = mode === "WALLET" && funding !== null && funding.estimatedBalance <= 0;
  const link = (to: string, label: string, allowed: boolean) =>
    isAdmin && allowed ? <Link to={to} style={{ textDecoration: "underline" }}>{label}</Link> : <b>{label}</b>;

  return (
    <>
      <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
        TumaBoda deliveries can now be paid from a wallet or the credit line
      </h2>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--admin-muted)" }}>
        Only one is active at a time. Admins choose which one under Delivery › Delivery Settings.
      </p>

      {(mode || funding) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 24px", marginTop: 12, fontSize: 14 }}>
          {mode && (
            <span>
              Active now: <b>{MODE_LABEL[mode]}</b>
            </span>
          )}
          {funding && (
            <span>
              Wallet balance, our estimate: <b style={{ color: walletColor }}>{formatKes(funding.estimatedBalance)}</b>
            </span>
          )}
        </div>
      )}

      {walletEmpty && (
        <p
          role="status"
          style={{ margin: "12px 0 0", padding: "10px 12px", borderRadius: 10, fontSize: 13, background: "rgba(220, 38, 38, 0.08)", color: "#b91c1c" }}
        >
          <b>Customers can't choose TumaBoda right now,</b> because no wallet money is recorded yet. Follow "Do this now" below.
        </p>
      )}

      <h3 style={H3}>Do this now</h3>
      {isAdmin ? (
        <ol style={OL}>
          <li>Open the TumaBoda dashboard and note how much is in the wallet.</li>
          <li>If it's empty or low, top up there or by Paybill.</li>
          <li>
            In Moments, go to <b>Delivery</b> › {link("/admin/tumaboda-settlements", "TumaBoda Settlements", canSettle)} ›{" "}
            <b>Wallet</b> tab, and use <b>Record a top-up</b> for the full amount now in the TumaBoda wallet. Money that was
            already there counts too: record it once, with the note "opening balance".
          </li>
          <li>Check that the wallet balance on that page matches the TumaBoda dashboard.</li>
          <li>
            If the wallet can't be funded yet, switch to <b>Credit line</b> under <b>Delivery</b> ›{" "}
            {link("/admin/delivery-settings", "Delivery Settings", true)}, so customers can still choose TumaBoda.
          </li>
        </ol>
      ) : (
        <p style={P}>
          Nothing to set up. If a customer says they can't choose TumaBoda at checkout, tell an admin: the wallet probably
          needs a top-up.
        </p>
      )}

      <h3 style={H3}>How the wallet works</h3>
      <ul style={UL}>
        <li>Moments pays TumaBoda in advance. Each delivery fee comes out of that money.</li>
        <li>
          TumaBoda doesn't share the real balance with our system, so Moments keeps its own: top-ups recorded, minus fees
          for delivered orders, minus fees held for orders paid but not yet delivered. Money is held from checkout, so two orders can't spend the same money.
        </li>
        <li>A top-up only counts once someone records it in Moments. Recording it doesn't move any money.</li>
        <li>
          When the balance can't cover a delivery fee, customers still see a TumaBoda price at checkout but can't choose it.
          Manual Delivery and Pickup stay available.
        </li>
        <li>
          Admins get a notification when the balance reaches {formatKes(funding?.lowBalanceKes ?? 5000)}, and an email as
          well at {formatKes(funding?.criticalBalanceKes ?? 2000)}.
        </li>
        <li>Return or redelivery fees only show up at the weekly check, so do that check every week.</li>
      </ul>

      <h3 style={H3}>Every week</h3>
      <ol style={OL}>
        <li>
          <b>Top up</b> when the balance runs low, then record it on the Wallet tab of TumaBoda Settlements.
        </li>
        <li>
          <b>Check the balance:</b> on the same tab, enter the balance from the TumaBoda dashboard. Moments shows any
          difference.
        </li>
        <li>
          <b>Settle the credit line:</b> repayments and syncing stay on the Credit line tab, whichever strategy is active.
        </li>
      </ol>

      <h3 style={H3}>Switching between wallet and credit line</h3>
      <ul style={UL}>
        <li>
          Admins switch under <b>Delivery</b> › Delivery Settings › TumaBoda payment strategy.
          {!isAdmin && " Ask an admin if it needs changing."}
        </li>
        <li>Deliveries booked after the switch use the new strategy. Deliveries already booked stay where they started.</li>
        <li>Switching changes what Moments checks and records. It doesn't change how TumaBoda bills the account.</li>
      </ul>
    </>
  );
}
