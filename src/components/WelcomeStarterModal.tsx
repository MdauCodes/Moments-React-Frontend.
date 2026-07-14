import { useEffect, useState } from "react";
import { X, Gift, Briefcase, ShoppingBag, Check, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import avatarLeft from "@/assets/avatars/avatar_1.png";
import avatarRight from "@/assets/avatars/avatar_2.png";
import avatarShrug from "@/assets/avatars/avatar_3.png";

// Shown once per browser session, a few seconds after the homepage loads —
// long enough to clear the branded splash. Two-screen flow: the main offer
// screen, and — only if the visitor picks "no account" — a single second-
// thoughts screen explaining what they'd be skipping, with an easy way
// back to either path or to just continue anonymously.
const STORAGE_KEY = "moments_starter_modal_shown";
const SHOW_DELAY_MS = 3600;

type View = "main" | "decline";

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
  const [view, setView] = useState<View>("main");

  useEffect(() => {
    if (!shouldShow() || isAuthenticated) return;
    const t = setTimeout(() => {
      setView("main");
      setOpen(true);
    }, SHOW_DELAY_MS);
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-300"
      onClick={dismiss}
    >
      <div
        className={`relative w-full overflow-hidden rounded-3xl border border-white/40 bg-white/75 text-card-foreground shadow-2xl backdrop-blur-2xl transition-[max-width] duration-300 animate-in zoom-in-95 slide-in-from-bottom-2 ${
          view === "main" ? "max-w-3xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {view === "main" ? (
          <div key="main" className="px-5 py-6 sm:px-8 sm:py-8 animate-in fade-in duration-200">
            {/* Avatar 1's job: introduce the offer copy */}
            <div className="flex items-center gap-4 sm:gap-5">
              <img
                src={avatarLeft}
                alt=""
                aria-hidden="true"
                className="h-16 w-16 shrink-0 object-contain object-bottom sm:h-28 sm:w-28"
              />
              <div className="min-w-0 text-left">
                <p id="starter-modal-title" className="font-display text-xl leading-tight text-foreground sm:text-2xl">
                  Here at Moments Packaging, we believe your loyalty should pay you back.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Get 100 Reward Coupons free just for joining, and keep earning every time you order — real
                  discounts, referral rewards, and VIP perks along the way.
                </p>
              </div>
            </div>

            <p className="mt-6 text-center text-[11px] font-semibold uppercase tracking-wider text-accent sm:text-left sm:ml-[104px]">
              Choose how you'd like to shop with us
            </p>

            {/* Avatar 2's job: usher the button choices */}
            <div className="mt-2.5 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
              <div className="grid w-full grid-cols-1 gap-2.5 sm:flex-1 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
                  className="flex flex-col items-center gap-2 rounded-xl border border-accent/30 bg-white/50 px-3 py-4 text-center transition-colors hover:bg-accent/[0.12]"
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
                  className="flex flex-col items-center gap-2 rounded-xl border border-accent/30 bg-white/50 px-3 py-4 text-center transition-colors hover:bg-accent/[0.12]"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <Gift className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">Create an Individual Account</span>
                  <span className="text-[10.5px] leading-tight text-muted-foreground">Free — 100 Reward Coupons on signup</span>
                </button>

                <button
                  type="button"
                  onClick={() => setView("decline")}
                  className="flex flex-col items-center gap-2 rounded-xl border border-border bg-white/30 px-3 py-4 text-center transition-colors hover:bg-black/5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                    <ShoppingBag className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">I don't want to create an account</span>
                  <span className="text-[10.5px] leading-tight text-muted-foreground">Just let me shop</span>
                </button>
              </div>

              <img
                src={avatarRight}
                alt=""
                aria-hidden="true"
                className="hidden h-24 w-24 shrink-0 object-contain object-bottom sm:block"
              />
            </div>

            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              Already have an account?
              <button type="button" onClick={() => pick(() => openLogin())} className="font-semibold text-accent hover:underline">
                Sign in
              </button>
            </div>
          </div>
        ) : (
          <div key="decline" className="px-5 py-6 text-center sm:px-8 sm:py-8 animate-in fade-in duration-200">
            <button
              type="button"
              onClick={() => setView("main")}
              className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>

            <img
              src={avatarShrug}
              alt=""
              aria-hidden="true"
              className="mx-auto h-24 w-24 object-contain sm:h-28 sm:w-28"
            />

            <p id="starter-modal-title" className="mt-3 font-display text-xl leading-tight text-foreground sm:text-2xl">
              Before you go — here's what you'd be skipping
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              No account means no Reward Coupons, no order history, no referral rewards, and no VIP tier discounts
              on future orders. You can still shop freely — just without any of that following you home.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-accent/30 bg-white/50 px-3 py-3.5 text-center transition-colors hover:bg-accent/[0.12]"
              >
                <span className="text-xs font-semibold text-foreground">Create a Business Account</span>
                <span className="text-[10.5px] leading-tight text-muted-foreground">Welcome bonus + trade credit ready</span>
              </button>
              <button
                type="button"
                onClick={() => pick(() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" }))}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-accent/30 bg-white/50 px-3 py-3.5 text-center transition-colors hover:bg-accent/[0.12]"
              >
                <span className="text-xs font-semibold text-foreground">Create an Individual Account</span>
                <span className="text-[10.5px] leading-tight text-muted-foreground">Free — 100 Reward Coupons on signup</span>
              </button>
            </div>

            <button
              type="button"
              onClick={dismiss}
              className="mt-3 w-full rounded-xl border border-border bg-transparent px-3 py-3 text-xs font-semibold text-foreground transition-colors hover:bg-black/5"
            >
              Continue without an account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
