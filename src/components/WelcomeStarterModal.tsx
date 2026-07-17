import { useEffect, useState } from "react";
import { X, Gift, Briefcase, ShoppingBag, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import avatarLeft from "@/assets/avatars/avatar_1.png";
import avatarRight from "@/assets/avatars/avatar_2.png";
import avatarShrug from "@/assets/avatars/avatar_3.png";

// Shows a few seconds after the homepage loads — long enough to clear the branded splash — and,
// for a visitor who dismisses it while still not logged in, re-appears a few more times as they
// keep browsing rather than vanishing for the rest of the session. Capped at MAX_SHOWS so it
// nudges rather than harasses. Two-screen flow: the main offer screen, and — only if the visitor
// picks "no account" — a single second-thoughts screen explaining what they'd be skipping, with
// an easy way back to either path or to just continue anonymously.
const SHOW_COUNT_KEY = "moments_starter_modal_show_count";
const SHOW_DELAY_MS = 1800;
const REAPPEAR_DELAY_MS = 45_000;
const MAX_SHOWS = 3;

type View = "main" | "decline";

function getShowCount(): number {
  if (typeof window === "undefined") return MAX_SHOWS;
  try {
    return Number(window.sessionStorage.getItem(SHOW_COUNT_KEY) ?? "0");
  } catch {
    return MAX_SHOWS;
  }
}

function recordShow() {
  try {
    window.sessionStorage.setItem(SHOW_COUNT_KEY, String(getShowCount() + 1));
  } catch {
    /* ignore */
  }
}

function shouldShow(): boolean {
  return getShowCount() < MAX_SHOWS;
}

// Small CTA pill shown inside each option card so it's unmistakably a
// button, even though the whole card is the real clickable target — clicks
// on this pill bubble up to the card's own onClick, so it doesn't need one.
function CtaPill({ children, tone = "accent" }: { children: React.ReactNode; tone?: "accent" | "neutral" }) {
  return (
    <span
      className={`mt-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10.5px] font-semibold ${
        tone === "accent" ? "bg-accent text-accent-foreground" : "bg-secondary text-foreground"
      }`}
    >
      {children}
      <ArrowRight className="h-3 w-3" />
    </span>
  );
}

export function WelcomeStarterModal() {
  const { isAuthenticated } = useAuth();
  const { openLogin, openRegister } = useAuthModal();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");

  useEffect(() => {
    if (!shouldShow() || isAuthenticated) return;
    const t = setTimeout(() => {
      recordShow();
      setView("main");
      setOpen(true);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  /** @param final true when the visitor engaged (register/login) — no re-appearance. false for a
   *  plain close/"continue without an account", which re-arms another appearance later if the
   *  visitor is still around and still unauthenticated, up to MAX_SHOWS. */
  function dismiss(final = false) {
    setOpen(false);
    if (final || isAuthenticated || !shouldShow()) return;
    const t = setTimeout(() => {
      if (!shouldShow() || isAuthenticated) return;
      recordShow();
      setView("main");
      setOpen(true);
    }, REAPPEAR_DELAY_MS);
    return () => clearTimeout(t);
  }

  function pick(action: () => void) {
    dismiss(true);
    action();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="starter-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-300"
      onClick={() => dismiss()}
    >
      <div
        className={`relative w-full rounded-3xl border border-white/40 bg-white/75 text-card-foreground shadow-2xl backdrop-blur-2xl transition-[max-width] duration-300 animate-in zoom-in-95 slide-in-from-bottom-2 ${
          view === "main" ? "max-w-3xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => dismiss()}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 rounded-full p-1.5 text-muted-foreground transition hover:bg-black/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {view === "main" ? (
          <>
            {/* Avatar 1's job: introduce the offer copy — breaks the card's
                top-left corner so it reads as a mascot standing in front of
                the panel, not artwork pasted inside it. */}
            <img
              src={avatarLeft}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -left-16 -top-14 z-[5] hidden h-60 w-60 select-none object-contain object-bottom drop-shadow-2xl sm:block"
            />
            {/* Avatar 2's job: usher the button choices — breaks the
                bottom-right corner near the button row. */}
            <img
              src={avatarRight}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-12 -bottom-8 z-[5] hidden h-48 w-48 select-none object-contain object-bottom drop-shadow-2xl sm:block"
            />

            <div key="main" className="relative z-10 max-h-[85vh] overflow-y-auto px-4 py-5 sm:px-8 sm:py-8 animate-in fade-in duration-200">
              <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-center sm:gap-4 sm:text-left">
                <img
                  src={avatarLeft}
                  alt=""
                  aria-hidden="true"
                  className="h-12 w-12 shrink-0 object-contain object-bottom sm:hidden"
                />
                <div className="min-w-0">
                  <p id="starter-modal-title" className="font-display text-lg leading-snug text-foreground sm:text-2xl sm:leading-tight">
                    Here at Moments Packaging, we believe your loyalty should pay you back.
                  </p>
                  <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground sm:mt-2 sm:text-sm sm:leading-normal">
                    Every account gets 1,000 Reward Coupons (worth about KES 100) free just for joining, and keeps
                    earning every time you order — real discounts, referral rewards, and VIP perks along the way.
                    Open a Business Account and you'll also unlock a one-time 5% welcome code once your trade
                    profile is set up.
                  </p>
                </div>
              </div>

              <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-wider text-accent sm:mt-6 sm:text-left">
                Choose how you'd like to shop with us
              </p>

              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/[0.09] px-3 py-3.5 text-center shadow-sm transition-colors hover:bg-accent/[0.16] sm:gap-2 sm:py-4"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <Briefcase className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">Create a Business Account</span>
                  <span className="text-[10.5px] leading-tight text-muted-foreground">1,000 coupons now, +5% welcome code later</span>
                  <CtaPill>Get started</CtaPill>
                </button>

                <button
                  type="button"
                  onClick={() => pick(() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" }))}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/[0.09] px-3 py-3.5 text-center shadow-sm transition-colors hover:bg-accent/[0.16] sm:gap-2 sm:py-4"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
                    <Gift className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">Create an Individual Shopper account</span>
                  <span className="text-[10.5px] leading-tight text-muted-foreground">Free — 1,000 Reward Coupons on signup</span>
                  <CtaPill>Get started</CtaPill>
                </button>

                <button
                  type="button"
                  onClick={() => setView("decline")}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 py-3.5 text-center shadow-sm transition-colors hover:bg-secondary sm:gap-2 sm:py-4"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                    <ShoppingBag className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-xs font-semibold text-foreground">I don't want to create an account</span>
                  <span className="text-[10.5px] leading-tight text-muted-foreground">Just let me shop</span>
                  <CtaPill tone="neutral">Continue</CtaPill>
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
          </>
        ) : (
          <>
            <img
              src={avatarShrug}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 -top-10 hidden h-28 w-28 -translate-x-1/2 select-none object-contain sm:block"
            />

            <div key="decline" className="relative z-10 max-h-[85vh] overflow-y-auto px-5 py-6 text-center sm:px-8 sm:py-8 animate-in fade-in duration-200">
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
                className="mx-auto h-24 w-24 object-contain sm:hidden"
              />

              <p id="starter-modal-title" className="mt-3 font-display text-xl leading-tight text-foreground sm:mt-8 sm:text-2xl">
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
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/[0.09] px-3 py-3.5 text-center shadow-sm transition-colors hover:bg-accent/[0.16]"
                >
                  <span className="text-xs font-semibold text-foreground">Create a Business Account</span>
                  <span className="text-[10.5px] leading-tight text-muted-foreground">1,000 coupons now, +5% welcome code later</span>
                  <CtaPill>Get started</CtaPill>
                </button>
                <button
                  type="button"
                  onClick={() => pick(() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" }))}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-accent/30 bg-accent/[0.09] px-3 py-3.5 text-center shadow-sm transition-colors hover:bg-accent/[0.16]"
                >
                  <span className="text-xs font-semibold text-foreground">Create an Individual Shopper account</span>
                  <span className="text-[10.5px] leading-tight text-muted-foreground">Free — 1,000 Reward Coupons on signup</span>
                  <CtaPill>Get started</CtaPill>
                </button>
              </div>

              <button
                type="button"
                onClick={() => dismiss()}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary/60 px-3 py-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
              >
                Continue without an account
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
