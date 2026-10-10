import { Fragment, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { formatDateShort, formatKes } from "@/components/admin/commerceUi";
import {
  tumaBodaSettlementApi,
  type TumaBodaDisagreement,
  type TumaBodaDisagreementEvent,
  type TumaBodaLedgerSummary,
} from "@/services/tumaBodaSettlementService";

const KIND_LABEL: Record<string, string> = {
  COST_DIFFERS: "Cost differs",
  STATUS_DIFFERS: "Status differs",
  MISSING_ON_THEIR_SIDE: "Missing on their side",
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  QUERIED: "Raised with TumaBoda",
  RESOLVED: "Settled",
};

const RESOLUTION_LABEL: Record<string, string> = {
  ACCEPTED_THEIRS: "We accepted TumaBoda's figure",
  KEPT_OURS: "Kept our figure (agreed with TumaBoda)",
  THEIR_FAULT: "TumaBoda's side, they will fix it",
  OTHER: "Settled another way",
};

const ACTION_LABEL: Record<string, string> = {
  DETECTED: "Spotted",
  REOPENED: "Figures changed again",
  AUTO_MATCHED: "Both sides now agree",
  QUERIED: "Raised with TumaBoda",
  RESOLVED_ACCEPTED_THEIRS: "Settled: accepted TumaBoda's figure",
  RESOLVED_KEPT_OURS: "Settled: kept our figure",
  RESOLVED_THEIR_FAULT: "Settled: TumaBoda's side",
  RESOLVED_OTHER: "Settled",
};

function valueText(kind: string, v: string | null): string {
  if (v == null) return "—";
  return kind === "COST_DIFFERS" ? formatKes(Number(v)) : v;
}

export function TumaBodaDisagreements() {
  const [rows, setRows] = useState<TumaBodaDisagreement[]>([]);
  const [summary, setSummary] = useState<TumaBodaLedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [events, setEvents] = useState<TumaBodaDisagreementEvent[]>([]);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("KEPT_OURS");
  const [busy, setBusy] = useState(false);
  const [showSettled, setShowSettled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, sum] = await Promise.all([
        tumaBodaSettlementApi.getDisagreements(),
        tumaBodaSettlementApi.getDisagreementSummary(),
      ]);
      setRows(list);
      setSummary(sum);
    } catch (err) {
      reportAdminError(err, "Failed to load TumaBoda disagreements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openRow(id: string) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    setNote("");
    setResolution("KEPT_OURS");
    try {
      setEvents(await tumaBodaSettlementApi.getDisagreementEvents(id));
    } catch {
      setEvents([]);
    }
  }

  async function scanNow() {
    setScanning(true);
    try {
      const r = await tumaBodaSettlementApi.scanDisagreements();
      toast.success(
        `Checked ${r.checked} deliveries: ${r.opened} new difference${r.opened === 1 ? "" : "s"}` +
          (r.unreachable ? `, ${r.unreachable} couldn't be read from TumaBoda` : ""),
      );
      await load();
    } catch (err) {
      reportAdminError(err, "Could not check with TumaBoda");
    } finally {
      setScanning(false);
    }
  }

  async function act(id: string, kind: "query" | "resolve") {
    setBusy(true);
    try {
      if (kind === "query") await tumaBodaSettlementApi.queryDisagreement(id, note);
      else await tumaBodaSettlementApi.resolveDisagreement(id, resolution, note);
      toast.success(kind === "query" ? "Marked as raised with TumaBoda" : "Settled");
      setNote("");
      await load();
      setEvents(await tumaBodaSettlementApi.getDisagreementEvents(id));
    } catch (err) {
      reportAdminError(err, "Could not save that");
    } finally {
      setBusy(false);
    }
  }

  const visible = rows.filter((r) => showSettled || r.status !== "RESOLVED");
  const open = rows.filter((r) => r.status !== "RESOLVED").length;

  return (
    <div className="admin-panel" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 18 }}>
            Where we and TumaBoda disagree
          </h3>
          <div style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 4 }}>
            Each difference is kept with when it first appeared and what was done. Nothing in our ledger changes
            until you choose to accept their figure.
          </div>
        </div>
        <button type="button" className="admin-btn admin-btn-ghost" disabled={scanning} onClick={() => void scanNow()}>
          {scanning ? "Checking…" : "Check with TumaBoda now"}
        </button>
      </div>

      {summary && summary.delta != null && Number(summary.delta) !== 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(180, 83, 9, 0.08)",
            fontSize: 13,
          }}
        >
          <b>Ledger difference: {formatKes(Math.abs(Number(summary.delta)))}</b>{" "}
          {Number(summary.delta) < 0 ? "more on TumaBoda's side than ours" : "more on our side than TumaBoda's"}
          {summary.differingSince ? `, showing since ${formatDateShort(summary.differingSince)}` : ""}. We have{" "}
          {formatKes(Number(summary.ourBalance))}, they report {formatKes(Number(summary.theirBalance))}. TumaBoda
          counts a delivery against your credit when it is booked; our ledger counts it once delivered, so deliveries
          still on the road are a usual cause. The list below shows the individual orders that differ.
        </div>
      )}

      <div data-admin-table-scroll style={{ marginTop: 12 }}>
        {loading ? (
          <div className="admin-empty">Loading…</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>What differs</th>
                <th>We have</th>
                <th>TumaBoda has</th>
                <th>First seen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="admin-empty">
                      {open === 0 ? "No open differences. Both sides match on every checked delivery." : ""}
                    </div>
                  </td>
                </tr>
              ) : (
                visible.map((r) => (
                  <Fragment key={r.id}>
                    <tr onClick={() => void openRow(r.id)} style={{ cursor: "pointer" }}>
                      <td><b>{r.orderReference}</b></td>
                      <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                      <td>{valueText(r.kind, r.ourValue)}</td>
                      <td>{valueText(r.kind, r.theirValue)}</td>
                      <td>{formatDateShort(r.firstSeenAt)}</td>
                      <td>
                        {STATUS_LABEL[r.status] ?? r.status}
                        {r.resolution ? ` · ${RESOLUTION_LABEL[r.resolution] ?? r.resolution}` : ""}
                      </td>
                    </tr>
                    {openId === r.id && (
                      <tr>
                        <td colSpan={6} style={{ background: "rgba(0,0,0,0.02)" }}>
                          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                            <div>
                              <div className="admin-label">History</div>
                              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13 }}>
                                {events.length === 0 ? (
                                  <li>Nothing recorded yet.</li>
                                ) : (
                                  events.map((e, i) => (
                                    <li key={i}>
                                      <b>{ACTION_LABEL[e.action] ?? e.action}</b> · {e.actor} ·{" "}
                                      {new Date(e.at).toLocaleString("en-KE")}
                                      {e.note ? <div style={{ color: "var(--admin-muted)" }}>{e.note}</div> : null}
                                    </li>
                                  ))
                                )}
                              </ul>
                            </div>
                            {r.status !== "RESOLVED" && (
                              <div>
                                <div className="admin-label">What did you agree?</div>
                                <textarea
                                  value={note}
                                  onChange={(e) => setNote(e.target.value)}
                                  rows={2}
                                  maxLength={1000}
                                  placeholder="Note for the record (who you spoke to, what was agreed)"
                                  style={{ width: "100%", marginTop: 6 }}
                                />
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                                  <button
                                    type="button"
                                    className="admin-btn admin-btn-ghost"
                                    disabled={busy}
                                    onClick={() => void act(r.id, "query")}
                                  >
                                    Raise with TumaBoda
                                  </button>
                                  <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                                    {r.kind === "COST_DIFFERS" && (
                                      <option value="ACCEPTED_THEIRS">Accept TumaBoda's figure</option>
                                    )}
                                    <option value="KEPT_OURS">Keep ours (they agreed)</option>
                                    <option value="THEIR_FAULT">Their side, they will fix it</option>
                                    <option value="OTHER">Settled another way</option>
                                  </select>
                                  <button
                                    type="button"
                                    className="admin-btn"
                                    disabled={busy}
                                    onClick={() => void act(r.id, "resolve")}
                                  >
                                    Mark settled
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <label style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 10, fontSize: 12 }}>
        <input type="checkbox" checked={showSettled} onChange={(e) => setShowSettled(e.target.checked)} />
        Show settled ones too ({rows.length - open})
      </label>
    </div>
  );
}
