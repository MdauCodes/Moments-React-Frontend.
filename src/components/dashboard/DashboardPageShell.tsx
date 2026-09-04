import type { ReactNode } from "react";
import { Briefcase, Heart, LayoutGrid, MapPin, Award, Receipt } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardSidebarNav, type DashboardNavItem } from "@/components/dashboard/DashboardSidebarNav";
import { useAuth } from "@/contexts/AuthContext";

type NavKey = "overview" | "orders" | "wishlist" | "addresses" | "rewards" | "business";

/**
 * Sidebar + mainbar shell for the account sub-pages that link out from the main dashboard
 * (Orders, Wishlist, Addresses, its own order-detail page) — without this they dropped back into
 * SiteLayout's full marketing chrome (footer, bottom nav, WhatsApp/deal banners) the moment you
 * navigated away from /account/dashboard, breaking the "cockpit" feel the moment you clicked
 * anything in its own sidebar. Deliberately lighter than DashboardShell (no identity row/stat
 * cards) — those pages already have their own page-specific header content.
 */
export function DashboardPageShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const rewardsPath = user?.accountType === "BUSINESS" ? "/account/referrals" : "/account/merchant";

  const NAV_ITEMS: DashboardNavItem<NavKey>[] = [
    { key: "overview", label: "Overview", icon: LayoutGrid, to: "/account/dashboard" },
    { key: "orders", label: "Orders", icon: Receipt, to: "/account/orders" },
    { key: "wishlist", label: "Wishlist", icon: Heart, to: "/account/wishlist" },
    { key: "addresses", label: "Addresses", icon: MapPin, to: "/account/profile" },
    { key: "rewards", label: "Rewards & Referrals", icon: Award, to: rewardsPath },
    ...(user?.accountType === "BUSINESS"
      ? [{ key: "business" as const, label: "Business Account", icon: Briefcase, to: "/account/business" }]
      : []),
  ];

  return (
    <DashboardLayout>
      <div className="lg:flex lg:min-h-[75vh]">
        <DashboardSidebarNav items={NAV_ITEMS} active="overview" onChange={() => undefined} />
        <div className="min-w-0 flex-1 bg-cream/40">{children}</div>
      </div>
    </DashboardLayout>
  );
}
