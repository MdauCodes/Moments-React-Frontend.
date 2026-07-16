import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { ProductEditor, productToFormValues } from "@/components/admin/ProductEditor";
import type { ProductDto } from "@/services/adminResources";
import { updateProductApi, deleteProductApi } from "@/services/adminProductApi";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { can } from "@/lib/permissions";
import { adminJson } from "@/services/adminApi";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAdminAuth();
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    adminJson<ProductDto>(`/api/v1/admin/products/${id}`).then((p) => {
      setProduct(p);
      setLoading(false);
    }).catch(() => navigate("/admin/products", { replace: true }));
  }, [id, navigate, reloadKey]);

  if (loading || !product) {
    return (
      <AdminLayout title="Loading…">
        <div className="animate-pulse space-y-4 p-6">
          <div className="h-8 w-1/3 rounded bg-secondary" />
          <div className="h-64 rounded-xl bg-secondary" />
        </div>
      </AdminLayout>
    );
  }

  if (!can(user?.role, "product:edit")) {
    return <AdminLayout title={`Edit: ${product.name}`}><Forbidden resource="product editing" /></AdminLayout>;
  }

  const canDelete = can(user?.role, "product:delete");

  return (
    <AdminLayout title={`Edit: ${product.name}`} onReload={() => setReloadKey((k) => k + 1)}>
      <ProductEditor
        key={reloadKey}
        initial={productToFormValues(product as never)}
        productId={product.id}
        submitLabel="Save changes"
        onCancel={() => navigate("/admin/products")}
        onDelete={canDelete
          ? async () => {
              if (!confirm(`Delete "${product.name}" permanently?`)) return;
              await deleteProductApi(product.id);
              navigate("/admin/products");
            }
          : undefined}
        onSubmit={async (values) => {
          await updateProductApi(product.id, values);
          navigate("/admin/products");
        }}
      />
    </AdminLayout>
  );
}
