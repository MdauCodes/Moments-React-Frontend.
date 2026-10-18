/** Single source for reading the visitor's cookie-banner choice (written by CookieConsent.tsx). */
export const CONSENT_KEY = "mpk_cookie_consent_v1";

export type ConsentChoice = "accepted" | "rejected" | null;

export function getConsentChoice(): ConsentChoice {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const choice = JSON.parse(raw)?.choice;
    return choice === "accepted" || choice === "rejected" ? choice : null;
  } catch {
    return null;
  }
}

export function hasAcceptedCookies(): boolean {
  return getConsentChoice() === "accepted";
}

/* A pop-up we open ourselves (the after-payment review, the signup rating) holds the banner back
 * while it is open: a modal dialog makes the rest of the page unclickable, so a banner shown at
 * the same time could be seen but not answered. CookieConsent is mounted in three places, so the
 * hold is a module-level count with a change event rather than React state. */
const HOLD_EVENT = "mpk:cookie-banner-hold";
let holds = 0;

/** Holds the banner until the returned release function is called (calling it twice is harmless). */
export function holdCookieBanner(): () => void {
  holds += 1;
  window.dispatchEvent(new Event(HOLD_EVENT));
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    window.dispatchEvent(new Event(HOLD_EVENT));
  };
}

export function cookieBannerHeld(): boolean {
  return holds > 0;
}

export function subscribeCookieBannerHold(fn: () => void): () => void {
  window.addEventListener(HOLD_EVENT, fn);
  return () => window.removeEventListener(HOLD_EVENT, fn);
}
