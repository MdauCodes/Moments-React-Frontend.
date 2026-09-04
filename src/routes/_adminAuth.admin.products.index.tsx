import { useNavigate } from "react-router-dom";

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, Pencil, Rows3, Search, Trash2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources, type IndustryDto, type ProductDto } from "@/services/adminResources";
import { CATEGORY_OPTIONS } from "@/data/categoryOptions";
import { QuickEditProductModal } from "@/components/admin/QuickEditProductModal";



function AdminProductsPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [industries, setIndustries] = useState<IndustryDto[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ industryId: "", category: "", isDiscount: "", isNewArrival: "", isFastMoving: "" });
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [view, setView] = useState<"table" | "cards">("table");
  const [jumpTo, setJumpTo] = useState("");
  const [quickEditId, setQuickEditId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = async () => {
    setLoading(true);
    try {
      const [productPage, industryRows] = await Promise.all([
        adminResources.products.list({ ...filters, q: debouncedQ || undefined, page, size: 10, sort: "createdAt,desc" }),
        adminResources.industries.list(),
      ]);
      setProducts(productPage.rows);
      setTotalPages(productPage.totalPages);
      setIndustries(industryRows);
    } catch (err) {
      reportAdminError(err, "Failed to load products");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [page, filters.industryId, filters.category, filters.isDiscount, filters.isNewArrival, filters.isFastMoving, debouncedQ]);

  // Search/filters now run server-side (GET /api/v1/admin/products); this is a light client-side
  // pass over the already-filtered page as a redundant safety net, not the primary filter.
  const visibleProducts = useMemo(() => {
    let rows = products;
    if (debouncedQ) {
      rows = rows.filter((p) =>
        [p.name, p.sku, p.category, p.description]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(debouncedQ)),
      );
    }
    if (filters.category) {
      rows = rows.filter((p) => (p.category ?? "").toLowerCase().includes(filters.category.toLowerCase()));
    }
    if (filters.industryId) {
      rows = rows.filter((p) => (p.industryIds ?? []).includes(filters.industryId));
    }
    if (filters.isDiscount) rows = rows.filter((p) => p.isDiscount);
    if (filters.isNewArrival) rows = rows.filter((p) => p.isNewArrival);
    if (filters.isFastMoving) rows = rows.filter((p) => p.isFastMoving);
    return rows;
  }, [products, debouncedQ, filters]);

  const getStockDisplay = (p: ProductDto) => {
    const ss = (p as any).stockStatus ?? "MADE_TO_ORDER";
    // Backend ProductDto only ever sends `stockCount` — `stock` is a stale
    // alias in the TS type that the API never actually populates, so reading
    // it always silently fell back to 0 regardless of real inventory.
    const stockCount = p.stockCount ?? 0;
    const tone =
      ss === "MADE_TO_ORDER" ? "var(--admin-muted)"
        : ss === "OUT_OF_STOCK" ? "#b91c1c"
        : ss === "LOW_STOCK" ? "#a16207"
        : "#15803d";
    const text =
      ss === "MADE_TO_ORDER" ? "Made to order"
        : ss === "OUT_OF_STOCK" ? "Out of stock"
        : ss === "LOW_STOCK" ? `${stockCount.toLocaleString()} ⚠ Low`
        : `${stockCount.toLocaleString()} units`;
    return { tone, text };
  };

  const beginCreate = () => navigate("/admin/products/new");
  const beginEdit = (p: ProductDto) => navigate(`/admin/products/${p.id}`);
  const remove = async (p: ProductDto) => {
    if (!isAdmin || !confirm(`Delete ${p.name}?`)) return;
    setSaving(true);
    try {
      await adminResources.products.remove(p.id);
      toast.success("Product deleted");
      await load();
    } catch (err) {
      reportAdminError(err, "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Products" actionLabel="New product" onAction={beginCreate} onReload={load}>
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
              <button
                type="button"
                onClick={() => { setQ(""); setPage(0); }}
                aria-label="Clear search"
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, cursor: "pointer", color: "var(--admin-muted)" }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <select
            className="admin-select"
            style={{ maxWidth: 220 }}
            value={filters.industryId}
            onChange={(e) => {
              setPage(0);
              setFilters({ ...filters, industryId: e.target.value });
            }}
          >
            <option value="">All industries</option>
            {industries.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <select
            className="admin-select"
            style={{ maxWidth: 200 }}
            value={filters.category}
            onChange={(e) => {
              setPage(0);
              setFilters({ ...filters, category: e.target.value });
            }}
          >
            <option value="">All categories</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {(["isDiscount", "isNewArrival", "isFastMoving"] as const).map((key) => (
            <button
              key={key}
              className={`admin-btn ${filters[key] ? "admin-btn-primary" : "admin-btn-ghost"}`}
              onClick={() => {
                setPage(0);
                setFilters({ ...filters, [key]: filters[key] ? "" : "true" });
              }}
            >
              {key.replace("is", "")}
            </button>
          ))}
          {(q || filters.industryId || filters.category || filters.isDiscount || filters.isNewArrival || filters.isFastMoving) && (
            <button
              className="admin-btn admin-btn-ghost"
              onClick={() => {
                setQ("");
                setPage(0);
                setFilters({ industryId: "", category: "", isDiscount: "", isNewArrival: "", isFastMoving: "" });
              }}
            >
              Clear
            </button>
          )}
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            <button
              type="button"
              className={`admin-btn ${view === "table" ? "admin-btn-primary" : "admin-btn-ghost"}`}
              onClick={() => setView("table")}
              aria-label="Table view"
            >
              <Rows3 size={14} />
            </button>
            <button
              type="button"
              className={`admin-btn ${view === "cards" ? "admin-btn-primary" : "admin-btn-ghost"}`}
              onClick={() => setView("cards")}
              aria-label="Card view"
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="admin-panel" style={{ padding: 24 }}>
            <div className="admin-empty">Loading products…</div>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="admin-panel" style={{ padding: 24 }}>
            <div className="admin-empty">
              No products found.{" "}
              <button className="admin-btn admin-btn-primary" onClick={beginCreate}>
                Create product
              </button>
            </div>
          </div>
        ) : view === "table" ? (
          <div className="admin-panel" data-admin-table-scroll>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Price (KES)</th>
                  <th>Stock</th>
                  <th>Category</th>
                  <th>Flags</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((p) => {
                  const { tone: stockTone, text: stockText } = getStockDisplay(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {(p.primaryImageUrl || p.imageUrls?.[0]) && (
                            <img
                              src={p.primaryImageUrl || p.imageUrls?.[0]}
                              alt=""
                              style={{ width: 44, height: 38, objectFit: "cover", borderRadius: 6 }}
                            />
                          )}
                          <b>{p.name}</b>
                        </div>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.sku || "—"}</td>
                      <td>{p.basePrice != null ? p.basePrice.toLocaleString() : "—"}</td>
                      <td style={{ color: stockTone, fontWeight: 600 }}>{stockText}</td>
                      <td>{p.category || "—"}</td>
                      <td>
                        {[p.isDiscount && "Discount", p.isNewArrival && "New", p.isFastMoving && "Fast"]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </td>
                      <td>
                        <button
                          className="admin-btn admin-btn-ghost"
                          onClick={() => setQuickEditId(p.id)}
                          title="Edit price, UOM, and photo without leaving this page"
                        >
                          <Zap size={14} />
                          Quick edit
                        </button>
                        <button className="admin-btn admin-btn-ghost" onClick={() => beginEdit(p)}>
                          <Pencil size={14} />
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            className="admin-btn admin-btn-danger"
                            disabled={saving}
                            onClick={() => void remove(p)}
                          >
                            <Trash2 size={14} />
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }} data-admin-grid>
            {visibleProducts.map((p) => {
              const { tone: stockTone, text: stockText } = getStockDisplay(p);
              return (
                <div key={p.id} className="admin-panel" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  {(p.primaryImageUrl || p.imageUrls?.[0]) ? (
                    <img
                      src={p.primaryImageUrl || p.imageUrls?.[0]}
                      alt=""
                      style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 8 }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: 130, borderRadius: 8, background: "var(--admin-border)" }} />
                  )}
                  <b style={{ fontSize: 13, lineHeight: 1.3 }}>{p.name}</b>
                  <div style={{ fontSize: 11, color: "var(--admin-muted)", fontFamily: "monospace" }}>{p.sku || "—"}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span>{p.basePrice != null ? `KES ${p.basePrice.toLocaleString()}` : "—"}</span>
                    <span style={{ color: stockTone, fontWeight: 600 }}>{stockText}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>{p.category || "—"}</div>
                  {[p.isDiscount && "Discount", p.isNewArrival && "New", p.isFastMoving && "Fast"].filter(Boolean).length > 0 && (
                    <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                      {[p.isDiscount && "Discount", p.isNewArrival && "New", p.isFastMoving && "Fast"].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
                    <button
                      className="admin-btn admin-btn-ghost"
                      style={{ flex: 1 }}
                      onClick={() => setQuickEditId(p.id)}
                      title="Edit price, UOM, and photo without leaving this page"
                    >
                      <Zap size={14} />
                    </button>
                    <button className="admin-btn admin-btn-ghost" style={{ flex: 1 }} onClick={() => beginEdit(p)}>
                      <Pencil size={14} />
                      Edit
                    </button>
                    {isAdmin && (
                      <button className="admin-btn admin-btn-danger" disabled={saving} onClick={() => void remove(p)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="admin-toolbar">
          <button
            className="admin-btn admin-btn-ghost"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="admin-label">
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="admin-btn admin-btn-ghost"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
          {totalPages > 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number(jumpTo);
                if (!Number.isFinite(n)) return;
                const clamped = Math.min(Math.max(Math.trunc(n), 1), totalPages);
                setPage(clamped - 1);
                setJumpTo("");
              }}
              style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}
            >
              <label htmlFor="products-jump-to-page" className="admin-label">
                Go to page
              </label>
              <input
                id="products-jump-to-page"
                type="number"
                min={1}
                max={totalPages}
                placeholder={String(page + 1)}
                className="admin-input"
                style={{ width: 64 }}
                value={jumpTo}
                onChange={(e) => setJumpTo(e.target.value)}
              />
              <button type="submit" className="admin-btn admin-btn-ghost" disabled={!jumpTo}>
                Go
              </button>
            </form>
          )}
        </div>
      </div>
      {quickEditId && (
        <QuickEditProductModal
          productId={quickEditId}
          onClose={() => setQuickEditId(null)}
          onSaved={() => void load()}
        />
      )}
    </AdminLayout>
  );
}

export default AdminProductsPage;
