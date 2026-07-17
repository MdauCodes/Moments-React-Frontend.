import { Link } from "react-router-dom";

import { useEffect, useState } from "react";
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Package,
  ArrowRight,
  LayoutGrid,
  Settings as SettingsIcon,
  Award,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { QuickAddProductStrip } from "@/components/QuickAddProductStrip";
import { EmailVerificationCard } from "@/components/EmailVerificationCard";
import { StatCard, StatCardGrid } from "@/components/dashboard/StatCard";
import { DashboardSidebarNav, type DashboardNavItem } from "@/components/dashboard/DashboardSidebarNav";
import { DashboardIdentityRow } from "@/components/dashboard/DashboardIdentityRow";
import { InlineProgress } from "@/components/InlineProgress";
import { useAuth } from "@/contexts/AuthContext";
import { orderStore, type CustomerOrder } from "@/services/orderStore";
import { profileStore, type CustomerProfile } from "@/services/profileStore";
import {
  referralStore,
  type ReferralStatus,
  type ReferralWallet,
  type ReferralTransaction,
  type ReferralEntry,
  type RewardsTier,
} from "@/services/referralStore";

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function AccountMerchantPage() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <div className="bg-gradient-to-b from-cream/70 via-cream/20 to-transparent">
          <section className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-10">
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Account</p>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl">Individual Shopper Account</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Earn Reward Coupons on every order, share your referral link, and redeem Reward Coupons for discounts.
            </p>
            <MerchantDashboardBody />
            <div className="mt-10">
              <QuickAddProductStrip />
            </div>
          </section>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

// ── Dashboard shell — same Stripe-style pattern as account.business.tsx ──────

type TabKey = "overview" | "rewards" | "orders" | "settings";

const NAV_ITEMS: DashboardNavItem<TabKey>[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "rewards", label: "Rewards & Referrals", icon: Award },
  { key: "orders", label: "Orders", icon: Package },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

function MerchantDashboardBody() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("overview");
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [wallet, setWallet] = useState<ReferralWallet | null>(null);
  const [tier, setTier] = useState<RewardsTier | null>(null);
  const [txs, setTxs] = useState<ReferralTransaction[]>([]);
  const [refs, setRefs] = useState<ReferralEntry[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await referralStore.getStatus();
      if (cancelled) return;
      setStatus(s);
      if (s.featureUnlocked && s.programEnabled) {
        const [w, t, tr, r] = await Promise.all([
          referralStore.getWallet(),
          referralStore.getMyTier(),
          referralStore.getTransactions(),
          referralStore.getReferrals(),
        ]);
        if (cancelled) return;
        setWallet(w);
        setTier(t);
        setTxs(tr);
        setRefs(r);
      }
      setLoading(false);
    })();
    orderStore.listMine(0, 20).then((r) => setOrders(r.rows));
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadWallet = () => { void referralStore.getWallet().then(setWallet); };

  if (loading) {
    return <p className="mt-10 text-sm text-muted-foreground">Loading…</p>;
  }

  // Whether the rewards program itself is live — NOT a gate on the whole dashboard. Orders and
  // Settings have nothing to do with rewards and must stay reachable even if this check fails
  // (network hiccup, backend blip, or the program being toggled off) — previously the entire
  // sidebar/tabs shell only rendered when this was true, so a rewards outage silently took
  // Orders and Settings down with it.
  const live = !!(status?.featureUnlocked && status?.programEnabled);
  const rewardsComingSoonMessage = status?.message ?? "We're polishing the rewards programme. Check back soon.";

  return (
    <div className="mt-8 space-y-5">
      <DashboardIdentityRow
        icon={Gift}
        name="Individual Shopper"
        meta="Rewards account"
        badge={
          tier && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              {tier.tierName}
            </span>
          )
        }
      />

      <StatCardGrid>
        {live && (
          <>
            <StatCard icon={Award} label="Reward Coupons balance" value={String(wallet?.balance ?? 0)} tone="accent" />
            <StatCard icon={Gift} label="Reward Coupons value" value={fmtKes(wallet?.balanceValueKes ?? 0)} tone="accent" />
          </>
        )}
        <StatCard icon={Package} label="Orders" value={orders !== undefined && orders !== null ? String(orders.length) : "—"} />
      </StatCardGrid>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col lg:flex-row">
          <DashboardSidebarNav items={NAV_ITEMS} active={tab} onChange={setTab} />
          <div className="min-w-0 flex-1 p-5 sm:p-6 lg:border-l lg:border-border">
            {tab === "overview" && (
              <OverviewTab
                live={live}
                comingSoonMessage={rewardsComingSoonMessage}
                wallet={wallet}
                tier={tier}
                txs={txs}
                onSeeAllRewards={() => setTab("rewards")}
              />
            )}
            {tab === "rewards" && (
              live ? (
                <RewardsTab wallet={wallet} txs={txs} refs={refs} userEmail={user?.email ?? ""} onWalletChange={reloadWallet} />
              ) : (
                <RewardsComingSoon message={rewardsComingSoonMessage} />
              )
            )}
            {tab === "orders" && <OrdersTab orders={orders} />}
            {tab === "settings" && <SettingsTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

function RewardsComingSoon({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary/20 p-8 text-center">
      <p className="font-display text-lg">Rewards program — coming soon</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  action,
  children,
  tint,
}: {
  icon?: typeof Package;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  tint?: "accent";
}) {
  return (
    <div
      className={`rounded-lg border p-5 ${tint === "accent" ? "border-accent/25 bg-accent/[0.03]" : "border-border bg-background/40"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        </div>
        {action}
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  live,
  comingSoonMessage,
  wallet,
  tier,
  txs,
  onSeeAllRewards,
}: {
  live: boolean;
  comingSoonMessage: string;
  wallet: ReferralWallet | null;
  tier: RewardsTier | null;
  txs: ReferralTransaction[];
  onSeeAllRewards: () => void;
}) {
  const recent = txs.slice(0, 3);
  return (
    <div className="space-y-5">
      {live ? (
        <>
          <Section icon={Award} title="Reward Coupons balance" tint="accent">
            <div className="flex items-baseline gap-1.5">
              <p className="font-mono text-3xl font-semibold tabular-nums text-foreground">{wallet?.balance ?? 0}</p>
              <p className="text-sm text-muted-foreground">Reward Coupons · worth {fmtKes(wallet?.balanceValueKes ?? 0)}</p>
            </div>
            {tier ? (
              <p className="mt-2 text-xs text-muted-foreground">
                You're on the <span className="font-semibold text-foreground">{tier.tierName}</span> tier —{" "}
                {tier.discountPercent}% off every order{tier.perkDescription ? `, ${tier.perkDescription.toLowerCase()}` : ""}.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Keep earning Reward Coupons to unlock a VIP tier.</p>
            )}
          </Section>

          <Section
            icon={Package}
            title="Recent activity"
            action={
              <button
                type="button"
                onClick={onSeeAllRewards}
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </button>
            }
          >
            <div className="space-y-2">
              {recent.length === 0 && <p className="text-sm text-muted-foreground">No activity yet — place an order to start earning.</p>}
              {recent.map((t) => <TransactionRow key={t.id} tx={t} />)}
            </div>
          </Section>
        </>
      ) : (
        <RewardsComingSoon message={comingSoonMessage} />
      )}
    </div>
  );
}

// ── Rewards & Referrals tab ───────────────────────────────────────────────────

function RewardsTab({
  wallet,
  txs,
  refs,
  userEmail,
  onWalletChange,
}: {
  wallet: ReferralWallet | null;
  txs: ReferralTransaction[];
  refs: ReferralEntry[];
  userEmail: string;
  onWalletChange: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const code = wallet?.referralCode ?? "";
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/account/register?ref=${encodeURIComponent(code)}` : "";

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied");
    setTimeout(() => setCopied(false), 1500);
  }

  async function shareLink() {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Moments Packaging", text: `Use my code ${code} for a discount`, url: shareUrl });
      } catch {
        /* cancelled */
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    }
  }

  return (
    <div className="space-y-5">
      <Section icon={Gift} title="Your referral code" tint="accent">
        <div className="flex flex-wrap items-center gap-3">
          <code className="rounded-lg bg-secondary px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-foreground">
            {code || "—"}
          </code>
          <button
            type="button"
            onClick={copyCode}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={shareLink}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Share2 className="h-3.5 w-3.5" /> Share link
          </button>
        </div>
        {shareUrl && <p className="mt-2.5 break-all text-xs text-muted-foreground">{shareUrl}</p>}
      </Section>

      {wallet && (
        <EmailVerificationCard
          email={userEmail}
          emailVerified={wallet.emailVerified}
          freeRedemptionsRemaining={wallet.freeRedemptionsRemaining}
          onVerified={onWalletChange}
        />
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Section icon={Package} title="Reward Coupons history">
          {txs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {txs.map((t) => <TransactionRow key={t.id} tx={t} />)}
            </div>
          )}
        </Section>

        <Section icon={Users} title="Your referrals">
          {refs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Share your code to start earning.</p>
          ) : (
            <div className="space-y-2">
              {refs.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3.5 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{r.refereeName ?? r.refereeEmail ?? "Anonymous"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })} · {r.status}
                    </p>
                  </div>
                  {r.reward != null && (
                    <span className="font-mono text-sm font-semibold tabular-nums text-accent">+{r.reward}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: ReferralTransaction }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3.5 py-2.5 text-sm">
      <div>
        <p className="font-medium text-foreground">{tx.type.replace(/_/g, " ")}</p>
        {tx.description && <p className="text-xs text-muted-foreground">{tx.description}</p>}
        <p className="mt-0.5 text-[11px] text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</p>
      </div>
      <span className={`font-mono text-sm font-semibold tabular-nums ${tx.amount >= 0 ? "text-accent" : "text-destructive"}`}>
        {tx.amount >= 0 ? "+" : ""}
        {tx.amount}
      </span>
    </div>
  );
}

// ── Orders tab ───────────────────────────────────────────────────────────────

function OrdersTab({ orders }: { orders: CustomerOrder[] | null }) {
  const totalSpend = orders?.reduce((s, o) => s + o.total, 0) ?? 0;
  return (
    <Section icon={Package} title={`Orders${orders ? ` (${orders.length})` : ""}`}>
      <div className="mb-4 flex items-baseline gap-1.5 border-b border-border pb-4 text-sm">
        <span className="font-mono font-semibold tabular-nums text-foreground">{fmtKes(totalSpend)}</span>
        <span className="text-xs text-muted-foreground">lifetime spend</span>
      </div>
      <div className="space-y-2">
        {orders === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {orders !== null && orders.length === 0 && <p className="text-sm text-muted-foreground">No orders placed yet.</p>}
        {orders?.map((o) => (
          <Link
            key={o.reference}
            to={`/account/orders/${encodeURIComponent(o.reference)}`}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3.5 py-2.5 text-sm hover:bg-secondary/40"
          >
            <div>
              <p className="font-mono text-[13px] font-medium text-foreground">{o.reference}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(o.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[13px] font-medium tabular-nums text-foreground">{fmtKes(o.total)}</p>
              <p className="text-xs text-muted-foreground">{o.status.replace(/_/g, " ")}</p>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}

// ── Settings tab ───────────────────────────────────────────────────────────────

const settingsInputCls =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

function SettingsTab() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    profileStore.get().then((res) => {
      const p = res.profile;
      if (!p.firstName && user) {
        p.firstName = user.firstName;
        p.lastName = user.lastName;
        p.email = user.email;
      }
      setProfile(p);
    });
  }, [user]);

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const { profile: saved, source } = await profileStore.save(profile);
      setProfile(saved);
      toast.success(source === "live" ? "Profile saved" : "Saved locally");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <Section icon={SettingsIcon} title="Contact details">
        <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">First name</span>
            <input
              className={settingsInputCls}
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Last name</span>
            <input
              className={settingsInputCls}
              value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Email</span>
            <input
              type="email"
              className={settingsInputCls}
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Phone</span>
            <input
              className={settingsInputCls}
              value={profile.phone}
              placeholder="+254 7…"
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
          </label>
          <div className="flex justify-end sm:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving && <InlineProgress size="sm" />} Save
            </button>
          </div>
        </form>
      </Section>

      <Section icon={SettingsIcon} title="Saved addresses">
        <p className="text-sm text-muted-foreground">
          {profile.addresses.length === 0
            ? "No addresses saved yet."
            : `${profile.addresses.length} address${profile.addresses.length === 1 ? "" : "es"} saved.`}
        </p>
        <Link
          to="/account/profile"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary"
        >
          Manage saved addresses <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Section>
    </div>
  );
}

export default AccountMerchantPage;
