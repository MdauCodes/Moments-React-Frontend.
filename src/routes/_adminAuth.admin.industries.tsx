
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources, type IndustryDto, type CategoryDto, type SubcategoryDto } from "@/services/adminResources";

const empty = { name: "", description: "", iconUrl: "" };

function AdminIndustriesPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<IndustryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<IndustryDto | null>(null);
  const [form, setForm] = useState(empty);

  // Category/subcategory linking state — loaded once per modal open.
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryDto[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [checkedCategoryIds, setCheckedCategoryIds] = useState<Set<string>>(new Set());
  const [checkedSubcategoryIds, setCheckedSubcategoryIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminResources.industries.list());
    } catch (err) {
      reportAdminError(err, "Failed to load industries");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const begin = async (row?: IndustryDto) => {
    setEditing(row ?? null);
    setForm(row ? { name: row.name, description: row.description ?? "", iconUrl: row.iconUrl ?? "" } : empty);
    setOpen(true);
    setCategoryFilter("");
    setSubcategoryFilter("");
    if (!row) {
      setCategories([]);
      setSubcategories([]);
      setCheckedCategoryIds(new Set());
      setCheckedSubcategoryIds(new Set());
      return;
    }
    setLinksLoading(true);
    try {
      const [allCategories, allSubcategories] = await Promise.all([
        adminResources.categories.list(),
        adminResources.subcategories.list(),
      ]);
      setCategories(allCategories);
      setSubcategories(allSubcategories);
      setCheckedCategoryIds(new Set(allCategories.filter((c) => c.industryIds?.includes(row.id)).map((c) => c.id)));
      setCheckedSubcategoryIds(new Set(allSubcategories.filter((sc) => sc.industryIds?.includes(row.id)).map((sc) => sc.id)));
    } catch (err) {
      reportAdminError(err, "Failed to load categories/subcategories");
    } finally {
      setLinksLoading(false);
    }
  };

  const toggleCategory = (id: string) => {
    setCheckedCategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSubcategory = (id: string) => {
    setCheckedSubcategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const industry = editing
        ? await adminResources.industries.update(editing.id, form)
        : await adminResources.industries.create(form);
      const industryId = industry.id;

      // Only push updates for categories/subcategories whose membership actually changed —
      // add or remove just this industry's id from their existing industryIds list, never
      // overwrite the whole list (other industries may already be linked to the same one).
      const categoryUpdates = categories
        .filter((c) => {
          const wasChecked = (c.industryIds ?? []).includes(industryId);
          const isChecked = checkedCategoryIds.has(c.id);
          return wasChecked !== isChecked;
        })
        .map((c) => {
          const current = new Set(c.industryIds ?? []);
          checkedCategoryIds.has(c.id) ? current.add(industryId) : current.delete(industryId);
          return adminResources.categories.update(c.id, { industryIds: Array.from(current) });
        });

      const subcategoryUpdates = subcategories
        .filter((sc) => {
          const wasChecked = (sc.industryIds ?? []).includes(industryId);
          const isChecked = checkedSubcategoryIds.has(sc.id);
          return wasChecked !== isChecked;
        })
        .map((sc) => {
          const current = new Set(sc.industryIds ?? []);
          checkedSubcategoryIds.has(sc.id) ? current.add(industryId) : current.delete(industryId);
          return adminResources.subcategories.update(sc.id, { industryIds: Array.from(current) });
        });

      await Promise.all([...categoryUpdates, ...subcategoryUpdates]);
      toast.success(editing ? "Industry updated" : "Industry created");
      setOpen(false);
      await load();
    } catch (err) {
      reportAdminError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: IndustryDto) => {
    if (!isAdmin || !confirm(`Delete ${row.name}?`)) return;
    setSaving(true);
    try {
      await adminResources.industries.remove(row.id);
      toast.success("Industry deleted");
      await load();
    } catch (err) {
      reportAdminError(err, "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.name.toLowerCase().includes(categoryFilter.toLowerCase())),
    [categories, categoryFilter],
  );
  const filteredSubcategories = useMemo(
    () => subcategories.filter((sc) =>
      sc.name.toLowerCase().includes(subcategoryFilter.toLowerCase())
      || (sc.categoryName ?? "").toLowerCase().includes(subcategoryFilter.toLowerCase())),
    [subcategories, subcategoryFilter],
  );

  return (
    <AdminLayout title="Industries" actionLabel="New industry" onAction={() => void begin()} onReload={load}>
      <div className="admin-page-stack">
        <div className="admin-panel" data-admin-table-scroll>
          <table className="admin-table">
            <thead><tr><th>Name</th><th>Slug</th><th>Description</th><th /></tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4}>Loading industries…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={4}><div className="admin-empty">No industries yet. <button className="admin-btn admin-btn-primary" onClick={() => void begin()}>Create industry</button></div></td></tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id}>
                    <td><b>{r.name}</b></td>
                    <td>{r.slug ?? "—"}</td>
                    <td>{r.description ?? "—"}</td>
                    <td>
                      <button className="admin-btn admin-btn-ghost" onClick={() => void begin(r)}><Pencil size={14} />Edit</button>
                      {isAdmin && <button className="admin-btn admin-btn-danger" onClick={() => void remove(r)}><Trash2 size={14} />Delete</button>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {open && (
          <div className="admin-modal-backdrop">
            <form className="admin-modal" style={{ maxWidth: 640 }} onSubmit={save}>
              <div className="admin-toolbar">
                <h2>{editing ? "Edit industry" : "Create industry"}</h2>
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setOpen(false)}>Close</button>
              </div>
              <div className="admin-form-grid">
                <label>
                  <span className="admin-label">Name</span>
                  <input required className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </label>
                <label>
                  <span className="admin-label">Icon URL</span>
                  <input className="admin-input" value={form.iconUrl} onChange={(e) => setForm({ ...form, iconUrl: e.target.value })} />
                </label>
                <label style={{ gridColumn: "1/-1" }}>
                  <span className="admin-label">Description</span>
                  <textarea className="admin-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </label>
              </div>

              {editing && (
                <div style={{ marginTop: 14, display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <span className="admin-label">Categories in this industry</span>
                    <input
                      className="admin-input" placeholder="Search categories…" style={{ marginTop: 4, marginBottom: 6 }}
                      value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                    />
                    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--admin-border)", borderRadius: 8, padding: 8 }}>
                      {linksLoading ? (
                        <div style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>Loading…</div>
                      ) : filteredCategories.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>No categories match.</div>
                      ) : (
                        filteredCategories.map((c) => (
                          <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", fontSize: 13 }}>
                            <input type="checkbox" checked={checkedCategoryIds.has(c.id)} onChange={() => toggleCategory(c.id)} />
                            {c.name}
                            <span style={{ color: "var(--admin-muted)", fontSize: 11 }}>{c.segmentName}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="admin-label">Subcategories in this industry</span>
                    <input
                      className="admin-input" placeholder="Search subcategories…" style={{ marginTop: 4, marginBottom: 6 }}
                      value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)}
                    />
                    <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--admin-border)", borderRadius: 8, padding: 8 }}>
                      {linksLoading ? (
                        <div style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>Loading…</div>
                      ) : filteredSubcategories.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>No subcategories match.</div>
                      ) : (
                        filteredSubcategories.map((sc) => (
                          <label key={sc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", fontSize: 13 }}>
                            <input type="checkbox" checked={checkedSubcategoryIds.has(sc.id)} onChange={() => toggleSubcategory(sc.id)} />
                            {sc.name}
                            <span style={{ color: "var(--admin-muted)", fontSize: 11 }}>{sc.categoryName}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
              {!editing && (
                <p style={{ marginTop: 10, fontSize: 12, color: "var(--admin-muted)" }}>
                  Save the industry first, then reopen it to link categories and subcategories.
                </p>
              )}

              <div className="admin-toolbar" style={{ marginTop: 14 }}>
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

export default AdminIndustriesPage;
