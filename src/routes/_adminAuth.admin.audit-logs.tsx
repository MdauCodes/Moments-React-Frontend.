
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import { resolveStaffRole } from "@/lib/roles";
import { adminResources, type AuditLogEntry } from "@/services/adminResources";



function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function ChangesDisplay({ changes }: { changes?: string }) {
  const parsed = useMemo(() => {
    if (!changes) return null;
    try { return JSON.parse(changes); } catch { return changes; }
  }, [changes]);
  if (!parsed) return <span style={{ color: "var(--admin-muted)" }}>—</span>;
  if (typeof parsed === "string") return <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap" }}>{parsed}</pre>;
  // Expecting either { field: { before, after } } or { before:{...}, after:{...} }
  const entries: Array<{ field: string; before: unknown; after: unknown }> = [];
  if (parsed && typeof parsed === "object" && ("before" in parsed || "after" in parsed)) {
    const beforeObj = (parsed as any).before ?? {};
    const afterObj = (parsed as any).after ?? {};
    const keys = new Set([...Object.keys(beforeObj || {}), ...Object.keys(afterObj || {})]);
    keys.forEach((k) => entries.push({ field: k, before: beforeObj?.[k], after: afterObj?.[k] }));
  } else if (parsed && typeof parsed === "object") {
    Object.entries(parsed as Record<string, unknown>).forEach(([k, v]) => {
      if (v && typeof v === "object" && ("before" in (v as object) || "after" in (v as object))) {
        entries.push({ field: k, before: (v as any).before, after: (v as any).after });
      } else {
        entries.push({ field: k, before: undefined, after: v });
      }
    });
  }
  if (entries.length === 0) return <pre style={{ margin: 0, fontSize: 11, whiteSpace: "pre-wrap" }}>{JSON.stringify(parsed, null, 2)}</pre>;
  return (
    <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ textAlign: "left", color: "var(--admin-muted)" }}>
          <th style={{ padding: "2px 6px" }}>Field</th><th style={{ padding: "2px 6px" }}>Before</th><th style={{ padding: "2px 6px" }}>After</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e, i) => (
          <tr key={i} style={{ borderTop: "1px solid var(--admin-border)" }}>
            <td style={{ padding: "2px 6px", fontWeight: 600 }}>{e.field}</td>
            <td style={{ padding: "2px 6px", color: "#be123c" }}>{e.before === undefined ? "—" : String(typeof e.before === "object" ? JSON.stringify(e.before) : e.before)}</td>
            <td style={{ padding: "2px 6px", color: "#15803d" }}>{e.after === undefined ? "—" : String(typeof e.after === "object" ? JSON.stringify(e.after) : e.after)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AdminAuditLogsPage() {
  const { hasPermission, user } = useAuth();
  const staffRole = resolveStaffRole(user);
  const allowed = hasPermission(PERM.AUDIT_VIEW) || staffRole === "SUPER_ADMIN";

  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(0);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [actorId, setActorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    setLoading(true);
    adminResources.auditLogs
      .list({
        entityType: entityType || undefined,
        action: action || undefined,
        actorId: actorId || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        page,
        size: 30,
      })
      .then((data) => { if (!cancelled) { setRows(data.rows); setTotalPages(data.totalPages); } })
      .catch((err) => reportAdminError(err, "Failed to load audit logs"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [allowed, entityType, action, actorId, from, to, page, reloadKey]);

  if (!allowed) return <AdminLayout title="Audit logs"><Forbidden resource="audit logs" /></AdminLayout>;

  return (
    <AdminLayout title="Audit logs" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel admin-toolbar" data-admin-toolbar style={{ flexWrap: "wrap", gap: 8 }}>
          <input className="admin-input" placeholder="Entity type" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(0); }} style={{ maxWidth: 160 }} />
          <input className="admin-input" placeholder="Action" value={action} onChange={(e) => { setAction(e.target.value); setPage(0); }} style={{ maxWidth: 160 }} />
          <input className="admin-input" placeholder="Actor ID" value={actorId} onChange={(e) => { setActorId(e.target.value); setPage(0); }} style={{ maxWidth: 200 }} />
          <label className="admin-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            From <input className="admin-input" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} />
          </label>
          <label className="admin-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            To <input className="admin-input" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} />
          </label>
          {(entityType || action || actorId || from || to) && (
            <button className="admin-btn admin-btn-ghost" onClick={() => {
              setEntityType(""); setAction(""); setActorId(""); setFrom(""); setTo(""); setPage(0);
            }}>Clear</button>
          )}
        </div>

        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>From page</th><th>IP / Location</th><th>Reason</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={8}>Loading…</td></tr>
                : rows.length === 0 ? <tr><td colSpan={8}><div className="admin-empty">No audit entries match.</div></td></tr>
                : rows.map((e) => (
                  <Fragment key={e.id}>
                    <tr>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(e.createdAt)}</td>
                      <td>{e.actorName ?? e.actorEmail ?? "—"}<div style={{ fontSize: 10, color: "var(--admin-muted)" }}>{e.actorEmail}</div></td>
                      <td><span className="admin-badge admin-badge-muted">{e.action ?? "—"}</span></td>
                      <td>{e.entityType ?? "—"}<div style={{ fontSize: 10, color: "var(--admin-muted)" }}>{e.entityLabel ?? e.entityId}</div></td>
                      <td style={{ fontSize: 11 }}>{e.sourcePage ?? "—"}</td>
                      <td style={{ fontSize: 11 }}>{e.ipAddress ?? "—"}<div style={{ fontSize: 10, color: "var(--admin-muted)" }}>{e.locationLabel ?? ""}</div></td>
                      <td style={{ fontSize: 11 }}>{e.reason ?? "—"}</td>
                      <td>
                        <button className="admin-btn admin-btn-ghost" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                          {expanded === e.id ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>
                    {expanded === e.id && (
                      <tr>
                        <td colSpan={8} style={{ background: "var(--admin-bg)" }}>
                          <ChangesDisplay changes={e.changes} />
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
    </AdminLayout>
  );
}

export default AdminAuditLogsPage;
