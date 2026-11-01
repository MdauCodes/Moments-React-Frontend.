import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { hasAcceptedCookies } from "@/lib/cookieConsent";
import {
  dropStalePendingEvents,
  isMetaPixelActive,
  startMetaPixel,
  trackMetaPageView,
} from "@/lib/metaPixel";

/**
 * Drives the Meta Pixel (loader and event sender live in src/lib/metaPixel.ts).
 *
 * Loads the pixel ONLY after the visitor has accepted cookies — the promise CookieConsent's banner
 * makes (Kenya Data Protection Act 2019: explicit opt-in before non-essential tracking), which is
 * why Meta's "paste this into <head>" snippet isn't used as-is: it would fire for every visitor
 * before they had chosen anything.
 *
 * - Returning visitor who already accepted: starts on first render.
 * - First-time visitor: starts the moment they click "Accept all" (CookieConsent dispatches
 *   `mpk:cookies-accepted`); events from the page they're on are replayed then.
 * - One PageView per in-app navigation — this is a single-page app, so Meta's snippet on its own
 *   would record just one PageView per visit however many pages were viewed.
 */
export function MetaPixel() {
  const { pathname } = useLocation();
  const firstPath = useRef(true);

  useEffect(() => {
    if (hasAcceptedCookies()) startMetaPixel();
    window.addEventListener("mpk:cookies-accepted", startMetaPixel);
    return () => window.removeEventListener("mpk:cookies-accepted", startMetaPixel);
  }, []);

  useEffect(() => {
    dropStalePendingEvents(pathname);
    // The first PageView is sent by startMetaPixel() itself; later ones come from here.
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (isMetaPixelActive()) trackMetaPageView(pathname);
  }, [pathname]);

  return null;
}
