import type { ComponentType } from "react";
import { X } from "lucide-react";
import { useDashboardSidebar } from "@/components/DashboardLayout";

export interface DashboardNavItem<T extends string> {
  key: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
  soon?: boolean;
}

/**
 * Shared Stripe-style sidebar nav for the customer dashboards — flat list, active row gets a
 * full-width tinted background (not a left border), same mobile off-canvas drawer pattern as
 * before via useDashboardSidebar. Generic over the tab-key union so each dashboard keeps its
 * own TabKey type while sharing this one component.
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
        className={`fixed inset-y-0 left-0 z-50 w-64 -translate-x-full overflow-y-auto bg-cream p-4 shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:w-52 lg:shrink-0 lg:translate-x-0 lg:overflow-visible lg:bg-transparent lg:p-3 lg:shadow-none ${
          open ? "translate-x-0" : ""
        }`}
      >
        <div className="mb-3 flex items-center justify-between lg:hidden">
          <p className="text-sm font-semibold text-foreground">Menu</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="grid h-8 w-8 place-items-center rounded-md hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {items.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleChange(item.key)}
                className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
                {item.soon && (
                  <span className="ml-auto text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
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
