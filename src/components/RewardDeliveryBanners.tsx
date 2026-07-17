import { Gift, Truck, ChevronRight, Ticket, Award } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useRewardDeliveryGap } from "@/hooks/useRewardDeliveryGap";

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
  const { isAuthenticated } = useAuth();
  const { openLogin } = useAuthModal();
  const {
    myTier,
    kesToNextTier,
    nextTierName,
    nextTierDiscountPercent,
    kesToFreeDelivery,
    freeDeliveryZoneLabel,
    freeDeliveryUnlockedZoneLabel,
    walletBalance,
    walletBalanceValueKes,
    kesToNextPointsBracket,
    rewardsConfig,
    welcomeCode,
    kesToWelcomeCode,
    welcomeCodeReady,
  } = useRewardDeliveryGap();

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
          Create a free account or log in — this order could be earning you Reward Coupons toward real discounts.
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-accent" />
      </button>
    );
  } else if (kesToNextTier != null && nextTierName != null) {
    rewardsBanner = (
      <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.06] px-3.5 py-2.5">
        <Gift className="h-4 w-4 shrink-0 text-accent" />
        <span className="text-xs font-medium text-foreground">
          Order <b>{fmtKes(kesToNextTier)}</b> more and unlock <b>{nextTierName}</b> — {nextTierDiscountPercent}% off every order.
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

  // ── Delivery banner ─────────────────────────────────────────────────────
  let deliveryBanner: React.ReactNode = null;
  if (kesToFreeDelivery != null && freeDeliveryZoneLabel != null) {
    deliveryBanner = (
      <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/[0.05] px-3.5 py-2.5">
        <Truck className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-xs font-medium text-foreground">
          Order <b>{fmtKes(kesToFreeDelivery)}</b> more and get <b>free delivery to {freeDeliveryZoneLabel}</b>.
        </span>
      </div>
    );
  } else if (freeDeliveryUnlockedZoneLabel != null) {
    deliveryBanner = (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3.5 py-2.5">
        <Truck className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="text-xs font-medium text-foreground">
          Free delivery to <b>{freeDeliveryUnlockedZoneLabel}</b> unlocked on this order.
        </span>
      </div>
    );
  }

  // ── Redeemable coupon balance — a standing reminder, not a threshold gap ──
  let couponBalanceBanner: React.ReactNode = null;
  if (isAuthenticated && walletBalance != null && walletBalance > 0) {
    couponBalanceBanner = (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3.5 py-2.5">
        <Ticket className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="text-xs font-medium text-foreground">
          You have <b>{walletBalance} Reward Coupons</b> ({fmtKes(walletBalanceValueKes ?? 0)}) ready to redeem at checkout.
        </span>
      </div>
    );
  }

  // ── Welcome code (Business Accounts only) ────────────────────────────────
  let welcomeCodeBanner: React.ReactNode = null;
  if (welcomeCode && kesToWelcomeCode != null) {
    welcomeCodeBanner = (
      <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.06] px-3.5 py-2.5">
        <Gift className="h-4 w-4 shrink-0 text-accent" />
        <span className="text-xs font-medium text-foreground">
          Add <b>{fmtKes(kesToWelcomeCode)}</b> more and use your welcome code <b>{welcomeCode}</b> for 5% off.
        </span>
      </div>
    );
  } else if (welcomeCode && welcomeCodeReady) {
    welcomeCodeBanner = (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] px-3.5 py-2.5">
        <Gift className="h-4 w-4 shrink-0 text-emerald-600" />
        <span className="text-xs font-medium text-foreground">
          Your welcome code <b>{welcomeCode}</b> is ready — apply it at checkout for 5% off.
        </span>
      </div>
    );
  }

  // ── Earn more this order (next KES-100 bracket) ──────────────────────────
  let earnMoreBanner: React.ReactNode = null;
  if (isAuthenticated && kesToNextPointsBracket != null && rewardsConfig && rewardsConfig.pointsPer100Kes > 0) {
    earnMoreBanner = (
      <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/[0.06] px-3.5 py-2.5">
        <Award className="h-4 w-4 shrink-0 text-accent" />
        <span className="text-xs font-medium text-foreground">
          Spend <b>{fmtKes(kesToNextPointsBracket)}</b> more and earn <b>{rewardsConfig.pointsPer100Kes} more Reward Coupon{rewardsConfig.pointsPer100Kes === 1 ? "" : "s"}</b> on this order.
        </span>
      </div>
    );
  }

  if (!rewardsBanner && !deliveryBanner && !couponBalanceBanner && !welcomeCodeBanner && !earnMoreBanner) return null;

  return (
    <div className={`sticky z-30 space-y-2 rounded-xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur ${stickyTopClassName}`}>
      {couponBalanceBanner}
      {welcomeCodeBanner}
      {rewardsBanner}
      {earnMoreBanner}
      {deliveryBanner}
    </div>
  );
}
