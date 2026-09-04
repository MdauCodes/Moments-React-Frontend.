import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { captureReferralCode } from "@/lib/referralAttribution";

/** Mounted once at the app root (see App.tsx, alongside ScrollToTop) — captures `?ref=` on
 *  EVERY route change, not just /account/register, so a referral link dropped on any page
 *  (a product page, the homepage, a shared cart link) still attributes correctly even if the
 *  visitor doesn't register until several pages and a browsing session later. */
export function ReferralCapture() {
  const location = useLocation();
  useEffect(() => {
    const ref = new URLSearchParams(location.search).get("ref");
    captureReferralCode(ref);
  }, [location.search]);
  return null;
}
