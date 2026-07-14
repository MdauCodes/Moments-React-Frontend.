import { useEffect, useState } from "react";
import { Gift, Truck, ChevronRight } from "lucide-react";
import { apiFetch } from "@/config/api";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { referralStore, type RewardsTier } from "@/services/referralStore";

type RewardsTierRow = {
  tierName: string;
  minLifetimePoints: number;
  discountPercent: number;
};

type RewardsProgressConfig = {
  pointsPer100Kes: number;
  tiers: RewardsTierRow[];
};

type DeliveryThreshold = {
  minOrderAmount: number;
  zoneLabel: string;
};

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

/**
 * Sticky, always-visible pair of banners at the top of /cart and checkout:
 * one for VIP-tier rewards progress (or a create-account nudge if
 * unauthenticated), one for the admin-configured free-delivery threshold.
 * Each shows an exact "order KES X more" figure — never vague — and is
 * skipped entirely if there's nothing to show (no next tier, no delivery
 * config, or the customer already qualifies).
 */
export function RewardDeliveryBanners({ stickyTopClassName = "top-16 sm:top-20" }: { stickyTopClassName?: string }) {
  const { cartTotal } = useCart();
  const { isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();
  const [rewardsConfig, setRewardsConfig] = useState<RewardsProgressConfig | null>(null);
  const [deliveryThresholds, setDeliveryThresholds] = useState<DeliveryThreshold[]>([]);
  const [myTier, setMyTier] = useState<RewardsTier | null>(null);
  const [myLifetimePoints, setMyLifetimePoints] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/v1/referral/rewards-progress-config");
        if (res.ok) setRewardsConfig(await res.json());
      } catch { /* banner just won't show */ }
      try {
        const res = await apiFetch("/api/v1/public/free-delivery-thresholds");
        if (res.ok) setDeliveryThresholds(await res.json());
      } catch { /* banner just won't show */ }
    })();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    referralStore.getMyTier().then(setMyTier).catch(() => {});
    referralStore.getWallet().then((w) => setMyLifetimePoints(w?.totalEarned ?? 0)).catch(() => {});
  }, [isAuthenticated]);

  // ── Rewards banner ──────────────────────────────────────────────────────
  let rewardsBanner: React.ReactNode = null;
  if (!isAuthenticated) {
    rewardsBanner = (
      <button
        type="button"
        onClick={() => openLogin({})}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent/[0.06] px-3.5 py-2.5 text-left transition-colors hover:bg-accent/[0.1]"
      >
        <span className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Gift className="h-4 w-4 shrink-0 text-accent" />
          Create a free account or log in — this order could be earning you points toward real discounts.
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-accent" />
      </button>
    );
  } else if (rewardsConfig && rewardsConfig.tiers.length > 0 && myLifetimePoints != null) {
    const pointsThisOrder = Math.floor(cartTotal / 100) * rewardsConfig.pointsPer100Kes;
    const projectedPoints = myLifetimePoints + pointsThisOrder;
    const nextTier = rewardsConfig.tiers
      .filter((t) => t.minLifetimePoints > projectedPoints)
      .sort((a, b) => a.minLifetimePoints - b.minLifetimePoints)[0];
    if (nextTier) {
      const pointsNeeded = nextTier.minLifetimePoints - projectedPoints;
      const kesNeeded = Math.ceil((pointsNeeded / rewardsConfig.pointsPer100Kes) * 100);
      rewardsBanner = (
        <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.06] px-3.5 py-2.5">
          <Gift className="h-4 w-4 shrink-0 text-accent" />
          <span className="text-xs font-medium text-foreground">
            Order <b>{fmtKes(kesNeeded)}</b> more and unlock <b>{nextTier.tierName}</b> — {nextTier.discountPercent}% off every order.
          </span>
        </div>
      );
    } else if (myTier) {
      rewardsBanner = (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3.5 py-2.5">
          <Gift className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-xs font-medium text-foreground">
            You're on the <b>{myTier.tierName}</b> tier — {myTier.discountPercent}% off every order.
          </span>
        </div>
      );
    }
  }

  // ── Delivery banner ─────────────────────────────────────────────────────
  let deliveryBanner: React.ReactNode = null;
  if (deliveryThresholds.length > 0) {
    const sorted = [...deliveryThresholds].sort((a, b) => a.minOrderAmount - b.minOrderAmount);
    const next = sorted.find((t) => t.minOrderAmount > cartTotal);
    if (next) {
      const kesNeeded = Math.ceil(next.minOrderAmount - cartTotal);
      deliveryBanner = (
        <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.05] px-3.5 py-2.5">
          <Truck className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-xs font-medium text-foreground">
            Order <b>{fmtKes(kesNeeded)}</b> more and get <b>free delivery to {next.zoneLabel}</b>.
          </span>
        </div>
      );
    } else {
      const highest = sorted[sorted.length - 1];
      deliveryBanner = (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3.5 py-2.5">
          <Truck className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-xs font-medium text-foreground">
            Free delivery to <b>{highest.zoneLabel}</b> unlocked on this order.
          </span>
        </div>
      );
    }
  }

  if (!rewardsBanner && !deliveryBanner) return null;

  return (
    <div className={`sticky z-30 space-y-2 rounded-xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur ${stickyTopClassName}`}>
      {rewardsBanner}
      {deliveryBanner}
    </div>
  );
}
