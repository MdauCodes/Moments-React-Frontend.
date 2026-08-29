import { useLocation } from "react-router-dom";
import { LaunchBanner } from "@/components/LaunchBanner";

/**
 * Pre-launch indicator — a persistent countdown banner, not a blocking modal. Used to be a
 * full-screen interstitial requiring a "Continue to site" click, back when the site-lock existed
 * for an ODPC data-protection licensing reason; now that the license is in hand, there's no
 * remaining reason to gate real content behind a click at all. Removed entirely rather than kept
 * as a dismiss-once-then-banner flow: a full-page blocking interstitial shown on first load is
 * exactly what Google's "intrusive interstitial" mobile-usability penalty targets, and since
 * Googlebot never carries a persisted session between crawls, it would see the full block on
 * every single page, every time — actively working against indexing, not just a one-time human
 * annoyance. Checkout stays fully explorable regardless; payments are blocked server-side (see
 * SiteLockConfig.SITE_LOCK_ENABLED on the backend), not by anything in this component.
 * Exempts /admin/* routes so staff never see it.
 */
export function SiteLockOverlay() {
  const location = useLocation();

  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  return <LaunchBanner />;
}
