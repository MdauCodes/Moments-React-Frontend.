import { Link, useParams } from "react-router-dom";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes, formatDate } from "@/components/admin/commerceUi";
import { adminResources, type BusinessAccountDto } from "@/services/adminResources";

function AdminBusinessAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<BusinessAccountDto | undefined>();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminResources.businessAccounts
      .get(id ?? "")
      .then((res) => { if (!cancelled) setAccount(res); })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load business account"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  async function toggleStatus() {
    if (!account) return;
    const next = account.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    setUpdating(true);
    try {
      const updated = await adminResources.businessAccounts.setStatus(account.id, next);
      setAccount(updated);
      toast.success(next === "ACTIVE" ? "Account reactivated" : "Account suspended");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return <AdminLayout title="Business account"><div className="admin-empty">Loading business account…</div></AdminLayout>;
  }
  if (!account) {
    return (
      <AdminLayout title="Business account not found">
        <div className="admin-empty">
          We couldn't find that business account.{" "}
          <Link to="/admin/business-accounts" className="admin-btn admin-btn-ghost">Back to Business Accounts</Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={account.businessName}>
      <div className="admin-page-stack">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(240px, 1fr)", gap: 16 }} data-admin-detail-grid>
          <div className="admin-panel" style={{ padding: 18 }}>
            <div className="admin-label">Business details</div>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginTop: 12, fontSize: 13 }}>
              <Row label="KRA PIN" value={account.kraPin} />
              <Row label="Industry" value={account.industryName ?? "—"} />
              <Row label="Location" value={account.location} />
              <Row label="Road" value={account.road} />
              <Row label="Building / address" value={account.buildingAddress} />
              <Row label="Phone" value={account.phone} />
              <Row label="Contact person" value={account.contactPersonName} />
              <Row label="Designation" value={account.contactPersonRole ?? "—"} />
              <Row label="Welcome code" value={account.welcomeCode ?? "—"} />
              <Row label="Opened" value={formatDate(account.createdAt)} />
            </dl>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Status</div>
              <div style={{ marginTop: 8 }}>
                <span style={{
                  display: "inline-flex", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: account.status === "ACTIVE" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: account.status === "ACTIVE" ? "#15803d" : "#b91c1c",
                }}>{account.status}</span>
              </div>
              <button
                className="admin-btn admin-btn-ghost"
                style={{ marginTop: 12, width: "100%" }}
                disabled={updating}
                onClick={toggleStatus}
              >
                {account.status === "ACTIVE" ? "Suspend account" : "Reactivate account"}
              </button>
            </div>

            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Order history</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, marginTop: 6 }}>
                {account.orderCount ?? 0} order{account.orderCount === 1 ? "" : "s"}
              </div>
              <div style={{ color: "var(--admin-muted)", fontSize: 12, marginTop: 4 }}>
                {formatKes(account.totalSpend ?? 0)} lifetime spend
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>{label}</div>
      <div style={{ marginTop: 2 }}>{value}</div>
    </div>
  );
}

export default AdminBusinessAccountDetailPage;
