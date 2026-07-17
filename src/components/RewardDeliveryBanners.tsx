import { useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useRewardDeliveryGap } from "@/hooks/useRewardDeliveryGap";
import { useCountUp } from "@/hooks/useCountUp";

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function AnimatedKes({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{fmtKes(animated)}</>;
}

function AnimatedNumber({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{animated}</>;
}

/**
 * A single, truly-fixed bar pinned just below the site header — not `position: sticky`, which
 * silently stopped working here because its parent wrapper had no extra height for it to stick
 * within, so it just scrolled away with the rest of the cart (the exact complaint this replaces).
 * `fixed` guarantees it stays on screen at every scroll position, matching the actual goal: a
 * customer should never have to scroll back up to see how much more they need to spend.
 *
 * Shows exactly one message at a time — text-forward, dot-bullet instead of an icon badge,
 * inspired by (not copied from) the plain colored-bar style of other sites' offer banners —
 * rather than stacking several competing cards, so there's one thing to read, always the most
 * relevant one: sign up (best conversion moment) > spend-more gap (the money mover) > redeemable
 * balance > "you're all set" confirmation.
 *
 * Renders nothing when there's nothing to say — callers should reserve layout space for it
 * (see REWARD_BANNER_SPACER_CLASS) so content doesn't jump when it appears.
 *
 * `topOffsetClassName` lets a caller override where the bar sits — the default matches the site
 * header; checkout renders as its own full-screen overlay with different chrome above it, so it
 * passes its own offset instead.
 */
export function RewardDeliveryBanners({ topOffsetClassName = "top-16 sm:top-20" }: { topOffsetClassName?: string }) {
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

  let content: React.ReactNode = null;
  let tone: "accent" | "success" = "accent";

  // A leading bullet drawn inline with the text (not a flex sibling) so the whole message wraps
  // as one natural paragraph on narrow screens instead of being squeezed onto a single truncated
  // line — the actual bug being fixed here (mobile was cutting the message off with "...").
  const bullet = <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current align-middle" />;

  if (!isAuthenticated) {
    content = (
      <button type="button" onClick={() => openLogin({})} className="block w-full text-center leading-snug">
        {bullet}
        Create a free account or log in — this order could be earning you Reward Coupons toward real discounts.{" "}
        <span className="underline underline-offset-2">Sign up</span>
      </button>
    );
  } else if (primaryGap) {
    content = (
      <div className="text-center leading-snug">
        {bullet}
        Shop <AnimatedKes value={primaryGap.amount} /> more to {primaryGap.benefit}
        {bonusCoupons > 0 && (
          <> — plus earn <AnimatedNumber value={bonusCoupons} /> more coupon{bonusCoupons === 1 ? "" : "s"}</>
        )}
        .
      </div>
    );
  } else if (walletBalance != null && walletBalance > 0) {
    tone = "success";
    content = (
      <div className="text-center leading-snug">
        {bullet}
        You have <AnimatedNumber value={walletBalance} /> Reward Coupons ({fmtKes(walletBalanceValueKes ?? 0)}) ready to redeem at checkout.
      </div>
    );
  } else if (myTier || welcomeCodeReady || freeDeliveryUnlockedZoneLabel) {
    tone = "success";
    const parts = [
      myTier ? `you're on the ${myTier.tierName} tier (${myTier.discountPercent}% off)` : null,
      welcomeCodeReady && welcomeCode ? `your welcome code ${welcomeCode} is ready` : null,
      freeDeliveryUnlockedZoneLabel ? `free delivery to ${freeDeliveryUnlockedZoneLabel}` : null,
    ].filter((p): p is string => Boolean(p));
    content = (
      <div className="text-center leading-snug">
        {bullet}
        You're all set on this order — {parts.join(", ")}.
      </div>
    );
  }

  if (!content) return null;

  return (
    <div
      className={`fixed inset-x-0 z-40 px-3 py-2.5 text-xs font-semibold sm:text-sm ${topOffsetClassName} ${
        tone === "success" ? "bg-emerald-600 text-white" : "bg-accent text-accent-foreground"
      }`}
    >
      {content}
    </div>
  );
}

/** Reserve this much vertical space wherever RewardDeliveryBanners is mounted, so the fixed bar
 *  doesn't cover the content immediately below it. Taller on mobile since the full (no longer
 *  truncated) message can wrap to two lines on a narrow screen; a single line comfortably fits
 *  from sm: up. */
export const REWARD_BANNER_SPACER_CLASS = "h-14 sm:h-10";
