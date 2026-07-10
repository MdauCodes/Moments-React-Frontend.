import { Link } from "react-router-dom";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { adminResources, type BusinessAccountDto } from "@/services/adminResources";

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: BusinessAccountDto["status"] }) {
  const tone = status === "ACTIVE"
    ? { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d" }
    : { bg: "rgba(239, 68, 68, 0.15)", fg: "#b91c1c" };
  return (
    <span style={{
      display: "inline-flex", padding: "3px 9px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, background: tone.bg, color: tone.fg,
    }}>{status}</span>
  );
}

function AdminBusinessAccountsPage() {
  const [rows, setRows] = useState<BusinessAccountDto[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => { document.title = "Business Accounts · Moments admin"; }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminResources.businessAccounts
      .list({ q, page, size: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setRows(res.content ?? []);
        setTotal(res.totalElements ?? 0);
        setTotalPages(res.totalPages ?? 1);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load business accounts"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, page]);

  return (
    <AdminLayout title="Business Accounts">
      <div className="admin-page-stack">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }} data-admin-stats>
          <div className="admin-panel" style={{ padding: 16 }}>
            <div className="admin-label">Business accounts</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>{loading ? "—" : total}</div>
          </div>
          <div className="admin-panel" style={{ padding: 16 }}>
            <div className="admin-label">Active</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>
              {loading ? "—" : rows.filter((r) => r.status === "ACTIVE").length}
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-toolbar" data-admin-toolbar>
            <input
              className="admin-input"
              placeholder="Search by business name or KRA PIN…"
              value={q}
              onChange={(e) => { setPage(0); setQ(e.target.value); }}
              style={{ maxWidth: 320 }}
            />
          </div>

          <div data-admin-table-scroll>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>KRA PIN</th>
                  <th>Contact person</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5}><div className="admin-empty">Loading business accounts…</div></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5}><div className="admin-empty">No business accounts match your search.</div></td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div><b>{r.businessName}</b></div>
                        <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{r.phone}</div>
                      </td>
                      <td>{r.kraPin || "—"}</td>
                      <td>{r.contactPersonName}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td>
                        <Link to={`/admin/business-accounts/${r.id}`} className="admin-btn admin-btn-ghost">View</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }} data-admin-pagination>
              <div style={{ color: "var(--admin-muted)", fontSize: 12 }}>
                Page {page + 1} of {totalPages} · {total} business accounts
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="admin-btn admin-btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
                <button className="admin-btn admin-btn-ghost" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminBusinessAccountsPage;
