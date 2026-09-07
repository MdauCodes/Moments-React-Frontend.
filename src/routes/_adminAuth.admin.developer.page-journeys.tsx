import { useEffect, useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import { reportAdminError } from "@/lib/adminErrorToast";
import {
  adminResources,
  type PageJourneySummary,
  type PageJourneySession,
  type PathTransition,
} from "@/services/adminResources";

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

const pathCls = { fontFamily: "monospace", fontSize: 12.5 } as const;

/** Gating and the AdminLayout chrome are handled once by the parent developer-section page
 *  (`_adminAuth.admin.developer.tsx`), which renders this as one of its tabs. */
export function PageJourneysPanel() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<PageJourneySummary | null>(null);
  const [transitions, setTransitions] = useState<PathTransition[]>([]);
  const [sessions, setSessions] = useState<PageJourneySession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      adminResources.pageJourney.summary(days),
      adminResources.pageJourney.transitions(days),
      adminResources.pageJourney.sessions(days, 100),
    ])
      .then(([s, t, sess]) => {
        if (cancelled) return;
        setSummary(s);
        setTransitions(t);
        setSessions(sess);
      })
      .catch((err) => reportAdminError(err, "Failed to load page journeys"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days]);

  const hasData = !!summary && summary.totalSessions > 0;

  return (
    <div className="admin-page-stack">
      <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>
          Where visitors come from, where they land, which pages they move between, and where
          they leave — tracked anonymously by browser (the same session id used for the cart and
          the checkout funnel) across the whole storefront, not just checkout. Raw events are
          kept for 90 days. Traffic-source detection is hostname-based (from the browser's own
          referrer), so it can't perfectly separate every case — e.g. an AI tool that strips its
          referrer for privacy will show up as Direct.
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

      {loading && !summary ? (
        <div className="admin-panel" style={{ padding: 18 }}>
          <p style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>Loading…</p>
        </div>
      ) : !hasData ? (
        <div className="admin-panel" style={{ padding: 18 }}>
          <div className="admin-empty">No page views tracked in this window yet.</div>
        </div>
      ) : (
        <>
          <div className="admin-panel" style={{ padding: 18 }}>
            <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--admin-muted)" }}>Sessions</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{summary!.totalSessions.toLocaleString()}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--admin-muted)" }}>Page views</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{summary!.totalPageViews.toLocaleString()}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4, color: "var(--admin-muted)" }}>Avg pages / session</p>
                <p style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                  {(summary!.totalPageViews / summary!.totalSessions).toFixed(1)}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>Traffic sources</h4>
                <table className="admin-table">
                  <thead><tr><th>Source</th><th>Sessions</th></tr></thead>
                  <tbody>
                    {/* Defensive fallback: frontend and backend deploy independently, so there's
                        a real window where this build is live before its backend counterpart is. */}
                    {(summary!.topTrafficSources ?? []).map((s) => (
                      <tr key={s.path}><td>{s.path}</td><td>{s.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>Top entry pages</h4>
                <table className="admin-table">
                  <thead><tr><th>Path</th><th>Sessions</th></tr></thead>
                  <tbody>
                    {summary!.topEntryPages.map((p) => (
                      <tr key={p.path}><td style={pathCls}>{p.path}</td><td>{p.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>Top exit pages</h4>
                <table className="admin-table">
                  <thead><tr><th>Path</th><th>Sessions</th></tr></thead>
                  <tbody>
                    {summary!.topExitPages.map((p) => (
                      <tr key={p.path}><td style={pathCls}>{p.path}</td><td>{p.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600 }}>Top pages overall</h4>
                <table className="admin-table">
                  <thead><tr><th>Path</th><th>Views</th></tr></thead>
                  <tbody>
                    {summary!.topPages.map((p) => (
                      <tr key={p.path}><td style={pathCls}>{p.path}</td><td>{p.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="admin-panel" data-admin-table-scroll>
            <div style={{ padding: "14px 18px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RouteIcon size={16} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>How pages flow into each other</h3>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--admin-muted)", margin: "4px 0 14px" }}>
                The most common next-page after a given page, across all sessions in this window.
              </p>
            </div>
            <table className="admin-table">
              <thead><tr><th>From</th><th></th><th>To</th><th>Sessions</th></tr></thead>
              <tbody>
                {transitions.length === 0 ? (
                  <tr><td colSpan={4}><div className="admin-empty">Not enough multi-page sessions yet.</div></td></tr>
                ) : (
                  transitions.map((t) => (
                    <tr key={`${t.fromPath}>${t.toPath}`}>
                      <td style={pathCls}>{t.fromPath}</td>
                      <td style={{ color: "var(--admin-muted)" }}>→</td>
                      <td style={pathCls}>{t.toPath}</td>
                      <td>{t.count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="admin-panel" data-admin-table-scroll>
            <div style={{ padding: "14px 18px 0" }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Individual journeys</h3>
              <p style={{ fontSize: 12.5, color: "var(--admin-muted)", margin: "4px 0 14px" }}>
                Real visitor sessions, most recently active first — the actual sequence of pages
                each one visited.
              </p>
            </div>
            <table className="admin-table">
              <thead><tr><th>Last seen</th><th>Pages</th><th>Journey</th></tr></thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr><td colSpan={3}><div className="admin-empty">No sessions in this window.</div></td></tr>
                ) : (
                  sessions.map((s) => (
                    <tr key={s.sessionId}>
                      <td style={{ whiteSpace: "nowrap", fontSize: 11 }}>{fmtDate(s.lastSeenAt)}</td>
                      <td>{s.pageViews}</td>
                      <td style={{ ...pathCls, whiteSpace: "normal" }}>{s.path.join("  →  ")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
