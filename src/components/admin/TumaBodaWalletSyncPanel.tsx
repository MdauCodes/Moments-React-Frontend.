import { useCallback, useEffect, useState } from "react";
import { formatKes } from "@/components/admin/commerceUi";
import { reportAdminError } from "@/lib/adminErrorToast";
import { tumaBodaSettlementApi, type TumaBodaWalletSync } from "@/services/tumaBodaSettlementService";

const TOLERANCE_KES = 1;

function Diff({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: "var(--admin-muted)" }}>—</span>;
  const ok = Math.abs(value) < TOLERANCE_KES;
  return (
    <b style={{ color: ok ? "var(--admin-accent)" : "#b91c1c" }}>
      {ok ? "Match" : `${value > 0 ? "TumaBoda has " : "We have "}${formatKes(Math.abs(value))} more`}
    </b>
  );
}

/**
 * Developer-only: Moments' wallet ledger next to TumaBoda's real wallet, to confirm they agree
 * before checkout starts trusting TumaBoda's balance.
 */
export function TumaBodaWalletSyncPanel() {
  const [sync, setSync] = useState<TumaBodaWalletSync | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSync(await tumaBodaSettlementApi.getWalletSync());
    } catch (err) {
      reportAdminError(err, "Couldn't run the wallet sync check");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const theirs = sync?.theirs ?? null;
  const row = (label: string, ours: number | null, their: number | null, diff: number | null, note: string) => (
    <tr>
      <td><b>{label}</b><div style={{ fontSize: 11, color: "var(--admin-muted)" }}>{note}</div></td>
      <td>{ours == null ? "—" : formatKes(ours)}</td>
      <td>{their == null ? "—" : formatKes(their)}</td>
      <td><Diff value={diff} /></td>
    </tr>
  );

  return (
    <div className="admin-panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>TumaBoda wallet sync</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--admin-muted)" }}>
            Developer only. Compares Moments' wallet ledger with TumaBoda's real wallet
            {sync ? ` (${sync.sandbox ? "sandbox" : "live"})` : ""}, read live from their API.
          </p>
        </div>
        <button type="button" className="admin-btn" disabled={loading} onClick={() => void load()}>
          {loading ? "Checking…" : "Check again"}
        </button>
      </div>

      {sync?.error && (
        <p style={{ margin: "12px 0 0", padding: "10px 12px", borderRadius: 10, fontSize: 13, background: "rgba(220, 38, 38, 0.08)", color: "#b91c1c" }}>
          <b>Couldn't read TumaBoda's wallet:</b> {sync.error}
        </p>
      )}

      {sync && (
        <div data-admin-table-scroll style={{ marginTop: 12 }}>
          <table className="admin-table">
            <thead>
              <tr><th>Figure</th><th>Moments</th><th>TumaBoda</th><th>Result</th></tr>
            </thead>
            <tbody>
              {row("Available cash", sync.ourAvailableEquivalent, theirs?.available ?? null, sync.availableDifference,
                "Ours: top-ups minus delivered fees minus booked deliveries on the road")}
              {row("Held for deliveries on the road", sync.ourBookedInFlight, theirs?.escrow ?? null, sync.escrowDifference,
                "Booked with TumaBoda and not finished")}
              {row("Spendable for new orders", sync.ourEstimate, sync.realSpendableAfterReservations, null,
                "Both after taking off paid orders not booked yet. Checkout uses the TumaBoda figure")}
            </tbody>
          </table>
          <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--admin-muted)" }}>
            Top-ups recorded {formatKes(sync.ourTopUps)} · delivered fees {formatKes(sync.ourDeliveredFees)} · paid but not
            booked {formatKes(sync.ourReservedNotBooked)}
            {theirs ? ` · TumaBoda status ${theirs.status ?? "—"}, in-app credit ${formatKes(theirs.inAppCredit ?? 0)}` : ""}
            {" "}· checked {new Date(sync.checkedAt).toLocaleString("en-KE")}
          </p>
        </div>
      )}
    </div>
  );
}
