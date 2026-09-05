import { Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { useDashboardSidebar } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";

function timeOfDayGreeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Minimal app-shell header for authenticated dashboard pages — deliberately
 * NOT the full marketing SiteHeader (no mega-menu, search, cart/account
 * dropdown). A customer inside their dashboard is already "in the app";
 * this just gives them a way back to the homepage or the catalogue, plus
 * the mobile sidebar toggle. Dark forest-deep background matches the
 * sidebar below it, so the two read as one shell instead of a mismatched
 * light strip sitting on top of a dark panel. Accessibility controls are
 * unaffected — the AccessibilityToolbar is mounted globally in App.tsx,
 * outside any layout.
 */
export function DashboardHeader() {
  const { setOpen } = useDashboardSidebar();
  const { user } = useAuth();
  const greeting = timeOfDayGreeting(new Date().getHours());
  return (
    <header className="sticky top-0 z-30 bg-[var(--forest-deep)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-cream hover:bg-cream/10 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="font-display text-lg font-semibold text-cream">
            moments
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="truncate text-xs font-medium text-cream/80 sm:text-sm">
            {greeting}
            {user?.firstName && <span className="hidden min-[380px]:inline">{`, ${user.firstName}`}</span>}
          </span>
          <Link
            to="/products"
            className="shrink-0 rounded-full border border-cream/25 px-4 py-1.5 text-sm font-medium text-cream hover:bg-cream/10"
          >
            Shop
          </Link>
        </div>
      </div>
    </header>
  );
}
