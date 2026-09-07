import { apiFetch } from "@/config/api";

/**
 * Fire-and-forget beacon for the admin "page journeys" report (Developer > User Journeys,
 * super-admin only). Identified by the same anonymous mpk_session_id already used for the cart
 * and the checkout funnel (X-Session-Id, via apiFetch's `session: true`) — never blocks or
 * throws into actual navigation. See PageViewTracker.tsx for where this is called from.
 */
export function trackPageView(path: string): void {
  void apiFetch("/api/v1/public/page-journey/event", {
    method: "POST",
    session: true,
    // document.referrer is only ever meaningful on the very first navigation of a browser tab —
    // it doesn't change on later client-side route changes within the same SPA session — but
    // it's cheap to send every time and the backend only ever uses a session's first-ever value
    // (see PageJourneyService.SessionAggregate.entryTrafficSource). Only the hostname is
    // extracted and stored server-side, never this raw value.
    json: { path, referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined },
  }).catch(() => {
    // Analytics beacon only — never surface a failure to the visitor.
  });
}
