import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { PERM } from "@/lib/permissions";
import { adminResources, type ChangeRequestDto, type ChangeRequestStatus, type ChangeRequestType } from "@/services/adminResources";

const STATUS_FILTERS: { label: string; value: ChangeRequestStatus }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Withdrawn", value: "WITHDRAWN" },
];

const TYPE_FILTERS: { label: string; value: ChangeRequestType | "" }[] = [
  { label: "All types", value: "" },
  { label: "Profile update", value: "PROFILE_UPDATE" },
  { label: "Business account update", value: "BUSINESS_ACCOUNT_UPDATE" },
  { label: "Account deletion", value: "ACCOUNT_DELETION" },
];

const TYPE_LABEL: Record<ChangeRequestType, string> = {
  PROFILE_UPDATE: "Profile update",
  BUSINESS_ACCOUNT_UPDATE: "Business account update",
  ACCOUNT_DELETION: "Account deletion",
};

const STATUS_TONE: Record<ChangeRequestStatus, { bg: string; fg: string }> = {
  PENDING: { bg: "rgba(234,179,8,0.16)", fg: "#a16207" },
  APPROVED: { bg: "rgba(34,197,94,0.16)", fg: "#15803d" },
  REJECTED: { bg: "rgba(244,63,94,0.14)", fg: "#be123c" },
  WITHDRAWN: { bg: "rgba(107,114,128,0.16)", fg: "#374151" },
};

// Friendly labels for the JSON payload keys — covers both CustomerProfileUpdateRequest
// and BusinessAccountCreateRequest fields. Anything not listed falls back to a
// camelCase → "Title Case" split so a new backend field never renders as blank.
const FIELD_LABEL: Record<string, string> = {
  firstName: "First name", lastName: "Last name", phone: "Phone",
  deliveryAddress: "Delivery address", city: "City", county: "County",
  postalCode: "Postal code", businessName: "Business name", businessType: "Business type",
  kraPin: "KRA PIN", location: "Location", road: "Road", buildingAddress: "Building address",
  industryId: "Industry", contactPersonName: "Contact person", contactPersonRole: "Contact role",
};

function fieldLabel(key: string): string {
  return FIELD_LABEL[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function parsePayload(payload?: string | null): [string, string][] {
  if (!payload) return [];
  try {
    const obj = JSON.parse(payload) as Record<string, unknown>;
    return Object.entries(obj)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => [fieldLabel(k), String(v)]);
  } catch {
    return [["Raw payload", payload]];
  }
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function StatusPill({ status }: { status: ChangeRequestStatus }) {
  const tone = STATUS_TONE[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", padding: "3px 9px", borderRadius: 999,
      background: tone.bg, color: tone.fg, fontSize: 11, fontWeight: 600,
    }}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function AdminChangeRequestsPage() {
  const allowed = useRequirePermission(PERM.CUSTOMER_VIEW);
  const { isAdmin } = useAuth();

  const [status, setStatus] = useState<ChangeRequestStatus>("PENDING");
  const [type, setType] = useState<ChangeRequestType | "">("");
  const [rows, setRows] = useState<ChangeRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ChangeRequestDto | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await adminResources.changeRequests.list({ status, type: type || undefined, size: 50 });
      setRows(data.rows);
    } catch (err) {
      reportAdminError(err, "Failed to load change requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status, type]);

  if (!allowed) return null;

  const openDetail = (cr: ChangeRequestDto) => {
    setSelected(cr);
    setReason("");
  };

  const approve = async (cr: ChangeRequestDto) => {
    if (!confirm(`Approve this ${TYPE_LABEL[cr.type].toLowerCase()} for ${cr.requestedByName}?`)) return;
    setBusy(true);
    try {
      await adminResources.changeRequests.approve(cr.id, reason.trim() || undefined);
      toast.success("Change request approved");
      setSelected(null);
      await load();
    } catch (err) {
      reportAdminError(err, "Approve failed");
    } finally {
      setBusy(false);
    }
  };

  const reject = async (cr: ChangeRequestDto) => {
    const trimmed = reason.trim();
    if (!trimmed) { toast.error("A reason is required to reject a request"); return; }
    setBusy(true);
    try {
      await adminResources.changeRequests.reject(cr.id, trimmed);
      toast.success("Change request rejected");
      setSelected(null);
      await load();
    } catch (err) {
      reportAdminError(err, "Reject failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="Change Requests" onReload={load}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p>
            <b>What this controls:</b> every customer-initiated profile edit, business account edit, and
            account deletion request. None of these apply automatically — a customer's change sits here
            until an Admin approves or rejects it. Approving an account deletion starts the 14-day grace
            period; the account itself isn't purged until that lapses.
            {!isAdmin && <><br /><b>Note:</b> your role can view this queue but only an Admin can approve or reject.</>}
          </p>
        </div>

        <div className="admin-panel" style={{ padding: 10, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {STATUS_FILTERS.map((f) => (
              <button key={f.value} className={`admin-btn ${status === f.value ? "admin-btn-primary" : "admin-btn-ghost"}`}
                onClick={() => setStatus(f.value)}>
                {f.label}
              </button>
            ))}
          </div>
          <select className="admin-input" value={type} onChange={(e) => setType(e.target.value as ChangeRequestType | "")} style={{ maxWidth: 220 }}>
            {TYPE_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Customer</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Reviewed by</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="admin-empty">Loading change requests…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6}><div className="admin-empty">
                  <b>No {STATUS_FILTERS.find((f) => f.value === status)?.label.toLowerCase()} requests</b>
                </div></td></tr>
              ) : rows.map((cr) => (
                <tr key={cr.id}>
                  <td><b>{TYPE_LABEL[cr.type]}</b></td>
                  <td>
                    {cr.requestedByName}
                    <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{cr.requestedByEmail}</div>
                  </td>
                  <td>{fmtDate(cr.createdAt)}</td>
                  <td><StatusPill status={cr.status} /></td>
                  <td>{cr.reviewedByName ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={() => openDetail(cr)}>
                      {cr.status === "PENDING" && isAdmin ? "Review" : "View"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="admin-modal-backdrop" onClick={() => !busy && setSelected(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="admin-toolbar">
              <h2>{TYPE_LABEL[selected.type]}</h2>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setSelected(null)} disabled={busy}>Close</button>
            </div>

            <div style={{ display: "grid", gap: 10, padding: "4px 0 14px" }}>
              <div>
                <div className="admin-label">Requested by</div>
                <div>{selected.requestedByName} — {selected.requestedByEmail}</div>
              </div>
              <div>
                <div className="admin-label">Submitted</div>
                <div>{fmtDate(selected.createdAt)}</div>
              </div>
              <div>
                <div className="admin-label">Status</div>
                <StatusPill status={selected.status} />
              </div>

              {selected.type === "ACCOUNT_DELETION" ? (
                <div style={{ fontSize: 13, color: "var(--admin-muted)" }}>
                  No fields to review — approving starts this customer's 14-day deletion grace period.
                  They can still cancel during that window; the account is purged automatically once it lapses.
                </div>
              ) : (
                <div>
                  <div className="admin-label" style={{ marginBottom: 6 }}>Proposed changes</div>
                  <div style={{ display: "grid", gap: 4, fontSize: 13 }}>
                    {parsePayload(selected.payload).map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ color: "var(--admin-muted)" }}>{label}</span>
                        <span style={{ textAlign: "right" }}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.status !== "PENDING" && (
                <div>
                  <div className="admin-label">Review notes</div>
                  <div>{selected.reviewNotes || "—"}</div>
                  {selected.reviewedByName && (
                    <div style={{ color: "var(--admin-muted)", fontSize: 11, marginTop: 2 }}>
                      By {selected.reviewedByName} on {fmtDate(selected.reviewedAt)}
                    </div>
                  )}
                </div>
              )}

              {selected.status === "PENDING" && isAdmin && (
                <div>
                  <div className="admin-label">Notes (optional for approve, required to reject)</div>
                  <textarea
                    className="admin-input"
                    style={{ width: "100%", minHeight: 70, resize: "vertical" }}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why you're approving or rejecting this request…"
                  />
                </div>
              )}
            </div>

            {selected.status === "PENDING" && isAdmin && (
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="admin-btn admin-btn-danger" disabled={busy} onClick={() => void reject(selected)}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : null}Reject
                </button>
                <button className="admin-btn admin-btn-primary" disabled={busy} onClick={() => void approve(selected)}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : null}Approve
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminChangeRequestsPage;
