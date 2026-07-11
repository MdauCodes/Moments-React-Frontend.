import { Link } from "react-router-dom";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { MockBanner, formatKes, formatDateShort } from "@/components/admin/commerceUi";
import { listCustomers, exportCustomers, type ListCustomersResult } from "@/services/commerceApi";
import { downloadCsv, toCsv } from "@/lib/csv";
import { Download } from "lucide-react";
import type { CustomerRecord } from "@/services/commerceMock";



const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "VIP", label: "VIP" },
  { value: "ACTIVE", label: "Active" },
  { value: "AT_RISK", label: "At risk" },
  { value: "DORMANT", label: "Dormant" },
];

const SEGMENT_OPTIONS = [
  { value: "ALL", label: "All segments" },
  { value: "RETAIL", label: "Retail" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "ENTERPRISE", label: "Enterprise" },
];

const STATUS_TONE: Record<CustomerRecord["status"], { bg: string; fg: string }> = {
  VIP: { bg: "rgba(168, 85, 247, 0.18)", fg: "#7e22ce" },
  ACTIVE: { bg: "rgba(34, 197, 94, 0.15)", fg: "#15803d" },
  AT_RISK: { bg: "rgba(234, 179, 8, 0.18)", fg: "#a16207" },
  DORMANT: { bg: "rgba(107, 114, 128, 0.18)", fg: "#374151" },
};

function StatusBadge({ status }: { status: CustomerRecord["status"] }) {
  const t = STATUS_TONE[status];
  return (
    <span style={{
      display: "inline-flex", padding: "3px 9px", borderRadius: 999,
      fontSize: 11, fontWeight: 600, background: t.bg, color: t.fg,
    }}>{status.replace("_", " ")}</span>
  );
}

function AdminCustomersPage() {
  const [data, setData] = useState<ListCustomersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [segment, setSegment] = useState("ALL");
  const [page, setPage] = useState(0);

  useEffect(() => { document.title = "Customers · Moments admin"; }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCustomers({ q, status, segment, page, size: PAGE_SIZE })
      .then((res) => { if (!cancelled) setData(res); })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load customers"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, status, segment, page]);

  const totalLtv = data?.rows.reduce((s, c) => s + c.lifetimeValue, 0) ?? 0;

  return (
    <AdminLayout title="Customers">
      <div className="admin-page-stack">
        {data && <MockBanner source={data.source} />}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }} data-admin-stats>
          <div className="admin-panel" style={{ padding: 16 }}>
            <div className="admin-label">Customers</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>{loading ? "—" : data?.total ?? 0}</div>
          </div>
          <div className="admin-panel" style={{ padding: 16 }}>
            <div className="admin-label">Lifetime value (visible)</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>{loading ? "—" : formatKes(totalLtv)}</div>
          </div>
          <div className="admin-panel" style={{ padding: 16 }}>
            <div className="admin-label">VIPs</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, marginTop: 6 }}>
              {loading ? "—" : data?.rows.filter((c) => c.status === "VIP").length ?? 0}
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-toolbar" data-admin-toolbar>
            <div style={{ display: "flex", gap: 10, flex: 1, flexWrap: "wrap" }}>
              <input
                className="admin-input"
                placeholder="Search by name, email, phone…"
                value={q}
                onChange={(e) => { setPage(0); setQ(e.target.value); }}
                style={{ maxWidth: 320 }}
              />
              <select className="admin-select" value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }} style={{ maxWidth: 180 }}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="admin-select" value={segment} onChange={(e) => { setPage(0); setSegment(e.target.value); }} style={{ maxWidth: 180 }}>
                {SEGMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button className="admin-btn admin-btn-ghost" onClick={async () => {
              const { rows } = await exportCustomers({ q, status, segment });
              downloadCsv(`customers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows.map((c) => ({
                name: c.name, email: c.email, phone: c.phone, city: c.city, segment: c.segment, status: c.status,
                orders: c.ordersCount, lifetimeValue: c.lifetimeValue, aov: c.averageOrderValue,
                firstOrder: c.firstOrderAt ?? "", lastOrder: c.lastOrderAt ?? "",
              }))));
              toast.success(`Exported ${rows.length} customers`);
            }}><Download size={14} style={{ marginRight: 6 }} />Export CSV</button>
          </div>

          <div data-admin-table-scroll>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Account</th>
                  <th>Segment</th>
                  <th>Orders</th>
                  <th>Lifetime value</th>
                  <th>AOV</th>
                  <th>Last order</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9}><div className="admin-empty">Loading customers…</div></td></tr>
                ) : !data || data.rows.length === 0 ? (
                  <tr><td colSpan={9}><div className="admin-empty">No customers match your filters.</div></td></tr>
                ) : (
                  data.rows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div><b>{c.name}</b></div>
                        <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{c.email} · {c.phone}</div>
                      </td>
                      <td>
                        <div>{c.accountType === "BUSINESS" ? "Business" : "Sole Merchant"}</div>
                        {c.rewardsPoints != null && (
                          <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{c.rewardsPoints} pts</div>
                        )}
                      </td>
                      <td><span className="admin-label">{c.segment}</span></td>
                      <td>{c.ordersCount}</td>
                      <td><b>{formatKes(c.lifetimeValue)}</b></td>
                      <td>{formatKes(c.averageOrderValue ?? 0)}</td>
                      <td>{formatDateShort(c.lastOrderAt ?? undefined)}</td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>
                        <Link to={`/admin/customers/${c.id}`} className="admin-btn admin-btn-ghost">View</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 14 }} data-admin-pagination>
              <div style={{ color: "var(--admin-muted)", fontSize: 12 }}>
                Page {page + 1} of {data.totalPages} · {data.total} customers
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="admin-btn admin-btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
                <button className="admin-btn admin-btn-ghost" disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminCustomersPage;
