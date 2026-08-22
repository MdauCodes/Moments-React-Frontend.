import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Briefcase, ShoppingBag, Check, ArrowLeft, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { RewardsTermsLink } from "@/components/RewardsTermsLink";
import { MODAL_BG, MODAL_BORDER } from "@/lib/modalTheme";
import avatarLeft from "@/assets/avatars/avatar_1.png";
import avatarRight from "@/assets/avatars/avatar_2.png";
import avatarShrug from "@/assets/avatars/avatar_3.png";

// Shows a few seconds after any page loads (mounted globally in SiteLayout) — long enough to
// clear the branded splash. Two-screen flow: the main offer screen, and — only if the visitor
// picks "no account" — a single second-thoughts screen explaining what they'd be skipping, with
// an easy way back to either path or to explicitly continue anonymously.
//
// No X button and no backdrop-click dismiss, deliberately — either one let a visitor "soft
// close" the modal without deciding anything, which just re-armed it to pop back up a short
// while later and read as nagging. Every path out now requires an explicit choice: pick an
// account type, sign in, or hit "Continue without an account" on the decline screen (which sets
// the permanent per-session decline flag). If the visitor never engages at all and just keeps
// browsing/navigating, it can still show again on a later page load, capped at
// MAX_SHOWS_PER_SESSION — that part is unchanged and isn't the disruptive behavior this fixes.
const SHOW_DELAY_MS = 1800;
const MAX_SHOWS_PER_SESSION = 3;
const DECLINED_KEY = "moments_welcome_declined";
const SHOWN_COUNT_KEY = "moments_welcome_shown_count";

function hasDeclined(): boolean {
  try {
    return sessionStorage.getItem(DECLINED_KEY) === "true";
  } catch {
    return false;
  }
}

function getShownCount(): number {
  try {
    return Number(sessionStorage.getItem(SHOWN_COUNT_KEY) ?? "0");
  } catch {
    return 0;
  }
}

function recordShown(): void {
  try {
    sessionStorage.setItem(SHOWN_COUNT_KEY, String(getShownCount() + 1));
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — fail open, just skip the cap.
  }
}

function recordDeclined(): void {
  try {
    sessionStorage.setItem(DECLINED_KEY, "true");
  } catch {
    // ignore
  }
}

const FOREST_DEEP = "#08231a";
const FOREST = "#0d3320";
// Light gray wash for the two highlighted option cards — keeps them visually distinct from the
// plain-white "no account" card below without reaching for gold.
const CARD_BG = "#f4f4f2";
// Secondary link/CTA color — a neutral gray in place of the old gold-brown, checked against both
// CARD_BG and MODAL_BG for WCAG AA (4.5:1+) same as the contrast pass done on the gold version.
const GRAY_INK = "#57534e";

type View = "main" | "decline";

function shouldShow(): boolean {
  return !hasDeclined() && getShownCount() < MAX_SHOWS_PER_SESSION;
}

// Small CTA pill shown inside each option card so it's unmistakably a
// button, even though the whole card is the real clickable target — clicks
// on this pill bubble up to the card's own onClick, so it doesn't need one.
// Sized up (was text-[10.5px]/px-3 py-1) so it reads as a real, tappable button on all screens.
// One consistent dark-green/white style across all three options now — the old gold-vs-neutral
// tone split went away along with the gold accent itself.
function CtaPill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mt-1 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold"
      style={{ background: FOREST_DEEP, color: "#fff" }}
    >
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
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
      if (!shouldShow() || isAuthenticated) return;
      recordShown();
      setView("main");
      setOpen(true);
    }, SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  // No non-final path anymore — every call site here represents an actual decision (pick an
  // account type, sign in, or explicitly decline), so this just closes, full stop.
  function dismiss() {
    setOpen(false);
  }

  function pick(action: () => void) {
    dismiss();
    action();
  }

  /** The decline screen's "Continue without an account" — sets the permanent per-session
   *  decline flag so the modal doesn't show again on a later page load either. */
  function declineFinal() {
    recordDeclined();
    dismiss();
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="starter-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-300"
    >
      <div
        className={`relative w-full rounded-3xl border shadow-2xl transition-[max-width] duration-300 animate-in zoom-in-95 slide-in-from-bottom-2 ${
          view === "main" ? "max-w-3xl" : "max-w-lg"
        }`}
        style={{ background: MODAL_BG, borderColor: MODAL_BORDER }}
      >
        {view === "main" ? (
          <>
            {/* Avatar 1's job: introduce the offer copy — breaks the card's
                top-left corner so it reads as a mascot standing in front of
                the panel, not artwork pasted inside it. Sized down on mobile
                but kept close to the card edge (not the old -left-4/-top-4,
                which pushed it further into the overlay's tight p-4 margin
                and risked clipping on narrow phones) so it still reads as a
                deliberate mascot rather than a stray sticker. pt-20 below
                clears its full mobile height so it never overlaps the
                centered heading. */}
            <img
              src={avatarLeft}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -left-3 -top-3 z-[5] h-20 w-20 select-none object-contain object-bottom drop-shadow-xl sm:-left-10 sm:-top-9 sm:h-40 sm:w-40 sm:drop-shadow-2xl"
            />
            {/* Avatar 2's job: usher the button choices — breaks the
                bottom-right corner near the button row. Same edge-clipping
                fix as avatar 1 above. */}
            <img
              src={avatarRight}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-2 -bottom-2 z-[5] h-16 w-16 select-none object-contain object-bottom drop-shadow-xl sm:-right-8 sm:-bottom-6 sm:h-32 sm:w-32 sm:drop-shadow-2xl"
            />

            <div key="main" className="relative z-10 max-h-[85vh] overflow-y-auto px-4 pb-5 pt-20 sm:px-8 sm:py-8 sm:pl-16 sm:pt-8 animate-in fade-in duration-200">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="min-w-0">
                  <p id="starter-modal-title" className="font-display font-semibold text-lg leading-snug sm:text-2xl sm:leading-tight" style={{ color: FOREST_DEEP }}>
                    Here at Moments Packaging, we believe your loyalty should pay you back.
                  </p>
                  <p className="mt-1.5 text-[13px] leading-snug sm:mt-2 sm:text-sm sm:leading-normal" style={{ color: `${FOREST_DEEP}bf` }}>
                    Every account comes with 1,000 free Coupon Points (worth KES 100) when you join. Earn even more
                    with every order through exclusive discounts, referral rewards, and VIP perks. Open a Business
                    Account to unlock a one-time 5% promo code once your trade profile has been approved.
                  </p>
                  <p className="mt-1.5 text-[11px]" style={{ color: `${FOREST_DEEP}b3` }}>
                    See our{" "}
                    <RewardsTermsLink className="underline underline-offset-2 font-semibold text-[#57534e]">
                      Offer Terms
                    </RewardsTermsLink>{" "}
                    for full details.
                  </p>
                </div>
              </div>

              <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-wider sm:mt-6 sm:text-left" style={{ color: FOREST }}>
                Choose how you'd like to shop with us.
              </p>

              <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <div
                  className="flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 text-center shadow-sm sm:gap-2 sm:py-5"
                  style={{ borderColor: `${FOREST_DEEP}2e`, background: CARD_BG }}
                >
                  <button
                    type="button"
                    onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
                    className="flex flex-col items-center gap-1.5 sm:gap-2"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border shadow-sm" style={{ background: "#ffffff", borderColor: `${FOREST_DEEP}22`, color: FOREST_DEEP }}>
                      <Briefcase className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-bold" style={{ color: FOREST_DEEP }}>Create a Business Account</span>
                    <span className="text-[11.5px] leading-tight" style={{ color: `${FOREST_DEEP}b3` }}>1,000 coupons + a one-time 5% welcome code</span>
                    <CtaPill>Get started</CtaPill>
                  </button>
                  <Link
                    to="/account-options#business"
                    onClick={() => dismiss()}
                    className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                    style={{ color: GRAY_INK }}
                  >
                    Learn more
                  </Link>
                </div>

                <div
                  className="flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 text-center shadow-sm sm:gap-2 sm:py-5"
                  style={{ borderColor: `${FOREST_DEEP}2e`, background: CARD_BG }}
                >
                  <button
                    type="button"
                    onClick={() => pick(() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" }))}
                    className="flex flex-col items-center gap-1.5 sm:gap-2"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border shadow-sm" style={{ background: "#ffffff", borderColor: `${FOREST_DEEP}22`, color: FOREST_DEEP }}>
                      <Gift className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-bold" style={{ color: FOREST_DEEP }}>Create an Individual Shopper account</span>
                    <span className="text-[11.5px] leading-tight" style={{ color: `${FOREST_DEEP}b3` }}>1,000 Reward Coupons on signup</span>
                    <CtaPill>Get started</CtaPill>
                  </button>
                  <Link
                    to="/account-options#individual"
                    onClick={() => dismiss()}
                    className="text-xs font-semibold underline underline-offset-2 hover:opacity-80"
                    style={{ color: GRAY_INK }}
                  >
                    Learn more
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() => setView("decline")}
                  className="flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 text-center shadow-sm transition-colors hover:bg-black/5 sm:gap-2 sm:py-5"
                  style={{ borderColor: `${FOREST_DEEP}22`, background: "rgba(255,255,255,0.5)" }}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border shadow-sm" style={{ background: "#ffffff", borderColor: `${FOREST_DEEP}22`, color: FOREST_DEEP }}>
                    <ShoppingBag className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold" style={{ color: FOREST_DEEP }}>I don't want to create an account</span>
                  <span className="text-[11.5px] leading-tight" style={{ color: `${FOREST_DEEP}b3` }}>Just let me shop</span>
                  <CtaPill>Continue</CtaPill>
                </button>
              </div>

              <button
                type="button"
                onClick={() => pick(() => openLogin())}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-bold shadow-md transition-transform hover:scale-[1.01]"
                style={{ background: FOREST_DEEP, color: "#fff" }}
              >
                <Check className="h-4.5 w-4.5" aria-hidden="true" />
                Already have an account? Sign in
                <ArrowRight className="h-4.5 w-4.5" aria-hidden="true" />
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
                className="mb-3 inline-flex items-center gap-1 text-xs font-semibold hover:opacity-70"
                style={{ color: `${FOREST_DEEP}b3` }}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>

              <img
                src={avatarShrug}
                alt=""
                aria-hidden="true"
                className="mx-auto h-24 w-24 object-contain sm:hidden"
              />

              <p id="starter-modal-title" className="mt-3 font-display text-xl leading-tight sm:mt-8 sm:text-2xl" style={{ color: FOREST_DEEP }}>
                Before you go — here's what you'd be skipping
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm" style={{ color: `${FOREST_DEEP}bf` }}>
                Without an account, you can still shop as a guest—but you won't earn Reward Coupons, referral
                rewards, or VIP discounts, and your order history won't be saved. Create an account to unlock these
                benefits on future orders.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => pick(() => openRegister({ accountType: "BUSINESS" }))}
                  className="flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 text-center shadow-sm transition-colors hover:brightness-95"
                  style={{ borderColor: `${FOREST_DEEP}2e`, background: CARD_BG }}
                >
                  <span className="text-sm font-bold" style={{ color: FOREST_DEEP }}>Create a Business Account</span>
                  <span className="text-[11.5px] leading-tight" style={{ color: `${FOREST_DEEP}b3` }}>1,000 coupons + a one-time 5% welcome code</span>
                  <CtaPill>Get started</CtaPill>
                </button>
                <button
                  type="button"
                  onClick={() => pick(() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" }))}
                  className="flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-4 text-center shadow-sm transition-colors hover:brightness-95"
                  style={{ borderColor: `${FOREST_DEEP}2e`, background: CARD_BG }}
                >
                  <span className="text-sm font-bold" style={{ color: FOREST_DEEP }}>Create an Individual Shopper account</span>
                  <span className="text-[11.5px] leading-tight" style={{ color: `${FOREST_DEEP}b3` }}>1,000 Reward Coupons on signup</span>
                  <CtaPill>Get started</CtaPill>
                </button>
              </div>

              <button
                type="button"
                onClick={() => pick(() => openLogin())}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-bold shadow-md transition-transform hover:scale-[1.01]"
                style={{ background: FOREST_DEEP, color: "#fff" }}
              >
                <Check className="h-4.5 w-4.5" aria-hidden="true" />
                Already have an account? Sign in
              </button>

              <button
                type="button"
                onClick={declineFinal}
                className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-3 text-sm font-bold shadow-sm transition-colors hover:bg-black/5"
                style={{ borderColor: `${FOREST_DEEP}22`, background: "rgba(255,255,255,0.5)", color: FOREST_DEEP }}
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
