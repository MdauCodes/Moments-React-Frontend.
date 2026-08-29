import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { adminResources, type AppLogEntry, type LogDigestSummary } from "@/services/adminResources";
import { downloadDevLogsPdf } from "@/lib/pdf";

const EXPORT_SIZE_CAP = 2000;

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "medium" }) : "—";
}

function levelBadgeClass(level?: string) {
  if (level === "ERROR") return "admin-badge admin-badge-danger";
  if (level === "WARN") return "admin-badge admin-badge-warning";
  return "admin-badge admin-badge-muted";
}

function successBadgeClass(success?: boolean) {
  if (success === true) return "admin-badge admin-badge-success";
  if (success === false) return "admin-badge admin-badge-danger";
  return "admin-badge admin-badge-muted";
}

function DigestPreviewPanel() {
  const [summary, setSummary] = useState<LogDigestSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadPreview = () => {
    setLoading(true);
    adminResources.devTools.previewLogDigest()
      .then(setSummary)
      .catch((err) => reportAdminError(err, "Failed to load digest preview"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadPreview(); }, []);

  const sendNow = () => {
    if (!confirm("Send today's log digest email right now to the notify address(es)?")) return;
    setSending(true);
    adminResources.devTools.sendLogDigestNow()
      .then((s) => { setSummary(s); })
      .catch((err) => reportAdminError(err, "Failed to send digest"))
      .finally(() => setSending(false));
  };

  return (
    <div className="admin-panel" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontWeight: 600 }}>Daily digest preview (last 24h)</div>
          <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>
            The real digest emails once a day at 08:15 EAT to the notify address(es) — this is what it would contain right now.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="admin-btn admin-btn-ghost" onClick={loadPreview} disabled={loading}>Refresh</button>
          <button className="admin-btn admin-btn-primary" onClick={sendNow} disabled={sending}>
            {sending ? "Sending…" : "Send now"}
          </button>
        </div>
      </div>
      {summary && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13 }}><strong>{summary.errorCount}</strong> error(s)</div>
          <div style={{ fontSize: 13 }}><strong>{summary.warnCount}</strong> warning(s)</div>
        </div>
      )}
    </div>
  );
}

/** Gating and the AdminLayout chrome are handled once by the parent developer-section
 *  page (`_adminAuth.admin.developer.tsx`), which renders this as one of its tabs. */
export function DevLogsPanel() {
  const [rows, setRows] = useState<AppLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(0);
  const [level, setLevel] = useState("");
  const [loggerName, setLoggerName] = useState("");
  const [q, setQ] = useState("");
  const [task, setTask] = useState("");
  const [actor, setActor] = useState("");
  const [responseCode, setResponseCode] = useState("");
  const [success, setSuccess] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  const currentFilters = {
    level: level || undefined,
    loggerName: loggerName || undefined,
    q: q || undefined,
    task: task || undefined,
    actor: actor || undefined,
    responseCode: responseCode || undefined,
    success: success ? success === "true" : undefined,
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(to).toISOString() : undefined,
  };

  const exportPdf = async () => {
    setExporting(true);
    try {
      const data = await adminResources.devLogs.list({ ...currentFilters, page: 0, size: EXPORT_SIZE_CAP });
      if (data.rows.length === 0) {
        toast.error("No logs match the current filters.");
        return;
      }
      const filterLabel = [
        level && `Level: ${level}`,
        task && `Task contains "${task}"`,
        actor && `Actor contains "${actor}"`,
        responseCode && `Response: ${responseCode}`,
        success && `Outcome: ${success === "true" ? "Succeeded" : "Failed"}`,
        loggerName && `Logger contains "${loggerName}"`,
        q && `Message contains "${q}"`,
        (from || to) && `${from || "…"} → ${to || "…"}`,
      ].filter(Boolean).join("  ·  ");
      await downloadDevLogsPdf(data.rows, { filterLabel: filterLabel || undefined });
      if (data.total > data.rows.length) {
        toast(`Exported the most recent ${data.rows.length} of ${data.total} matching entries — narrow the filters to capture the rest.`);
      }
    } catch (err) {
      reportAdminError(err, "Failed to export logs");
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminResources.devLogs
      .list({
        level: level || undefined,
        loggerName: loggerName || undefined,
        q: q || undefined,
        task: task || undefined,
        actor: actor || undefined,
        responseCode: responseCode || undefined,
        success: success ? success === "true" : undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        page,
        size: 50,
      })
      .then((data) => { if (!cancelled) { setRows(data.rows); setTotalPages(data.totalPages); } })
      .catch((err) => reportAdminError(err, "Failed to load logs"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [level, loggerName, q, task, actor, responseCode, success, from, to, page, reloadKey]);

  return (
    <div className="admin-page-stack">
      <DigestPreviewPanel />

        <div className="admin-panel admin-toolbar" data-admin-toolbar style={{ flexWrap: "wrap", gap: 8 }}>
          <select className="admin-input" value={level} onChange={(e) => { setLevel(e.target.value); setPage(0); }} style={{ maxWidth: 130 }}>
            <option value="">All levels</option>
            <option value="ERROR">ERROR</option>
            <option value="WARN">WARN</option>
            <option value="INFO">INFO</option>
            <option value="DEBUG">DEBUG</option>
          </select>
          <input className="admin-input" placeholder="Logger contains…" value={loggerName} onChange={(e) => { setLoggerName(e.target.value); setPage(0); }} style={{ maxWidth: 220 }} />
          <input className="admin-input" placeholder="Message contains…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} style={{ maxWidth: 240 }} />
          <input className="admin-input" placeholder="Task (e.g. TUMABODA_CREATE_DELIVERY)…" value={task} onChange={(e) => { setTask(e.target.value); setPage(0); }} style={{ maxWidth: 220 }} />
          <input className="admin-input" placeholder="Actor contains…" value={actor} onChange={(e) => { setActor(e.target.value); setPage(0); }} style={{ maxWidth: 180 }} />
          <input className="admin-input" placeholder="Response code…" value={responseCode} onChange={(e) => { setResponseCode(e.target.value); setPage(0); }} style={{ maxWidth: 150 }} />
          <select className="admin-input" value={success} onChange={(e) => { setSuccess(e.target.value); setPage(0); }} style={{ maxWidth: 140 }}>
            <option value="">Any outcome</option>
            <option value="true">Succeeded</option>
            <option value="false">Failed</option>
          </select>
          <label className="admin-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            From <input className="admin-input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
          </label>
          <label className="admin-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            To <input className="admin-input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
          </label>
          {(level || loggerName || q || task || actor || responseCode || success || from || to) && (
            <button className="admin-btn admin-btn-ghost" onClick={() => {
              setLevel(""); setLoggerName(""); setQ(""); setTask(""); setActor(""); setResponseCode(""); setSuccess(""); setFrom(""); setTo(""); setPage(0);
            }}>Clear</button>
          )}
          <button className="admin-btn admin-btn-ghost" onClick={() => setReloadKey((k) => k + 1)}>Refresh</button>
          <button className="admin-btn admin-btn-primary" onClick={exportPdf} disabled={exporting}>
            {exporting ? "Exporting…" : "Download PDF"}
          </button>
        </div>

        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th><th>Level</th><th>Logger</th><th>Task</th><th>Actor</th><th>Response</th><th>Outcome</th><th>Message</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={9}>Loading…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={9}><div className="admin-empty">No logs match.</div></td></tr>
                : rows.map((r) => (
                  <Fragment key={r.id}>
                    <tr>
                      <td style={{ whiteSpace: "nowrap", fontSize: 11 }}>{fmtDate(r.createdAt)}</td>
                      <td><span className={levelBadgeClass(r.level)}>{r.level}</span></td>
                      <td style={{ fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.loggerName}>{r.loggerName ?? "—"}</td>
                      <td style={{ fontSize: 11, whiteSpace: "nowrap" }} title={r.task}>{r.task ?? "—"}</td>
                      <td style={{ fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.actor}>{r.actor ?? "—"}</td>
                      <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{r.responseCode ?? "—"}</td>
                      <td>{r.success === undefined || r.success === null ? "—" : <span className={successBadgeClass(r.success)}>{r.success ? "OK" : "Failed"}</span>}</td>
                      <td style={{ fontSize: 12, maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.message}>{r.message ?? "—"}</td>
                      <td>
                        {r.stackTrace && (
                          <button className="admin-btn admin-btn-ghost" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                            {expanded === r.id ? "Hide" : "Stack trace"}
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === r.id && r.stackTrace && (
                      <tr>
                        <td colSpan={9} style={{ background: "var(--admin-bg)" }}>
                          <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 320, overflowY: "auto" }}>{r.stackTrace}</pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
            </tbody>
          </table>
          <div className="admin-toolbar">
            <button className="admin-btn admin-btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
            <span className="admin-label">Page {page + 1} of {totalPages}</span>
            <button className="admin-btn admin-btn-ghost" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </div>
  );
}
