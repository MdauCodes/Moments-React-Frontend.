import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteConfig } from "@/contexts/SiteConfigContext";
import { useActiveMs } from "@/hooks/useEngagementClock";
import {
  ACTIVE_DWELL_MS,
  BETWEEN_PROMPTS_MS,
  NAV_SETTLE_MS,
  msSinceLastPrompt,
  orderPlacedRecently,
  recordPromptShown,
} from "@/lib/engagementSignals";
import {
  isEmailPromptEligible,
  isWelcomeOfferEligible,
  markWelcomeOfferShown,
} from "./promptEligibility";

/**
 * The single gate every non-essential engagement prompt now goes through.
 *
 * Why it exists: a first-time visitor came to look at packaging. Previously the welcome offer
 * armed a 2.5-second timer on *any* page load and then covered the entire screen with a modal
 * that has no close button, while the insider email ask armed exit-intent, a 50%-scroll trigger
 * and a 30-second idle timer of its own. Both were mounted twice over (once in SiteLayout, once
 * in the homepage's own copy of the layout), neither knew the other existed, and nothing stopped
 * either from landing on top of the cart, the checkout or another dialog.
 *
 * Now there is one coordinator, mounted once, in App.tsx. It owns *when*; the prompt components
 * own only *what*. The rules, in full:
 *
 *   OPENS ONLY IF, all of:
 *     • the visitor has spent ACTIVE_DWELL_MS of visible-tab time in this session (accumulated
 *       across pages — see engagementSignals.ts), OR has placed an order in the last 30 minutes;
 *     • the current route is not a cart / checkout / payment / sign-in / registration / admin
 *       flow (and /order-confirmation only counts for the post-order moment, never for dwell);
 *     • at least NAV_SETTLE_MS has passed since the last navigation;
 *     • no other overlay, dialog, sheet, splash or consent banner is currently on screen;
 *     • no prompt is already open, and BETWEEN_PROMPTS_MS has passed since the last one;
 *     • the prompt's own long-standing throttles still allow it (see promptEligibility.ts).
 *
 *   PRIORITY: the welcome offer outranks the email ask — it is the bigger, once-per-visitor
 *   proposition, and having asked for an email first would make it read as the second nag.
 *
 * Exit intent and scroll depth are gone as triggers. They are why the email modal appeared while
 * someone was still on their way down the homepage for the first time; neither is evidence that
 * the visitor has actually engaged with anything.
 */

const WelcomeStarterModal = lazy(() =>
  import("@/components/WelcomeStarterModal").then((m) => ({ default: m.WelcomeStarterModal })),
);
const EmailInsiderPrompt = lazy(() =>
  import("@/components/EmailInsiderPrompt").then((m) => ({ default: m.EmailInsiderPrompt })),
);

type PromptId = "welcome" | "email";
type Reason = "dwell" | "post_order";

/** Routes where a visitor is doing something with money, an order or an account. Nothing
 *  optional may ever appear on top of these. */
const NEVER_PROMPT_PREFIXES = [
  "/cart",
  "/checkout",
  "/login",
  "/admin",
  "/launch",
  "/orders/track",
  "/account/login",
  "/account/register",
  "/account/forgot-password",
  "/account/reset-password",
];

/** The one place a post-order moment is allowed but a dwell-driven one is not: the visitor is
 *  there because they just finished ordering, not because they were browsing. */
const POST_ORDER_ONLY_PREFIXES = ["/order-confirmation"];

function routeAllows(pathname: string, reason: Reason): boolean {
  if (NEVER_PROMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return false;
  if (POST_ORDER_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) return reason === "post_order";
  return true;
}

/**
 * Is anything already covering the page?
 *
 * A DOM probe rather than a registry of every overlay in the app, deliberately: the alternative
 * is threading a "register/unregister" call through Radix dialogs, sheets, the auth modal, the
 * configurator, the search palette, the mega menu and the cart toast, and the day someone adds
 * the eleventh overlay and forgets the call is the day a prompt lands on top of it. Radix marks
 * its own open content with aria-modal/data-state; the hand-rolled overlays in this codebase are
 * tagged with `data-mpk-overlay`, which is also what the splash and the cookie banner carry.
 */
function anotherOverlayIsOpen(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.querySelector(
      '[data-mpk-overlay], [aria-modal="true"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
    ) !== null
  );
}

export function EngagementPrompts() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { emailCaptureEnabled } = useSiteConfig();
  const activeMs = useActiveMs();

  const [current, setCurrent] = useState<PromptId | null>(null);
  const lastNavAtRef = useRef(Date.now());

  useEffect(() => {
    lastNavAtRef.current = Date.now();
  }, [location.pathname, location.search]);

  const close = useCallback(() => {
    setCurrent(null);
    // Stamped on close as well as on open, so the gap between two prompts is measured from when
    // the visitor got their screen back, not from when we took it.
    recordPromptShown();
  }, []);

  useEffect(() => {
    if (current !== null) return;

    const postOrder = orderPlacedRecently();
    if (!postOrder && activeMs < ACTIVE_DWELL_MS) return;
    const reason: Reason = postOrder ? "post_order" : "dwell";

    if (!routeAllows(location.pathname, reason)) return;
    if (Date.now() - lastNavAtRef.current < NAV_SETTLE_MS) return;
    if (msSinceLastPrompt() < BETWEEN_PROMPTS_MS) return;
    if (anotherOverlayIsOpen()) return;

    let next: PromptId | null = null;
    if (!isAuthenticated && isWelcomeOfferEligible()) next = "welcome";
    else if (emailCaptureEnabled && isEmailPromptEligible()) next = "email";
    if (!next) return;

    if (next === "welcome") markWelcomeOfferShown();
    recordPromptShown();
    setCurrent(next);
  }, [activeMs, current, emailCaptureEnabled, isAuthenticated, location.pathname]);

  // A visitor who signs in while the welcome offer is on screen has just answered it.
  useEffect(() => {
    if (isAuthenticated && current === "welcome") setCurrent(null);
  }, [isAuthenticated, current]);

  if (current === null) return null;

  return (
    <Suspense fallback={null}>
      {current === "welcome" ? <WelcomeStarterModal onClose={close} /> : <EmailInsiderPrompt onClose={close} />}
    </Suspense>
  );
}
