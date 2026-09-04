import { Link, useLocation } from "react-router-dom";

import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Heart,
  MapPin,
  Receipt,
  ArrowRight,
  LogOut,
  Briefcase,
  Award,
  Sparkles,
  Copy,
  Check,
  Share2,
  LayoutGrid,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardIdentityRow } from "@/components/dashboard/DashboardIdentityRow";
import { StatCard, StatCardGrid } from "@/components/dashboard/StatCard";
import { type DashboardNavItem } from "@/components/dashboard/DashboardSidebarNav";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { orderStore, type CustomerOrder } from "@/services/orderStore";
import { profileStore, type CustomerProfile } from "@/services/profileStore";
import { referralStore, type ReferralWallet } from "@/services/referralStore";

function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

// Every item navigates via a real route (see DashboardSidebarNav's `to` mode) rather than
// switching an in-page tab, so `active`/`onChange` are never actually read — these keys only
// need to be distinct (React list keys) and satisfy DashboardShell's generic tab-state contract.
type NavKey = "overview" | "orders" | "wishlist" | "addresses" | "rewards" | "business";

function DashboardPage() {
  const { user, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const location = useLocation();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [summary, setSummary] = useState<{ ordersCount: number; lifetimeValue: number } | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [wallet, setWallet] = useState<ReferralWallet | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  // Set once, from router state left by account.register.tsx's redirect — a real navigation
  // (refresh, back button, revisiting later) never carries that state again, so this stays true
  // only for the one page view right after signup, not "every time you happen to land here."
  const [justRegistered] = useState(() => Boolean((location.state as { justRegistered?: boolean } | null)?.justRegistered));

  useEffect(() => {
    orderStore.listMine().then((res) => setOrders((res.rows ?? []).slice(0, 3)));
    orderStore.getSummary().then(setSummary).catch(() => undefined);
    profileStore.get().then((res) => {
      const p = res.profile;
      if (p) p.addresses = p.addresses ?? [];
      setProfile(p);
    });
    referralStore.getWallet().then(setWallet).catch(() => undefined);
  }, []);

  const defaultAddress = (profile?.addresses ?? []).find((a) => a.isDefault) ?? profile?.addresses?.[0];
  const referralCode = wallet?.referralCode ?? "";
  const referralShareUrl =
    typeof window !== "undefined" && referralCode
      ? `${window.location.origin}/account/register?ref=${encodeURIComponent(referralCode)}`
      : "";
  const rewardsPath = user?.accountType === "BUSINESS" ? "/account/referrals" : "/account/merchant";

  async function copyReferralLink() {
    if (!referralShareUrl) return;
    await navigator.clipboard.writeText(referralShareUrl);
    setLinkCopied(true);
    toast.success("Referral link copied");
    setTimeout(() => setLinkCopied(false), 1500);
  }

  async function shareReferralLink() {
    if (!referralShareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Moments Packaging", text: "Use my link for a discount", url: referralShareUrl });
      } catch {
        /* cancelled */
      }
    } else {
      await copyReferralLink();
    }
  }

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
    <ProtectedRoute>
      <DashboardLayout>
        <DashboardShell
          navItems={NAV_ITEMS}
          activeTab="overview"
          onTabChange={() => undefined}
          identity={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <DashboardIdentityRow
                icon={LayoutGrid}
                name={user?.email ?? ""}
                meta={justRegistered ? `Welcome, ${user?.firstName ?? "there"}` : `Welcome back, ${user?.firstName ?? "there"}`}
              />
              <button
                onClick={() => logout()}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          }
          stats={
            <StatCardGrid>
              <StatCard icon={Receipt} label="Orders" value={String(summary?.ordersCount ?? orders?.length ?? 0)} />
              <StatCard
                icon={Wallet}
                label="Lifetime spend"
                value={summary ? fmt(summary.lifetimeValue) : "—"}
                tone="accent"
              />
              <StatCard icon={Award} label="Reward Coupons" value={String(wallet?.balance ?? 0)} tone="accent" />
              <StatCard icon={Heart} label="Wishlist" value={String(wishlistCount)} />
            </StatCardGrid>
          }
        >
          {justRegistered && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-5">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="font-display text-lg">Welcome to Moments, {user?.firstName ?? "there"}!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your account is ready and 1,000 Reward Coupons are already in your wallet
                  {wallet ? ` (worth KES ${wallet.balanceValueKes.toLocaleString()})` : ""} — use them at checkout on your
                  first order, or refer a friend to earn even more.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">Recent orders</h2>
                <Link to="/account/orders" className="text-xs text-accent hover:underline">
                  View all →
                </Link>
              </div>
              {orders === null ? (
                <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
              ) : orders.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">No orders yet.</p>
                  <Link
                    to="/products"
                    className="mt-3 inline-block rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Browse catalogue
                  </Link>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {orders.map((o) => (
                    <li key={o.reference} className="flex items-center justify-between py-3">
                      <div>
                        <Link
                          to={`/account/orders/${o.reference}`}
                          className="font-display text-base hover:text-accent"
                        >
                          {o.reference}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {new Date(o.createdAt).toLocaleDateString("en-KE")} · {o.status.replace(/_/g, " ")}
                        </p>
                      </div>
                      <span className="font-semibold">{fmt(o.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">Default address</h2>
                <Link to="/account/profile" className="text-xs text-accent hover:underline">
                  Edit →
                </Link>
              </div>
              {!defaultAddress ? (
                <div className="mt-6 rounded-xl border border-dashed border-border p-4 text-center">
                  <p className="text-sm text-muted-foreground">No address saved yet.</p>
                  <Link
                    to="/account/profile"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent"
                  >
                    Add address <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="mt-4 space-y-1 text-sm">
                  <p className="font-semibold">{defaultAddress.recipient}</p>
                  <p className="text-muted-foreground">{defaultAddress.line1}</p>
                  <p className="text-muted-foreground">{defaultAddress.city}</p>
                  <p className="text-muted-foreground">{defaultAddress.phone}</p>
                </div>
              )}
              <Link
                to="/cart"
                className="mt-5 inline-flex w-full items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm hover:bg-secondary"
              >
                <span className="inline-flex items-center gap-2 font-semibold">
                  <ShoppingBag className="h-4 w-4 text-accent" /> View cart
                </span>
                <ArrowRight className="h-4 w-4 text-accent" />
              </Link>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Refer & earn Reward Coupons</h2>
              <Link to={rewardsPath} className="text-xs text-accent hover:underline">
                View details →
              </Link>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Share your link — when someone buys using it, you both earn Reward Coupons.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={referralShareUrl || "Loading your referral link…"}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-border bg-secondary px-3.5 py-2.5 font-mono text-xs text-foreground sm:text-sm"
              />
              <button
                type="button"
                onClick={copyReferralLink}
                disabled={!referralShareUrl}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {linkCopied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={shareReferralLink}
                disabled={!referralShareUrl}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
              >
                <Share2 className="h-3.5 w-3.5" /> Share
              </button>
            </div>
          </div>
        </DashboardShell>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

export default DashboardPage;
