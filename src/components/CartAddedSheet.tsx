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
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNonce = useRef<number | null>(null);

  const clearDismissTimer = () => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  };

  const scheduleDismiss = () => {
    clearDismissTimer();
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
      <div className="overflow-hidden rounded-xl border border-border bg-background shadow-lg ring-1 ring-black/5">
        <div className="flex items-center gap-2.5 p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest/10 text-forest">
            {lastAdded.primaryImageUrl ? (
              <img src={lastAdded.primaryImageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <ShoppingBag className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold leading-tight text-foreground">Added to cart</p>
            <p className="truncate text-[13px] leading-tight text-muted-foreground">
              {lastAdded.quantity.toLocaleString()} {lastAdded.unitLabel} · {lastAdded.productName}
            </p>
            {lastAdded.isBackorder && (
              <p className="mt-0.5 text-xs font-medium text-amber-600">Backorder — extended lead time</p>
            )}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-foreground/40 transition-colors hover:bg-secondary hover:text-foreground"
          >
            ×
          </button>
        </div>

        {primaryGap && (
          <div className="border-t border-border bg-secondary/40 px-3 py-2">
            <p className="text-xs font-medium text-foreground">
              {fmtKes(primaryGap.amount)} more to {primaryGap.benefit}
              {bonusCoupons > 0 && ` — plus earn ${bonusCoupons} more coupon${bonusCoupons === 1 ? "" : "s"}`}.
            </p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-forest transition-all"
                style={{
                  width: `${Math.min(100, Math.max(4, (cartTotal / (cartTotal + primaryGap.amount)) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-stretch gap-2 border-t border-border p-2.5">
          <button
            type="button"
            onClick={close}
            className="flex flex-1 items-center justify-center rounded-full border border-border px-3 py-2 text-center text-[13px] font-semibold leading-tight text-foreground transition-colors hover:bg-secondary"
          >
            Keep shopping
          </button>
          <button
            type="button"
            onClick={() => {
              close();
              navigate("/checkout");
            }}
            className="flex flex-1 items-center justify-center rounded-full bg-primary px-3 py-2 text-center text-[13px] font-semibold leading-tight text-primary-foreground transition-opacity hover:opacity-90"
          >
            Checkout · {fmtKes(cartTotal)}
          </button>
        </div>
      </div>
    </div>
  );
}
