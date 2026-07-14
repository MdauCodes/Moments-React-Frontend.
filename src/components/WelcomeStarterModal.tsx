import { useEffect, useState } from "react";
import { X, Gift, Briefcase, ShoppingBag, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import avatarLeft from "@/assets/avatars/avatar_1.png";
import avatarRight from "@/assets/avatars/avatar_2.png";

// Shown once per browser session, a few seconds after the homepage loads —
// long enough to clear the branded splash. Replaces the earlier
// Business-Account-only promo modal: every visitor now sees all three real
// paths (Business, Individual, or no account at all), not just one.
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={dismiss}
    >
      <div
        className="relative flex w-full max-w-3xl items-end justify-center overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 duration-300"
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

        {/* Left avatar — ushers inward from the edge, desktop only */}
        <img
          src={avatarLeft}
          alt=""
          aria-hidden="true"
          className="hidden h-48 w-auto shrink-0 object-contain object-bottom sm:block"
        />

        <div className="min-w-0 flex-1 px-5 pb-6 pt-7 text-center sm:px-2">
          {/* Mobile-only avatar, centered above the copy */}
          <img
            src={avatarLeft}
            alt=""
            aria-hidden="true"
            className="mx-auto mb-2 h-20 w-20 object-contain sm:hidden"
          />

          <p id="starter-modal-title" className="font-display text-2xl leading-tight text-foreground">
            Here at Moments Packaging, we believe your loyalty should pay you back.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Get 100 Reward Coupons free just for joining, and keep earning every time you order — real discounts,
            referral rewards, and VIP perks along the way.
          </p>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-accent">
            Choose how you'd like to shop with us
          </p>

          <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
              className="flex flex-col items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] px-3 py-4 text-center transition-colors hover:bg-accent/[0.12]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                <Briefcase className="h-4.5 w-4.5" />
              </span>
              <span className="text-xs font-semibold text-foreground">Create a Business Account</span>
              <span className="text-[10.5px] leading-tight text-muted-foreground">Welcome bonus + trade credit ready</span>
            </button>

            <button
              type="button"
              onClick={() => pick(() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" }))}
              className="flex flex-col items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] px-3 py-4 text-center transition-colors hover:bg-accent/[0.12]"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                <Gift className="h-4.5 w-4.5" />
              </span>
              <span className="text-xs font-semibold text-foreground">Create an Individual Account</span>
              <span className="text-[10.5px] leading-tight text-muted-foreground">Free — 100 Reward Coupons on signup</span>
            </button>

            <button
              type="button"
              onClick={dismiss}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-secondary/20 px-3 py-4 text-center transition-colors hover:bg-secondary/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                <ShoppingBag className="h-4.5 w-4.5" />
              </span>
              <span className="text-xs font-semibold text-foreground">I don't want to create an account</span>
              <span className="text-[10.5px] leading-tight text-muted-foreground">Just let me shop</span>
            </button>
          </div>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
            Already have an account?
            <button type="button" onClick={() => pick(() => openLogin())} className="font-semibold text-accent hover:underline">
              Sign in
            </button>
          </div>
        </div>

        {/* Right avatar — mirrors the left, ushers inward from the other edge */}
        <img
          src={avatarRight}
          alt=""
          aria-hidden="true"
          className="hidden h-48 w-auto shrink-0 object-contain object-bottom sm:block"
        />
      </div>
    </div>
  );
}
