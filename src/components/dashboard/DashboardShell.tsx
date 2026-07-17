import type { ReactNode } from "react";
import { DashboardSidebarNav, type DashboardNavItem } from "@/components/dashboard/DashboardSidebarNav";

/**
 * True two-pane app-shell body for the customer dashboards — sidebar flush against the left
 * edge, full height, content pane taking the rest of the width. Mirrors AdminLayout's structure
 * (sidebar + content, no artificial max-width centering the whole shell) instead of the earlier
 * pattern of nesting a small nav+content card inside a narrow, centered marketing-page column,
 * which read as a profile page rather than a dashboard.
 */
export function DashboardShell<T extends string>({
  identity,
  stats,
  navItems,
  activeTab,
  onTabChange,
  children,
}: {
  identity: ReactNode;
  stats: ReactNode;
  navItems: DashboardNavItem<T>[];
  activeTab: T;
  onTabChange: (t: T) => void;
  children: ReactNode;
}) {
  return (
    <div className="lg:flex lg:min-h-[75vh]">
      <DashboardSidebarNav items={navItems} active={activeTab} onChange={onTabChange} />
      <div className="min-w-0 flex-1">
        <div className="border-b border-border bg-card px-4 py-5 sm:px-6 lg:px-8">
          {identity}
          <div className="mt-4">{stats}</div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
