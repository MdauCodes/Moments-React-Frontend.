
import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Clock } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import {
  adminResources,
  type EnquiryDto,
  type EnquiryNote,
  type EnquiryPipelineStatus,
  type EnquiryPipelineSummary,
  type UserDto,
} from "@/services/adminResources";



const PIPELINE: EnquiryPipelineStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "WON", "LOST", "ARCHIVED"];

const STATUS_LABEL: Record<string, string> = {
  NEW: "New", CONTACTED: "Contacted", QUALIFIED: "Qualified", PROPOSAL_SENT: "Proposal sent",
  WON: "Won", LOST: "Lost", ARCHIVED: "Archived",
  IN_PROGRESS: "In progress", RESOLVED: "Resolved", CLOSED: "Closed",
};

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  NEW: { bg: "rgba(59,130,246,0.12)", fg: "#1d4ed8" },
  CONTACTED: { bg: "rgba(234,179,8,0.16)", fg: "#a16207" },
  QUALIFIED: { bg: "rgba(13,148,136,0.16)", fg: "#0f766e" },
  PROPOSAL_SENT: { bg: "rgba(168,85,247,0.16)", fg: "#7e22ce" },
  WON: { bg: "rgba(34,197,94,0.16)", fg: "#15803d" },
  LOST: { bg: "rgba(244,63,94,0.14)", fg: "#be123c" },
  ARCHIVED: { bg: "rgba(107,114,128,0.16)", fg: "#374151" },
};

function ref(e: EnquiryDto) { return e.referenceNumber ?? e.reference ?? `ENQ-${e.id}`; }
function name(e: EnquiryDto) { return e.contact?.name ?? e.name ?? "Unknown"; }
function phone(e: EnquiryDto) { return e.contact?.phone ?? e.phone ?? "—"; }
function email(e: EnquiryDto) { return e.contact?.email ?? e.email ?? "—"; }
function company(e: EnquiryDto) { return e.contact?.company ?? e.companyName ?? "—"; }
function isOverdue(iso?: string | null) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t < Date.now();
}
function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";
}
function fmtDateOnly(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("en-KE", { dateStyle: "medium" }) : "—";
}

function parseNotes(raw: EnquiryDto["internalNotes"]): EnquiryNote[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Legacy: blob of newline-separated "[ISO] message" lines or plain text.
  const lines = String(raw).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  return lines.map((line) => {
    const m = /^\[([^\]]+)\]\s*(.*)$/.exec(line);
    if (m) return { createdAt: m[1], message: m[2] };
    return { message: line };
  });
}

function StatusPill({ status }: { status?: string }) {
  const s = status ?? "NEW";
  const tone = STATUS_TONE[s] ?? { bg: "rgba(107,114,128,0.16)", fg: "#374151" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999,
      background: tone.bg, color: tone.fg, fontSize: 11, fontWeight: 600,
    }}>{STATUS_LABEL[s] ?? s}</span>
  );
}

function AdminEnquiriesPage() {
  const [view, setView] = useState<"pipeline" | "list">("pipeline");
  const [rows, setRows] = useState<EnquiryDto[]>([]);
  const [selected, setSelected] = useState<EnquiryDto | null>(null);
  const [status, setStatus] = useState<"ALL" | EnquiryPipelineStatus>("ALL");
  const [assignedFilter, setAssignedFilter] = useState<string>("");
  const [q, setQ] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<EnquiryPipelineSummary>({});
  const [followUpsDue, setFollowUpsDue] = useState<EnquiryDto[]>([]);
  const [assignees, setAssignees] = useState<UserDto[]>([]);
  const [noteDraft, setNoteDraft] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number | undefined> = {
        status: status === "ALL" ? undefined : status,
        assignedToId: assignedFilter || undefined,
        q: q.trim() || undefined,
        page,
        size: 20,
      };
      const data = await adminResources.enquiries.list(params);
      setRows(data.rows);
      setTotalPages(data.totalPages);
      if (selected) setSelected(data.rows.find((r) => r.id === selected.id) ?? null);
    } catch (err) {
      reportAdminError(err, "Failed to load enquiries");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try { setSummary(await adminResources.enquiries.pipelineSummary()); } catch { /* ignore */ }
  };
  const loadDue = async () => {
    try { setFollowUpsDue(await adminResources.enquiries.followUpsDue()); } catch { /* ignore */ }
  };
  const loadAssignees = async () => {
    try { setAssignees(await adminResources.users.listAssignable()); } catch { /* ignore */ }
  };

  useEffect(() => { void load(); }, [status, page, assignedFilter]);
  useEffect(() => { void loadSummary(); void loadDue(); void loadAssignees(); }, []);

  // debounce q
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); void load(); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const patch = async (body: Parameters<typeof adminResources.enquiries.update>[1]) => {
    if (!selected) return;
    setSaving(true);
    try {
      const next = await adminResources.enquiries.update(selected.id, body);
      setSelected(next);
      toast.success("Enquiry updated");
      await load();
      await loadSummary();
      await loadDue();
    } catch (err) {
      reportAdminError(err, "Update failed");
    } finally { setSaving(false); }
  };

  const addNote = async () => {
    const msg = noteDraft.trim();
    if (!msg || !selected) return;
    await patch({ note: msg, addNote: msg });
    setNoteDraft("");
  };

  const grouped = useMemo(() => {
    const map = new Map<EnquiryPipelineStatus, EnquiryDto[]>();
    PIPELINE.forEach((s) => map.set(s, []));
    for (const e of rows) {
      const s = (e.status as EnquiryPipelineStatus) ?? "NEW";
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(e);
    }
    return map;
  }, [rows]);

  const notes = selected ? parseNotes(selected.internalNotes) : [];

  return (
    <AdminLayout title="Enquiries CRM">
      <div className="admin-page-stack">
        {/* Pipeline summary tiles */}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))" }} data-admin-grid>
          {PIPELINE.map((s) => (
            <button key={s} type="button" onClick={() => { setStatus(s); setPage(0); }}
              className="admin-panel"
              style={{
                padding: 14, textAlign: "left", cursor: "pointer",
                borderColor: status === s ? "var(--admin-accent)" : undefined,
                outline: status === s ? "2px solid var(--admin-accent)" : "none",
              }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--admin-muted)" }}>{STATUS_LABEL[s]}</div>
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{summary[s] ?? 0}</div>
            </button>
          ))}
        </div>

        {followUpsDue.length > 0 && (
          <div className="admin-panel" style={{ padding: 14, borderColor: "#b45309" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#b45309", fontWeight: 600 }}>
              <AlertTriangle size={16} /> {followUpsDue.length} overdue follow-up{followUpsDue.length === 1 ? "" : "s"}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--admin-muted)" }}>
              {followUpsDue.slice(0, 5).map((e) => (
                <button key={e.id} type="button" onClick={() => setSelected(e)}
                  style={{ background: "transparent", border: "none", color: "var(--admin-accent)", cursor: "pointer", padding: 0, marginRight: 12 }}>
                  {ref(e)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="admin-panel admin-toolbar" data-admin-toolbar style={{ flexWrap: "wrap", gap: 8 }}>
          <button className={`admin-btn ${status === "ALL" ? "admin-btn-primary" : "admin-btn-ghost"}`} onClick={() => { setStatus("ALL"); setPage(0); }}>All</button>
          {PIPELINE.map((s) => (
            <button key={s} className={`admin-btn ${status === s ? "admin-btn-primary" : "admin-btn-ghost"}`} onClick={() => { setStatus(s); setPage(0); }}>{STATUS_LABEL[s]}</button>
          ))}
          <span style={{ flex: 1 }} />
          <select className="admin-select" value={assignedFilter} onChange={(e) => { setAssignedFilter(e.target.value); setPage(0); }}>
            <option value="">All assignees</option>
            <option value="unassigned">Unassigned</option>
            {assignees.map((u) => <option key={u.id} value={u.id}>{u.firstName || u.email}</option>)}
          </select>
          <input className="admin-input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 200 }} />
          <button className="admin-btn admin-btn-ghost" onClick={() => setView(view === "pipeline" ? "list" : "pipeline")}>
            {view === "pipeline" ? "List view" : "Pipeline view"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 380px", gap: 16 }} data-admin-grid>
          <div>
            {view === "pipeline" ? (
              <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "minmax(240px, 1fr)", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
                {PIPELINE.map((s) => {
                  const items = grouped.get(s) ?? [];
                  return (
                    <div key={s} className="admin-panel" style={{ padding: 10, minHeight: 220 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <StatusPill status={s} />
                        <span style={{ fontSize: 11, color: "var(--admin-muted)" }}>{items.length}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {loading && items.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>Loading…</div>
                        ) : items.length === 0 ? (
                          <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>—</div>
                        ) : items.map((e) => (
                          <button key={e.id} type="button" onClick={() => setSelected(e)}
                            className="admin-panel"
                            style={{
                              textAlign: "left", padding: 10, cursor: "pointer",
                              borderColor: selected?.id === e.id ? "var(--admin-accent)" : undefined,
                            }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{ref(e)}</div>
                            <div style={{ fontSize: 12, marginTop: 2 }}>{name(e)}</div>
                            {e.estimatedValue ? (
                              <div style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 2 }}>
                                Est. KES {Number(e.estimatedValue).toLocaleString()}
                              </div>
                            ) : null}
                            {e.followUpAt && (
                              <div style={{
                                fontSize: 11, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4,
                                color: isOverdue(e.followUpAt) ? "#be123c" : "var(--admin-muted)",
                                fontWeight: isOverdue(e.followUpAt) ? 600 : 400,
                              }}>
                                <Clock size={11} /> {fmtDateOnly(e.followUpAt)}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="admin-panel" data-admin-table-scroll>
                <table className="admin-table">
                  <thead><tr><th>Reference</th><th>Contact</th><th>Status</th><th>Assigned</th><th>Follow-up</th><th>Created</th></tr></thead>
                  <tbody>
                    {loading ? <tr><td colSpan={6}>Loading enquiries…</td></tr>
                      : rows.length === 0 ? <tr><td colSpan={6}><div className="admin-empty">No enquiries match.</div></td></tr>
                      : rows.map((e) => (
                        <tr key={e.id} onClick={() => setSelected(e)} style={{ cursor: "pointer" }}>
                          <td><b>{ref(e)}</b></td>
                          <td>{name(e)}<div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{phone(e)}</div></td>
                          <td><StatusPill status={e.status} /></td>
                          <td>{e.assignedToName ?? "—"}</td>
                          <td style={{ color: isOverdue(e.followUpAt) ? "#be123c" : undefined, fontWeight: isOverdue(e.followUpAt) ? 600 : 400 }}>
                            {fmtDateOnly(e.followUpAt)}
                          </td>
                          <td>{e.createdAt ? new Date(e.createdAt).toLocaleDateString("en-KE") : "—"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <div className="admin-toolbar">
                  <button className="admin-btn admin-btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
                  <span className="admin-label">Page {page + 1} of {totalPages}</span>
                  <button className="admin-btn admin-btn-ghost" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            )}
          </div>

          <aside className="admin-panel" style={{ padding: 16 }}>
            {!selected ? (
              <div className="admin-empty">Select an enquiry to update status, assign, add notes, schedule follow-ups.</div>
            ) : (
              <div className="admin-page-stack">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: 0 }}>{ref(selected)}</h2>
                  <StatusPill status={selected.status} />
                </div>
                <div>
                  <b>{name(selected)}</b>
                  <div style={{ color: "var(--admin-muted)", fontSize: 12 }}>{company(selected)}</div>
                  <div style={{ color: "var(--admin-muted)", fontSize: 12 }}>{email(selected)} · {phone(selected)}</div>
                </div>

                <label>
                  <span className="admin-label">Status</span>
                  <select className="admin-select" value={(selected.status as string) ?? "NEW"}
                    onChange={(e) => void patch({ status: e.target.value as EnquiryPipelineStatus })}>
                    {PIPELINE.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                  </select>
                </label>

                <label>
                  <span className="admin-label">Assigned to</span>
                  <select className="admin-select" value={selected.assignedToId ?? ""}
                    onChange={(e) => void patch({ assignedToId: e.target.value || undefined })}>
                    <option value="">Unassigned</option>
                    {assignees.map((u) => <option key={u.id} value={u.id}>{u.firstName || u.email}</option>)}
                  </select>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label>
                    <span className="admin-label">Follow-up date</span>
                    <input className="admin-input" type="datetime-local"
                      value={selected.followUpAt ? selected.followUpAt.slice(0, 16) : ""}
                      onChange={(e) => setSelected({ ...selected, followUpAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                      onBlur={(e) => void patch({ followUpAt: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                    {isOverdue(selected.followUpAt) && (
                      <div style={{ color: "#be123c", fontSize: 11, marginTop: 4 }}>Overdue</div>
                    )}
                  </label>
                  <label>
                    <span className="admin-label">Estimated value (KES)</span>
                    <input className="admin-input" type="number" min={0}
                      value={selected.estimatedValue ?? ""}
                      onChange={(e) => setSelected({ ...selected, estimatedValue: e.target.value ? Number(e.target.value) : null })}
                      onBlur={(e) => void patch({ estimatedValue: e.target.value ? Number(e.target.value) : null })} />
                  </label>
                </div>

                {selected.productInterest && (
                  <div>
                    <span className="admin-label">Product interest</span>
                    <p style={{ margin: 0 }}>{selected.productInterest}</p>
                  </div>
                )}

                <div>
                  <span className="admin-label">Message</span>
                  <p style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 13 }}>{selected.message ?? "—"}</p>
                </div>

                <div>
                  <span className="admin-label">Internal notes ({notes.length})</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto", padding: 8, background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8 }}>
                    {notes.length === 0 && <div style={{ fontSize: 12, color: "var(--admin-muted)" }}>No notes yet.</div>}
                    {notes.map((n, i) => (
                      <div key={n.id ?? i} style={{ borderLeft: "2px solid var(--admin-accent)", paddingLeft: 8 }}>
                        <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                          {n.authorName ? `${n.authorName} · ` : ""}{fmtDate(n.createdAt)}
                        </div>
                        <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{n.message}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input className="admin-input" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add a note…" onKeyDown={(e) => { if (e.key === "Enter") void addNote(); }} />
                    <button className="admin-btn admin-btn-primary" onClick={() => void addNote()} disabled={!noteDraft.trim() || saving}>Add</button>
                  </div>
                </div>

                {saving && <span className="admin-label"><Loader2 size={12} className="animate-spin" /> Saving…</span>}
              </div>
            )}
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminEnquiriesPage;
