import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { hasAcceptedCookies } from "@/lib/cookieConsent";
import { isGoogleTagActive, startGoogleTag, trackGooglePageView } from "@/lib/googleTag";

/**
 * Drives Google Tag Manager (loader in src/lib/googleTag.ts), the same way MetaPixel.tsx drives
 * the Meta Pixel: started only after "Accept all" (now, or on an earlier visit), and told about
 * each in-app page change.
 */
export function GoogleTag() {
  const { pathname } = useLocation();
  const firstPath = useRef(true);

  useEffect(() => {
    if (hasAcceptedCookies()) startGoogleTag();
    window.addEventListener("mpk:cookies-accepted", startGoogleTag);
    return () => window.removeEventListener("mpk:cookies-accepted", startGoogleTag);
  }, []);

  useEffect(() => {
    // The first page is covered by Tag Manager's own start event; later ones come from here.
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (isGoogleTagActive()) trackGooglePageView(pathname);
    else if (hasAcceptedCookies()) startGoogleTag(); // e.g. they landed on a staff page first
  }, [pathname]);

  return null;
}
