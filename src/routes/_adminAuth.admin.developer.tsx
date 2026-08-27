import { useSearchParams } from "react-router-dom";
import { Wrench, ScrollText, TrendingDown } from "lucide-react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { resolveStaffRole } from "@/lib/roles";
import { DevToolsPanel } from "./_adminAuth.admin.dev-tools";
import { DevLogsPanel } from "./_adminAuth.admin.dev-logs";
import { CheckoutFunnelPanel } from "./_adminAuth.admin.developer.checkout-funnel";

type Tab = "tools" | "logs" | "funnel";

const TABS: { key: Tab; label: string; icon: typeof Wrench }[] = [
  { key: "tools", label: "Developer Tools", icon: Wrench },
  { key: "logs", label: "Dev Logs", icon: ScrollText },
  { key: "funnel", label: "Checkout Funnel", icon: TrendingDown },
];

/** Single consolidated super-admin-only "Developer" section, replacing the previously separate
 *  /admin/dev-tools and /admin/dev-logs sidebar entries — one page, tabbed, per your request to
 *  group everything developer-related under one section instead of scattered sidebar links. */
function AdminDeveloperPage() {
  const { user } = useAdminAuth();
  const allowed = resolveStaffRole(user) === "SUPER_ADMIN";
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as Tab) || "tools";

  if (!allowed) {
    return (
      <AdminLayout title="Developer">
        <Forbidden resource="Developer section" />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Developer">
      <div className="admin-page-stack">
        <div className="admin-panel admin-toolbar" data-admin-toolbar style={{ gap: 6 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`admin-btn ${t.key === activeTab ? "admin-btn-primary" : "admin-btn-ghost"}`}
              onClick={() => setSearchParams({ tab: t.key })}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
        {activeTab === "tools" && <DevToolsPanel />}
        {activeTab === "logs" && <DevLogsPanel />}
        {activeTab === "funnel" && <CheckoutFunnelPanel />}
      </div>
    </AdminLayout>
  );
}

export default AdminDeveloperPage;
