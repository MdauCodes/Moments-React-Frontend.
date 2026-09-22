import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Briefcase, ShoppingBag, Check, ArrowLeft, ArrowRight, X } from "lucide-react";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { RewardsTermsLink } from "@/components/RewardsTermsLink";
import { MODAL_BG, MODAL_BORDER } from "@/lib/modalTheme";
import { markWelcomeOfferDeclined, markWelcomeOfferSnoozed } from "@/components/engagement/promptEligibility";
import avatarLeft from "@/assets/avatars/avatar_1.png";
import avatarRight from "@/assets/avatars/avatar_2.png";
import avatarShrug from "@/assets/avatars/avatar_3.png";

// WHEN this appears is no longer this component's business. It used to arm its own 2.5-second
// timer on every page load, which is precisely why a first-time visitor met a full-screen,
// un-closable modal before they had seen a single product. It is now rendered only when the
// engagement gate decides the moment has earned it — after real dwell time, or after an order —
// see components/engagement/EngagementPrompts.tsx. The gate also owns the two long-standing
// throttles this file used to own (per-session show cap, cross-session decline cooldown); they
// live in components/engagement/promptEligibility.ts now, unchanged in substance.
//
// WHAT it says is unchanged. Two-screen flow: the main offer screen, and — only if the visitor
// picks "no account" — a single second-thoughts screen explaining what they'd be skipping, with
// an easy way back to either path or to explicitly continue anonymously.
//
// There is now an × and an Escape key. The original objection to them was sound at the time — a
// "soft close" that decided nothing just re-armed the modal to pop back a few minutes later, which
// is what made it read as nagging — so the fix is in the semantics, not in withholding the
// control. Three distinct answers, three different cooldowns:
//
//   × or Escape ......... "not now". Counts against the per-session show cap (the gate consumes
//                         that the moment it opens) AND sets a 1-day cross-session snooze, so it
//                         does not greet the same person again on their next visit today.
//   "Continue without
//    an account" ........ a real no. Keeps the existing 3-day decline cooldown.
//   Pick an account /
//    sign in ............ answered; an authenticated visitor is never shown it again at all.
//
// Backdrop clicks still do NOT dismiss. A mis-aimed tap on a phone should not silently spend a
// visitor's answer for them — × and Escape are deliberate, a stray tap is not.

const FOREST_DEEP = "#08231a";
const FOREST = "#0d3320";
// Light gray wash for the two highlighted option cards — keeps them visually distinct from the
// plain-white "no account" card below without reaching for gold.
const CARD_BG = "#f4f4f2";
// Secondary link/CTA color — a neutral gray in place of the old gold-brown, checked against both
// CARD_BG and MODAL_BG for WCAG AA (4.5:1+) same as the contrast pass done on the gold version.
const GRAY_INK = "#57534e";

type View = "main" | "decline";

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

export function WelcomeStarterModal({ onClose }: { onClose: () => void }) {
  const { openLogin, openRegister } = useAuthModal();
  const [view, setView] = useState<View>("main");
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusToRef = useRef<HTMLElement | null>(null);

  // Move focus into the dialog on open and hand it back on close. Without this a keyboard or
  // screen-reader user stayed parked wherever they were on the page underneath, tabbing through
  // content they could no longer see — and a modal this app deliberately gives no close button
  // to is the last place that should be hard to reach.
  useEffect(() => {
    restoreFocusToRef.current = document.activeElement as HTMLElement | null;
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? panelRef.current)?.focus({ preventScroll: true });
    return () => restoreFocusToRef.current?.focus?.({ preventScroll: true });
  }, []);

  /** × and Escape — "not now". See the semantics note at the top of this file. */
  function snoozeAndClose() {
    markWelcomeOfferSnoozed();
    onClose();
  }

  // Keep Tab inside the panel while it is up — it covers the whole viewport, so anything the
  // focus ring lands on behind it is, by definition, unreachable and invisible.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        snoozeAndClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // No non-final path anymore — every call site here represents an actual decision (pick an
  // account type, sign in, or explicitly decline), so this just closes, full stop.
  function dismiss() {
    onClose();
  }

  function pick(action: () => void) {
    dismiss();
    action();
  }

  /** The decline screen's "Continue without an account" — sets the cross-session decline flag so
   *  the offer doesn't come back for three days, on this or any later visit. */
  function declineFinal() {
    markWelcomeOfferDeclined();
    dismiss();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="starter-modal-title"
      data-mpk-overlay="welcome"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-300 motion-reduce:animate-none"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`relative w-full rounded-3xl border shadow-2xl outline-none transition-[max-width] duration-300 animate-in zoom-in-95 slide-in-from-bottom-2 motion-reduce:animate-none motion-reduce:transition-none ${
          view === "main" ? "max-w-3xl" : "max-w-lg"
        }`}
        style={{ background: MODAL_BG, borderColor: MODAL_BORDER }}
      >
        {/* Present on both screens, so "not now" never requires first walking into the decline
            screen. Sits above the mascot artwork (z-[5]) and the scrolling content (z-10). */}
        <button
          type="button"
          onClick={snoozeAndClose}
          aria-label="Close — not now"
          className="absolute right-2 top-2 z-20 grid h-9 w-9 place-items-center rounded-full border shadow-sm transition-colors hover:bg-black/5"
          style={{ background: "#ffffff", borderColor: `${FOREST_DEEP}22`, color: FOREST_DEEP }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
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

            <div key="main" className="relative z-10 max-h-[85vh] overflow-y-auto px-4 pb-5 pt-20 sm:px-8 sm:py-8 sm:pl-16 sm:pt-8 animate-in fade-in duration-200 motion-reduce:animate-none">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="min-w-0">
                  <p id="starter-modal-title" className="font-display font-semibold text-lg leading-snug sm:text-2xl sm:leading-tight" style={{ color: FOREST_DEEP }}>
                    Here at Moments Packaging, we believe your loyalty should pay you back.
                  </p>
                  <p className="mt-1.5 text-[13px] leading-snug sm:mt-2 sm:text-sm sm:leading-normal" style={{ color: `${FOREST_DEEP}bf` }}>
                    Every account comes with 1,000 free Coupon Points (worth KES 100) when you join. Earn even more
                    with every order through exclusive discounts, referral rewards, and VIP perks. Open a Business
                    Account to also unlock a one-time 5% promo code, issued as soon as your business profile is set up.
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
                    Business Account details
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
                    Shopper Account details
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

            <div key="decline" className="relative z-10 max-h-[85vh] overflow-y-auto px-5 py-6 text-center sm:px-8 sm:py-8 animate-in fade-in duration-200 motion-reduce:animate-none">
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
