import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** Meta (Facebook) Pixel for the "Moments E-commerce" dataset in Meta Events Manager. */
const PIXEL_ID = "978799355262510";

/** Same key CookieConsent.tsx writes — the visitor's saved Accept / Only-essentials choice. */
const CONSENT_KEY = "mpk_cookie_consent_v1";

/** Only the live storefront reports to Meta; staging and local builds would pollute the data. */
const TRACKED_HOSTS = new Set(["momentspackaging.com", "www.momentspackaging.com"]);

/** Staff-only areas are never tracked. */
const UNTRACKED_PREFIXES = ["/admin", "/staff", "/style-guide"];

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

function hasAcceptedCookies(): boolean {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw ? JSON.parse(raw)?.choice === "accepted" : false;
  } catch {
    return false;
  }
}

function isTrackedPath(pathname: string): boolean {
  return !UNTRACKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Meta's base code (the snippet from Events Manager), minus the auto PageView — see MetaPixel. */
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
  // staff-area exclusion below and would double-count alongside MetaPixel's own route tracking.
  // With that off, it also has to be told that one PageView per route (not per page load) is
  // intended, or it silently drops every PageView after the first.
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

/**
 * Loads the Meta Pixel ONLY after the visitor has accepted cookies — the promise CookieConsent's
 * banner makes (Kenya Data Protection Act 2019: explicit opt-in before non-essential tracking),
 * which is why Meta's "paste this into <head>" snippet isn't used as-is: it would fire for every
 * visitor before they had chosen anything.
 *
 * - Returning visitor who already accepted: loads on first render.
 * - First-time visitor: loads the moment they click "Accept all" (CookieConsent dispatches
 *   `mpk:cookies-accepted`).
 * - Sends a PageView on every in-app navigation — this is a single-page app, so Meta's snippet on
 *   its own would record just one PageView per visit however many pages were viewed.
 */
export function MetaPixel() {
  const { pathname } = useLocation();
  const active = useRef(false);

  // Consent: now (returning visitor) or later (banner accept).
  useEffect(() => {
    if (!TRACKED_HOSTS.has(window.location.hostname)) return;
    const start = () => {
      if (active.current) return;
      active.current = true;
      loadPixel();
      if (isTrackedPath(window.location.pathname)) window.fbq?.("track", "PageView");
    };
    if (hasAcceptedCookies()) start();
    window.addEventListener("mpk:cookies-accepted", start);
    return () => window.removeEventListener("mpk:cookies-accepted", start);
  }, []);

  // One PageView per route change after the first (the first is sent by start() above).
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (active.current && isTrackedPath(pathname)) window.fbq?.("track", "PageView");
  }, [pathname]);

  return null;
}
