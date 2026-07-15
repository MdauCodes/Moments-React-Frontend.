import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { useDashboardSidebar } from "@/components/DashboardLayout";

/**
 * Minimal app-shell header for authenticated dashboard pages — deliberately
 * NOT the full marketing SiteHeader (no mega-menu, search, cart/account
 * dropdown). A customer inside their dashboard is already "in the app";
 * this just gives them a way back to the homepage or the catalogue, plus
 * the mobile sidebar toggle. Accessibility controls are unaffected — the
 * AccessibilityToolbar is mounted globally in App.tsx, outside any layout.
 */
export function DashboardHeader() {
  const { setOpen } = useDashboardSidebar();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 lg:px-8">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-foreground hover:bg-secondary lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="font-display text-lg font-semibold text-forest">
            moments
          </Link>
        </div>
        <Link
          to="/products"
          className="rounded-full border border-border px-4 py-1.5 text-sm font-medium text-foreground hover:bg-secondary"
        >
          Shop
        </Link>
      </div>
    </header>
  );
}
