import { useEffect, useState } from "react";
import { X, Gift, Briefcase, ShoppingBag, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";

// Shown once per browser session, a few seconds after the homepage loads —
// long enough to clear the branded splash. Replaces the earlier
// Business-Account-only promo modal: every visitor now sees all three real
// paths (Individual Shopper, Business, or just browsing), not just one.
const STORAGE_KEY = "moments_starter_modal_shown";
const SHOW_DELAY_MS = 3600;

function shouldShow(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

export function WelcomeStarterModal() {
  const { isAuthenticated } = useAuth();
  const { openLogin, openRegister } = useAuthModal();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shouldShow() || isAuthenticated) return;
    const t = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  function dismiss() {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  function pick(action: () => void) {
    dismiss();
    action();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="starter-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-300"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pb-4 pt-7 text-center">
          <p id="starter-modal-title" className="font-display text-2xl leading-tight text-foreground">
            Get 100 points free — just for signing up
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Do you order packaging regularly? Every order you place earns points toward real checkout
            discounts, plus referral rewards and VIP tiers — and if you're ordering for a business, first
            access when trade credit launches.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 px-6 pb-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => pick(() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" }))}
            className="flex flex-col items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] px-3 py-4 text-center transition-colors hover:bg-accent/[0.12]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Gift className="h-4.5 w-4.5" />
            </span>
            <span className="text-xs font-semibold text-foreground">Individual Shopper</span>
            <span className="text-[10.5px] leading-tight text-muted-foreground">Free — 100 points on signup</span>
          </button>

          <button
            type="button"
            onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
            className="flex flex-col items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] px-3 py-4 text-center transition-colors hover:bg-accent/[0.12]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Briefcase className="h-4.5 w-4.5" />
            </span>
            <span className="text-xs font-semibold text-foreground">Business</span>
            <span className="text-[10.5px] leading-tight text-muted-foreground">Free — trade credit ready</span>
          </button>

          <button
            type="button"
            onClick={dismiss}
            className="flex flex-col items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] px-3 py-4 text-center transition-colors hover:bg-accent/[0.12]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <ShoppingBag className="h-4.5 w-4.5" />
            </span>
            <span className="text-xs font-semibold text-foreground">Just Browsing</span>
            <span className="text-[10.5px] leading-tight text-muted-foreground">Shop now, decide later</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 px-6 pb-6 pt-4 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Already have an account?
          <button type="button" onClick={() => pick(() => openLogin())} className="font-semibold text-accent hover:underline">
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
