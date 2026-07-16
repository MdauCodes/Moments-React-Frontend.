import { useEffect, useState } from "react";
import { Loader2, RotateCw, Download, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { adminResources, type TaxDocumentAdminDto, type TaxDocumentStatus } from "@/services/adminResources";

const STATUS_FILTERS: { label: string; value: TaxDocumentStatus | "" }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Generating", value: "GENERATING" },
  { label: "Sent", value: "SENT" },
  { label: "Failed", value: "FAILED" },
  { label: "Expired", value: "EXPIRED" },
];

const STATUS_COLORS: Record<TaxDocumentStatus, { bg: string; fg: string }> = {
  PENDING: { bg: "rgba(107, 114, 128, 0.15)", fg: "#374151" },
  GENERATING: { bg: "rgba(59, 130, 246, 0.15)", fg: "#1d4ed8" },
  SENT: { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d" },
  FAILED: { bg: "rgba(239, 68, 68, 0.15)", fg: "#b91c1c" },
  EXPIRED: { bg: "rgba(107, 114, 128, 0.15)", fg: "#6b7280" },
};

function whatsappUrl(row: TaxDocumentAdminDto): string | null {
  if (!row.customerPhone) return null;
  const digits = row.customerPhone.replace(/[^\d]/g, "").replace(/^0/, "254");
  const message =
    `Hello, this is Moments Packaging Sales consultant. ` +
    `Below is your tax invoice / VAT breakdown for order ${row.orderReference}. ` +
    `Thank you for doing business with us.` +
    (row.cloudinaryUrl ? `\n${row.cloudinaryUrl}` : "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function AdminTaxDocumentsPage() {
  const [rows, setRows] = useState<TaxDocumentAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TaxDocumentStatus | "">("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminResources.taxDocuments.list({ status: statusFilter || undefined, size: 50 });
      setRows(res.content ?? []);
    } catch (err) {
      reportAdminError(err, "Failed to load tax documents");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [statusFilter]);

  async function retry(row: TaxDocumentAdminDto) {
    setRetryingId(row.id);
    try {
      const updated = await adminResources.taxDocuments.retry(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      toast.success(updated.status === "SENT" ? "Tax invoice sent" : `Retry finished — status: ${updated.status}`);
    } catch (err) {
      reportAdminError(err, "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <AdminLayout title="Tax Documents">
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p>
            <b>What this controls:</b> every tax invoice / VAT breakdown a customer opted into at checkout.
            Most are generated and emailed automatically — this tab is for spotting and retrying the ones
            that failed, and for manually forwarding a copy over WhatsApp if a customer asks for it that way.
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
                <th>Recipient email</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Sent</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="admin-empty">Loading tax documents…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7}><div className="admin-empty">No tax invoice requests yet.</div></td></tr>
              ) : (
                rows.map((r) => {
                  const colors = STATUS_COLORS[r.status];
                  const wa = whatsappUrl(r);
                  return (
                    <tr key={r.id}>
                      <td><b>{r.orderReference}</b></td>
                      <td>
                        {r.customerName}
                        <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{r.customerPhone}</div>
                      </td>
                      <td>{r.recipientEmail}</td>
                      <td>
                        <span style={{
                          display: "inline-flex", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: colors.bg, color: colors.fg,
                        }}>{r.status}</span>
                        {r.status === "FAILED" && r.failureReason && (
                          <div style={{ color: "var(--admin-muted)", fontSize: 11, marginTop: 2, maxWidth: 220 }}>{r.failureReason}</div>
                        )}
                      </td>
                      <td>{new Date(r.createdAt).toLocaleString("en-KE")}</td>
                      <td>{r.sentAt ? new Date(r.sentAt).toLocaleString("en-KE") : "—"}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {(r.status === "FAILED" || r.status === "EXPIRED") && (
                          <button className="admin-btn admin-btn-ghost" disabled={retryingId === r.id} onClick={() => void retry(r)}>
                            {retryingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                            {r.status === "EXPIRED" ? "Resend" : "Retry"}
                          </button>
                        )}
                        {r.cloudinaryUrl && (
                          <a className="admin-btn admin-btn-ghost" href={r.cloudinaryUrl} target="_blank" rel="noreferrer">
                            <Download size={14} />PDF
                          </a>
                        )}
                        {wa && (
                          <a className="admin-btn admin-btn-ghost" href={wa} target="_blank" rel="noreferrer">
                            <MessageCircle size={14} />WhatsApp
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminTaxDocumentsPage;
