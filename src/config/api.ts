// Central API configuration. All backend calls flow through here.
//
// INTENTIONALLY DIFFERENT ON EACH BRANCH — do not merge this line between `main` and `staging`.
// `staging` always points at the staging Railway backend; `main` always points at production.
// When merging one branch into the other, keep the target branch's own URL below.
export const API_BASE = "https://moments-backend-staging-staging.up.railway.app";

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

// ---------- Auth token (JWT in localStorage) ----------
const TOKEN_KEY = "mpk_access_token";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

// ---------- Unified fetch helper ----------
export interface ApiFetchOptions extends RequestInit {
  /** Attach Authorization: Bearer <token> if a token is stored */
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
    const t = getAuthToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }
  if (session) {
    h.set("X-Session-Id", getSessionId());
  }
  return fetch(apiUrl(path), {
    ...rest,
    headers: h,
    body: json !== undefined ? JSON.stringify(json) : body,
  });
}
