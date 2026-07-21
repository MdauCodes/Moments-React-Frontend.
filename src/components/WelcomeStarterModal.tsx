import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, Gift, Briefcase, ShoppingBag, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { RewardsTermsLink } from "@/components/RewardsTermsLink";
import avatarLeft from "@/assets/avatars/avatar_1.png";
import avatarRight from "@/assets/avatars/avatar_2.png";
import avatarShrug from "@/assets/avatars/avatar_3.png";

// Shows a few seconds after any page loads (mounted globally in SiteLayout) — long enough to
// clear the branded splash — and, for a visitor who dismisses it while still not logged in,
// keeps re-appearing as they keep browsing or navigate to a new page. No show-count cap: per
// the client's explicit call, this stays up for as long as the visitor is unauthenticated,
// on every page. Two-screen flow: the main offer screen, and — only if the visitor picks
// "no account" — a single second-thoughts screen explaining what they'd be skipping, with an
// easy way back to either path or to just continue anonymously.
const SHOW_DELAY_MS = 1800;
const REAPPEAR_DELAY_MS = 45_000;

// Brand palette used on the Company Profile / Sustainability pages — the client asked for the
// welcome modal to match that dark-green + gold look instead of the site's red/orange --accent,
// which read wrong here ("remove the red... contrast with the dark green, like on the website").
const FOREST_DEEP = "#08231a";
const FOREST = "#0d3320";
const GOLD = "#c9a44c";
const GOLD_SOFT = "#e8c878";

type View = "main" | "decline";

function shouldShow(): boolean {
  return true;
}

// Small CTA pill shown inside each option card so it's unmistakably a
// button, even though the whole card is the real clickable target — clicks
// on this pill bubble up to the card's own onClick, so it doesn't need one.
function CtaPill({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "neutral" }) {
  return (
    <span
      className="mt-1 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10.5px] font-semibold"
      style={
        tone === "gold"
          ? { background: GOLD, color: FOREST_DEEP }
          : { background: "rgba(255,255,255,0.12)", color: "#fff" }
      }
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
      setView("main");
      setOpen(true);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  /** @param final true when the visitor engaged (register/login) — no re-appearance on this
   *  page. false for a plain close/"continue without an account", which re-arms another
   *  appearance shortly after if the visitor is still around and still unauthenticated. */
  function dismiss(final = false) {
    setOpen(false);
    if (final || isAuthenticated || !shouldShow()) return;
    const t = setTimeout(() => {
      if (!shouldShow() || isAuthenticated) return;
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
        className={`relative w-full rounded-3xl border shadow-2xl transition-[max-width] duration-300 animate-in zoom-in-95 slide-in-from-bottom-2 ${
          view === "main" ? "max-w-3xl" : "max-w-lg"
        }`}
        style={{
          background: `radial-gradient(ellipse at 100% 0%, ${FOREST} 0%, ${FOREST_DEEP} 60%, #061a13 100%)`,
          borderColor: `${GOLD}40`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => dismiss()}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {view === "main" ? (
          <>
            {/* Avatar 1's job: introduce the offer copy — breaks the card's
                top-left corner so it reads as a mascot standing in front of
                the panel, not artwork pasted inside it. Smaller on mobile —
                same corner-break idea, scaled to the narrower card and the
                backdrop margin around it (p-4 on the overlay), so it never
                overlaps the centered heading below. */}
            <img
              src={avatarLeft}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -left-4 -top-4 z-[5] h-16 w-16 select-none object-contain object-bottom drop-shadow-xl sm:-left-10 sm:-top-9 sm:h-40 sm:w-40 sm:drop-shadow-2xl"
            />
            {/* Avatar 2's job: usher the button choices — breaks the
                bottom-right corner near the button row. */}
            <img
              src={avatarRight}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-3 -bottom-3 z-[5] h-14 w-14 select-none object-contain object-bottom drop-shadow-xl sm:-right-8 sm:-bottom-6 sm:h-32 sm:w-32 sm:drop-shadow-2xl"
            />

            <div key="main" className="relative z-10 max-h-[85vh] overflow-y-auto px-4 pb-5 pt-14 sm:px-8 sm:py-8 sm:pl-16 sm:pt-8 animate-in fade-in duration-200">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="min-w-0">
                  <p id="starter-modal-title" className="font-display font-semibold text-lg leading-snug text-white sm:text-2xl sm:leading-tight">
                    Here at Moments Packaging, we believe your loyalty should pay you back.
                  </p>
                  <p className="mt-1.5 text-[13px] leading-snug text-white/80 sm:mt-2 sm:text-sm sm:leading-normal">
                    Every account gets 1,000 Coupon Points (worth KES 100) free when you join. Earn more with every
                    order through discounts, referral rewards, and VIP perks. Open a Business Account to unlock a
                    one-time 5% promo code after your trade profile is approved.
                  </p>
                  <p className="mt-1.5 text-[11px] text-white/70">
                    Full details in the{" "}
                    <RewardsTermsLink className="underline underline-offset-2 text-[#e8c878]">
                      offer terms
                    </RewardsTermsLink>
                    .
                  </p>
                </div>
              </div>

              <p className="mt-4 text-center text-[11px] font-semibold uppercase tracking-wider sm:mt-6 sm:text-left" style={{ color: GOLD_SOFT }}>
                Choose how you'd like to shop with us
              </p>

              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div
                  className="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-center shadow-sm sm:gap-2 sm:py-4"
                  style={{ borderColor: `${GOLD}33`, background: `${GOLD}14` }}
                >
                  <button
                    type="button"
                    onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
                    className="flex flex-col items-center gap-1.5 sm:gap-2"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `${GOLD}26`, color: GOLD_SOFT }}>
                      <Briefcase className="h-4.5 w-4.5" />
                    </span>
                    <span className="text-xs font-semibold text-white">Create a Business Account</span>
                    <span className="text-[10.5px] leading-tight text-white/70">1,000 coupons + a one-time 5% welcome code</span>
                    <CtaPill>Get started</CtaPill>
                  </button>
                  <Link
                    to="/account-options#business"
                    onClick={() => dismiss(true)}
                    className="text-[10px] font-medium underline underline-offset-2 hover:opacity-80"
                    style={{ color: GOLD_SOFT }}
                  >
                    Learn more
                  </Link>
                </div>

                <div
                  className="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-center shadow-sm sm:gap-2 sm:py-4"
                  style={{ borderColor: `${GOLD}33`, background: `${GOLD}14` }}
                >
                  <button
                    type="button"
                    onClick={() => pick(() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" }))}
                    className="flex flex-col items-center gap-1.5 sm:gap-2"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: `${GOLD}26`, color: GOLD_SOFT }}>
                      <Gift className="h-4.5 w-4.5" />
                    </span>
                    <span className="text-xs font-semibold text-white">Create an Individual Shopper account</span>
                    <span className="text-[10.5px] leading-tight text-white/70">1,000 Reward Coupons on signup</span>
                    <CtaPill>Get started</CtaPill>
                  </button>
                  <Link
                    to="/account-options#individual"
                    onClick={() => dismiss(true)}
                    className="text-[10px] font-medium underline underline-offset-2 hover:opacity-80"
                    style={{ color: GOLD_SOFT }}
                  >
                    Learn more
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => setView("decline")}
                  className="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-center shadow-sm transition-colors hover:bg-white/10 sm:gap-2 sm:py-4"
                  style={{ borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)" }}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white/70">
                    <ShoppingBag className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-xs font-semibold text-white">I don't want to create an account</span>
                  <span className="text-[10.5px] leading-tight text-white/70">Just let me shop</span>
                  <CtaPill tone="neutral">Continue</CtaPill>
                </button>
              </div>

              <button
                type="button"
                onClick={() => pick(() => openLogin())}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold shadow-sm transition-colors hover:bg-white/5"
                style={{ borderColor: GOLD, color: GOLD_SOFT }}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Already have an account? Sign in
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
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
                className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>

              <img
                src={avatarShrug}
                alt=""
                aria-hidden="true"
                className="mx-auto h-24 w-24 object-contain sm:hidden"
              />

              <p id="starter-modal-title" className="mt-3 font-display text-xl leading-tight text-white sm:mt-8 sm:text-2xl">
                Before you go — here's what you'd be skipping
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-white/75">
                Without an account, you can still shop as a guest—but you won't earn Reward Coupons, referral
                rewards, or VIP discounts, and your order history won't be saved. Create an account to unlock these
                benefits on future orders.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
                  className="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-center shadow-sm transition-colors hover:brightness-110"
                  style={{ borderColor: `${GOLD}33`, background: `${GOLD}14` }}
                >
                  <span className="text-xs font-semibold text-white">Create a Business Account</span>
                  <span className="text-[10.5px] leading-tight text-white/70">1,000 coupons + a one-time 5% welcome code</span>
                  <CtaPill>Get started</CtaPill>
                </button>
                <button
                  type="button"
                  onClick={() => pick(() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" }))}
                  className="flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3.5 text-center shadow-sm transition-colors hover:brightness-110"
                  style={{ borderColor: `${GOLD}33`, background: `${GOLD}14` }}
                >
                  <span className="text-xs font-semibold text-white">Create an Individual Shopper account</span>
                  <span className="text-[10.5px] leading-tight text-white/70">1,000 Reward Coupons on signup</span>
                  <CtaPill>Get started</CtaPill>
                </button>
              </div>

              <button
                type="button"
                onClick={() => pick(() => openLogin())}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors hover:bg-white/5"
                style={{ borderColor: GOLD, color: GOLD_SOFT }}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Already have an account? Sign in
              </button>

              <button
                type="button"
                onClick={() => dismiss()}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-white/10"
                style={{ borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)" }}
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
