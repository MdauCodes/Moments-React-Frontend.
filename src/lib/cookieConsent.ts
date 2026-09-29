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
