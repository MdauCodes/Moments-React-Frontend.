import { useEffect, useRef, useState } from "react";
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

interface TumaBodaTrackingWidgetProps {
  trackingCode: string;
  status?: string | null;
  /** Side-by-side smaller map + an info panel, instead of a full-width map — for the admin order
   *  modal, where this widget sits inside an already-crowded panel and doesn't need to be the
   *  biggest thing on screen. The customer-facing track-order page keeps the full-width layout
   *  (compact omitted/false there), since it IS the main thing on that page. */
  compact?: boolean;
  /** Set when staff have scanned the rider's QR code at pickup — see PaymentService.
   *  scanRiderForOrder. Shown as a badge in the info panel when true; omitted entirely (not shown
   *  as "not verified") when false/undefined, since scanning is optional, not a problem. */
  riderVerified?: boolean;
  /** TumaBoda's own delivery reference number, shown alongside our tracking code so staff can
   *  quote either one to TumaBoda support without hunting through the raw order record. */
  deliveryNumber?: string | null;
}

/** Everything we actually know about this delivery, shown next to (not inside) the map — rider
 *  name/phone are NOT available here: TumaBoda's tracking page renders them from what appears to
 *  be a live WebSocket feed, not a discoverable REST call or anything present in the page's own
 *  server-rendered HTML, so there's nothing reliable for our backend to scrape. Investigated
 *  2026-09-05: no XHR/fetch call carries it, and a plain HTTP GET of the tracking URL doesn't
 *  contain it either — reverse-engineering an undocumented private channel isn't worth the
 *  fragility. If TumaBoda ever exposes rider name/phone via their partner REST API, wire it in
 *  here instead of attempting to scrape their tracking page. */
function TrackingInfoPanel({
  status,
  trackingCode,
  deliveryNumber,
  riderVerified,
  trackingUrl,
  tumaBodaPartner,
}: {
  status?: string | null;
  trackingCode: string;
  deliveryNumber?: string | null;
  riderVerified?: boolean;
  trackingUrl: string;
  tumaBodaPartner: ReturnType<typeof getDeliveryPartner>;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {tumaBodaPartner && <DeliveryPartnerBadge partner={tumaBodaPartner} />}
      {status && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</p>
          <p className="text-sm font-medium text-foreground">{status.replace(/_/g, " ")}</p>
        </div>
      )}
      {riderVerified && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
          ✓ Rider verified at pickup
        </span>
      )}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Tracking code</p>
        <p className="font-mono text-sm text-foreground">{trackingCode}</p>
      </div>
      {deliveryNumber && (
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">TumaBoda delivery #</p>
          <p className="font-mono text-sm text-foreground">{deliveryNumber}</p>
        </div>
      )}
      <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-auto text-sm text-primary underline">
        Open tracking in a new tab
      </a>
    </div>
  );
}

export function TumaBodaTrackingWidget({
  trackingCode,
  status,
  compact = false,
  riderVerified,
  deliveryNumber,
}: TumaBodaTrackingWidgetProps) {
  const [iframeFailed, setIframeFailed] = useState(false);
  const trackingUrl = buildTumaBodaTrackingUrl(trackingCode);
  const tumaBodaPartner = getDeliveryPartner("tumaboda");
  // Bug fixed 2026-09-05: onLoad used to just flip iframeFailed back to false without cancelling
  // this timer, so a slow-but-successful load (Leaflet + OSM tiles routinely takes >8s) would
  // still get overwritten by the timeout firing afterwards — the map would render, then get
  // silently replaced by the "couldn't be embedded" message a moment later. The timer is now
  // held in a ref so onLoad can actually clear it, same as the unmount/URL-change cleanup below.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIframeFailed(false);
    timerRef.current = setTimeout(() => setIframeFailed(true), TUMABODA_TRACKING_LOAD_TIMEOUT_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [trackingUrl]);

  const mapHeight = compact ? 200 : 360;

  const map = (
    <div className={compact ? "w-full sm:w-[220px] sm:shrink-0" : "w-full"}>
      {!iframeFailed && (
        <iframe
          src={trackingUrl}
          title="Live delivery tracking"
          className="w-full rounded-lg border border-border"
          style={{ height: mapHeight }}
          loading="lazy"
          // allow-same-origin here is safe despite the usual allow-scripts+allow-same-origin
          // sandbox-escape warning: that escape requires the iframe's origin to match the
          // parent's, letting its script reach back and strip its own sandbox attribute.
          // TumaBoda's tracking host is a genuinely different origin from ours, so that path
          // doesn't apply — allow-same-origin only lets the map use its own cookies/storage,
          // which it likely needs to function, and never grants it access to our own origin's data.
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setIframeFailed(false);
          }}
          onError={() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            setIframeFailed(true);
          }}
        />
      )}
      {iframeFailed && (
        <div
          className="flex items-center justify-center rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground"
          style={{ height: mapHeight }}
        >
          Live map couldn't be embedded here.
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Live delivery tracking</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {map}
          <TrackingInfoPanel
            status={status}
            trackingCode={trackingCode}
            deliveryNumber={deliveryNumber}
            riderVerified={riderVerified}
            trackingUrl={trackingUrl}
            tumaBodaPartner={tumaBodaPartner}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Live delivery tracking</p>
      {status && <p className="mt-1 text-sm text-foreground">{status.replace(/_/g, " ")}</p>}
      {tumaBodaPartner && <DeliveryPartnerBadge partner={tumaBodaPartner} className="mt-2" />}
      <div className="mt-2">{map}</div>
      <p className="mt-2 text-sm text-muted-foreground">
        <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="underline">
          Open tracking in a new tab
        </a>
        .
      </p>
    </div>
  );
}
