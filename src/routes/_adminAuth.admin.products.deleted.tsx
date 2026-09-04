import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { adminResources, type ProductDto } from "@/services/adminResources";

/**
 * The one-click undo for anything soft-deleted — most usefully the made-to-order → Riseller
 * replacement job (see admin Dev Tools), which permanently removes products with no confident
 * Riseller match and has no undo of its own beyond this restore path.
 */
function AdminDeletedProductsPage() {
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await adminResources.products.listDeleted({ page, size: 20, sort: "updatedAt,desc" });
      setProducts(result.rows);
      setTotalPages(result.totalPages);
    } catch (err) {
      reportAdminError(err, "Failed to load deleted products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  const restore = async (p: ProductDto) => {
    if (!confirm(`Restore "${p.name}"? It will reappear in the admin product list and, once its stock/status allow, on the storefront.`)) return;
    setRestoringId(p.id);
    try {
      await adminResources.products.restore(p.id);
      toast.success(`"${p.name}" restored`);
      setProducts((prev) => prev.filter((row) => row.id !== p.id));
    } catch (err) {
      reportAdminError(err, "Restore failed");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <AdminLayout title="Deleted products" onReload={load}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 12.5, color: "var(--admin-muted)" }}>
          Soft-deleted products — hidden from the storefront and the main product list, but not
          gone. Restore brings one back exactly as it was when deleted (same image, name, price,
          category). Most of these will come from the made-to-order → Riseller replacement job
          (Dev Tools), which deletes products with no confident Riseller match instead of leaving
          them as unsellable made-to-order listings.
        </div>

        <div className="admin-panel" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Deleted / updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--admin-muted)" }}>Loading…</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--admin-muted)" }}>No deleted products.</td></tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      {p.primaryImageUrl ? (
                        <img src={p.primaryImageUrl} alt={p.name} style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: 6, background: "var(--admin-bg-subtle, #eee)" }} />
                      )}
                    </td>
                    <td>{p.name}</td>
                    <td>{p.categoryName ?? p.category ?? "—"}</td>
                    <td>{p.basePrice != null ? `KES ${p.basePrice.toLocaleString()}` : "—"}</td>
                    <td>{p.updatedAt ? new Date(p.updatedAt).toLocaleString() : "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="admin-btn admin-btn-primary"
                        disabled={restoringId === p.id}
                        onClick={() => void restore(p)}
                      >
                        <RotateCcw size={14} /> Restore
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="admin-toolbar">
          <button className="admin-btn admin-btn-ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </button>
          <span className="admin-label">Page {page + 1} of {totalPages}</span>
          <button className="admin-btn admin-btn-ghost" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminDeletedProductsPage;
