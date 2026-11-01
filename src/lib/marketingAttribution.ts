// Remembers HOW a visitor arrived (which ad, campaign, search, chat assistant...) so the order they
// place — possibly days later — can be credited to it. Sent with the checkout request; the backend
// stores it per order (order_attribution). Full design: docs/META_ADS_ATTRIBUTION_PLAN.md.
//
// Same shape as referralAttribution.ts, on purpose: captured on EVERY route change (not just the
// landing page), kept 30 days in localStorage, storage failures never surfaced. Attribution model
// (decision D1): the LAST non-direct touch is what revenue is reported against; the FIRST touch is
// kept too. A direct visit never overwrites a stored touch, so "saw an ad Monday, typed the address
// Thursday and bought" still counts for the ad.
//
// Consent (decision D2): this is first-party — it stores tags on the visitor's own device and sends
// them only to our own API, exactly like the existing ?ref= and page-journey tracking, so it does
// not wait for the cookie banner. Nothing here is sent to Meta or any third party; that only
// happens in MetaPixel.tsx, after "Accept all".
import { apiFetch } from "@/config/api";
import { hasAcceptedCookies } from "@/lib/cookieConsent";

const STORAGE_KEY = "mpk_marketing_attribution_v1";
const SEEN_KEY = "mpk_marketing_touch_seen";
const TAGGED_SESSION_KEY = "mpk_marketing_tagged_session";
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LEN = 200;

export interface MarketingTouch {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  campaignId?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  /** Pathname only — never the query string, which can carry tracking ids. */
  landingPath: string;
  /** Referrer HOST only (e.g. "l.facebook.com"), never a full URL. */
  referrer?: string;
  at: number;
}

interface StoredAttribution {
  first: MarketingTouch;
  last: MarketingTouch;
  fbc?: string;
}

export interface CheckoutAttribution {
  first?: MarketingTouch;
  last?: MarketingTouch;
  fbc?: string;
  fbp?: string;
  consentMarketing: boolean;
}

/** Our own hosts: arriving from one of these is an in-site navigation, not a marketing touch. */
const OWN_HOSTS = new Set([
  "momentspackaging.com",
  "www.momentspackaging.com",
  "staging.momentspackaging.com",
  "moments-staging.onrender.com",
  "moments-demo.site",
]);

/** Sign-in and payment hops return the visitor with a referrer, but aren't where they came from. */
const IGNORED_HOSTS = [
  "accounts.google.com",
  "appleid.apple.com",
  "login.microsoftonline.com",
  "login.live.com",
  "safaricom.co.ke",
  "pesapal.com",
  "tumaboda.co.ke",
];

/** Referrers worth overwriting an earlier touch for: search, social, chat assistants, messaging. */
const MARKETING_HOSTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "yahoo.",
  "ecosia.",
  "search.brave.",
  "facebook.com",
  "instagram.com",
  "fb.com",
  "t.co",
  "twitter.com",
  "x.com",
  "tiktok.com",
  "linkedin.com",
  "youtube.com",
  "wa.me",
  "whatsapp.com",
  "chatgpt.com",
  "chat.openai.com",
  "perplexity.ai",
  "gemini.google.com",
  "copilot.microsoft.com",
  "claude.ai",
];

function hostMatches(host: string, needle: string): boolean {
  return needle.endsWith(".")
    ? host.includes(needle)
    : host === needle || host.endsWith(`.${needle}`);
}

function clip(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  return t ? t.slice(0, MAX_LEN) : undefined;
}

function referrerHost(): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const host = new URL(document.referrer).hostname.toLowerCase();
    if (!host || host === window.location.hostname.toLowerCase() || OWN_HOSTS.has(host))
      return undefined;
    if (IGNORED_HOSTS.some((h) => hostMatches(host, h))) return undefined;
    return host;
  } catch {
    return undefined;
  }
}

function readStored(): StoredAttribution | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as StoredAttribution;
    if (!rec?.last?.at) return null;
    if (Date.now() - rec.last.at > EXPIRY_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return rec;
  } catch {
    return null;
  }
}

function cookie(name: string): string | undefined {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Called on every route change (see MarketingAttributionCapture). Returns the new touch when this
 * visit started a new one, or null when there is nothing new to record. `isFirstLoad` matters
 * because document.referrer only describes how the page was first loaded — in-app navigation must
 * not re-count the same external referrer on every route.
 */
export function captureMarketingTouch(
  search: string,
  pathname: string,
  isFirstLoad: boolean,
): MarketingTouch | null {
  const q = new URLSearchParams(search);
  const tagged = {
    source: clip(q.get("utm_source")),
    medium: clip(q.get("utm_medium")),
    campaign: clip(q.get("utm_campaign")),
    content: clip(q.get("utm_content")),
    term: clip(q.get("utm_term")),
    campaignId: clip(q.get("utm_id")),
    fbclid: clip(q.get("fbclid")),
    gclid: clip(q.get("gclid")),
    ttclid: clip(q.get("ttclid")),
  };
  const hasTag = Object.values(tagged).some(Boolean);
  const referrer = isFirstLoad ? referrerHost() : undefined;
  const knownReferrer = !!referrer && MARKETING_HOSTS.some((h) => hostMatches(referrer, h));
  if (!hasTag && !referrer) return null;

  // Same tags + referrer already handled in this browser session (StrictMode double effects,
  // re-renders on the landing page) — don't record it twice.
  const signature = JSON.stringify([tagged, referrer]);
  try {
    if (window.sessionStorage.getItem(SEEN_KEY) === signature) return null;
    window.sessionStorage.setItem(SEEN_KEY, signature);
  } catch {
    /* storage unavailable — worst case a duplicate touch row, never a lost order */
  }

  // A printed QR code (utm_source=qr) is still recorded as a touch, but it is not an ad campaign:
  // it reaches someone already dealing with us (shop counter, parcel insert), not an audience Meta
  // needs to learn from, so it must not trigger the immediate cookie ask meant for tagged ad
  // traffic. Its welcome window (QrVisitDialog) gets the screen to itself; the banner then follows
  // on its ordinary delay.
  if (hasTag && tagged.source?.toLowerCase() !== "qr") {
    try {
      window.sessionStorage.setItem(TAGGED_SESSION_KEY, "1");
    } catch {
      /* storage unavailable */
    }
  }

  const touch: MarketingTouch = {
    ...tagged,
    landingPath: pathname.slice(0, 500),
    referrer,
    at: Date.now(),
  };
  const existing = readStored();

  // A bare unknown referrer (some blog linking to us) must not erase a real ad/search touch.
  // It only becomes the "last" touch when nothing better is remembered yet.
  const overwritesLast = hasTag || knownReferrer || !existing;
  if (overwritesLast) {
    const next: StoredAttribution = {
      first: existing?.first ?? touch,
      last: touch,
      fbc: touch.fbclid ? `fb.1.${touch.at}.${touch.fbclid}` : existing?.fbc,
    };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private browsing / quota — attribution then lasts only for this page load */
    }
  }
  return touch;
}

/** True when this browser session started from a tagged link (an ad, a campaign email...). The
 *  cookie banner uses it to ask straight away, because that visitor is the one Meta needs to see. */
export function isTaggedCampaignSession(): boolean {
  try {
    return window.sessionStorage.getItem(TAGGED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Fire-and-forget landing beacon so the Marketing report can show visits per campaign, including
 *  the ones that never buy. Carries no personal data. */
export function postMarketingTouch(touch: MarketingTouch): void {
  void apiFetch("/api/v1/public/marketing/touch", {
    method: "POST",
    session: true,
    json: { touch },
  }).catch(() => {
    /* analytics beacon only */
  });
}

/** What checkout attaches to the order. Always returns an object (with the consent flag), even
 *  for a direct visitor, so the backend can record the consent state either way. */
export function getCheckoutAttribution(): CheckoutAttribution {
  const stored = readStored();
  return {
    first: stored?.first,
    last: stored?.last,
    // Meta's own cookies win when present — they are what Meta itself would match on.
    fbc: cookie("_fbc") ?? stored?.fbc,
    fbp: cookie("_fbp"),
    consentMarketing: hasAcceptedCookies(),
  };
}
