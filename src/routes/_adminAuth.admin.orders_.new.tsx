import { useNavigate } from "react-router-dom";

import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { AdminOrderCreateModal } from "@/components/admin/AdminOrderCreateModal";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";

/**
 * Direct-link entry point (bookmarks, deep links) for the same compact modal the Orders list
 * page's "New order" button opens in place — see AdminOrderCreateModal. Closing it here navigates
 * back to the orders list rather than leaving an empty page behind.
 */
function AdminOrderNewPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const allowed = useRequirePermission([PERM.ORDER_VIEW, PERM.ORDER_MANAGE_ALL, PERM.ORDER_ASSIGN]);

  if (!allowed) return <AdminLayout title="New order"><Forbidden resource="orders" /></AdminLayout>;
  if (!hasPermission(PERM.ORDER_MANAGE_ALL) && !hasPermission(PERM.ORDER_ASSIGN)) {
    return <AdminLayout title="New order"><Forbidden resource="order creation" /></AdminLayout>;
  }

  return (
    <AdminLayout title="New order">
      <AdminOrderCreateModal
        open
        onClose={() => navigate("/admin/orders")}
        onCreated={() => navigate("/admin/orders")}
      />
    </AdminLayout>
  );
}

export default AdminOrderNewPage;
