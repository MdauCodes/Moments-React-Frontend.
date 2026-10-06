import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
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

const isCancellation = (r: RefundRequestAdminDto) => r.desiredAction === "CANCEL_ORDER";

/** What staff can do next, by kind of request. A cancellation is a short loop — approve (the order is
 *  cancelled), send the refund by M-Pesa, then record that it was sent — so it only offers the next
 *  step; any other request is a free choice of decision, as before. */
function decisionsFor(r: RefundRequestAdminDto): RefundRequestStatus[] {
  if (!isCancellation(r)) return ["APPROVED", "REJECTED", "RESOLVED"];
  switch (r.status) {
    case "PENDING": return ["APPROVED", "REJECTED"];
    case "APPROVED": return ["RESOLVED"];
    case "REJECTED": return ["APPROVED"];
    case "RESOLVED": return [];
  }
}

function decisionLabel(r: RefundRequestAdminDto, s: RefundRequestStatus): string {
  if (isCancellation(r)) {
    if (s === "APPROVED") return r.status === "REJECTED" ? "Reconsider: approve & cancel order" : "Approve & cancel order";
    if (s === "REJECTED") return "Reject";
    return "Refund sent";
  }
  return s === "APPROVED" ? "Approve" : s === "REJECTED" ? "Reject" : "Mark resolved";
}

/** Says exactly what the chosen button will do, since for a cancellation it does real things. */
function decisionHint(r: RefundRequestAdminDto, s: RefundRequestStatus): string | null {
  if (!isCancellation(r)) return null;
  if (s === "APPROVED") {
    return "This cancels the order now: the stock goes back, any reward points are reversed and the customer is told. It does not send any money — send the M-Pesa refund yourself, then come back and choose Refund sent. You need the Manage Orders permission.";
  }
  if (s === "REJECTED") {
    return "The order carries on as normal. The customer sees your note, so say why.";
  }
  return "Choose this only after you have sent the M-Pesa refund. It marks the payment Refunded and tells the customer — put the M-Pesa reference in the note. You need the refund permission.";
}

/**
 * Reviews requests a customer submitted digitally — either from their account's order page or the
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
    const options = decisionsFor(row);
    setReviewingId(row.id);
    setDraftStatus(isCancellation(row) ? (options[0] ?? row.status) : row.status === "PENDING" ? "APPROVED" : row.status);
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
      toast.success(
        isCancellation(updated)
          ? updated.status === "APPROVED" ? "Order cancelled — now send the refund, then mark it sent"
            : updated.status === "RESOLVED" ? "Refund recorded as sent"
            : "Cancellation request rejected — the order carries on"
          : `Refund request marked ${updated.status.toLowerCase()}`,
      );
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
            <b>What this controls:</b> requests customers submit themselves — from their account's order
            page or the email-verified track-order page. There are two kinds.
          </p>
          <p style={{ marginTop: 6 }}>
            <b>Refund / replacement / store credit</b> (after delivery): approving or rejecting only records
            your decision; it doesn't move money or touch inventory on its own — do that from the order's own
            detail page once you've decided (Refund card there, or Mark payment refunded).
          </p>
          <p style={{ marginTop: 6 }}>
            <b>Cancel order</b> (a paid order the customer wants to cancel): <b>Approve &amp; cancel order</b> cancels
            it now (stock back, reward points reversed, customer told). Send the refund by M-Pesa yourself, then choose{" "}
            <b>Refund sent</b> — that is the only thing that marks the payment Refunded. Refunds are never automatic.
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
                <th>Asked for</th>
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
                  const cancellation = isCancellation(r);
                  return (
                    <tr key={r.id}>
                      <td>
                        <b>{r.orderReference}</b>
                        {r.orderStatus && (
                          <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>
                            Order {r.orderStatus.replace(/_/g, " ").toLowerCase()}
                            {r.orderTotal != null ? ` · ${formatKes(r.orderTotal)}` : ""}
                          </div>
                        )}
                      </td>
                      <td>
                        {r.customerName}
                        <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{r.customerEmail}</div>
                        {r.customerPhone && (
                          <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{r.customerPhone}</div>
                        )}
                      </td>
                      <td>
                        {cancellation ? <b>Cancel order</b> : r.desiredAction.replace(/_/g, " ")}
                        {cancellation && r.status === "APPROVED" && (
                          <div style={{ color: "#a16207", fontSize: 11, fontWeight: 600 }}>
                            Cancelled — refund owed{r.orderTotal != null ? `: ${formatKes(r.orderTotal)}` : ""}
                          </div>
                        )}
                      </td>
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
                        {!reviewing && decisionsFor(r).length > 0 && (
                          <button className="admin-btn admin-btn-ghost" onClick={() => startReview(r)}>
                            {cancellation && r.status === "APPROVED" ? "Record refund" : "Review"}
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
          const hint = decisionHint(row, draftStatus);
          return (
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">
                {isCancellation(row) ? "Cancellation request" : "Review"} — {row.orderReference}
              </div>
              {isCancellation(row) && (
                <p style={{ marginTop: 6, fontSize: 12, color: "var(--admin-muted)" }}>
                  {row.customerName} paid {row.orderTotal != null ? formatKes(row.orderTotal) : "for this order"}
                  {row.orderStatus ? ` · order is ${row.orderStatus.replace(/_/g, " ").toLowerCase()}` : ""}
                  {row.customerPhone ? ` · phone on the order ${row.customerPhone}` : ""}. Refund to the M-Pesa number they paid with.
                </p>
              )}
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {decisionsFor(row).map((s) => (
                  <button
                    key={s}
                    className={`admin-btn ${draftStatus === s ? "admin-btn-primary" : "admin-btn-ghost"}`}
                    onClick={() => setDraftStatus(s)}
                  >
                    {decisionLabel(row, s)}
                  </button>
                ))}
              </div>
              {hint && (
                <p style={{ marginTop: 8, fontSize: 12, color: "var(--admin-muted)", lineHeight: 1.5 }}>{hint}</p>
              )}
              <textarea
                rows={3}
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder={
                  isCancellation(row) && draftStatus === "RESOLVED"
                    ? "M-Pesa reference of the refund (shown to the customer)…"
                    : "Note visible to the customer (optional)…"
                }
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
