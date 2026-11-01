// Meta (Facebook) Pixel loader + event sender for the "Moments E-commerce" dataset.
// Design and rules: docs/META_ADS_ATTRIBUTION_PLAN.md (Phase 2). Rendered/driven by
// src/components/MetaPixel.tsx; page code sends events through src/lib/metaEvents.ts.
import { getConsentChoice } from "@/lib/cookieConsent";

export const PIXEL_ID = "978799355262510";

/** Only the live storefront reports to Meta; staging and local builds would pollute the data.
 *  To test on another host on purpose, run localStorage.setItem("mpk_meta_pixel_debug", "1"). */
const TRACKED_HOSTS = new Set(["momentspackaging.com", "www.momentspackaging.com"]);

/** Staff-only areas are never tracked. */
const UNTRACKED_PREFIXES = ["/admin", "/staff", "/style-guide"];

/** Events fired before the visitor answers the cookie banner are held for THIS page only and
 *  sent if they accept within this window. Nothing is sent, and nothing leaves the device,
 *  before consent. */
const PENDING_TTL_MS = 10 * 60 * 1000;
const PENDING_MAX = 20;

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
  allowDuplicatePageViews?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

interface PendingEvent {
  event: string;
  params?: Record<string, unknown>;
  eventId?: string;
  path: string;
  at: number;
}

let active = false;
let pending: PendingEvent[] = [];

export function isTrackedPath(pathname: string): boolean {
  return !UNTRACKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function hostAllowed(): boolean {
  if (TRACKED_HOSTS.has(window.location.hostname)) return true;
  try {
    return window.localStorage.getItem("mpk_meta_pixel_debug") === "1";
  } catch {
    return false;
  }
}

/** Meta's base code (the snippet from Events Manager), minus the auto PageView. */
function loadPixel() {
  if (window.fbq) return;
  const fbq = function (...args: unknown[]) {
    // fbevents.js expects `this` to be the fbq function itself, as in Meta's original snippet.
    // eslint-disable-next-line prefer-spread
    if (fbq.callMethod) fbq.callMethod.apply(fbq, args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  // fbevents.js otherwise fires its own PageView on every history.pushState — which ignores the
  // staff-area exclusion and would double-count alongside our own route tracking. With that off, it
  // also has to be told that one PageView per route (not per page load) is intended, or it
  // silently drops every PageView after the first.
  fbq.disablePushState = true;
  fbq.allowDuplicatePageViews = true;
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", PIXEL_ID);
}

function send(event: string, params?: Record<string, unknown>, eventId?: string) {
  if (!window.fbq) return;
  if (eventId) window.fbq("track", event, params ?? {}, { eventID: eventId });
  else if (params) window.fbq("track", event, params);
  else window.fbq("track", event);
}

export function isMetaPixelActive(): boolean {
  return active;
}

/** Loads the pixel (once) and sends the current page's PageView plus any held events. Call only
 *  when the visitor has accepted cookies. */
export function startMetaPixel(): void {
  if (active || typeof window === "undefined" || !hostAllowed()) return;
  active = true;
  loadPixel();
  const path = window.location.pathname;
  if (isTrackedPath(path)) send("PageView");
  const now = Date.now();
  for (const p of pending) {
    if (p.path === path && now - p.at < PENDING_TTL_MS) send(p.event, p.params, p.eventId);
  }
  pending = [];
}

/** Sends a route-change PageView (the app never reloads, so Meta's default would miss them). */
export function trackMetaPageView(pathname: string): void {
  if (active && isTrackedPath(pathname)) send("PageView");
}

/** Forget held events that belong to a page the visitor has already left. */
export function dropStalePendingEvents(currentPath: string): void {
  pending = pending.filter((p) => p.path === currentPath);
}

/**
 * Send a standard Meta event. Safe to call from anywhere, any time:
 * - pixel running (visitor accepted)      → sent now
 * - visitor hasn't answered the banner    → held for this page; sent if they accept
 * - visitor chose "Only essentials"       → dropped
 * - staff area / wrong host               → dropped
 * `eventId` makes Meta count the event once when the same purchase is also reported by the server.
 */
export function trackMeta(event: string, params?: Record<string, unknown>, eventId?: string): void {
  if (typeof window === "undefined" || !hostAllowed()) return;
  const path = window.location.pathname;
  if (!isTrackedPath(path)) return;
  if (active) {
    send(event, params, eventId);
    return;
  }
  if (getConsentChoice() === "rejected") return;
  // Not started yet: either the banner is unanswered, or the visitor already accepted and the
  // component's effect is about to call startMetaPixel(). Hold the event; start replays it.
  pending.push({ event, params, eventId, path, at: Date.now() });
  if (pending.length > PENDING_MAX) pending = pending.slice(-PENDING_MAX);
}
