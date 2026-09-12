import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useRewardDeliveryGap } from "@/hooks/useRewardDeliveryGap";

const AUTO_DISMISS_MS = 3000;

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

/**
 * The "obvious next step is checkout" surface — replaces the plain text toast that used to fire
 * on every add-to-cart with a slide-in panel naming what was just added, the single nearest
 * reward/free-delivery incentive (same ranking RewardDeliveryBanners uses, via
 * useRewardDeliveryGap's shared primaryGap), and an unmissable Checkout CTA alongside a quiet
 * "Keep shopping" dismiss.
 * <p>
 * Deliberately NOT built on the shared Sheet/Radix-Dialog primitive (components/ui/sheet.tsx) —
 * that one renders a full-screen overlay that blocks pointer events on the page behind it even at
 * a high z-index (see its own comment), which is the opposite of the point here: this must never
 * interrupt continued browsing. This is a plain, non-modal, dismissible panel instead.
 * <p>
 * One instance is mounted globally (SiteLayout for every inner page; index.tsx's homepage
 * separately, since the homepage builds its own layout rather than using SiteLayout) and reacts to
 * CartContext's `lastAdded`, so it fires no matter which surface actually called addItem —
 * card quick-add, the configurator, or the PDP's own buttons all funnel through the same place.
 */
export function CartAddedSheet() {
  const navigate = useNavigate();
  const { lastAdded, cartTotal } = useCart();
  const { primaryGap, bonusCoupons } = useRewardDeliveryGap();

  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  // Drives the countdown bar's animation-play-state — kept in lockstep with the dismiss timer
  // itself (paused/resumed from the exact same hover/focus/blur handlers) rather than a separate
  // signal, so the bar can never show "still running" while the timer is actually paused or vice
  // versa.
  const [paused, setPaused] = useState(false);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNonce = useRef<number | null>(null);

  const clearDismissTimer = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
    setPaused(true);
  };

  const scheduleDismiss = () => {
    clearDismissTimer();
    setPaused(false);
    dismissTimer.current = setTimeout(() => close(), AUTO_DISMISS_MS);
  };

  const close = () => {
    clearDismissTimer();
    setClosing(true);
    // Let the slide-out transition finish before unmounting.
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  };

  useEffect(() => {
    if (!lastAdded || lastAdded.nonce === lastNonce.current) return;
    lastNonce.current = lastAdded.nonce;
    setClosing(false);
    setOpen(true);
    scheduleDismiss();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAdded]);

  useEffect(() => () => clearDismissTimer(), []);

  if (!open || !lastAdded) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={clearDismissTimer}
      onMouseLeave={scheduleDismiss}
      onFocus={clearDismissTimer}
      onBlur={scheduleDismiss}
      className={`fixed inset-x-3 bottom-[calc(var(--bottom-nav-height,64px)+10px)] z-[130] transition-all duration-200 ease-out sm:inset-x-auto sm:bottom-auto sm:right-4 sm:top-[calc(var(--site-header-bottom,4.5rem)+8px)] sm:w-80 ${
        closing ? "translate-y-2 opacity-0 sm:translate-x-2 sm:translate-y-0" : "translate-y-0 opacity-100 sm:translate-x-0"
      }`}
    >
      <div
        // A shade darker than the page's own --background (bg-secondary, not bg-background) —
        // per feedback, sets the toast apart from whatever page it's floating over just a bit,
        // without going full dark-mode-snackbar and fighting the clay accent for attention.
        className="overflow-hidden rounded-2xl bg-secondary shadow-[0_8px_28px_-6px_oklch(from_var(--clay)_l_c_h_/_0.35)]"
      >
        {/* Countdown bar — one-shot shrink over AUTO_DISMISS_MS, not infinite like the site's other
           keyframe animations, so it's keyed to lastAdded.nonce to restart per add rather than
           reusing a stale mid-shrink animation from the previous item. Paused in lockstep with the
           dismiss timer via the exact same handlers, so hovering/focusing the panel visibly holds
           the bar still instead of it silently finishing while the timer is actually paused. */}
        <div className="h-[3px] w-full bg-[oklch(from_var(--clay)_0.93_calc(c*0.4)_h)]">
          <div
            key={lastAdded.nonce}
            className="cart-sheet-countdown h-full w-full origin-left bg-[oklch(from_var(--clay)_calc(l-0.08)_c_h)]"
            style={{
              animation: `cart-sheet-countdown ${AUTO_DISMISS_MS}ms linear forwards`,
              animationPlayState: paused ? "paused" : "running",
            }}
          />
        </div>

        {/* One glanceable row: what got added, the single nearest incentive right underneath in
           the same breath (no separate bordered sub-panel — a real toast says one thing, not
           three stacked cards), then a light two-action line. Deliberately no border/ring on the
           outer shell either — the shadow alone is what makes this read as "floating message",
           not "docked panel", per the exact "this looks like a blocking modal" feedback. */}
        <div className="flex items-start gap-2.5 px-3 pb-2 pt-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[oklch(from_var(--clay)_0.93_calc(c*0.4)_h)] text-[oklch(from_var(--clay)_calc(l-0.08)_c_h)]">
            {lastAdded.primaryImageUrl ? (
              <img src={lastAdded.primaryImageUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <ShoppingBag className="h-3.5 w-3.5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-tight text-foreground">
              <span className="font-semibold">Added</span> · {lastAdded.quantity.toLocaleString()} {lastAdded.unitLabel} {lastAdded.productName}
            </p>
            {lastAdded.isBackorder ? (
              <p className="mt-0.5 text-[11px] font-medium text-amber-600">Backorder — extended lead time</p>
            ) : primaryGap ? (
              <div className="mt-1">
                <p className="text-[11px] leading-tight text-muted-foreground">
                  {fmtKes(primaryGap.amount)} more to {primaryGap.benefit}
                  {bonusCoupons > 0 && ` +${bonusCoupons} coupon${bonusCoupons === 1 ? "" : "s"}`}
                </p>
                <div className="mt-1 h-[3px] w-full max-w-[10rem] overflow-hidden rounded-full bg-[oklch(from_var(--clay)_0.93_calc(c*0.4)_h)]">
                  <div
                    className="h-full rounded-full bg-[oklch(from_var(--clay)_calc(l-0.08)_c_h)] transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(4, (cartTotal / (cartTotal + primaryGap.amount)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-foreground/30 transition-colors hover:bg-secondary hover:text-foreground"
          >
            ×
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 px-3 pb-2.5">
          <button
            type="button"
            onClick={close}
            className="shrink-0 px-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Keep shopping
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              navigate("/checkout");
            }}
            className="shrink-0 rounded-full bg-[oklch(from_var(--clay)_calc(l-0.08)_c_h)] px-3.5 py-1.5 text-center text-[12px] font-semibold leading-tight text-white transition-opacity hover:opacity-90"
          >
            Checkout · {fmtKes(cartTotal)}
          </button>
        </div>
      </div>
    </div>
  );
}
