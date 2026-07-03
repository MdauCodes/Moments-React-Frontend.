import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import {
  adminResources,
  type CategoryDto,
  type IndustryDto,
  type ProductDto,
  type SegmentDto,
  type SubcategoryDto,
} from "@/services/adminResources";

function AdminClassifyProductsPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [unclassifiedOnly, setUnclassifiedOnly] = useState(true);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [segments, setSegments] = useState<SegmentDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryDto[]>([]);
  const [industries, setIndustries] = useState<IndustryDto[]>([]);

  const [classifyOpen, setClassifyOpen] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [targetSegmentId, setTargetSegmentId] = useState("");
  const [targetCategoryId, setTargetCategoryId] = useState("");
  const [targetSubcategoryId, setTargetSubcategoryId] = useState("");
  const [targetIndustryIds, setTargetIndustryIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = async () => {
    setLoading(true);
    try {
      const productPage = await adminResources.products.list({ q: debouncedQ || undefined, page, size: 20, sort: "createdAt,desc" });
      setProducts(productPage.rows);
      setTotalPages(productPage.totalPages);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [page, debouncedQ]);

  useEffect(() => {
    adminResources.segments.list().then(setSegments).catch(() => undefined);
    adminResources.industries.list().then(setIndustries).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!targetSegmentId) { setCategories([]); setTargetCategoryId(""); return; }
    adminResources.categories.list(targetSegmentId).then(setCategories).catch(() => undefined);
  }, [targetSegmentId]);

  useEffect(() => {
    if (!targetCategoryId) { setSubcategories([]); setTargetSubcategoryId(""); return; }
    adminResources.subcategories.list(targetCategoryId).then(setSubcategories).catch(() => undefined);
  }, [targetCategoryId]);

  const visibleProducts = useMemo(() => {
    let rows = products;
    if (debouncedQ) {
      rows = rows.filter((p) => [p.name, p.sku, p.category].filter(Boolean).some((v) => String(v).toLowerCase().includes(debouncedQ)));
    }
    if (unclassifiedOnly) rows = rows.filter((p) => !p.subcategoryId);
    return rows;
  }, [products, debouncedQ, unclassifiedOnly]);

  const allVisibleSelected = visibleProducts.length > 0 && visibleProducts.every((p) => selectedIds.has(p.id));

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleProducts.forEach((p) => next.delete(p.id));
      } else {
        visibleProducts.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const toggleIndustry = (id: string) => {
    setTargetIndustryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openClassify = () => {
    setTargetSegmentId(""); setTargetCategoryId(""); setTargetSubcategoryId(""); setTargetIndustryIds(new Set());
    setClassifyOpen(true);
  };

  const submitClassify = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetSubcategoryId && targetIndustryIds.size === 0) {
      toast.error("Pick a subcategory and/or at least one industry");
      return;
    }
    setClassifying(true);
    try {
      const result = await adminResources.products.bulkClassify({
        productIds: Array.from(selectedIds),
        subcategoryId: targetSubcategoryId || undefined,
        industryIds: targetIndustryIds.size > 0 ? Array.from(targetIndustryIds) : undefined,
      });
      toast.success(`Classified ${result.updatedCount} product${result.updatedCount === 1 ? "" : "s"}`);
      setClassifyOpen(false);
      setSelectedIds(new Set());
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk classify failed");
    } finally {
      setClassifying(false);
    }
  };

  return (
    <AdminLayout title="Classify Products" onReload={load}>
      <HelpAnchor>
        <HelpPanel title="Bulk classify">
          <p style={{ margin: 0 }}>
            Select multiple products and assign them all to one Subcategory and/or one set of
            Industries at once. "Unclassified only" shows products still on their legacy category
            string — that's the backlog to work through.
          </p>
        </HelpPanel>

        <div className="admin-page-stack">
          <div className="admin-panel admin-toolbar" data-admin-toolbar>
            <div style={{ position: "relative", flex: "1 1 240px", maxWidth: 320 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--admin-muted)" }} />
              <input
                className="admin-input"
                style={{ width: "100%", paddingLeft: 30, paddingRight: q ? 28 : 12 }}
                placeholder="Search by name, SKU, category…"
                value={q}
                onChange={(e) => { setPage(0); setQ(e.target.value); }}
              />
              {q && (
                <button type="button" onClick={() => { setQ(""); setPage(0); }} aria-label="Clear search"
                  style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, cursor: "pointer", color: "var(--admin-muted)" }}>
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              className={`admin-btn ${unclassifiedOnly ? "admin-btn-primary" : "admin-btn-ghost"}`}
              onClick={() => setUnclassifiedOnly((v) => !v)}
            >
              Unclassified only
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div className="admin-panel" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <span className="admin-label" style={{ margin: 0 }}>{selectedIds.size} product{selectedIds.size === 1 ? "" : "s"} selected</span>
              <span style={{ display: "flex", gap: 8 }}>
                <button className="admin-btn admin-btn-ghost" onClick={() => setSelectedIds(new Set())}>Clear selection</button>
                <button className="admin-btn admin-btn-primary" onClick={openClassify}>Classify selected</button>
              </span>
            </div>
          )}

          <div className="admin-panel" data-admin-table-scroll>
            <table className="admin-table">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} /></th>
                  <th>Product</th>
                  <th>Legacy category</th>
                  <th>Current classification</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4}>Loading products…</td></tr>
                ) : visibleProducts.length === 0 ? (
                  <tr><td colSpan={4}><div className="admin-empty">No products match.</div></td></tr>
                ) : (
                  visibleProducts.map((p) => (
                    <tr key={p.id}>
                      <td><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleOne(p.id)} /></td>
                      <td><b>{p.name}</b></td>
                      <td>{p.category || "—"}</td>
                      <td>
                        {p.subcategoryName ? (
                          <span style={{ fontSize: 12 }}>{p.segmentName} › {p.categoryName} › {p.subcategoryName}</span>
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>Unclassified</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="admin-toolbar">
            <button className="admin-btn admin-btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</button>
            <span className="admin-label">Page {page + 1} of {totalPages}</span>
            <button className="admin-btn admin-btn-ghost" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </div>
      </HelpAnchor>

      {classifyOpen && (
        <div className="admin-modal-backdrop">
          <form className="admin-modal" onSubmit={submitClassify}>
            <div className="admin-toolbar">
              <h2>Classify {selectedIds.size} product{selectedIds.size === 1 ? "" : "s"}</h2>
              <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setClassifyOpen(false)}>Close</button>
            </div>
            <div className="admin-form-grid">
              <label>
                <span className="admin-label">Segment</span>
                <select className="admin-select" value={targetSegmentId} onChange={(e) => setTargetSegmentId(e.target.value)}>
                  <option value="">Select segment…</option>
                  {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label>
                <span className="admin-label">Category</span>
                <select className="admin-select" value={targetCategoryId} disabled={!targetSegmentId} onChange={(e) => setTargetCategoryId(e.target.value)}>
                  <option value="">Select category…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label>
                <span className="admin-label">Subcategory</span>
                <select className="admin-select" value={targetSubcategoryId} disabled={!targetCategoryId} onChange={(e) => setTargetSubcategoryId(e.target.value)}>
                  <option value="">Select subcategory…</option>
                  {subcategories.map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                </select>
              </label>
              <label style={{ gridColumn: "1/-1" }}>
                <span className="admin-label">Industries (optional — leave unchecked to keep unchanged)</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                  {industries.map((i) => (
                    <label key={i.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, border: "1px solid var(--admin-border)", borderRadius: 6, padding: "4px 8px", cursor: "pointer" }}>
                      <input type="checkbox" checked={targetIndustryIds.has(i.id)} onChange={() => toggleIndustry(i.id)} />
                      {i.name}
                    </label>
                  ))}
                </div>
              </label>
            </div>
            <div className="admin-toolbar">
              <button className="admin-btn admin-btn-primary" disabled={classifying}>
                {classifying && <Loader2 size={14} className="animate-spin" />}
                Apply to {selectedIds.size} product{selectedIds.size === 1 ? "" : "s"}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminClassifyProductsPage;
