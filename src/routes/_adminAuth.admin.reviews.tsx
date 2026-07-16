// ----------------------------------------------------------------------------
// Admin Reviews moderation (Phase 6).
// Policy: reviews auto-publish; admin can hide / unhide / delete. Verified-purchase
// reviews are flagged so moderators can prioritise non-verified noise.
// ----------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { MockBanner } from "@/components/admin/commerceUi";
import { reviewStore, type ProductReview } from "@/services/reviewStore";



type Filter = "ALL" | "VISIBLE" | "HIDDEN";

function Stars({ value }: { value: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 2, color: "#f5b301" }} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={14} fill={n <= value ? "currentColor" : "none"} stroke="currentColor" />
      ))}
    </span>
  );
}

function AdminReviewsPage() {
  const [rows, setRows] = useState<ProductReview[]>([]);
  const [source, setSource] = useState<"live" | "mock">("mock");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  useEffect(() => { document.title = "Reviews · Moments admin"; }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await reviewStore.listAll();
      setRows(res.reviews);
      setSource(res.source);
    } catch (err) {
      reportAdminError(err, "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "VISIBLE" && r.hidden) return false;
      if (filter === "HIDDEN" && !r.hidden) return false;
      if (!q) return true;
      return (
        r.productId.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.title?.toLowerCase().includes(q) ?? false) ||
        r.body.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

  const counts = useMemo(() => ({
    all: rows.length,
    visible: rows.filter((r) => !r.hidden).length,
    hidden: rows.filter((r) => r.hidden).length,
  }), [rows]);

  const toggleHidden = async (r: ProductReview) => {
    setBusyId(r.id);
    try {
      const next = await reviewStore.setHidden(r.id, !r.hidden);
      if (next) {
        setRows((prev) => prev.map((x) => (x.id === next.id ? next : x)));
        toast.success(next.hidden ? "Review hidden" : "Review made visible");
      }
    } catch (err) {
      reportAdminError(err, "Failed to update review");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (r: ProductReview) => {
    if (!window.confirm(`Delete review by ${r.customerName}? This cannot be undone.`)) return;
    setBusyId(r.id);
    try {
      const ok = await reviewStore.remove(r.id);
      if (ok) {
        setRows((prev) => prev.filter((x) => x.id !== r.id));
        toast.success("Review deleted");
      }
    } catch (err) {
      reportAdminError(err, "Failed to delete review");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <AdminLayout title="Reviews" onReload={load}>
      <div className="admin-page-stack">
        <MockBanner source={source} />

        <div className="admin-panel admin-toolbar" data-admin-toolbar>
          {(["ALL", "VISIBLE", "HIDDEN"] as Filter[]).map((f) => (
            <button
              key={f}
              className={`admin-btn ${filter === f ? "admin-btn-primary" : "admin-btn-ghost"}`}
              onClick={() => setFilter(f)}
            >
              {f === "ALL" ? `All (${counts.all})` : f === "VISIBLE" ? `Visible (${counts.visible})` : `Hidden (${counts.hidden})`}
            </button>
          ))}
          <input
            className="admin-input"
            style={{ marginLeft: "auto", maxWidth: 280 }}
            placeholder="Search product, customer, text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Rating</th>
                <th>Product</th>
                <th>Reviewer</th>
                <th>Review</th>
                <th>Submitted</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="admin-empty"><Loader2 size={14} className="animate-spin" /> Loading reviews…</div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="admin-empty">No reviews match this filter.</div></td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} style={{ opacity: r.hidden ? 0.55 : 1 }}>
                  <td><Stars value={r.rating} /></td>
                  <td><code style={{ fontSize: 12 }}>{r.productId}</code></td>
                  <td>
                    <b>{r.customerName}</b>
                    <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{r.customerEmail ?? "—"}</div>
                    {r.verifiedPurchase && (
                      <span className="n n-muted" style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <ShieldCheck size={11} /> Verified
                      </span>
                    )}
                  </td>
                  <td style={{ maxWidth: 360 }}>
                    {r.title && <div style={{ fontWeight: 600 }}>{r.title}</div>}
                    <div style={{ color: "var(--admin-muted)", fontSize: 12, whiteSpace: "pre-wrap" }}>{r.body}</div>
                    {r.orderReference && (
                      <div style={{ color: "var(--admin-muted)", fontSize: 11, marginTop: 4 }}>Order {r.orderReference}</div>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>{new Date(r.createdAt).toLocaleString("en-KE")}</td>
                  <td>
                    <span className={`n ${r.hidden ? "n-muted" : "n-ok"}`}>
                      {r.hidden ? "Hidden" : "Visible"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="admin-btn admin-btn-ghost"
                      disabled={busyId === r.id}
                      onClick={() => void toggleHidden(r)}
                      title={r.hidden ? "Unhide" : "Hide"}
                    >
                      {r.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      <span style={{ marginLeft: 6 }}>{r.hidden ? "Unhide" : "Hide"}</span>
                    </button>
                    <button
                      className="admin-btn admin-btn-danger"
                      disabled={busyId === r.id}
                      onClick={() => void remove(r)}
                      style={{ marginLeft: 6 }}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminReviewsPage;
