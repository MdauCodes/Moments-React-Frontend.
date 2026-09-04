import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import { Cookie, X } from "lucide-react";

const STORAGE_KEY = "mpk_cookie_consent_v1";
const FIRST_VISIT_KEY = "mpk_first_visit_at";
type Choice = "accepted" | "rejected";

// Delay before the banner appears for a first-time visitor — long enough that it doesn't greet
// someone the instant the page loads, short enough that it still shows up well before anything
// non-essential would need consent. Doesn't weaken the compliance story: no cookie/analytics
// call fires until "accepted" either way (see the mpk:cookies-accepted event below), so delaying
// only when we ASK doesn't delay anything the asking is meant to gate.
const SHOW_AFTER_MS = 3 * 60 * 1000;

/** This component is mounted separately by SiteLayout, DashboardLayout AND routes/index.tsx —
 *  three independent instances that unmount/remount as the visitor navigates between
 *  differently-laid-out pages. A plain per-mount setTimeout would reset every time that happens,
 *  so "3 minutes on the site" could never actually elapse for anyone who navigates. sessionStorage
 *  makes the elapsed time survive across those remounts (and tabs closing mid-session correctly
 *  restarts the clock on the next visit, since it's session-scoped, not persistent). */
function msUntilShow(): number {
  if (typeof window === "undefined") return SHOW_AFTER_MS;
  try {
    const existing = window.sessionStorage.getItem(FIRST_VISIT_KEY);
    const firstVisitAt = existing ? Number(existing) : Date.now();
    if (!existing) window.sessionStorage.setItem(FIRST_VISIT_KEY, String(firstVisitAt));
    return Math.max(0, SHOW_AFTER_MS - (Date.now() - firstVisitAt));
  } catch {
    return SHOW_AFTER_MS;
  }
}

/**
 * Lightweight, non-modal cookie consent banner. Stays pinned to the bottom
 * of the viewport until the visitor makes a choice — disruptive enough to
 * get acknowledged, but never blocks the page or its content.
 *
 * Satisfies the Kenya Data Protection Act (2019) requirement for explicit,
 * informed opt-in before non-essential cookies / analytics are set.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let already: boolean;
    try {
      already = !!window.localStorage.getItem(STORAGE_KEY);
    } catch {
      already = false;
    }
    if (already) return;
    const timer = window.setTimeout(() => setVisible(true), msUntilShow());
    return () => window.clearTimeout(timer);
  }, []);

  const decide = (choice: Choice) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ choice, at: new Date().toISOString() }),
      );
    } catch { /* ignore */ }
    setVisible(false);
    // Hook for analytics: only initialise if accepted
    if (choice === "accepted") {
      window.dispatchEvent(new CustomEvent("mpk:cookies-accepted"));
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[120] px-3 pb-3 sm:px-5 sm:pb-5 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-2xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
            <Cookie className="h-4.5 w-4.5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Cookies and your privacy
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              We use cookies to keep our website running smoothly, improve your shopping
              experience, and understand how visitors use our site. We respect your privacy and
              only use cookies as described in our{" "}
              <Link to="/privacy" className="text-foreground underline-offset-2 hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => decide("accepted")}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                Accept all
              </button>
              <button
                onClick={() => decide("rejected")}
                className="inline-flex items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary"
              >
                Only essentials
              </button>
              <Link
                to="/privacy"
                className="ml-auto text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Learn more
              </Link>
            </div>
          </div>
          <button
            onClick={() => decide("rejected")}
            aria-label="Dismiss — only essential cookies"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
