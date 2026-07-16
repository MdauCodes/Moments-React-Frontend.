import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources, type PromoCodeDto } from "@/services/adminResources";

type FormState = {
  code: string;
  discountType: "PERCENT" | "FIXED_AMOUNT";
  discountValue: string;
  minOrderAmount: string;
  maxUses: string;
  expiresAt: string;
  active: boolean;
};

const empty: FormState = {
  code: "",
  discountType: "PERCENT",
  discountValue: "",
  minOrderAmount: "",
  maxUses: "",
  expiresAt: "",
  active: true,
};

function fmtKes(n?: number | null) {
  if (!n) return "—";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function AdminPromoCodesPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<PromoCodeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PromoCodeDto | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminResources.promoCodes.list());
    } catch (err) {
      reportAdminError(err, "Failed to load promo codes");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  function begin(row?: PromoCodeDto) {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            code: row.code,
            discountType: row.discountType,
            discountValue: String(row.discountValue),
            minOrderAmount: row.minOrderAmount ? String(row.minOrderAmount) : "",
            maxUses: row.maxUses ? String(row.maxUses) : "",
            expiresAt: row.expiresAt ? row.expiresAt.slice(0, 10) : "",
            active: row.active,
          }
        : empty,
    );
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Partial<PromoCodeDto> = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        active: form.active,
      };
      if (editing) {
        await adminResources.promoCodes.update(editing.id, body);
        toast.success("Promo code updated");
      } else {
        await adminResources.promoCodes.create(body);
        toast.success("Promo code created");
      }
      setOpen(false);
      await load();
    } catch (err) {
      reportAdminError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: PromoCodeDto) {
    if (!isAdmin || !confirm(`Delete promo code ${row.code}?`)) return;
    setSaving(true);
    try {
      await adminResources.promoCodes.remove(row.id);
      toast.success("Promo code deleted");
      await load();
    } catch (err) {
      reportAdminError(err, "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="Promo Codes" actionLabel="New code" onAction={() => begin()}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p>
            <b>What this controls:</b> manually-created discount codes a customer types in at
            checkout — a percent or fixed KES amount off, with an optional minimum order value,
            usage cap and expiry date. This is separate from the points/rewards system: a code
            here is a one-off marketing tool, not tied to a customer's earned points balance.
          </p>
          <p style={{ marginTop: 8 }}>
            One code type is created automatically, not here: every new Business Account gets a
            one-time welcome code the moment it's created (shown as "restricted to" that specific
            customer below) — you can view it but shouldn't need to create these manually.
          </p>
        </div>
        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Min order</th>
                <th>Uses</th>
                <th>Expires</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="admin-empty">Loading promo codes…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7}><div className="admin-empty">No promo codes yet. <button className="admin-btn admin-btn-primary" onClick={() => begin()}>Create promo code</button></div></td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <b>{r.code}</b>
                      {r.restrictedToUserId && (
                        <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>Auto-issued welcome code</div>
                      )}
                    </td>
                    <td>{r.discountType === "PERCENT" ? `${r.discountValue}%` : fmtKes(r.discountValue)}</td>
                    <td>{fmtKes(r.minOrderAmount)}</td>
                    <td>{r.usedCount}{r.maxUses ? ` / ${r.maxUses}` : ""}</td>
                    <td>{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("en-KE") : "—"}</td>
                    <td>
                      <span style={{
                        display: "inline-flex", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: r.active ? "rgba(34, 197, 94, 0.15)" : "rgba(107, 114, 128, 0.15)",
                        color: r.active ? "#15803d" : "#374151",
                      }}>{r.active ? "Active" : "Disabled"}</span>
                    </td>
                    <td>
                      <button className="admin-btn admin-btn-ghost" onClick={() => begin(r)}>
                        <Pencil size={14} />Edit
                      </button>
                      {isAdmin && !r.restrictedToUserId && (
                        <button className="admin-btn admin-btn-danger" onClick={() => void remove(r)}>
                          <Trash2 size={14} />Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {open && (
          <div className="admin-modal-backdrop">
            <form className="admin-modal" onSubmit={save}>
              <div className="admin-toolbar">
                <h2>{editing ? "Edit promo code" : "Create promo code"}</h2>
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setOpen(false)}>Close</button>
              </div>
              <div className="admin-form-grid">
                <label>
                  <span className="admin-label">Code</span>
                  <input
                    required
                    className="admin-input"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    style={{ textTransform: "uppercase" }}
                    disabled={!!editing?.restrictedToUserId}
                  />
                </label>
                <label>
                  <span className="admin-label">Discount type</span>
                  <select
                    className="admin-select"
                    value={form.discountType}
                    onChange={(e) => setForm({ ...form, discountType: e.target.value as FormState["discountType"] })}
                  >
                    <option value="PERCENT">Percentage</option>
                    <option value="FIXED_AMOUNT">Fixed amount (Ksh)</option>
                  </select>
                </label>
                <label>
                  <span className="admin-label">{form.discountType === "PERCENT" ? "Discount %" : "Discount amount (Ksh)"}</span>
                  <input
                    required
                    type="number"
                    min={0}
                    className="admin-input"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  />
                </label>
                <label>
                  <span className="admin-label">Minimum order amount (Ksh)</span>
                  <input
                    type="number"
                    min={0}
                    className="admin-input"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                  />
                </label>
                <label>
                  <span className="admin-label">Max uses (blank = unlimited)</span>
                  <input
                    type="number"
                    min={1}
                    className="admin-input"
                    value={form.maxUses}
                    onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                  />
                </label>
                <label>
                  <span className="admin-label">Expires on (blank = never)</span>
                  <input
                    type="date"
                    className="admin-input"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />
                  <span className="admin-label" style={{ margin: 0 }}>Active</span>
                </label>
              </div>
              <div className="admin-toolbar">
                <button className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}Save
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminPromoCodesPage;
