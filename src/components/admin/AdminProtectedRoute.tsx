import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { NewOrderAlertModal } from "@/components/admin/NewOrderAlertModal";
import { RisellerRecordReminder } from "@/components/admin/RisellerRecordReminder";
import { RisellerBacklogModal } from "@/components/admin/RisellerBacklogModal";
import { Forbidden } from "@/components/admin/Forbidden";
import { hasUsedStaffLink, staffLinkFor } from "@/components/StaffLinkGate";
import { useAuth } from "@/contexts/AdminAuthContext";
import { AdminOrdersProvider } from "@/contexts/AdminOrdersContext";
import type { BackendRole } from "@/services/adminApi";

export interface ProtectedRouteProps {
  requiredRole?: BackendRole;
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, isAuthenticated, isCheckingSession, ensureValidSession, mustChangePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasRequiredRole = !requiredRole || !!user?.roles.includes(requiredRole);

  const redirectToLogin = () => {
    const onLoginPage =
      location.pathname === "/login" ||
      location.pathname.startsWith("/admin/login");
    if (onLoginPage) return;
    const wanted = `${location.pathname}${location.search}`;
    // A returning staff-link user goes straight to the staff site, carrying the page they wanted in `next`.
    if (hasUsedStaffLink()) {
      window.location.replace(staffLinkFor(wanted));
      return;
    }
    navigate(`/admin/login?redirect=${encodeURIComponent(wanted)}`, { replace: true });
  };

  useEffect(() => {
    if (isCheckingSession) return;

    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    // Force password change before allowing any other admin navigation.
    if (mustChangePassword && location.pathname !== "/admin/change-password") {
      navigate("/admin/change-password", { replace: true });
      return;
    }

    void ensureValidSession().then((session) => {
      if (!session) redirectToLogin();
    });
  }, [ensureValidSession, isAuthenticated, isCheckingSession, location.pathname, mustChangePassword, navigate, user?.refreshToken]);

  if (isCheckingSession || !isAuthenticated) return null;
  if (mustChangePassword && location.pathname !== "/admin/change-password") return null;
  if (!hasRequiredRole) return <Forbidden resource="this admin area" />;
  return (
    <AdminOrdersProvider>
      <Outlet />
      <NewOrderAlertModal />
      <RisellerRecordReminder />
      <RisellerBacklogModal />
    </AdminOrdersProvider>
  );
}

export const AdminProtectedRoute = ProtectedRoute;
export default ProtectedRoute;
