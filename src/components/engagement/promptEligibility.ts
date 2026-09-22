/**
 * Storage-only eligibility predicates for the two engagement prompts.
 *
 * Kept in their own dependency-free module rather than exported from the prompt components
 * themselves: the coordinator has to ask "would this prompt have anything to say?" on every tick,
 * and importing that answer from WelcomeStarterModal would statically pull its ~220KB of avatar
 * artwork back into the main bundle, undoing the lazy split those images were given.
 *
 * Every throttle below already existed and is preserved verbatim — the per-session show cap, the
 * cross-session decline cooldown, the lead flag, the once-per-session email ask. What changed is
 * only *when* they get consulted: previously each component armed its own timer/scroll/exit-intent
 * trigger on mount, now the coordinator asks.
 */

// ── Welcome starter offer ───────────────────────────────────────────────────
export const WELCOME_SHOWN_COUNT_KEY = "moments_welcome_shown_count";
export const WELCOME_DECLINED_AT_KEY = "moments_welcome_declined_at";
export const WELCOME_SNOOZED_AT_KEY = "moments_welcome_snoozed_at";
export const WELCOME_MAX_SHOWS_PER_SESSION = 3;
export const WELCOME_DECLINE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/**
 * "Not now" is a weaker answer than "no", so it earns a weaker cooldown: one day rather than the
 * three days an explicit "Continue without an account" buys. Long enough that closing the offer
 * means it is gone for this visit and the next one later today — which is the entire complaint
 * about a modal that reappears — but short enough that a genuinely interested visitor who was
 * simply busy still gets asked again this week.
 */
export const WELCOME_SNOOZE_MS = 24 * 60 * 60 * 1000; // 1 day

function isCoolingDown(key: string, windowMs: number): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at < windowMs;
  } catch {
    return false;
  }
}

export function getWelcomeShownCount(): number {
  try {
    return Number(sessionStorage.getItem(WELCOME_SHOWN_COUNT_KEY) ?? "0");
  } catch {
    return 0;
  }
}

export function isWelcomeOfferEligible(): boolean {
  if (typeof window === "undefined") return false;
  return (
    !isCoolingDown(WELCOME_DECLINED_AT_KEY, WELCOME_DECLINE_COOLDOWN_MS) &&
    !isCoolingDown(WELCOME_SNOOZED_AT_KEY, WELCOME_SNOOZE_MS) &&
    getWelcomeShownCount() < WELCOME_MAX_SHOWS_PER_SESSION
  );
}

export function markWelcomeOfferShown(): void {
  try {
    sessionStorage.setItem(WELCOME_SHOWN_COUNT_KEY, String(getWelcomeShownCount() + 1));
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — fail open, just skip the cap.
  }
}

/** The explicit "Continue without an account" — a real answer, three-day cooldown. */
export function markWelcomeOfferDeclined(): void {
  try {
    localStorage.setItem(WELCOME_DECLINED_AT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** The × and Escape — "not now", one-day cooldown. See WELCOME_SNOOZE_MS. */
export function markWelcomeOfferSnoozed(): void {
  try {
    localStorage.setItem(WELCOME_SNOOZED_AT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

// ── Post-order account prompt ───────────────────────────────────────────────
// Once per session, full stop. Someone who has just paid and said no is not going to be talked
// round by being asked again on the same visit.
export const POST_ORDER_PROMPT_KEY = "moments_post_order_prompt";

export function isPostOrderPromptEligible(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(POST_ORDER_PROMPT_KEY) === null;
  } catch {
    return true;
  }
}

export function markPostOrderPromptShown(): void {
  try {
    window.sessionStorage.setItem(POST_ORDER_PROMPT_KEY, "1");
  } catch {
    // ignore
  }
}

// ── Insider email capture ───────────────────────────────────────────────────
export const EMAIL_PROMPT_KEY = "moments_insider_prompt";
export const LEAD_KEY = "mpk_lead";

/** Someone who has already given us their address is never asked again, on any device where that
 *  flag survives — unchanged from the original component. */
export function hasLead(): boolean {
  try {
    return !!window.localStorage.getItem(LEAD_KEY);
  } catch {
    return false;
  }
}

export function isEmailPromptEligible(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (hasLead()) return false;
    return window.sessionStorage.getItem(EMAIL_PROMPT_KEY) === null;
  } catch {
    // Storage blocked entirely — better to be askable once than to be silently disabled forever.
    return true;
  }
}

export function markEmailPromptResolved(outcome: "dismissed" | "submitted"): void {
  try {
    window.sessionStorage.setItem(EMAIL_PROMPT_KEY, outcome);
    if (outcome === "submitted") window.localStorage.setItem(LEAD_KEY, "1");
  } catch {
    // ignore
  }
}
