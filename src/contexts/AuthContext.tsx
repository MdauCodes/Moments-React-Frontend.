import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { apiUrl, getImpersonationToken, getSessionId } from "@/config/api";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  accountType?: "INDIVIDUAL_SHOPPER" | "BUSINESS";
}

interface AuthContextValue {
  user: AuthUser | null;
  /** No longer a real bearer token — the session lives in an httpOnly cookie this code can't
   *  read. Kept as a truthy/falsy signal for existing callers; use `isAuthenticated` instead of
   *  checking this directly. */
  accessToken: string | null;
  isAuthenticated: boolean;
  isCustomer: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  login: (email: string, password: string, turnstileToken?: string) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  /** Called after register/verify-email — the backend already set the session cookie in its
   *  response, this just updates local state with the user info the same response carried. */
  setSession: (user: AuthUser) => void;
  /** True when this tab is an admin previewing a customer's dashboard (see impersonateCustomer). */
  isImpersonating: boolean;
  exitImpersonation: () => void;
  /** False until the initial GET /auth/me (or impersonation bootstrap) has resolved. A consumer
   *  that needs to gate on "definitely logged out" (ProtectedRoute) must wait for this instead of
   *  reading isAuthenticated alone — isAuthenticated starts false on every fresh mount regardless
   *  of whether a valid session cookie exists, so acting on it before this flips true means acting
   *  on "haven't checked yet," not "checked, and there's no session." */
  authChecked: boolean;
  /**
   * A fresh random value minted on every login()/setSession() call and cleared on logout() —
   * NOT the same as "is a session active." login()/logout() here mutate token state in place
   * without reloading the page, so a plain persisted dismissal flag (as WelcomeStarterModal
   * uses) would wrongly survive a logout→login in the same tab. Consumers that need to
   * "reappear every login" key their dismissal against this value instead of a fixed boolean.
   */
  loginSessionId: string | null;
}

const REFRESH_INTERVAL_MS = 840_000; // 14 min

// Impersonation lives in sessionStorage (tab-scoped, never localStorage/cookies) so an admin
// previewing a customer's dashboard in a new tab can never collide with or overwrite a real
// customer/admin session — closing the tab discards it. See config/api.ts's Javadoc-equivalent
// comment on getImpersonationToken for why this stays bearer-token-based rather than moving to
// the cookie session below.
const IMPERSONATION_KEY = "mpk_impersonation_token";

// See loginSessionId's doc comment on AuthContextValue for why this exists.
const LOGIN_SESSION_NONCE_KEY = "mpk_login_session_nonce";

function readLoginSessionNonce(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(LOGIN_SESSION_NONCE_KEY);
  } catch {
    return null;
  }
}

function mintLoginSessionNonce(): string {
  const nonce = crypto.randomUUID();
  try {
    window.sessionStorage.setItem(LOGIN_SESSION_NONCE_KEY, nonce);
  } catch {
    /* ignore */
  }
  return nonce;
}

function clearLoginSessionNonce(): void {
  try {
    window.sessionStorage.removeItem(LOGIN_SESSION_NONCE_KEY);
  } catch {
    /* ignore */
  }
}

// Reads a one-time ?impersonate=<token> param (set by the admin "Preview dashboard" button),
// moves it into sessionStorage, and strips it from the visible URL so it never lingers in
// history/bookmarks.
function bootstrapImpersonationFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("impersonate");
  if (!token) return null;
  try {
    window.sessionStorage.setItem(IMPERSONATION_KEY, token);
  } catch {
    /* ignore */
  }
  params.delete("impersonate");
  const newSearch = params.toString();
  window.history.replaceState({}, "", window.location.pathname + (newSearch ? `?${newSearch}` : "") + window.location.hash);
  return token;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Module-scoped mirror of "do we believe a cookie session is active" — kept in sync with React
// state so getAccessToken() (called from many places outside any component, purely as a
// truthy/falsy signal) doesn't need its own subscription. Never holds a real token value; the
// httpOnly cookie is the only place the actual credential exists.
let sessionActiveMem = false;

export function getAccessToken(): string | null {
  const impersonation = getImpersonationToken();
  if (impersonation) return impersonation;
  return sessionActiveMem ? "cookie-session" : null;
}

// Decode JWT payload — used ONLY for the impersonation token, which is deliberately a plain,
// client-visible bearer token by design (see getImpersonationToken's Javadoc-equivalent comment).
// The real login session is never decoded client-side anymore; AuthUserDto in the response body
// (or GET /auth/me) is the sole source of user info.
function decodeImpersonationJwt(token: string | null): AuthUser | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    if (!payload.sub || !payload.userId || !payload.firstName) return null;
    return {
      id: payload.userId,
      email: payload.sub,
      firstName: payload.firstName,
      lastName: payload.lastName ?? "",
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      accountType: payload.accountType,
    };
  } catch {
    return null;
  }
}

// Shared, de-duplicated refresh — module-level (not per-component) so authFetch's automatic
// retry-on-401 and AuthProvider's own mount-time/interval refresh always share one in-flight
// request instead of each firing its own. Without this, N components/requests hitting a 401 at
// once each independently POST /auth/refresh with the same (single-use, rotating) refresh
// cookie — only the first actually succeeds server-side, and the rest look like session-expired
// to whichever caller loses the race. Returns true/false (session refreshed or not) rather than
// a token, since the cookie is httpOnly — refreshing it isn't something JS can observe directly.
let inFlightRefresh: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("/api/v1/auth/refresh"), { method: "POST", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

function sharedRefresh(): Promise<boolean> {
  if (!inFlightRefresh) {
    inFlightRefresh = performRefresh().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionActive, setSessionActiveState] = useState(false);
  const [impersonationToken, setImpersonationToken] = useState<string | null>(
    () => bootstrapImpersonationFromUrl() ?? getImpersonationToken(),
  );
  const [loginSessionId, setLoginSessionId] = useState<string | null>(() => readLoginSessionNonce());
  // Impersonation is resolved synchronously (from sessionStorage/URL, via the impersonationToken
  // initializer above, which runs first) — nothing async to wait for in that case. Only the
  // cookie-session path below has a real network round-trip to wait on.
  const [authChecked, setAuthChecked] = useState(() => !!getImpersonationToken());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const impersonatedUser = impersonationToken ? decodeImpersonationJwt(impersonationToken) : null;
  const effectiveUser = impersonatedUser ?? user;

  const setSessionActive = (active: boolean) => {
    sessionActiveMem = active;
    setSessionActiveState(active);
  };

  const exitImpersonation = () => {
    try {
      window.sessionStorage.removeItem(IMPERSONATION_KEY);
    } catch {
      /* ignore */
    }
    setImpersonationToken(null);
    if (window.opener) {
      window.close();
    } else {
      window.location.href = "/";
    }
  };

  // Session restore on mount — GET /auth/me with the cookie sent automatically. A 401 (access
  // cookie expired but the longer-lived refresh cookie may still be valid — e.g. a page reload
  // after 15+ minutes) triggers one refresh-and-retry before giving up, mirroring what the old
  // localStorage-token version did on finding an expired token with a refresh token still present.
  useEffect(() => {
    if (impersonationToken) return;
    let cancelled = false;
    (async () => {
      let res = await fetch(apiUrl("/api/v1/auth/me"), { credentials: "include" });
      if (res.status === 401) {
        const refreshed = await sharedRefresh();
        if (refreshed) res = await fetch(apiUrl("/api/v1/auth/me"), { credentials: "include" });
      }
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as AuthUser;
        setSessionActive(true);
        setUser(data);
        if (!readLoginSessionNonce()) mintLoginSessionNonce();
        setLoginSessionId(readLoginSessionNonce());
      } else {
        setSessionActive(false);
        setUser(null);
      }
      setAuthChecked(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impersonationToken]);

  // Auto-refresh interval — also skipped while impersonating, same reasoning as above.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!sessionActive || impersonationToken) return;
    intervalRef.current = setInterval(() => {
      void sharedRefresh();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionActive, impersonationToken]);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    const ok = await sharedRefresh();
    setSessionActive(ok);
    if (!ok) setUser(null);
    return ok ? "cookie-session" : null;
  }, []);

  const login = async (email: string, password: string, turnstileToken?: string) => {
    const res = await fetch(apiUrl("/api/v1/auth/login"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "X-Session-Id": getSessionId() },
      body: JSON.stringify({ email, password, turnstileToken }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // code "CHALLENGE_REQUIRED" (HTTP 428) means this IP has 5+ recent failures and must pass
      // a Turnstile check before the credentials are even looked at — attached to the thrown
      // Error so the login form can show the widget instead of a plain "login failed" message.
      const message = (err as { message?: string }).message ?? "Login failed";
      const loginError = new Error(message) as Error & { code?: string };
      loginError.code = (err as { code?: string }).code;
      throw loginError;
    }
    const data = await res.json();
    const nextUser = (data as { user?: AuthUser }).user ?? null;
    if (!nextUser) {
      // Without a user, isAuthenticated can never become true — surface this as a real failure
      // instead of returning a "successful" login while the header silently stays signed out.
      throw new Error("Login succeeded but no session was returned. Please try again.");
    }
    setSessionActive(true);
    setUser(nextUser);
    setLoginSessionId(mintLoginSessionNonce());
    return nextUser;
  };

  const setSession = (nextUser: AuthUser) => {
    setSessionActive(true);
    setUser(nextUser);
    setLoginSessionId(mintLoginSessionNonce());
  };

  const logout = async () => {
    try {
      await fetch(apiUrl("/api/v1/auth/logout"), { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    setSessionActive(false);
    setUser(null);
    clearLoginSessionNonce();
    setLoginSessionId(null);
  };

  const roles = effectiveUser?.roles ?? [];
  const value: AuthContextValue = {
    user: effectiveUser,
    accessToken: getAccessToken(),
    isAuthenticated: !!effectiveUser,
    isCustomer: roles.includes("ROLE_CUSTOMER"),
    isStaff: roles.includes("ROLE_STAFF"),
    isAdmin: roles.includes("ROLE_ADMIN"),
    login,
    logout,
    refreshToken,
    setSession,
    isImpersonating: !!impersonationToken,
    exitImpersonation,
    loginSessionId,
    authChecked,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * authFetch — wraps fetch with credentials for the cookie session, plus the impersonation bearer
 * token when previewing a customer. On a 401 (cookie session only — impersonation tokens don't
 * refresh, they're short-lived by design) it retries once via the shared, de-duplicated refresh.
 *
 * The `refresh`/`onAuthFailed` legacy positional params are kept for call-site compatibility but
 * `refresh` is no longer used — every caller now gets the same de-duplicated cookie-refresh
 * automatically instead of only the (few) call sites that used to remember to pass one in.
 */
export async function authFetch(
  input: string,
  init: RequestInit = {},
  _legacyRefresh?: () => Promise<string | null>,
  onAuthFailed?: () => void,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const impersonation = getImpersonationToken();
  if (impersonation) headers.set("Authorization", `Bearer ${impersonation}`);
  let res = await fetch(input, { ...init, headers, credentials: "include" });
  if (res.status !== 401) return res;
  if (impersonation) {
    onAuthFailed?.();
    return res;
  }
  const refreshed = await sharedRefresh();
  if (!refreshed) {
    onAuthFailed?.();
    return res;
  }
  const retryHeaders = new Headers(init.headers);
  res = await fetch(input, { ...init, headers: retryHeaders, credentials: "include" });
  if (res.status === 401) onAuthFailed?.();
  return res;
}
