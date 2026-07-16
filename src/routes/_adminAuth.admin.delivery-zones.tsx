
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminDeliveryZones, type DeliveryZone } from "@/services/deliveryZoneService";



const empty = { zoneName: "", county: "", feeAmount: 0, description: "", active: true };

function AdminDeliveryZonesPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryZone | null>(null);
  const [form, setForm] = useState(empty);

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminDeliveryZones.list());
    } catch (err) {
      reportAdminError(err, "Failed to load delivery zones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const begin = (row?: DeliveryZone) => {
    setEditing(row ?? null);
    setForm(
      row
        ? {
            zoneName: row.zoneName,
            county: row.county,
            feeAmount: row.feeAmount,
            description: row.description ?? "",
            active: row.active,
          }
        : empty,
    );
    setOpen(true);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await adminDeliveryZones.update(editing.id, { ...form, feeAmount: Number(form.feeAmount) });
      } else {
        await adminDeliveryZones.create({ ...form, feeAmount: Number(form.feeAmount) });
      }
      toast.success(editing ? "Zone updated" : "Zone created");
      setOpen(false);
      await load();
    } catch (err) {
      reportAdminError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: DeliveryZone) => {
    if (!isAdmin || !confirm(`Delete zone "${row.zoneName}"?`)) return;
    setSaving(true);
    try {
      await adminDeliveryZones.remove(row.id);
      toast.success("Zone deleted");
      await load();
    } catch (err) {
      reportAdminError(err, "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Delivery zones" actionLabel="Create zone" onAction={() => begin()}>
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Zone name</th>
                <th className="px-4 py-3">County</th>
                <th className="px-4 py-3">Fee (KES)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" /> Loading zones…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No delivery zones yet.{" "}
                    <button className="text-primary underline" onClick={() => begin()}>
                      Create zone
                    </button>
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-medium">{r.zoneName}</td>
                    <td className="px-4 py-3">{r.county}</td>
                    <td className="px-4 py-3">KES {Number(r.feeAmount).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                          r.active ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.description || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                          onClick={() => begin(r)}
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        {isAdmin && (
                          <button
                            className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => void remove(r)}
                          >
                            <Trash2 className="h-3 w-3" /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? "Edit zone" : "Create zone"}</h2>
              <button className="text-sm text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={save}>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Zone name</span>
                <input
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={form.zoneName}
                  onChange={(e) => setForm({ ...form, zoneName: e.target.value })}
                  placeholder="e.g. Nairobi CBD"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">County</span>
                <input
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={form.county}
                  onChange={(e) => setForm({ ...form, county: e.target.value })}
                  placeholder="e.g. Nairobi"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Delivery fee (KES)</span>
                <input
                  required
                  type="number"
                  min={0}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={form.feeAmount}
                  onChange={(e) => setForm({ ...form, feeAmount: Number(e.target.value) })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Active
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Description (shown to customer)
                </span>
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g. Same-day delivery within Nairobi"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminDeliveryZonesPage;
