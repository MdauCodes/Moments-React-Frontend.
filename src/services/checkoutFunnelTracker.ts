import { apiFetch } from "@/config/api";

export type CheckoutFunnelStep = "OPENED" | "CONTACT_COMPLETED" | "DELIVERY_CONFIRMED" | "ORDER_PLACED";

/**
 * Fire-and-forget beacon for the admin "checkout funnel" drop-off report (Developer section,
 * super-admin only). Identified by the same anonymous mpk_session_id already used for the cart
 * (X-Session-Id, via apiFetch's `session: true`) — never blocks or throws into the checkout flow.
 */
export function trackFunnelStep(
  step: CheckoutFunnelStep,
  extra?: { email?: string; phone?: string; fulfillmentType?: string; orderReference?: string },
): void {
  void apiFetch("/api/v1/public/checkout-funnel/event", {
    method: "POST",
    session: true,
    json: { step, ...extra },
  }).catch(() => {
    // Analytics beacon only — never surface a failure to the customer.
  });
}
