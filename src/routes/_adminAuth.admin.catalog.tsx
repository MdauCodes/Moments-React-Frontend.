import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import {
  adminResources,
  type SegmentDto,
  type CategoryDto,
  type SubcategoryDto,
} from "@/services/adminResources";

type Level = "segment" | "category" | "subcategory";
type LevelRow = SegmentDto | CategoryDto | SubcategoryDto;

const emptyForm = { name: "", description: "", sortOrder: "" };

function AdminCatalogPage() {
  const { isAdmin } = useAuth();

  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryDto[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [modalLevel, setModalLevel] = useState<Level | null>(null);
  const [editing, setEditing] = useState<LevelRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  const loadSegments = async () => {
    setLoadingSegments(true);
    try {
      setSegments(await adminResources.segments.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load segments");
    } finally {
      setLoadingSegments(false);
    }
  };

  const loadCategories = async (segmentId: string) => {
    setLoadingCategories(true);
    try {
      setCategories(await adminResources.categories.list(segmentId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load categories");
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadSubcategories = async (categoryId: string) => {
    setLoadingSubcategories(true);
    try {
      setSubcategories(await adminResources.subcategories.list(categoryId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load subcategories");
    } finally {
      setLoadingSubcategories(false);
    }
  };

  useEffect(() => {
    void loadSegments();
  }, []);

  const selectSegment = (id: string) => {
    setSelectedSegmentId(id);
    setSelectedCategoryId(null);
    setSubcategories([]);
    void loadCategories(id);
  };

  const selectCategory = (id: string) => {
    setSelectedCategoryId(id);
    void loadSubcategories(id);
  };

  const beginCreate = (level: Level) => {
    setEditing(null);
    setForm(emptyForm);
    setModalLevel(level);
  };

  const beginEdit = (level: Level, row: LevelRow) => {
    setEditing(row);
    setForm({
      name: row.name,
      description: row.description ?? "",
      sortOrder: row.sortOrder != null ? String(row.sortOrder) : "",
    });
    setModalLevel(level);
  };

  const closeModal = () => {
    setModalLevel(null);
    setEditing(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!modalLevel) return;
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || undefined,
        sortOrder: form.sortOrder ? Number(form.sortOrder) : undefined,
      };
      if (modalLevel === "segment") {
        editing ? await adminResources.segments.update(editing.id, body) : await adminResources.segments.create(body);
        toast.success(editing ? "Segment updated" : "Segment created");
        await loadSegments();
      } else if (modalLevel === "category") {
        if (!selectedSegmentId) return;
        const categoryBody = { ...body, segmentId: selectedSegmentId };
        editing ? await adminResources.categories.update(editing.id, categoryBody) : await adminResources.categories.create(categoryBody as { segmentId: string; name: string; description?: string; sortOrder?: number });
        toast.success(editing ? "Category updated" : "Category created");
        await loadCategories(selectedSegmentId);
      } else {
        if (!selectedCategoryId) return;
        const subcategoryBody = { ...body, categoryId: selectedCategoryId };
        editing
          ? await adminResources.subcategories.update(editing.id, subcategoryBody)
          : await adminResources.subcategories.create(subcategoryBody as { categoryId: string; name: string; description?: string; sortOrder?: number });
        toast.success(editing ? "Subcategory updated" : "Subcategory created");
        await loadSubcategories(selectedCategoryId);
      }
      closeModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (level: Level, row: LevelRow) => {
    if (!isAdmin || !confirm(`Delete "${row.name}"?`)) return;
    setSaving(true);
    try {
      if (level === "segment") {
        await adminResources.segments.remove(row.id);
        toast.success("Segment deleted");
        await loadSegments();
        if (selectedSegmentId === row.id) {
          setSelectedSegmentId(null);
          setSelectedCategoryId(null);
          setCategories([]);
          setSubcategories([]);
        }
      } else if (level === "category") {
        await adminResources.categories.remove(row.id);
        toast.success("Category deleted");
        if (selectedSegmentId) await loadCategories(selectedSegmentId);
        if (selectedCategoryId === row.id) {
          setSelectedCategoryId(null);
          setSubcategories([]);
        }
      } else {
        await adminResources.subcategories.remove(row.id);
        toast.success("Subcategory deleted");
        if (selectedCategoryId) await loadSubcategories(selectedCategoryId);
      }
    } catch (err) {
      // Backend returns 409 with a message like "Cannot delete category: 3 subcategories still belong to it."
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = modalLevel === "segment" ? "segment" : modalLevel === "category" ? "category" : "subcategory";

  return (
    <AdminLayout title="Catalog Structure" onReload={loadSegments}>
      <HelpAnchor>
        <HelpPanel title="Segment → Category → Subcategory">
          <p style={{ margin: 0 }}>
            Every product belongs to exactly one Subcategory, which fixes its Category and Segment.
            Pick a Segment to see its Categories, then a Category to see its Subcategories. A level
            can't be deleted while it still has children or products attached — reassign or remove
            those first.
          </p>
        </HelpPanel>

        <div className="admin-page-stack">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            {/* Segments */}
            <div className="admin-panel" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15 }}>Segments</h2>
                <button className="admin-btn admin-btn-primary" onClick={() => beginCreate("segment")}>New</button>
              </div>
              {loadingSegments ? (
                <div className="admin-empty">Loading…</div>
              ) : segments.length === 0 ? (
                <div className="admin-empty">No segments yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {segments.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => selectSegment(s.id)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                        background: selectedSegmentId === s.id ? "var(--admin-accent-soft, rgba(0,0,0,0.06))" : "transparent",
                        border: "1px solid var(--admin-border)",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button className="admin-btn admin-btn-ghost" onClick={(e) => { e.stopPropagation(); beginEdit("segment", s); }}><Pencil size={12} /></button>
                        {isAdmin && (
                          <button className="admin-btn admin-btn-danger" disabled={saving} onClick={(e) => { e.stopPropagation(); void remove("segment", s); }}><Trash2 size={12} /></button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Categories */}
            <div className="admin-panel" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15 }}>Categories</h2>
                <button className="admin-btn admin-btn-primary" disabled={!selectedSegmentId} onClick={() => beginCreate("category")}>New</button>
              </div>
              {!selectedSegmentId ? (
                <div className="admin-empty">Select a segment.</div>
              ) : loadingCategories ? (
                <div className="admin-empty">Loading…</div>
              ) : categories.length === 0 ? (
                <div className="admin-empty">No categories yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {categories.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => selectCategory(c.id)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                        background: selectedCategoryId === c.id ? "var(--admin-accent-soft, rgba(0,0,0,0.06))" : "transparent",
                        border: "1px solid var(--admin-border)",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button className="admin-btn admin-btn-ghost" onClick={(e) => { e.stopPropagation(); beginEdit("category", c); }}><Pencil size={12} /></button>
                        {isAdmin && (
                          <button className="admin-btn admin-btn-danger" disabled={saving} onClick={(e) => { e.stopPropagation(); void remove("category", c); }}><Trash2 size={12} /></button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Subcategories */}
            <div className="admin-panel" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15 }}>Subcategories</h2>
                <button className="admin-btn admin-btn-primary" disabled={!selectedCategoryId} onClick={() => beginCreate("subcategory")}>New</button>
              </div>
              {!selectedCategoryId ? (
                <div className="admin-empty">Select a category.</div>
              ) : loadingSubcategories ? (
                <div className="admin-empty">Loading…</div>
              ) : subcategories.length === 0 ? (
                <div className="admin-empty">No subcategories yet.</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {subcategories.map((sc) => (
                    <div
                      key={sc.id}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 10px", borderRadius: 8,
                        border: "1px solid var(--admin-border)",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{sc.name}</span>
                      <span style={{ display: "flex", gap: 4 }}>
                        <button className="admin-btn admin-btn-ghost" onClick={() => beginEdit("subcategory", sc)}><Pencil size={12} /></button>
                        {isAdmin && (
                          <button className="admin-btn admin-btn-danger" disabled={saving} onClick={() => void remove("subcategory", sc)}><Trash2 size={12} /></button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </HelpAnchor>

      {modalLevel && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={save}>
            <div className="admin-toolbar">
              <h2>{editing ? `Edit ${modalTitle}` : `Create ${modalTitle}`}</h2>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={closeModal}>Close</button>
            </div>
            <div className="admin-form-grid">
              <label>
                <span className="admin-label">Name</span>
                <input required className="admin-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </label>
              <label>
                <span className="admin-label">Sort order</span>
                <input type="number" className="admin-input" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
              </label>
              <label style={{ gridColumn: "1/-1" }}>
                <span className="admin-label">Description</span>
                <textarea className="admin-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>
            <div className="admin-toolbar">
              <button className="admin-btn admin-btn-primary" disabled={saving}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminCatalogPage;
