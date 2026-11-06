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

/** TumaBoda's own top-up page. Signed-out visitors are sent to TumaBoda's sign-in and then back here. */
export const TUMABODA_TOPUP_URL = "https://business.tumaboda.co.ke/business/wallet/top-up";

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
      const loadFunding = () =>
        tumaBodaSettlementApi
          .getFunding()
          .then((f) => {
            setFunding(f);
            setMode(f.mode);
          })
          .catch(() => undefined);
      void loadFunding();
      // TumaBoda's balance changes without anyone touching Moments, so keep it current.
      const timer = window.setInterval(loadFunding, 60_000);
      return () => window.clearInterval(timer);
    } else {
      tumaBodaSettlementApi
        .getActiveFundingMode()
        .then((r) => setMode(r.mode))
        .catch(() => undefined);
    }
  }, [isAdmin]);

  const canSettle = isAdmin || hasPermission(PERM.SETTINGS_MANAGE);
  const forNewOrders = funding?.availableForNewOrders ?? null;
  const walletColor =
    forNewOrders == null || !funding
      ? undefined
      : forNewOrders <= funding.criticalBalanceKes
        ? "#dc2626"
        : forNewOrders <= funding.lowBalanceKes
          ? "var(--admin-clay)"
          : undefined;

  const walletEmpty =
    mode === "WALLET" && funding !== null && (!funding.realBalanceReadable || (forNewOrders ?? 0) <= 0);
  const link = (to: string, label: string, allowed: boolean) =>
    isAdmin && allowed ? <Link to={to} style={{ textDecoration: "underline" }}>{label}</Link> : <b>{label}</b>;

  return (
    <>
      <h2 id={titleId} style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
        TumaBoda deliveries are now paid from a wallet
      </h2>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--admin-muted)" }}>
        Moments pays TumaBoda in advance, and each delivery fee comes out of that money.
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
              TumaBoda wallet, free for new orders:{" "}
              <b style={{ color: walletColor }}>
                {funding.realBalanceReadable && forNewOrders != null ? formatKes(forNewOrders) : "can't be read right now"}
              </b>
            </span>
          )}
        </div>
      )}

      {walletEmpty && (
        <p
          role="status"
          style={{ margin: "12px 0 0", padding: "10px 12px", borderRadius: 10, fontSize: 13, background: "rgba(220, 38, 38, 0.08)", color: "#b91c1c" }}
        >
          <b>Customers can't choose TumaBoda right now,</b> because the TumaBoda wallet is empty or can't be read. Top
          up below to fix it.
        </p>
      )}

      {isAdmin ? (
        <>
          <h3 style={H3}>How to top up</h3>
          <ol style={OL}>
            <li>Press <b>Open TumaBoda top-up</b> below. Sign in to TumaBoda if it asks.</li>
            <li>Type the amount and the M-Pesa phone number, then press <b>Proceed to Pay</b>.</li>
            <li>Approve the M-Pesa prompt on the phone.</li>
          </ol>
          <a
            href={TUMABODA_TOPUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-primary"
            style={{ display: "inline-flex", marginTop: 10, textDecoration: "none" }}
          >
            Open TumaBoda top-up ↗
          </a>
          <p style={P}>
            <b>That's all.</b> Moments reads TumaBoda's wallet by itself and sees the money within a minute. You don't
            type it anywhere, there's nothing to approve, and no one to call.
          </p>
        </>
      ) : (
        <p style={{ ...P, marginTop: 12 }}>
          Nothing for you to do. If a customer says they can't choose TumaBoda at checkout, tell an admin: the wallet needs
          a top-up.
        </p>
      )}

      <h3 style={H3}>Good to know</h3>
      <ul style={UL}>
        <li>
          When the wallet can't cover a delivery fee, customers can't choose TumaBoda. Manual Delivery and Pickup stay
          available, so no order is lost.
        </li>
        <li>
          Admins get a notification when the balance reaches {formatKes(funding?.lowBalanceKes ?? 5000)}, and an email
          as well at {formatKes(funding?.criticalBalanceKes ?? 2000)}. That's the signal to top up.
        </li>
        <li>
          Money for orders already paid but not yet sent is kept aside, so two orders never spend the same money.
        </li>
        <li>
          Admins can switch back to the credit line under Delivery › {link("/admin/delivery-settings", "Delivery Settings", true)}.
          {!isAdmin && " Ask an admin if it needs changing."}
        </li>
      </ul>
    </>
  );
}
