import { useEffect, useState } from "react";
import { X, Gift, Briefcase, Check } from "lucide-react";
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
            Create a free account &amp; start earning
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Every order earns you points toward real discounts — plus referral rewards, VIP tiers, and for
            businesses, first-in-line access to trade credit.
          </p>
        </div>

        <div className="space-y-2.5 px-6 pb-2">
          <button
            type="button"
            onClick={() => pick(() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" }))}
            className="flex w-full items-center gap-3 rounded-xl bg-primary px-4 py-3.5 text-left text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
              <Gift className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-sm font-semibold">Individual Shopper Account</span>
              <span className="block text-[11px] opacity-85">Free — welcome bonus points on signup</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/40 px-4 py-3.5 text-left transition-colors hover:bg-secondary/70"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <Briefcase className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">Business Account</span>
              <span className="block text-[11px] text-muted-foreground">Free — order history + trade credit prospects</span>
            </span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 px-6 pb-6 pt-2 text-xs text-muted-foreground">
          <button type="button" onClick={dismiss} className="hover:underline">
            Just browsing
          </button>
          <span aria-hidden="true">·</span>
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
