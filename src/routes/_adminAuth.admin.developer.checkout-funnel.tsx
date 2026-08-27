import { useEffect, useState } from "react";
import { TrendingDown } from "lucide-react";
import { reportAdminError } from "@/lib/adminErrorToast";
import {
  adminResources,
  type CheckoutFunnelSummary,
  type CheckoutFunnelSession,
  type CheckoutFunnelStep,
} from "@/services/adminResources";

function stepLabel(step: CheckoutFunnelStep) {
  switch (step) {
    case "OPENED": return "Opened checkout";
    case "CONTACT_COMPLETED": return "Filled in contact details";
    case "DELIVERY_CONFIRMED": return "Confirmed pickup/delivery";
    case "ORDER_PLACED": return "Placed the order";
  }
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

/** Gating and the AdminLayout chrome are handled once by the parent developer-section page
 *  (`_adminAuth.admin.developer.tsx`), which renders this as one of its tabs. */
export function CheckoutFunnelPanel() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<CheckoutFunnelSummary | null>(null);
  const [sessions, setSessions] = useState<CheckoutFunnelSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      adminResources.checkoutFunnel.summary(days),
      adminResources.checkoutFunnel.droppedSessions(days),
    ])
      .then(([s, sess]) => {
        if (cancelled) return;
        setSummary(s);
        setSessions(sess);
      })
      .catch((err) => reportAdminError(err, "Failed to load checkout funnel"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  return (
    <div className="admin-page-stack">
      <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>
          Where customers open checkout and where they quit before an order is even placed.
          Tracked anonymously by browser (the same session id used for the cart) — once a real
          order exists, its own status already shows whether it was paid, so this stops at
          "order placed."
        </p>
      </div>

      <div className="admin-panel admin-toolbar" data-admin-toolbar>
        <label className="admin-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          Window
          <select className="admin-input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </label>
      </div>

      <div className="admin-panel" style={{ padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <TrendingDown size={16} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Funnel</h3>
        </div>
        {loading && !summary ? (
          <p style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>Loading…</p>
        ) : !summary || summary.steps.every((s) => s.sessions === 0) ? (
          <div className="admin-empty">No checkout sessions tracked in this window yet.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>Stage</th><th>Sessions</th><th>% of opened</th><th>% continued from previous stage</th></tr>
            </thead>
            <tbody>
              {summary.steps.map((s) => (
                <tr key={s.step}>
                  <td>{stepLabel(s.step)}</td>
                  <td>{s.sessions}</td>
                  <td>{s.pctOfOpened}%</td>
                  <td>{s.pctOfPrevious == null ? "—" : `${s.pctOfPrevious}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {summary && summary.droppedAfterDeliveryConfirmed > 0 && (
          <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--admin-muted)" }}>
            <b>{summary.droppedAfterDeliveryConfirmed}</b> session(s) confirmed pickup/delivery details
            but never actually placed an order — the sharpest, most fixable drop-off point.
          </p>
        )}
      </div>

      <div className="admin-panel" data-admin-table-scroll>
        <div style={{ padding: "14px 18px 0" }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Dropped-off sessions</h3>
          <p style={{ fontSize: 12.5, color: "var(--admin-muted)", margin: "4px 0 14px" }}>
            Sessions that never placed an order, most recent first — with contact info when they
            got far enough to type it in, for manual follow-up.
          </p>
        </div>
        <table className="admin-table">
          <thead>
            <tr><th>Last seen</th><th>Got as far as</th><th>Email</th><th>Phone</th><th>Fulfillment</th></tr>
          </thead>
          <tbody>
            {sessions.length === 0 ? (
              <tr><td colSpan={5}><div className="admin-empty">No dropped-off sessions in this window.</div></td></tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.sessionId}>
                  <td style={{ whiteSpace: "nowrap", fontSize: 11 }}>{fmtDate(s.lastSeenAt)}</td>
                  <td>{stepLabel(s.lastStep)}</td>
                  <td>{s.email ?? "—"}</td>
                  <td>{s.phone ?? "—"}</td>
                  <td>{s.fulfillmentType ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
