import { Link } from "react-router-dom";

import { useEffect, useState } from "react";
import { ShoppingBag, Heart, MapPin, Receipt, ArrowRight, LogOut, Briefcase, Gift } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { orderStore, type CustomerOrder } from "@/services/orderStore";
import { profileStore, type CustomerProfile } from "@/services/profileStore";



function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function DashboardPage() {
  const { user, logout } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  useEffect(() => {
    orderStore.listMine().then((res) => setOrders((res.rows ?? []).slice(0, 3)));
    profileStore.get().then((res) => {
      const p = res.profile;
      if (p) p.addresses = p.addresses ?? [];
      setProfile(p);
    });
  }, []);

  const defaultAddress = (profile?.addresses ?? []).find((a) => a.isDefault) ?? profile?.addresses?.[0];
  return (
    <SiteLayout>
      <section className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Account</p>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl">Welcome back, {user?.firstName ?? "there"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={() => logout()}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Tile to="/account/orders" icon={Receipt} label="Orders" value={orders?.length ?? "—"} />
          <Tile to="/account/wishlist" icon={Heart} label="Wishlist" value={wishlistCount} />
          <Tile to="/cart" icon={ShoppingBag} label="Cart" value="View" />
          <Tile to="/account/profile" icon={MapPin} label="Addresses" value={profile?.addresses?.length ?? 0} />
          {user?.accountType === "BUSINESS" ? (
            <Tile to="/account/business" icon={Briefcase} label="Business Account" value="View" />
          ) : (
            <Tile to="/account/merchant" icon={Gift} label="Rewards" value="View" />
          )}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
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
              to={user?.accountType === "BUSINESS" ? "/account/referrals" : "/account/merchant"}
              className="mt-5 inline-flex w-full items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm hover:bg-secondary"
            >
              <span className="font-semibold">Refer & earn points</span>
              <ArrowRight className="h-4 w-4 text-accent" />
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function Tile({
  to,
  icon: Icon,
  label,
  value,
}: {
  to: "/account/orders" | "/account/wishlist" | "/cart" | "/account/profile" | "/account/business" | "/account/merchant";
  icon: typeof ShoppingBag;
  label: string;
  value: string | number;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-secondary/40"
    >
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-2xl">{value}</p>
      </div>
      <Icon className="h-6 w-6 text-accent transition-transform group-hover:scale-110" />
    </Link>
  );
}

export default DashboardPage;
