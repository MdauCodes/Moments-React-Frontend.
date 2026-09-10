// Central API configuration. All backend calls flow through here.
//
// 2026-09-09 incident: VITE_API_BASE (a Render build-time env var meant to be set per service)
// was never actually set on the production Render service after the previous commit switched to
// reading it — production silently built with the staging fallback below and served staging's
// seeded test orders (MP-SEED-0001..0012 etc.) in the live admin dashboard. An env var that can
// silently go unset is exactly the kind of failure this needs to be immune to, so production no
// longer depends on Render config being right: if the page's own hostname is a production
// momentspackaging.com host, the production backend is used unconditionally, full stop — no env
// var, no per-branch source text, nothing to forget to set. VITE_API_BASE still exists purely as
// a dev/preview convenience for pointing a local or preview build at a specific backend; it's
// simply never consulted on the real production host, so it losing its value there can't matter.
//
// Interim state (2026-09-04): api.momentspackaging.com's DNS verification with Railway is still
// pending, so PROD_API_BASE below is temporarily the raw *.up.railway.app host while that
// propagates. This ONLY works because AuthCookieService's cookie is temporarily SameSite=None
// (env var app.auth.cookie-samesite=None on the production Railway service) — see that file's
// comment for why a raw railway.app host otherwise silently breaks every authenticated request.
// Once api.momentspackaging.com verifies: point PROD_API_BASE back at it, and flip
// app.auth.cookie-samesite back to Lax (or just unset it) on production — None is the weaker,
// temporary setting.
const PROD_API_BASE = "https://moments-packaging-latest-backend-production.up.railway.app";
const STAGING_API_BASE = "https://api-staging.momentspackaging.com";

function isProductionHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "momentspackaging.com" || host.endsWith(".momentspackaging.com");
}

export const API_BASE = isProductionHost()
  ? PROD_API_BASE
  : import.meta.env.VITE_API_BASE || STAGING_API_BASE;

// Backwards-compatible aliases — existing modules import these.
export const API_BASE_URL = API_BASE;

export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

// ---------- Cart session id (anonymous cart) ----------
const SESSION_KEY = "mpk_session_id";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // RFC4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id: string | null = null;
  try {
    id = window.localStorage.getItem(SESSION_KEY);
  } catch {
    /* storage blocked/unavailable */
  }
  if (!id) {
    id = uuid();
    try {
      window.localStorage.setItem(SESSION_KEY, id);
    } catch {
      // QuotaExceededError (e.g. a phone low on storage) — return the fresh id for this call
      // so callers still get a usable X-Session-Id; it just won't be stable across reloads.
    }
  }
  return id;
}

// ---------- Admin impersonation token ----------
// Lives here (not in AuthContext) so apiFetch can read it without a circular import — it's a
// plain sessionStorage read, no React dependency. Tab-scoped and deliberately NOT part of the
// cookie-based session below: an admin previewing a customer's dashboard in a new tab must never
// collide with or be upgradeable into a real login, and a cookie (shared across tabs on the same
// origin) can't provide that isolation the way a sessionStorage-held bearer token can.
const IMPERSONATION_KEY = "mpk_impersonation_token";

export function getImpersonationToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(IMPERSONATION_KEY);
  } catch {
    return null;
  }
}

export function setImpersonationToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(IMPERSONATION_KEY, token);
    else window.sessionStorage.removeItem(IMPERSONATION_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- Unified fetch helper ----------
export interface ApiFetchOptions extends RequestInit {
  /** Attach Authorization: Bearer <token> when impersonating; otherwise a no-op — the customer's
   *  own session travels via the httpOnly cookie automatically (credentials: 'include' below),
   *  not a header this code can read. */
  auth?: boolean;
  /** Attach X-Session-Id header (anonymous cart) */
  session?: boolean;
  /** JSON body — auto-stringified, content-type set */
  json?: unknown;
}

export async function apiFetch(path: string, opts: ApiFetchOptions = {}): Promise<Response> {
  const { auth, session, json, headers, body, ...rest } = opts;
  const h = new Headers(headers);
  if (json !== undefined) {
    h.set("Content-Type", "application/json");
  }
  if (auth) {
    const impersonation = getImpersonationToken();
    if (impersonation) h.set("Authorization", `Bearer ${impersonation}`);
  }
  if (session) {
    h.set("X-Session-Id", getSessionId());
  }
  return fetch(apiUrl(path), {
    ...rest,
    headers: h,
    // Always included, not just when `auth` is set — the cookie only exists at all for a real
    // logged-in customer, so this is a no-op for anonymous calls and correct for authenticated
    // ones without every call site needing to remember to opt in.
    credentials: "include",
    body: json !== undefined ? JSON.stringify(json) : body,
  });
}
