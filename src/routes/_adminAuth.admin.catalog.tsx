import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import { ApiError } from "@/services/adminApi";
import {
  adminResources,
  type SegmentDto,
  type CategoryDto,
  type SubcategoryDto,
  type IndustryDto,
} from "@/services/adminResources";

type Level = "segment" | "category" | "subcategory";
type LevelRow = SegmentDto | CategoryDto | SubcategoryDto;
/** Which of the two root branches is expanded — mutually exclusive, both start collapsed. */
type RootBranch = "segments" | "industries" | null;

const emptyForm = { name: "", description: "", sortOrder: "", industryIds: [] as string[] };
const emptyIndustryForm = { name: "", description: "", iconUrl: "" };

function CollapsibleHeader({
  label,
  open,
  onClick,
  count,
}: {
  label: string;
  open: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "12px 14px", background: "transparent", border: 0, cursor: "pointer",
        fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600, textAlign: "left",
      }}
    >
      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      {label}
      {count !== undefined && (
        <span style={{ fontSize: 12, fontWeight: 400, color: "var(--admin-muted)" }}>({count})</span>
      )}
    </button>
  );
}

function AdminCatalogPage() {
  const { isAdmin } = useAuth();

  // ---- Root-level accordion: Segments vs Industries, both collapsed by default ----
  const [openRoot, setOpenRoot] = useState<RootBranch>(null);
  const toggleRoot = (branch: "segments" | "industries") => {
    setOpenRoot((prev) => (prev === branch ? null : branch));
  };

  // ---- Segment -> Category -> Subcategory branch ----
  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryDto[]>([]);
  const [industries, setIndustries] = useState<IndustryDto[]>([]);
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const [modalLevel, setModalLevel] = useState<Level | null>(null);
  const [editing, setEditing] = useState<LevelRow | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Set when a delete hits the backend's 409 "still has children" guard —
  // drives the "delete everything under it, or move them elsewhere first?"
  // resolution modal instead of just failing with a toast.
  const [pendingDelete, setPendingDelete] = useState<{ level: Level; row: LevelRow; message: string } | null>(null);
  const [reassignTo, setReassignTo] = useState("");
  const [siblingOptions, setSiblingOptions] = useState<LevelRow[]>([]);
  const [loadingSiblings, setLoadingSiblings] = useState(false);

  const loadSegments = async () => {
    setLoadingSegments(true);
    try {
      setSegments(await adminResources.segments.list());
    } catch (err) {
      reportAdminError(err, "Failed to load segments");
    } finally {
      setLoadingSegments(false);
    }
  };

  const loadCategories = async (segmentId: string) => {
    setLoadingCategories(true);
    try {
      setCategories(await adminResources.categories.list(segmentId));
    } catch (err) {
      reportAdminError(err, "Failed to load categories");
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadSubcategories = async (categoryId: string) => {
    setLoadingSubcategories(true);
    try {
      setSubcategories(await adminResources.subcategories.list(categoryId));
    } catch (err) {
      reportAdminError(err, "Failed to load subcategories");
    } finally {
      setLoadingSubcategories(false);
    }
  };

  const loadIndustries = async () => {
    try {
      setIndustries(await adminResources.industries.list());
    } catch {
      // Non-fatal here — only blocks the industry-tag checkboxes on seg/cat/subcat
      // forms and the Industries branch below, both of which show their own empty states.
    }
  };

  useEffect(() => {
    void loadSegments();
    void loadIndustries();
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
      industryIds:
        level === "category" ? ((row as CategoryDto).industryIds ?? [])
        : level === "subcategory" ? ((row as SubcategoryDto).industryIds ?? [])
        : [],
    });
    setModalLevel(level);
  };

  const toggleFormIndustry = (industryId: string) => {
    setForm((f) => ({
      ...f,
      industryIds: f.industryIds.includes(industryId)
        ? f.industryIds.filter((id) => id !== industryId)
        : [...f.industryIds, industryId],
    }));
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
        const categoryBody = { ...body, segmentId: selectedSegmentId, industryIds: form.industryIds };
        editing ? await adminResources.categories.update(editing.id, categoryBody) : await adminResources.categories.create(categoryBody as { segmentId: string; name: string; description?: string; sortOrder?: number; industryIds?: string[] });
        toast.success(editing ? "Category updated" : "Category created");
        await loadCategories(selectedSegmentId);
      } else {
        if (!selectedCategoryId) return;
        const subcategoryBody = { ...body, categoryId: selectedCategoryId, industryIds: form.industryIds };
        editing
          ? await adminResources.subcategories.update(editing.id, subcategoryBody)
          : await adminResources.subcategories.create(subcategoryBody as { categoryId: string; name: string; description?: string; sortOrder?: number; industryIds?: string[] });
        toast.success(editing ? "Subcategory updated" : "Subcategory created");
        await loadSubcategories(selectedCategoryId);
      }
      closeModal();
    } catch (err) {
      reportAdminError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const afterDelete = async (level: Level, row: LevelRow) => {
    if (level === "segment") {
      toast.success("Segment deleted");
      await loadSegments();
      if (selectedSegmentId === row.id) {
        setSelectedSegmentId(null);
        setSelectedCategoryId(null);
        setCategories([]);
        setSubcategories([]);
      }
    } else if (level === "category") {
      toast.success("Category deleted");
      if (selectedSegmentId) await loadCategories(selectedSegmentId);
      if (selectedCategoryId === row.id) {
        setSelectedCategoryId(null);
        setSubcategories([]);
      }
    } else {
      toast.success("Subcategory deleted");
      if (selectedCategoryId) await loadSubcategories(selectedCategoryId);
    }
  };

  // Plain delete attempt. Empty rows (no children) succeed immediately.
  // A 409 means children are still attached — instead of just failing, open
  // the resolution modal so the admin can choose to move them elsewhere or
  // delete the whole (empty-of-products) subtree in one go.
  const remove = async (level: Level, row: LevelRow) => {
    if (!isAdmin || !confirm(`Delete "${row.name}"?`)) return;
    setSaving(true);
    try {
      if (level === "segment") await adminResources.segments.remove(row.id);
      else if (level === "category") await adminResources.categories.remove(row.id);
      else await adminResources.subcategories.remove(row.id);
      await afterDelete(level, row);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setPendingDelete({ level, row, message: err.message });
        setReassignTo("");
        void loadSiblings(level, row.id);
        return;
      }
      reportAdminError(err, "Delete failed");
      // 404 means the row was already deleted elsewhere (another tab, another
      // admin) and this page's list is just stale — refresh so the ghost row
      // clears instead of sitting there forever confusing whoever's looking at it.
      if (err instanceof ApiError && err.status === 404) {
        if (level === "segment") await loadSegments();
        else if (level === "category" && selectedSegmentId) await loadCategories(selectedSegmentId);
        else if (level === "subcategory" && selectedCategoryId) await loadSubcategories(selectedCategoryId);
      }
    } finally {
      setSaving(false);
    }
  };

  const loadSiblings = async (level: Level, excludeId: string) => {
    setLoadingSiblings(true);
    try {
      const all =
        level === "segment" ? await adminResources.segments.list()
        : level === "category" ? await adminResources.categories.list()
        : await adminResources.subcategories.list();
      setSiblingOptions(all.filter((s) => s.id !== excludeId));
    } catch {
      setSiblingOptions([]);
    } finally {
      setLoadingSiblings(false);
    }
  };

  const closePendingDelete = () => {
    setPendingDelete(null);
    setReassignTo("");
    setSiblingOptions([]);
  };

  // Second attempt, now with the admin's choice: either move the children
  // onto another row of the same level (reassignTo), or delete the whole
  // subtree along with it (cascade). Products are never deleted by either
  // path — cascade unassigns them (subcategory set to null) rather than
  // taking them down with their parent.
  const resolveDelete = async (mode: "reassign" | "cascade") => {
    if (!pendingDelete) return;
    const { level, row } = pendingDelete;
    if (mode === "reassign" && !reassignTo) return;
    const opts = mode === "reassign" ? { reassignTo } : { cascade: true };
    setSaving(true);
    try {
      if (level === "segment") await adminResources.segments.remove(row.id, opts);
      else if (level === "category") await adminResources.categories.remove(row.id, opts);
      else await adminResources.subcategories.remove(row.id, opts);
      await afterDelete(level, row);
      closePendingDelete();
    } catch (err) {
      reportAdminError(err, "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = modalLevel === "segment" ? "segment" : modalLevel === "category" ? "category" : "subcategory";

  const childNoun = (level: Level) =>
    level === "segment" ? "categories" : level === "category" ? "subcategories" : "products";

  const siblingLabel = (level: Level, row: LevelRow): string => {
    if (level === "category") {
      const c = row as CategoryDto;
      return c.segmentName ? `${c.segmentName} › ${c.name}` : c.name;
    }
    if (level === "subcategory") {
      const sc = row as SubcategoryDto;
      const breadcrumb = [sc.segmentName, sc.categoryName].filter(Boolean).join(" › ");
      return breadcrumb ? `${breadcrumb} › ${sc.name}` : sc.name;
    }
    return row.name;
  };

  // ---- Industries branch ----
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(null);
  const [industryModalOpen, setIndustryModalOpen] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<IndustryDto | null>(null);
  const [industryForm, setIndustryForm] = useState(emptyIndustryForm);
  const [industrySaving, setIndustrySaving] = useState(false);

  // All categories/subcategories (unscoped by segment) — needed for the linking
  // checklists below, loaded once an industry is actually selected.
  const [allCategories, setAllCategories] = useState<CategoryDto[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<SubcategoryDto[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [checkedCategoryIds, setCheckedCategoryIds] = useState<Set<string>>(new Set());
  const [checkedSubcategoryIds, setCheckedSubcategoryIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subcategoryFilter, setSubcategoryFilter] = useState("");
  const [linksSaving, setLinksSaving] = useState(false);
  // Categories checklist collapsed by default (like the Segments branch's categories
  // column) — Subcategories has no such toggle, always visible once an industry is picked.
  const [industryCategoriesOpen, setIndustryCategoriesOpen] = useState(false);

  const selectIndustry = async (industry: IndustryDto) => {
    setSelectedIndustryId(industry.id);
    setIndustryCategoriesOpen(false);
    setCategoryFilter("");
    setSubcategoryFilter("");
    setLinksLoading(true);
    try {
      const [cats, subs] = await Promise.all([
        adminResources.categories.list(),
        adminResources.subcategories.list(),
      ]);
      setAllCategories(cats);
      setAllSubcategories(subs);
      setCheckedCategoryIds(new Set(cats.filter((c) => c.industryIds?.includes(industry.id)).map((c) => c.id)));
      setCheckedSubcategoryIds(new Set(subs.filter((sc) => sc.industryIds?.includes(industry.id)).map((sc) => sc.id)));
    } catch (err) {
      reportAdminError(err, "Failed to load categories/subcategories");
    } finally {
      setLinksLoading(false);
    }
  };

  const toggleLinkCategory = (id: string) => {
    setCheckedCategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleLinkSubcategory = (id: string) => {
    setCheckedSubcategoryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const beginCreateIndustry = () => {
    setEditingIndustry(null);
    setIndustryForm(emptyIndustryForm);
    setIndustryModalOpen(true);
  };

  const beginEditIndustry = (industry: IndustryDto) => {
    setEditingIndustry(industry);
    setIndustryForm({ name: industry.name, description: industry.description ?? "", iconUrl: industry.iconUrl ?? "" });
    setIndustryModalOpen(true);
  };

  const saveIndustry = async (e: FormEvent) => {
    e.preventDefault();
    setIndustrySaving(true);
    try {
      editingIndustry
        ? await adminResources.industries.update(editingIndustry.id, industryForm)
        : await adminResources.industries.create(industryForm);
      toast.success(editingIndustry ? "Industry updated" : "Industry created");
      setIndustryModalOpen(false);
      await loadIndustries();
    } catch (err) {
      reportAdminError(err, "Save failed");
    } finally {
      setIndustrySaving(false);
    }
  };

  const removeIndustry = async (industry: IndustryDto) => {
    if (!isAdmin || !confirm(`Delete "${industry.name}"?`)) return;
    setIndustrySaving(true);
    try {
      await adminResources.industries.remove(industry.id);
      toast.success("Industry deleted");
      if (selectedIndustryId === industry.id) setSelectedIndustryId(null);
      await loadIndustries();
    } catch (err) {
      reportAdminError(err, "Delete failed");
    } finally {
      setIndustrySaving(false);
    }
  };

  // Only pushes updates for rows whose membership actually changed — adds/removes just
  // this industry's id from each row's existing industryIds list, never overwrites the
  // whole list (other industries may already be linked to the same category/subcategory).
  const saveLinks = async () => {
    if (!selectedIndustryId) return;
    setLinksSaving(true);
    try {
      const categoryUpdates = allCategories
        .filter((c) => (c.industryIds ?? []).includes(selectedIndustryId) !== checkedCategoryIds.has(c.id))
        .map((c) => {
          const current = new Set(c.industryIds ?? []);
          checkedCategoryIds.has(c.id) ? current.add(selectedIndustryId) : current.delete(selectedIndustryId);
          // Category's update DTO reuses the create shape, which requires segmentId/name
          // even on a partial update — send its current values, not just the changed field.
          return adminResources.categories.update(c.id, {
            segmentId: c.segmentId, name: c.name, description: c.description,
            sortOrder: c.sortOrder, industryIds: Array.from(current),
          });
        });
      const subcategoryUpdates = allSubcategories
        .filter((sc) => (sc.industryIds ?? []).includes(selectedIndustryId) !== checkedSubcategoryIds.has(sc.id))
        .map((sc) => {
          const current = new Set(sc.industryIds ?? []);
          checkedSubcategoryIds.has(sc.id) ? current.add(selectedIndustryId) : current.delete(selectedIndustryId);
          return adminResources.subcategories.update(sc.id, {
            categoryId: sc.categoryId, name: sc.name, description: sc.description,
            sortOrder: sc.sortOrder, industryIds: Array.from(current),
          });
        });
      await Promise.all([...categoryUpdates, ...subcategoryUpdates]);
      toast.success("Industry classifications updated");
    } catch (err) {
      reportAdminError(err, "Save failed");
    } finally {
      setLinksSaving(false);
    }
  };

  const filteredLinkCategories = useMemo(
    () => allCategories.filter((c) => c.name.toLowerCase().includes(categoryFilter.toLowerCase())),
    [allCategories, categoryFilter],
  );
  const filteredLinkSubcategories = useMemo(
    () => allSubcategories.filter((sc) =>
      sc.name.toLowerCase().includes(subcategoryFilter.toLowerCase())
      || (sc.categoryName ?? "").toLowerCase().includes(subcategoryFilter.toLowerCase())),
    [allSubcategories, subcategoryFilter],
  );

  return (
    <AdminLayout title="Classifications" onReload={loadSegments}>
      <HelpAnchor>
        <HelpPanel title="Segments, Categories, Subcategories & Industries — one place">
          <p style={{ margin: 0 }}>
            Every product belongs to exactly one Subcategory, which fixes its Category and Segment.
            A Category or Subcategory can <em>also</em> be tagged to one or more Industries — that's
            the connection this page is built around: drill down by Segment, or work industry-first
            below. Only one of the two is open at a time to keep things compact.
          </p>
        </HelpPanel>

        <div className="admin-page-stack">
          {/* ── Segments root branch ── */}
          <div className="admin-panel">
            <CollapsibleHeader
              label="Segments"
              open={openRoot === "segments"}
              onClick={() => toggleRoot("segments")}
              count={segments.length}
            />
            {openRoot === "segments" && (
              <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }} data-admin-grid>
                {/* Segments */}
                <div>
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

                {/* Categories — hidden until a segment is picked, same as before */}
                <div>
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
                          <span>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</span>
                            {c.industryNames && c.industryNames.length > 0 && (
                              <span style={{ display: "block", fontSize: 11, color: "var(--admin-muted)", marginTop: 2 }}>
                                {c.industryNames.join(", ")}
                              </span>
                            )}
                          </span>
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

                {/* Subcategories — always visible once a category is picked, never collapsed */}
                <div>
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
                          <span>
                            <span style={{ fontWeight: 600, fontSize: 13 }}>{sc.name}</span>
                            {sc.industryNames && sc.industryNames.length > 0 && (
                              <span style={{ display: "block", fontSize: 11, color: "var(--admin-muted)", marginTop: 2 }}>
                                {sc.industryNames.join(", ")}
                              </span>
                            )}
                          </span>
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
            )}
          </div>

          {/* ── Industries root branch ── */}
          <div className="admin-panel">
            <CollapsibleHeader
              label="Industries"
              open={openRoot === "industries"}
              onClick={() => toggleRoot("industries")}
              count={industries.length}
            />
            {openRoot === "industries" && (
              <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "minmax(220px, 320px) 1fr", gap: 14 }} data-admin-grid>
                {/* Industries list */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15 }}>Industries</h2>
                    <button className="admin-btn admin-btn-primary" onClick={beginCreateIndustry}>New</button>
                  </div>
                  {industries.length === 0 ? (
                    <div className="admin-empty">No industries yet.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 6 }}>
                      {industries.map((ind) => (
                        <div
                          key={ind.id}
                          onClick={() => void selectIndustry(ind)}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                            background: selectedIndustryId === ind.id ? "var(--admin-accent-soft, rgba(0,0,0,0.06))" : "transparent",
                            border: "1px solid var(--admin-border)",
                          }}
                        >
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{ind.name}</span>
                          <span style={{ display: "flex", gap: 4 }}>
                            <button className="admin-btn admin-btn-ghost" onClick={(e) => { e.stopPropagation(); beginEditIndustry(ind); }}><Pencil size={12} /></button>
                            {isAdmin && (
                              <button className="admin-btn admin-btn-danger" disabled={industrySaving} onClick={(e) => { e.stopPropagation(); void removeIndustry(ind); }}><Trash2 size={12} /></button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Linking panel for the selected industry */}
                <div>
                  {!selectedIndustryId ? (
                    <div className="admin-empty">Select an industry to add categories and subcategories to it.</div>
                  ) : (
                    <div style={{ display: "grid", gap: 14 }}>
                      {/* Categories in this industry — collapsed by default */}
                      <div style={{ border: "1px solid var(--admin-border)", borderRadius: 8 }}>
                        <CollapsibleHeader
                          label="Categories in this industry"
                          open={industryCategoriesOpen}
                          onClick={() => setIndustryCategoriesOpen((v) => !v)}
                          count={checkedCategoryIds.size}
                        />
                        {industryCategoriesOpen && (
                          <div style={{ padding: "0 14px 14px" }}>
                            <input
                              className="admin-input" placeholder="Search categories…" style={{ marginBottom: 6 }}
                              value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                            />
                            <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--admin-border)", borderRadius: 8, padding: 8 }}>
                              {linksLoading ? (
                                <div style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>Loading…</div>
                              ) : filteredLinkCategories.length === 0 ? (
                                <div style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>No categories match.</div>
                              ) : (
                                filteredLinkCategories.map((c) => (
                                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", fontSize: 13 }}>
                                    <input type="checkbox" checked={checkedCategoryIds.has(c.id)} onChange={() => toggleLinkCategory(c.id)} />
                                    {c.name}
                                    <span style={{ color: "var(--admin-muted)", fontSize: 11 }}>{c.segmentName}</span>
                                  </label>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Subcategories in this industry — always visible, never collapsed */}
                      <div>
                        <span className="admin-label">Subcategories in this industry</span>
                        <input
                          className="admin-input" placeholder="Search subcategories…" style={{ marginTop: 4, marginBottom: 6 }}
                          value={subcategoryFilter} onChange={(e) => setSubcategoryFilter(e.target.value)}
                        />
                        <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--admin-border)", borderRadius: 8, padding: 8 }}>
                          {linksLoading ? (
                            <div style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>Loading…</div>
                          ) : filteredLinkSubcategories.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>No subcategories match.</div>
                          ) : (
                            filteredLinkSubcategories.map((sc) => (
                              <label key={sc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 2px", fontSize: 13 }}>
                                <input type="checkbox" checked={checkedSubcategoryIds.has(sc.id)} onChange={() => toggleLinkSubcategory(sc.id)} />
                                {sc.name}
                                <span style={{ color: "var(--admin-muted)", fontSize: 11 }}>{sc.categoryName}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <button className="admin-btn admin-btn-primary" disabled={linksSaving || linksLoading} onClick={() => void saveLinks()}>
                          {linksSaving && <Loader2 size={14} className="animate-spin" />}
                          Save classifications
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </HelpAnchor>

      {/* Segment/Category/Subcategory create-edit modal */}
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
              {(modalLevel === "category" || modalLevel === "subcategory") && (
                <div style={{ gridColumn: "1/-1" }}>
                  <span className="admin-label">
                    {modalLevel === "category"
                      ? "Industries — drives the homepage industry tiles: clicking one filters products AND this category list to just what's tagged here"
                      : "Industries — tag this subcategory directly, independent of its category's own industry tags (it already inherits those too)"}
                  </span>
                  {industries.length === 0 ? (
                    <p style={{ fontSize: 12.5, color: "var(--admin-muted)", margin: "4px 0 0" }}>
                      No industries created yet — add one in the Industries section above first.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {industries.map((ind) => {
                        const checked = form.industryIds.includes(ind.id);
                        return (
                          <label
                            key={ind.id}
                            style={{
                              display: "flex", alignItems: "center", gap: 6,
                              padding: "6px 10px", borderRadius: 999, cursor: "pointer",
                              border: `1px solid ${checked ? "var(--admin-accent)" : "var(--admin-border)"}`,
                              background: checked ? "var(--admin-accent-soft, rgba(0,0,0,0.06))" : "transparent",
                              fontSize: 12.5,
                            }}
                          >
                            <input type="checkbox" checked={checked} onChange={() => toggleFormIndustry(ind.id)} style={{ margin: 0 }} />
                            {ind.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
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

      {/* Industry create/edit modal — name/description/icon only; category & subcategory
          linking happens inline in the branch above, not here, so it's always one click
          away instead of hidden behind "edit industry". */}
      {industryModalOpen && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={saveIndustry}>
            <div className="admin-toolbar">
              <h2>{editingIndustry ? "Edit industry" : "Create industry"}</h2>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setIndustryModalOpen(false)}>Close</button>
            </div>
            <div className="admin-form-grid">
              <label>
                <span className="admin-label">Name</span>
                <input required className="admin-input" value={industryForm.name} onChange={(e) => setIndustryForm({ ...industryForm, name: e.target.value })} />
              </label>
              <label>
                <span className="admin-label">Icon URL</span>
                <input className="admin-input" value={industryForm.iconUrl} onChange={(e) => setIndustryForm({ ...industryForm, iconUrl: e.target.value })} />
              </label>
              <label style={{ gridColumn: "1/-1" }}>
                <span className="admin-label">Description</span>
                <textarea className="admin-textarea" value={industryForm.description} onChange={(e) => setIndustryForm({ ...industryForm, description: e.target.value })} />
              </label>
            </div>
            <div className="admin-toolbar">
              <button className="admin-btn admin-btn-primary" disabled={industrySaving}>
                {industrySaving && <Loader2 size={14} className="animate-spin" />}
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {pendingDelete && (
        <div className="admin-modal-backdrop">
          <div className="admin-modal">
            <div className="admin-toolbar">
              <h2>Can&apos;t delete &quot;{pendingDelete.row.name}&quot; yet</h2>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={closePendingDelete}>Close</button>
            </div>
            <p style={{ fontSize: 13, color: "var(--admin-muted)", marginTop: 0 }}>{pendingDelete.message}</p>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label>
                <span className="admin-label">
                  Move its {childNoun(pendingDelete.level)} to another {pendingDelete.level}, then delete it
                </span>
                <select
                  className="admin-input"
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  disabled={loadingSiblings}
                >
                  <option value="">{loadingSiblings ? "Loading…" : `Select a ${pendingDelete.level}…`}</option>
                  {siblingOptions.map((s) => (
                    <option key={s.id} value={s.id}>{siblingLabel(pendingDelete.level, s)}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  style={{ marginTop: 8 }}
                  disabled={saving || !reassignTo}
                  onClick={() => void resolveDelete("reassign")}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Move &amp; delete
                </button>
              </label>

              <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 10 }}>
                <p style={{ fontSize: 12.5, color: "var(--admin-muted)", margin: "0 0 8px" }}>
                  {pendingDelete.level === "subcategory"
                    ? "Or delete it anyway — its products are unassigned, not deleted, and can be re-filed to a subcategory later."
                    : `Or delete it and every ${childNoun(pendingDelete.level)} row under it in one go — any products further down are unassigned, not deleted.`}
                </p>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  disabled={saving}
                  onClick={() => void resolveDelete("cascade")}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Delete everything under it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminCatalogPage;
