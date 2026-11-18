// Google Tag Manager loader (container GTM-PTPN94NN: Google Ads conversion measurement and
// whatever else the owner sets up in Tag Manager). Rendered/driven by src/components/GoogleTag.tsx.
//
// Same rules as the Meta Pixel (src/lib/metaPixel.ts):
// - Loads ONLY after the visitor accepts cookies (Kenya Data Protection Act 2019: opt-in before
//   non-essential tracking). That is why Google's "paste into <head>" snippet isn't used as-is.
// - Only the live storefront loads it; staging, previews and local builds would pollute the data.
//   To test on another host on purpose, run localStorage.setItem("mpk_google_tag_debug", "1").
// - Staff areas never start it.

export const GTM_ID = "GTM-PTPN94NN";

const TRACKED_HOSTS = new Set(["momentspackaging.com", "www.momentspackaging.com"]);
const UNTRACKED_PREFIXES = ["/admin", "/staff", "/style-guide"];

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let active = false;

function isTrackedPath(pathname: string): boolean {
  return !UNTRACKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function hostAllowed(): boolean {
  if (TRACKED_HOSTS.has(window.location.hostname)) return true;
  try {
    return window.localStorage.getItem("mpk_google_tag_debug") === "1";
  } catch {
    return false;
  }
}

export function isGoogleTagActive(): boolean {
  return active;
}

/** Google's Tag Manager snippet, run once the visitor has accepted cookies. */
export function startGoogleTag(): void {
  if (
    active ||
    typeof window === "undefined" ||
    !hostAllowed() ||
    !isTrackedPath(window.location.pathname)
  )
    return;
  active = true;
  const dataLayer = (window.dataLayer = window.dataLayer || []);
  // gtag() as in the snippet the owner was given, so tags that call it directly work too.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  // Tag Manager's own start event: without it, triggers such as "All pages" never fire.
  dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`;
  document.head.appendChild(script);
}

/**
 * The site never reloads between pages, so each in-app navigation is announced to Tag Manager as
 * a "virtual_page_view" event (use a Custom Event trigger on it, or the built-in History Change
 * trigger). Staff areas are skipped.
 */
export function trackGooglePageView(pathname: string): void {
  if (!active || !isTrackedPath(pathname)) return;
  window.dataLayer?.push({
    event: "virtual_page_view",
    page_path: pathname,
    page_location: window.location.href,
    page_title: document.title,
  });
}
