import { fulfillmentLabel } from "@/components/admin/analyticsPages/DeliverySection";
import type { CheckoutFunnelModeSummary, CheckoutFunnelStepSummary } from "@/services/commerceApi";

function stepLabel(step: CheckoutFunnelStepSummary["step"]) {
  switch (step) {
    case "OPENED": return "Opened checkout";
    case "CONTACT_COMPLETED": return "Filled in contact details";
    case "DELIVERY_CONFIRMED": return "Confirmed pickup/delivery";
    case "ORDER_PLACED": return "Placed the order";
  }
}

/** Super-admin-only: of sessions that chose a given delivery mode, where do they drop off before
 *  placing an order. Reuses the same session-level tracking as the all-sessions funnel report
 *  (Developer > Checkout Funnel on staging), just grouped by the mode each session settled on. */
export function FunnelByModeSection({ modes, loading }: { modes: CheckoutFunnelModeSummary[] | null; loading: boolean }) {
  if (loading && !modes) {
    return <p style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>Loading…</p>;
  }
  if (!modes || modes.length === 0 || modes.every((m) => m.sessions === 0)) {
    return <div className="admin-empty">No checkout sessions tracked by mode in this window yet.</div>;
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
      {modes.map((m) => (
        <div key={m.fulfillmentType}>
          <div className="admin-label" style={{ marginBottom: 8 }}>
            {fulfillmentLabel(m.fulfillmentType)} — {m.sessions} session(s)
          </div>
          <table className="admin-table">
            <thead>
              <tr><th>Stage</th><th>Sessions</th><th>% continued</th></tr>
            </thead>
            <tbody>
              {m.steps.map((s) => (
                <tr key={s.step}>
                  <td>{stepLabel(s.step)}</td>
                  <td>{s.sessions}</td>
                  <td>{s.pctOfPrevious == null ? "—" : `${s.pctOfPrevious}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export function funnelByModeExportTable(modes: CheckoutFunnelModeSummary[] | null) {
  const rows: (string | number)[][] = [];
  for (const m of modes ?? []) {
    for (const s of m.steps) {
      rows.push([fulfillmentLabel(m.fulfillmentType), stepLabel(s.step), s.sessions, s.pctOfOpened, s.pctOfPrevious ?? "—"]);
    }
  }
  return {
    title: "Checkout funnel drop-off by delivery mode",
    columns: ["Mode", "Stage", "Sessions", "% of opened", "% continued from previous stage"],
    rows,
  };
}
