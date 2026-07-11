import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources, type RewardsTierConfigDto } from "@/services/adminResources";

type FormState = {
  tierName: string;
  minLifetimePoints: string;
  discountPercent: string;
  perkDescription: string;
  isActive: boolean;
  sortOrder: string;
};

const empty: FormState = {
  tierName: "",
  minLifetimePoints: "",
  discountPercent: "",
  perkDescription: "",
  isActive: true,
  sortOrder: "0",
};

function AdminRewardsTiersPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<RewardsTierConfigDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RewardsTierConfigDto | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminResources.rewardsTiers.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load rewards tiers");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  function begin(row?: RewardsTierConfigDto) {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            tierName: row.tierName,
            minLifetimePoints: String(row.minLifetimePoints),
            discountPercent: String(row.discountPercent),
            perkDescription: row.perkDescription ?? "",
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
      const body: Partial<RewardsTierConfigDto> = {
        tierName: form.tierName.trim(),
        minLifetimePoints: Number(form.minLifetimePoints),
        discountPercent: Number(form.discountPercent),
        perkDescription: form.perkDescription.trim() || undefined,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (editing) {
        await adminResources.rewardsTiers.update(editing.id, body);
        toast.success("Tier updated");
      } else {
        await adminResources.rewardsTiers.create(body);
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

  async function remove(row: RewardsTierConfigDto) {
    if (!isAdmin || !confirm(`Delete tier ${row.tierName}?`)) return;
    setSaving(true);
    try {
      await adminResources.rewardsTiers.remove(row.id);
      toast.success("Tier deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="Rewards Tiers" actionLabel="New tier" onAction={() => begin()}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)" }}>
          VIP tiers for Sole Merchant accounts, resolved from a member's lifetime points earned — separate from
          referral payout tiers.
        </div>

        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Min. lifetime points</th>
                <th>Discount</th>
                <th>Perk</th>
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
                    <td>{r.minLifetimePoints}</td>
                    <td>{r.discountPercent}%</td>
                    <td>{r.perkDescription || "—"}</td>
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
                    placeholder="Silver, Gold, Platinum…"
                  />
                </label>
                <label>
                  <span className="admin-label">Minimum lifetime points</span>
                  <input
                    required
                    type="number"
                    min={0}
                    className="admin-input"
                    value={form.minLifetimePoints}
                    onChange={(e) => setForm({ ...form, minLifetimePoints: e.target.value })}
                  />
                </label>
                <label>
                  <span className="admin-label">Discount %</span>
                  <input
                    required
                    type="number"
                    min={0}
                    max={100}
                    className="admin-input"
                    value={form.discountPercent}
                    onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                  />
                </label>
                <label>
                  <span className="admin-label">Perk description (optional)</span>
                  <input
                    className="admin-input"
                    value={form.perkDescription}
                    onChange={(e) => setForm({ ...form, perkDescription: e.target.value })}
                    placeholder="e.g. Free shipping on every order"
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

export default AdminRewardsTiersPage;
