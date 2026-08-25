import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { reportAdminError } from "@/lib/adminErrorToast";
import {
  adminResources,
  type RefundRequestAdminDto,
  type RefundRequestStatus,
} from "@/services/adminResources";

const STATUS_FILTERS: { label: string; value: RefundRequestStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Resolved", value: "RESOLVED" },
];

const STATUS_COLORS: Record<RefundRequestStatus, { bg: string; fg: string }> = {
  PENDING: { bg: "rgba(234, 179, 8, 0.15)", fg: "#a16207" },
  APPROVED: { bg: "rgba(59, 130, 246, 0.15)", fg: "#1d4ed8" },
  REJECTED: { bg: "rgba(239, 68, 68, 0.15)", fg: "#b91c1c" },
  RESOLVED: { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d" },
};

/**
 * Reviews requests a customer submitted digitally — either from their account order page or the
 * OTP-verified guest track page. Deliberately a separate surface from the order detail modal's
 * own "Refund" card, which tracks a different, staff-initiated complaint log
 * (Order.refundRequestedAt) — the two aren't the same record and this page doesn't touch that one.
 */
function AdminRefundRequestsPage() {
  const [rows, setRows] = useState<RefundRequestAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RefundRequestStatus | "">("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<RefundRequestStatus>("APPROVED");
  const [draftNote, setDraftNote] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminResources.refundRequests.list();
      setRows(res ?? []);
    } catch (err) {
      reportAdminError(err, "Failed to load refund requests");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  function startReview(row: RefundRequestAdminDto) {
    setReviewingId(row.id);
    setDraftStatus(row.status === "PENDING" ? "APPROVED" : row.status);
    setDraftNote(row.adminNote ?? "");
  }

  async function saveReview(id: string) {
    setSavingId(id);
    try {
      const updated = await adminResources.refundRequests.updateStatus(id, {
        status: draftStatus,
        adminNote: draftNote.trim() || undefined,
      });
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setReviewingId(null);
      toast.success(`Refund request marked ${updated.status.toLowerCase()}`);
    } catch (err) {
      reportAdminError(err, "Failed to update refund request");
    } finally {
      setSavingId(null);
    }
  }

  const visible = statusFilter ? rows.filter((r) => r.status === statusFilter) : rows;

  return (
    <AdminLayout title="Refund Requests" onReload={load}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p>
            <b>What this controls:</b> refund/return requests customers submit themselves — either from
            their account's order page or the email-verified track-order page. Approving or rejecting here
            only records your decision; it doesn't move money or touch inventory on its own — do that from
            the order's own detail page once you've decided (Refund card there, or Mark payment refunded).
          </p>
        </div>

        <div className="admin-panel" style={{ padding: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              className={`admin-btn ${statusFilter === f.value ? "admin-btn-primary" : "admin-btn-ghost"}`}
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Desired action</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Requested</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="admin-empty">Loading refund requests…</div></td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={7}><div className="admin-empty">No refund requests here.</div></td></tr>
              ) : (
                visible.map((r) => {
                  const colors = STATUS_COLORS[r.status];
                  const reviewing = reviewingId === r.id;
                  return (
                    <tr key={r.id}>
                      <td><b>{r.orderReference}</b></td>
                      <td>
                        {r.customerName}
                        <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{r.customerEmail}</div>
                      </td>
                      <td>{r.desiredAction.replace(/_/g, " ")}</td>
                      <td style={{ maxWidth: 260 }}>
                        <div style={{ fontSize: 12 }}>{r.reason}</div>
                        {r.adminNote && (
                          <div style={{ marginTop: 4, fontSize: 11, color: "var(--admin-muted)" }}>
                            Note: {r.adminNote}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          display: "inline-flex", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: colors.bg, color: colors.fg,
                        }}>{r.status}</span>
                      </td>
                      <td>{new Date(r.createdAt).toLocaleString("en-KE")}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {!reviewing && (
                          <button className="admin-btn admin-btn-ghost" onClick={() => startReview(r)}>
                            Review
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {reviewingId && (() => {
          const row = rows.find((r) => r.id === reviewingId);
          if (!row) return null;
          return (
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Review — {row.orderReference}</div>
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["APPROVED", "REJECTED", "RESOLVED"] as RefundRequestStatus[]).map((s) => (
                  <button
                    key={s}
                    className={`admin-btn ${draftStatus === s ? "admin-btn-primary" : "admin-btn-ghost"}`}
                    onClick={() => setDraftStatus(s)}
                  >
                    {s === "APPROVED" ? "Approve" : s === "REJECTED" ? "Reject" : "Mark resolved"}
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="Note visible to the customer (optional)…"
                style={{
                  marginTop: 10, width: "100%", borderRadius: 8, border: "1px solid var(--admin-border)",
                  padding: "8px 10px", fontSize: 13,
                }}
              />
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setReviewingId(null)}>Cancel</button>
                <button
                  className="admin-btn admin-btn-primary"
                  disabled={savingId === row.id}
                  onClick={() => void saveReview(row.id)}
                >
                  {savingId === row.id && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                  Save
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </AdminLayout>
  );
}

export default AdminRefundRequestsPage;
