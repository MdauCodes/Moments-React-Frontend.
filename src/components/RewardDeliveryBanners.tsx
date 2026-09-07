import { useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRewardDeliveryGap } from "@/hooks/useRewardDeliveryGap";
import { useCountUp } from "@/hooks/useCountUp";

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

/** Published on <html> as this bar's real, currently-rendered height (see the measuring effect
 *  below), so REWARD_BANNER_SPACER_CLASS can reserve exactly that much space — never more than
 *  the shortest message needs, never less than the longest one wraps to. A static height guess
 *  (the old "h-14 sm:h-10") was always either wasted space for a one-line message or an overlap
 *  for a message long enough to wrap further, e.g. the combined guest+gap message below. */
const BANNER_HEIGHT_VAR = "--reward-banner-h";

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
 * `topOffsetClassName` lets a caller override where the bar sits — checkout renders as its own
 * full-screen overlay with different chrome above it, so it passes its own fixed offset instead.
 * Left unset (every other caller, all of them under SiteLayout), it docks to SiteHeader's real,
 * currently-rendered bottom edge via `--site-header-bottom` (see SiteHeader.tsx) rather than a
 * guessed pixel offset — a hardcoded guess broke the moment anything else (CelebratoryRewardBanner,
 * the pre-launch banner) added height above the header, since this bar had no way to know that
 * height had grown and ended up overlapping the header instead of sitting below it.
 */
export function RewardDeliveryBanners({ topOffsetClassName }: { topOffsetClassName?: string }) {
  // Callback ref (not useRef+useEffect) so it fires exactly when the bar itself mounts, resizes
  // via content change, or unmounts (including the common case of `content` going from something
  // to null below and the div disappearing entirely) — a plain ref could go stale across that
  // transition and leave BANNER_HEIGHT_VAR reporting a bar that's no longer on screen.
  const roRef = useRef<ResizeObserver | null>(null);
  const barRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) {
      document.documentElement.style.setProperty(BANNER_HEIGHT_VAR, "0px");
      return;
    }
    const sync = () => {
      document.documentElement.style.setProperty(BANNER_HEIGHT_VAR, `${el.getBoundingClientRect().height}px`);
    };
    sync();
    roRef.current = new ResizeObserver(sync);
    roRef.current.observe(el);
  }, []);
  const { isAuthenticated } = useAuth();
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
      // Scoped to "hand-delivery" specifically, not a blanket "delivery" claim — the threshold
      // is only ever honoured for MANUAL_DELIVERY + HAND_DELIVERY within the zone (see
      // CheckoutService). A customer who picks TumaBoda instead pays full price regardless of
      // cart total; a generic "free delivery" promise would be false for that (very common,
      // prominently-branded) fulfillment choice.
      candidates.push({ amount: kesToFreeDelivery, benefit: `get free hand-delivery within ${freeDeliveryZoneLabel}` });
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

  // The sign-up nudge used to live here as a guest's top (and only, absent a gap) message —
  // it's now SignUpFab's job instead, so this banner can stay gap-first for every visitor,
  // guest or not, and never has to squeeze two asks into one line. See SignUpFab.tsx.
  if (primaryGap) {
    content = (
      <div className="text-center leading-snug">
        {bullet}
        Shop <AnimatedKes value={primaryGap.amount} /> more to {primaryGap.benefit}
        {isAuthenticated && bonusCoupons > 0 && (
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
      ref={barRef}
      className={`fixed inset-x-0 z-40 px-3 py-2 text-xs font-semibold sm:text-sm ${topOffsetClassName ?? ""} ${
        tone === "success" ? "bg-emerald-600 text-white" : "bg-accent text-accent-foreground"
      }`}
      style={topOffsetClassName ? undefined : { top: "var(--site-header-bottom, 4.5rem)" }}
    >
      {content}
    </div>
  );
}

/** Reserve exactly as much vertical space as the bar is actually rendering right now, wherever
 *  RewardDeliveryBanners is mounted, via the live BANNER_HEIGHT_VAR — a static height (the old
 *  "h-14 sm:h-10") was either wasted space for a short message or an overlap for a message long
 *  enough to wrap further. Falls back to 0px if the bar hasn't measured itself yet (first paint)
 *  or isn't mounted at all, so nothing reserves phantom space on a page that never shows it. */
export const REWARD_BANNER_SPACER_CLASS = "h-[var(--reward-banner-h,0px)]";
