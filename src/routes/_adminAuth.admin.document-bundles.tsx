import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCw, Upload, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { adminResources, type DocumentBundleAdminDto, type DocumentBundleStatus } from "@/services/adminResources";

const STATUS_FILTERS: { label: string; value: DocumentBundleStatus | "" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Sent", value: "SENT" },
  { label: "Failed", value: "FAILED" },
  { label: "All", value: "" },
];

const STATUS_COLORS: Record<DocumentBundleStatus, { bg: string; fg: string }> = {
  PENDING: { bg: "rgba(107, 114, 128, 0.15)", fg: "#374151" },
  SENT: { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d" },
  FAILED: { bg: "rgba(239, 68, 68, 0.15)", fg: "#b91c1c" },
};

function AdminDocumentBundlesPage() {
  const [rows, setRows] = useState<DocumentBundleAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DocumentBundleStatus | "">("PENDING");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminResources.documentBundles.list({ status: statusFilter || undefined, size: 50 });
      setRows(res.content ?? []);
    } catch (err) {
      reportAdminError(err, "Failed to load document bundles");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [statusFilter]);

  async function uploadEtr(row: DocumentBundleAdminDto, file: File) {
    setUploadingId(row.id);
    try {
      const updated = await adminResources.documentBundles.uploadEtr(row.id, file);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      toast.success(updated.status === "SENT" ? "ETR uploaded — bundle sent to customer" : `Uploaded, but send failed: ${updated.failureReason ?? "unknown reason"}`);
    } catch (err) {
      reportAdminError(err, "ETR upload failed");
    } finally {
      setUploadingId(null);
    }
  }

  async function retry(row: DocumentBundleAdminDto) {
    setRetryingId(row.id);
    try {
      const updated = await adminResources.documentBundles.retry(row.id);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
      toast.success(updated.status === "SENT" ? "Bundle sent" : `Retry finished — status: ${updated.status}`);
    } catch (err) {
      reportAdminError(err, "Retry failed");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <AdminLayout title="Documents/PDFs" onReload={load}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p>
            <b>What this controls:</b> orders where the customer checked "Send me my ETR & tax documents".
            Their receipt and tax invoice are held back until you upload the ETR scan here — uploading
            immediately emails all three (receipt, tax invoice, ETR) to the customer's documents email.
            If a send fails after the ETR is uploaded, use Retry rather than re-uploading.
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
                <th>Documents email</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Sent</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="admin-empty">Loading document bundles…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7}><div className="admin-empty">Nothing here.</div></td></tr>
              ) : (
                rows.map((r) => {
                  const colors = STATUS_COLORS[r.status];
                  return (
                    <tr key={r.id}>
                      <td>
                        <b>{r.orderReference}</b>
                        <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{r.orderStatus}</div>
                      </td>
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
                        {r.status === "PENDING" && (
                          <>
                            <input
                              ref={(el) => { fileInputs.current[r.id] = el; }}
                              type="file"
                              accept="application/pdf,image/jpeg,image/png"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (file) void uploadEtr(r, file);
                              }}
                            />
                            <button
                              className="admin-btn admin-btn-primary"
                              disabled={uploadingId === r.id}
                              onClick={() => fileInputs.current[r.id]?.click()}
                            >
                              {uploadingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                              Upload ETR & send
                            </button>
                          </>
                        )}
                        {r.status === "FAILED" && (
                          <button className="admin-btn admin-btn-ghost" disabled={retryingId === r.id} onClick={() => void retry(r)}>
                            {retryingId === r.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
                            Retry send
                          </button>
                        )}
                        {r.receiptUrl && (
                          <a className="admin-btn admin-btn-ghost" href={r.receiptUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} />Receipt
                          </a>
                        )}
                        {r.taxInvoiceUrl && (
                          <a className="admin-btn admin-btn-ghost" href={r.taxInvoiceUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} />Tax invoice
                          </a>
                        )}
                        {r.etrCloudinaryUrl && (
                          <a className="admin-btn admin-btn-ghost" href={r.etrCloudinaryUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={14} />ETR
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

export default AdminDocumentBundlesPage;
