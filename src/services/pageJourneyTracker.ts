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
    json: { path },
  }).catch(() => {
    // Analytics beacon only — never surface a failure to the visitor.
  });
}
