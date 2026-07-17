import { useMemo } from "react";
import { Gift, ChevronRight, Ticket, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useRewardDeliveryGap } from "@/hooks/useRewardDeliveryGap";
import { useCountUp } from "@/hooks/useCountUp";

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

/** Renders an animated KES figure that counts toward its target whenever the cart total changes,
 *  instead of snapping instantly — a visual cue that the banner is live, not static copy. */
function AnimatedKes({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{fmtKes(animated)}</>;
}

function AnimatedNumber({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{animated}</>;
}

/**
 * Sticky, always-visible, non-dismissible banner block at the top of /cart and checkout. Rather
 * than stacking several separate low-contrast nudges (easy to scan past), this collapses every
 * "spend more to unlock X" signal — VIP tier, free delivery, Business welcome code — into a
 * single bold headline banner built around whichever is closest, worded as "Shop KES Y more to
 * <benefit> — plus earn N more coupons", with the bonus-coupon figure computed from that same
 * top-up amount. A standing "you have coupons ready" reminder and an "already unlocked"
 * confirmation banner render alongside it when relevant. Skipped entirely if there's nothing to
 * show — never an empty shell.
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
    rewardsConfig,
    welcomeCode,
    kesToWelcomeCode,
    welcomeCodeReady,
  } = useRewardDeliveryGap();

  // ── Pick the single closest "spend more" gap to headline ──────────────────
  const primaryGap = useMemo(() => {
    const candidates: { amount: number; benefit: string }[] = [];
    if (kesToWelcomeCode != null && welcomeCode) {
      candidates.push({ amount: kesToWelcomeCode, benefit: `use your welcome code ${welcomeCode} for 5% off` });
    }
    if (kesToNextTier != null && nextTierName != null) {
      candidates.push({ amount: kesToNextTier, benefit: `unlock ${nextTierName} — ${nextTierDiscountPercent}% off every order` });
    }
    if (kesToFreeDelivery != null && freeDeliveryZoneLabel != null) {
      candidates.push({ amount: kesToFreeDelivery, benefit: `get free delivery to ${freeDeliveryZoneLabel}` });
    }
    if (candidates.length === 0) return null;
    return candidates.sort((a, b) => a.amount - b.amount)[0];
  }, [kesToWelcomeCode, welcomeCode, kesToNextTier, nextTierName, nextTierDiscountPercent, kesToFreeDelivery, freeDeliveryZoneLabel]);

  const bonusCoupons =
    primaryGap && rewardsConfig && rewardsConfig.pointsPer100Kes > 0
      ? Math.floor(primaryGap.amount / 100) * rewardsConfig.pointsPer100Kes
      : 0;

  // ── Headline banner: the primary gap, or a signup nudge, or nothing ───────
  let headline: React.ReactNode = null;
  if (!isAuthenticated) {
    headline = (
      <button
        type="button"
        onClick={() => openLogin({})}
        className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-accent bg-accent/10 px-4 py-3.5 text-left shadow-sm transition-colors hover:bg-accent/[0.16] sm:px-5 sm:py-4"
      >
        <span className="flex items-center gap-2.5 text-sm font-semibold text-foreground sm:text-base">
          <Gift className="h-5 w-5 shrink-0 text-accent" />
          Create a free account or log in — this order could be earning you Reward Coupons toward real discounts.
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-accent" />
      </button>
    );
  } else if (primaryGap) {
    headline = (
      <div className="animate-in fade-in slide-in-from-top-1 flex items-center gap-3 rounded-xl border-2 border-accent bg-accent/10 px-4 py-3.5 shadow-sm duration-300 sm:px-5 sm:py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <Sparkles className="h-4.5 w-4.5" />
        </span>
        <span className="text-sm font-semibold leading-snug text-foreground sm:text-base">
          Shop <span className="text-accent"><AnimatedKes value={primaryGap.amount} /></span> more to {primaryGap.benefit}
          {bonusCoupons > 0 && (
            <> — plus earn <span className="text-accent"><AnimatedNumber value={bonusCoupons} /> more coupon{bonusCoupons === 1 ? "" : "s"}</span></>
          )}
          .
        </span>
      </div>
    );
  } else if (myTier || welcomeCodeReady || freeDeliveryUnlockedZoneLabel) {
    const parts = [
      myTier ? `you're on the ${myTier.tierName} tier (${myTier.discountPercent}% off)` : null,
      welcomeCodeReady && welcomeCode ? `your welcome code ${welcomeCode} is ready` : null,
      freeDeliveryUnlockedZoneLabel ? `free delivery to ${freeDeliveryUnlockedZoneLabel}` : null,
    ].filter((p): p is string => Boolean(p));
    headline = (
      <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-4 py-3.5 shadow-sm sm:px-5 sm:py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
          <Sparkles className="h-4.5 w-4.5" />
        </span>
        <span className="text-sm font-semibold leading-snug text-foreground sm:text-base">
          You're all set on this order — {parts.join(", ")}.
        </span>
      </div>
    );
  }

  // ── Standing coupon-balance reminder — independent of the gap above ───────
  let couponBalanceBanner: React.ReactNode = null;
  if (isAuthenticated && walletBalance != null && walletBalance > 0) {
    couponBalanceBanner = (
      <div className="flex items-center gap-3 rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 px-4 py-3 shadow-sm sm:px-5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
          <Ticket className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-foreground">
          You have <b><AnimatedNumber value={walletBalance} /> Reward Coupons</b> ({fmtKes(walletBalanceValueKes ?? 0)}) ready to redeem at checkout.
        </span>
      </div>
    );
  }

  if (!headline && !couponBalanceBanner) return null;

  return (
    <div className={`sticky z-30 space-y-2.5 ${stickyTopClassName}`}>
      {headline}
      {couponBalanceBanner}
    </div>
  );
}
