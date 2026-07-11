import { useEffect, useState } from "react";
import { X, Gift, Briefcase, ShoppingBag, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";

// Shown once per browser session, a few seconds after the homepage loads —
// long enough to clear the branded splash. Replaces the earlier
// Business-Account-only promo modal: every visitor now sees all three real
// paths (Sole Merchant, Business, or just browsing), not just one.
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

        <div className="px-6 pb-2 pt-6">
          <p id="starter-modal-title" className="font-display text-xl text-foreground">
            Welcome to Moments Packaging
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Which one sounds like you?</p>
        </div>

        <div className="space-y-2 px-6 py-4">
          <button
            type="button"
            onClick={() => pick(() => openRegister({ accountType: "SOLE_MERCHANT" }))}
            className="flex w-full items-center gap-3 rounded-xl border border-border p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-secondary/30"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <Gift className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">I'm an individual — Sole Merchant</span>
              <span className="block text-xs text-muted-foreground">Free account, welcome points, rewards on every order.</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
            className="flex w-full items-center gap-3 rounded-xl border border-border p-3.5 text-left transition-colors hover:border-accent/50 hover:bg-secondary/30"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <Briefcase className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">I'm ordering for a business</span>
              <span className="block text-xs text-muted-foreground">Order history, rewards, first in line for trade credit.</span>
            </span>
          </button>

          <button
            type="button"
            onClick={dismiss}
            className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border p-3.5 text-left transition-colors hover:bg-secondary/30"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
              <ShoppingBag className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">Just browsing</span>
              <span className="block text-xs text-muted-foreground">Buy and track your order — no account needed.</span>
            </span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-1.5 border-t border-border px-6 py-3.5 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5 text-accent" />
          Already have an account?
          <button type="button" onClick={() => pick(() => openLogin())} className="font-semibold text-accent hover:underline">
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
