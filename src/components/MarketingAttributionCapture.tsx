import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { captureMarketingTouch, postMarketingTouch } from "@/lib/marketingAttribution";

/** Mounted once at the app root (App.tsx, beside ReferralCapture). Records how the visitor
 *  arrived — see src/lib/marketingAttribution.ts. Staff areas are never recorded. */
export function MarketingAttributionCapture() {
  const { pathname, search } = useLocation();
  const firstRun = useRef(true);

  useEffect(() => {
    const isFirstLoad = firstRun.current;
    firstRun.current = false;
    if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) return;
    const touch = captureMarketingTouch(search, pathname, isFirstLoad);
    if (touch) postMarketingTouch(touch);
  }, [pathname, search]);

  return null;
}
