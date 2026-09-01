import { useEffect, useState } from "react";
import { DeliveryPartnerBadge } from "@/components/DeliveryPartnerBadge";
import { getDeliveryPartner } from "@/data/deliveryPartners";

// Rebuilt 2026-08-12 as a plain iframe rather than a script-injected custom element. Levi
// (TumaBoda) described the integration as "an iframe from our end that gives the same live
// tracking map the recipient gets on the SMS" (30/07 conversation) — and the SMS itself links to
// exactly this pattern: https://sandbox.tumaboda.co.ke/track/{code} (see e.g. order
// ORD-2026-08-0005's "Fuatilia live" SMS). The previous <script>-injected <tumaboda-tracking>
// web component was never confirmed against real docs and wasn't rendering anything.
//
// Extracted from orders.track.tsx (2026-08-14) so the admin order detail drawer can reuse the
// exact same widget — staff shouldn't need to ask the customer or guess at delivery progress
// when the same live map is one click away. This does NOT depend on the still-unconfirmed
// embed contract (signed/scoped token, required params) — it reuses the same public tracking-
// code URL already proven working in real SMS messages, not a new/different embed mechanism.
//
// INTENTIONALLY DIFFERENT ON EACH BRANCH — do not merge this line between `main` and `staging`.
// `main` points at TumaBoda's production tracking host, `staging` at their sandbox one. Found
// 2026-09-01 that this had never actually been swapped for go-live (VITE_TUMABODA_TRACKING_
// BASE_URL was never set on the production build, so it silently fell back to sandbox) —
// confirmed the production host by the same sandbox-prefix-drop pattern already proven for the
// backend's TUMABODA_BASE_URL (sandboxapi.->api.) and TumaBoda's own business portal
// (sandboxbusiness.->business.), then verified live: https://tumaboda.co.ke/track/{code} is a
// real tracking page (renders a proper "Delivery Not Found" state for an unknown code, not a
// generic 404), with no X-Frame-Options/CSP blocking the iframe embed below.
// The env var below still overrides this if one is ever set on the hosting platform.
export const TUMABODA_TRACKING_BASE_URL =
  import.meta.env.VITE_TUMABODA_TRACKING_BASE_URL || "https://sandbox.tumaboda.co.ke/track";

// iframe onError only fires for network-level load failures (DNS, connection refused) — a
// cross-origin page that loads fine but renders its own error content (a 404/500 page, an empty
// state) is invisible to us; browsers don't expose the response status to iframe load events, and
// we don't control TumaBoda's tracking page to add a postMessage signal. LOAD_TIMEOUT_MS is a
// heuristic that catches the other common failure mode (a hung/never-loading connection) that
// onError also misses. Neither fully closes the gap, which is why the "open in a new tab" link
// below is always visible rather than gated behind detected-failure state — the viewer always
// has an escape hatch regardless of whether our detection actually caught the problem.
const TUMABODA_TRACKING_LOAD_TIMEOUT_MS = 8000;

/** Single source of truth for the tracking URL — shared with anything that needs to link/open
 *  it without rendering the full widget (e.g. the admin "Mark ready" auto-open-in-new-tab flow). */
export function buildTumaBodaTrackingUrl(trackingCode: string): string {
  return `${TUMABODA_TRACKING_BASE_URL.replace(/\/$/, "")}/${encodeURIComponent(trackingCode)}`;
}

export function TumaBodaTrackingWidget({ trackingCode, status }: { trackingCode: string; status?: string | null }) {
  const [iframeFailed, setIframeFailed] = useState(false);
  const trackingUrl = buildTumaBodaTrackingUrl(trackingCode);
  const tumaBodaPartner = getDeliveryPartner("tumaboda");

  useEffect(() => {
    setIframeFailed(false);
    const timer = setTimeout(() => setIframeFailed(true), TUMABODA_TRACKING_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [trackingUrl]);

  return (
    <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Live delivery tracking</p>
      {status && <p className="mt-1 text-sm text-foreground">{status.replace(/_/g, " ")}</p>}
      {tumaBodaPartner && <DeliveryPartnerBadge partner={tumaBodaPartner} className="mt-2" />}
      {!iframeFailed && (
        <iframe
          src={trackingUrl}
          title="Live delivery tracking"
          className="mt-2 w-full rounded-lg border border-border"
          style={{ height: 360 }}
          loading="lazy"
          // allow-same-origin here is safe despite the usual allow-scripts+allow-same-origin
          // sandbox-escape warning: that escape requires the iframe's origin to match the
          // parent's, letting its script reach back and strip its own sandbox attribute.
          // TumaBoda's tracking host is a genuinely different origin from ours, so that path
          // doesn't apply — allow-same-origin only lets the map use its own cookies/storage,
          // which it likely needs to function, and never grants it access to our own origin's data.
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={() => setIframeFailed(false)}
          onError={() => setIframeFailed(true)}
        />
      )}
      {iframeFailed && (
        <p className="mt-2 text-sm text-muted-foreground">Live map couldn't be embedded here.</p>
      )}
      <p className="mt-2 text-sm text-muted-foreground">
        <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Open tracking in a new tab
        </a>
        .
      </p>
    </div>
  );
}
