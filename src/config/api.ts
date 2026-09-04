// Central API configuration. All backend calls flow through here.
//
// INTENTIONALLY DIFFERENT ON EACH BRANCH — do not merge this line between `main` and `staging`.
// `main` always points at the production Railway backend; `staging` always points at staging.
// When merging one branch into the other, keep the target branch's own URL below.
//
// staging uses a custom domain (api-staging.momentspackaging.com) sharing a registrable domain
// with its frontend, specifically so the httpOnly auth cookie (see AuthCookieService) is
// first-party — SameSite=Lax cookies are never attached to a genuinely cross-site fetch/XHR, only
// to top-level navigations. Production is mid-migration to the equivalent setup
// (api.momentspackaging.com) — see that branch's own copy of this file for the current status;
// don't copy production's URL here regardless of what it says.
export const API_BASE = "https://api-staging.momentspackaging.com";

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
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuid();
    window.localStorage.setItem(SESSION_KEY, id);
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
