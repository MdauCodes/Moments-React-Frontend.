import type { ComponentType } from "react";
import { X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useDashboardSidebar } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

export interface DashboardNavItem<T extends string> {
  key: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
  soon?: boolean;
  /** When set, this item navigates to a real route (via NavLink, active state driven by the URL)
   *  instead of switching an in-page tab — for a dashboard whose sections are separate pages
   *  (account.dashboard.tsx) rather than tabs within one page (account.merchant.tsx). `active`/
   *  `onChange` are ignored for items that set this. */
  to?: string;
}

/**
 * Shared sidebar nav for the customer dashboards — deep forest-green surface (distinct from the
 * admin sidebar's near-black tone, using the brand's own dark green), flat list with a full-width
 * tinted active row, same mobile off-canvas drawer pattern as before via useDashboardSidebar.
 * Generic over the tab-key union so each dashboard keeps its own TabKey type while sharing this
 * one component.
 */
export function DashboardSidebarNav<T extends string>({
  items,
  active,
  onChange,
}: {
  items: DashboardNavItem<T>[];
  active: T;
  onChange: (key: T) => void;
}) {
  const { open, setOpen } = useDashboardSidebar();
  const { user } = useAuth();
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : "Menu";
  const handleChange = (key: T) => {
    onChange(key);
    setOpen(false);
  };
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}
      <nav
        className={`fixed inset-y-0 left-0 z-50 w-64 -translate-x-full overflow-y-auto bg-[var(--forest-deep)] p-4 shadow-xl transition-transform duration-200 lg:sticky lg:top-[60px] lg:z-auto lg:h-[calc(100vh-60px)] lg:w-52 lg:shrink-0 lg:translate-x-0 lg:overflow-y-auto lg:p-3 lg:shadow-none ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="mb-3 flex items-center justify-between lg:hidden">
          <p className="truncate pr-2 text-sm font-semibold text-cream">{displayName}</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid h-8 w-8 place-items-center rounded-md text-cream hover:bg-cream/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            if (item.to) {
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  end
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-[var(--forest-bright)]/25 font-medium text-cream"
                        : "text-cream/65 hover:bg-cream/10 hover:text-cream"
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                  {item.soon && (
                    <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-cream/50">
                      Soon
                    </span>
                  )}
                </NavLink>
              );
            }
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleChange(item.key)}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-[var(--forest-bright)]/25 font-medium text-cream"
                    : "text-cream/65 hover:bg-cream/10 hover:text-cream"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
                {item.soon && (
                  <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-cream/50">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
