import { Link, useParams } from "react-router-dom";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes, formatDate } from "@/components/admin/commerceUi";
import { adminResources, type BusinessAccountDto, type BusinessType, type IndustryDto } from "@/services/adminResources";

const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  SOLE_PROPRIETOR: "Sole Proprietorship",
  SME: "SME",
  LIMITED_COMPANY: "Limited Company",
  PARTNERSHIP: "Partnership",
  OTHER: "Other",
};

const READINESS_COLOR: Record<string, string> = {
  Building: "#b45309",
  Promising: "var(--admin-accent, #2563eb)",
  Strong: "#15803d",
};

type EditForm = {
  businessName: string;
  businessType?: BusinessType;
  kraPin: string;
  location: string;
  road: string;
  buildingAddress: string;
  industryId: string;
  contactPersonName: string;
  contactPersonRole: string;
  phone: string;
};

function toForm(a: BusinessAccountDto): EditForm {
  return {
    businessName: a.businessName,
    businessType: a.businessType ?? undefined,
    kraPin: a.kraPin ?? "",
    location: a.location,
    road: a.road,
    buildingAddress: a.buildingAddress,
    industryId: a.industryId ?? "",
    contactPersonName: a.contactPersonName,
    contactPersonRole: a.contactPersonRole ?? "",
    phone: a.phone,
  };
}

function AdminBusinessAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<BusinessAccountDto | undefined>();
  const [industries, setIndustries] = useState<IndustryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      adminResources.businessAccounts.get(id ?? ""),
      adminResources.industries.list().catch(() => []),
    ])
      .then(([acc, inds]) => {
        if (cancelled) return;
        setAccount(acc);
        setIndustries(inds);
      })
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

  function startEdit() {
    if (!account) return;
    setForm(toForm(account));
    setEditing(true);
  }

  async function saveEdit() {
    if (!account || !form) return;
    setSaving(true);
    try {
      const updated = await adminResources.businessAccounts.update(account.id, {
        businessName: form.businessName,
        businessType: form.businessType ?? null,
        kraPin: form.kraPin || null,
        location: form.location,
        road: form.road,
        buildingAddress: form.buildingAddress,
        industryId: form.industryId || null,
        contactPersonName: form.contactPersonName,
        contactPersonRole: form.contactPersonRole || null,
        phone: form.phone,
      });
      setAccount(updated);
      setEditing(false);
      toast.success("Business account updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
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

  const readiness = account.creditReadiness;

  return (
    <AdminLayout title={account.businessName}>
      <div className="admin-page-stack">
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(240px, 1fr)", gap: 16 }} data-admin-detail-grid>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="admin-panel" style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="admin-label">Business details</div>
                {!editing && (
                  <button className="admin-btn admin-btn-ghost" onClick={startEdit}>Edit</button>
                )}
              </div>

              {editing && form ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 12 }}>
                  <EditField label="Business name" value={form.businessName} onChange={(v) => setForm({ ...form, businessName: v })} />
                  <div>
                    <div style={{ color: "var(--admin-muted)", fontSize: 11, marginBottom: 4 }}>Business type</div>
                    <select
                      className="admin-input"
                      value={form.businessType ?? ""}
                      onChange={(e) => setForm({ ...form, businessType: (e.target.value || undefined) as BusinessType | undefined })}
                    >
                      <option value="">—</option>
                      {(Object.keys(BUSINESS_TYPE_LABELS) as BusinessType[]).map((t) => (
                        <option key={t} value={t}>{BUSINESS_TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <EditField label="KRA PIN" value={form.kraPin} onChange={(v) => setForm({ ...form, kraPin: v })} />
                  <div>
                    <div style={{ color: "var(--admin-muted)", fontSize: 11, marginBottom: 4 }}>Industry</div>
                    <select
                      className="admin-input"
                      value={form.industryId}
                      onChange={(e) => setForm({ ...form, industryId: e.target.value })}
                    >
                      <option value="">—</option>
                      {industries.map((i) => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>
                  <EditField label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
                  <EditField label="Road" value={form.road} onChange={(v) => setForm({ ...form, road: v })} />
                  <div style={{ gridColumn: "1 / -1" }}>
                    <EditField label="Building / address" value={form.buildingAddress} onChange={(v) => setForm({ ...form, buildingAddress: v })} />
                  </div>
                  <EditField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <EditField label="Contact person" value={form.contactPersonName} onChange={(v) => setForm({ ...form, contactPersonName: v })} />
                  <EditField label="Designation" value={form.contactPersonRole} onChange={(v) => setForm({ ...form, contactPersonRole: v })} />

                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 4 }}>
                    <button className="admin-btn admin-btn-primary" disabled={saving} onClick={saveEdit}>
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button className="admin-btn admin-btn-ghost" disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, marginTop: 12, fontSize: 13 }}>
                  <Row label="Business type" value={account.businessType ? BUSINESS_TYPE_LABELS[account.businessType] : "—"} />
                  <Row label="KRA PIN" value={account.kraPin || "Not provided yet"} />
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
              )}
            </div>

            {readiness && (
              <div className="admin-panel" style={{ padding: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="admin-label">Trade credit readiness</div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999,
                    background: "var(--admin-panel-alt, #f3f4f6)", color: READINESS_COLOR[readiness.label],
                  }}>{readiness.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 32 }}>{readiness.score}</div>
                  <div style={{ color: "var(--admin-muted)", fontSize: 12 }}>/ 100</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12, marginTop: 14 }}>
                  <ReadinessBar label="Order frequency" points={readiness.orderCountPoints} max={readiness.orderCountMax} />
                  <ReadinessBar label="Lifetime spend" points={readiness.spendPoints} max={readiness.spendMax} />
                  <ReadinessBar label="Account age" points={readiness.accountAgePoints} max={readiness.accountAgeMax} />
                  <ReadinessBar label="Recent activity" points={readiness.recencyPoints} max={readiness.recencyMax} />
                </div>
                <p style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 12 }}>
                  Informational only — not used to auto-approve trade credit. Applications (coming soon) will still
                  need documents and manual review.
                </p>
              </div>
            )}
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

            <div className="admin-panel" style={{ padding: 16, opacity: 0.75 }}>
              <div className="admin-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                Trade credit application
                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: "var(--admin-panel-alt, #f3f4f6)" }}>
                  Coming soon
                </span>
              </div>
              <p style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 8, marginBottom: 0 }}>
                Review documents, set a credit limit and payment terms, and approve or decline — once Phase 2 ships.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

function ReadinessBar({ label, points, max }: { label: string; points: number; max: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--admin-muted)" }}>
        <span>{label}</span>
        <span>{points}/{max}</span>
      </div>
      <div style={{ marginTop: 4, height: 6, borderRadius: 999, background: "var(--admin-panel-alt, #f3f4f6)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 999, background: "var(--admin-accent, #2563eb)", width: `${max > 0 ? (points / max) * 100 : 0}%` }} />
      </div>
    </div>
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

function EditField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ color: "var(--admin-muted)", fontSize: 11, marginBottom: 4 }}>{label}</div>
      <input className="admin-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default AdminBusinessAccountDetailPage;
