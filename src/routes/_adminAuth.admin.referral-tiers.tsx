import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources, type ReferralTierConfigDto } from "@/services/adminResources";

type FormState = {
  tierName: string;
  minOrderAmount: string;
  maxOrderAmount: string;
  referrerCredits: string;
  refereeCredits: string;
  isActive: boolean;
  sortOrder: string;
};

const empty: FormState = {
  tierName: "",
  minOrderAmount: "0",
  maxOrderAmount: "",
  referrerCredits: "",
  refereeCredits: "",
  isActive: true,
  sortOrder: "0",
};

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function AdminReferralTiersPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<ReferralTierConfigDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReferralTierConfigDto | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminResources.referralTiers.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load referral tiers");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  function begin(row?: ReferralTierConfigDto) {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            tierName: row.tierName,
            minOrderAmount: String(row.minOrderAmount),
            maxOrderAmount: row.maxOrderAmount != null ? String(row.maxOrderAmount) : "",
            referrerCredits: String(row.referrerCredits),
            refereeCredits: String(row.refereeCredits),
            isActive: row.isActive,
            sortOrder: String(row.sortOrder),
          }
        : empty,
    );
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Partial<ReferralTierConfigDto> = {
        tierName: form.tierName.trim(),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxOrderAmount: form.maxOrderAmount.trim() ? Number(form.maxOrderAmount) : undefined,
        referrerCredits: Number(form.referrerCredits) || 0,
        refereeCredits: Number(form.refereeCredits) || 0,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        await adminResources.referralTiers.update(editing.id, body);
        toast.success("Tier updated");
      } else {
        await adminResources.referralTiers.create(body);
        toast.success("Tier created");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: ReferralTierConfigDto) {
    if (!isAdmin || !confirm(`Delete tier ${row.tierName}?`)) return;
    setSaving(true);
    try {
      await adminResources.referralTiers.remove(row.id);
      toast.success("Tier deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="Referral Payout Tiers" actionLabel="New tier" onAction={() => begin()}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p>
            <b>What this controls:</b> when a referred friend's first paid order lands, we look up
            which tier their order value falls into, then pay out <b>both</b> people — the referrer
            gets "referrer credits", the new customer (referee) gets "referee credits". This is the
            actual "give &amp; get" reward. Separate from <b>Rewards Tiers</b>, which is the VIP
            ladder based on lifetime points, not a per-order payout.
          </p>
          {!loading && rows.length === 0 && (
            <p style={{ marginTop: 10, color: "#b45309", fontWeight: 600 }}>
              No tiers exist yet — this means referrals are currently NOT paying out at all. Every
              referred signup is stuck "pending" forever because there's nothing to match an order
              against. Create at least one tier below (e.g. a single catch-all: min KES 0, no max)
              to activate payouts.
            </p>
          )}
        </div>

        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Order value range</th>
                <th>Referrer gets</th>
                <th>Referee gets</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}><div className="admin-empty">Loading tiers…</div></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6}><div className="admin-empty">No tiers yet. <button className="admin-btn admin-btn-primary" onClick={() => begin()}>Create tier</button></div></td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.tierName}</b></td>
                    <td>{fmtKes(r.minOrderAmount)} – {r.maxOrderAmount != null ? fmtKes(r.maxOrderAmount) : "no limit"}</td>
                    <td>{r.referrerCredits.toLocaleString()} pts</td>
                    <td>{r.refereeCredits.toLocaleString()} pts</td>
                    <td>
                      <span style={{
                        display: "inline-flex", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                        background: r.isActive ? "rgba(34, 197, 94, 0.15)" : "rgba(107, 114, 128, 0.15)",
                        color: r.isActive ? "#15803d" : "#374151",
                      }}>{r.isActive ? "Active" : "Disabled"}</span>
                    </td>
                    <td>
                      <button className="admin-btn admin-btn-ghost" onClick={() => begin(r)}>
                        <Pencil size={14} />Edit
                      </button>
                      {isAdmin && (
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
                <h2>{editing ? "Edit tier" : "Create tier"}</h2>
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setOpen(false)}>Close</button>
              </div>
              <div className="admin-form-grid">
                <label>
                  <span className="admin-label">Tier name</span>
                  <input
                    required
                    className="admin-input"
                    value={form.tierName}
                    onChange={(e) => setForm({ ...form, tierName: e.target.value })}
                    placeholder="Standard, Big order, …"
                  />
                </label>
                <label>
                  <span className="admin-label">Minimum order value (KES)</span>
                  <input
                    required
                    type="number"
                    min={0}
                    className="admin-input"
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                  />
                </label>
                <label>
                  <span className="admin-label">Maximum order value (KES, optional)</span>
                  <input
                    type="number"
                    min={0}
                    className="admin-input"
                    value={form.maxOrderAmount}
                    onChange={(e) => setForm({ ...form, maxOrderAmount: e.target.value })}
                    placeholder="Leave blank for no upper limit"
                  />
                </label>
                <label>
                  <span className="admin-label">Referrer gets (points)</span>
                  <input
                    required
                    type="number"
                    min={0}
                    className="admin-input"
                    value={form.referrerCredits}
                    onChange={(e) => setForm({ ...form, referrerCredits: e.target.value })}
                  />
                </label>
                <label>
                  <span className="admin-label">Referee gets (points)</span>
                  <input
                    required
                    type="number"
                    min={0}
                    className="admin-input"
                    value={form.refereeCredits}
                    onChange={(e) => setForm({ ...form, refereeCredits: e.target.value })}
                  />
                </label>
                <label>
                  <span className="admin-label">Sort order</span>
                  <input
                    type="number"
                    className="admin-input"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
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

export default AdminReferralTiersPage;
