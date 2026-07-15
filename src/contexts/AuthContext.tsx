import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { apiUrl, setAuthToken, getAuthToken, getSessionId } from "@/config/api";

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
  accessToken: string | null;
  isAuthenticated: boolean;
  isCustomer: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  setSession: (accessToken: string, refreshTokenValue?: string) => void;
  /** True when this tab is an admin previewing a customer's dashboard (see impersonateCustomer). */
  isImpersonating: boolean;
  exitImpersonation: () => void;
}

const RT_KEY = "mpk_rt";
const REFRESH_INTERVAL_MS = 840_000; // 14 min

// Impersonation lives in sessionStorage (tab-scoped, never localStorage) so an admin
// previewing a customer's dashboard in a new tab can never collide with or overwrite a real
// customer/admin session sitting in that browser's localStorage — closing the tab discards it.
const IMPERSONATION_KEY = "mpk_impersonation_token";

function readImpersonationToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(IMPERSONATION_KEY);
  } catch {
    return null;
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

// Module-scoped access token mirror (kept in sync with localStorage)
let accessTokenMem: string | null = null;
export function getAccessToken(): string | null {
  return readImpersonationToken() ?? accessTokenMem ?? getAuthToken();
}

// Decode JWT payload and extract AuthUser from claims.
// Returns null if token is missing, malformed, or expired.
function decodeJwt(token: string | null): AuthUser | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    // Must have the claims we added in JwtService
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

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialise user instantly from existing token — no network call needed
  const [user, setUser] = useState<AuthUser | null>(() => decodeJwt(getAuthToken()));
  const [accessToken, setAccessTokenState] = useState<string | null>(getAuthToken());
  const [impersonationToken, setImpersonationToken] = useState<string | null>(
    () => bootstrapImpersonationFromUrl() ?? readImpersonationToken(),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const impersonatedUser = impersonationToken ? decodeJwt(impersonationToken) : null;
  const effectiveUser = impersonatedUser ?? user;
  const effectiveAccessToken = impersonationToken ?? accessToken;

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

  const setAccessToken = (token: string | null) => {
    accessTokenMem = token;
    setAuthToken(token);
    setAccessTokenState(token);
    // Always sync user from token so they stay in step
    setUser(decodeJwt(token));
  };

  const refreshToken = useCallback(async (): Promise<string | null> => {
    const rt = typeof window !== "undefined" ? window.localStorage.getItem(RT_KEY) : null;
    if (!rt) return null;
    try {
      const res = await fetch(apiUrl("/api/v1/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
      if (!res.ok) throw new Error("refresh failed");
      const data = await res.json();
      if (data.accessToken) setAccessToken(data.accessToken);
      if (data.refreshToken) window.localStorage.setItem(RT_KEY, data.refreshToken);
      return data.accessToken ?? null;
    } catch {
      setAccessToken(null);
      try {
        window.localStorage.removeItem(RT_KEY);
      } catch {
        /* ignore */
      }
      return null;
    }
  }, []);

  // On mount: if token is expired but refresh token exists, trigger refresh.
  // Skipped while impersonating — that session deliberately has no refresh token, and this
  // tab's localStorage may hold an unrelated real customer/admin session we must never touch.
  useEffect(() => {
    if (impersonationToken) return;
    const token = getAuthToken();
    const rt = typeof window !== "undefined" ? window.localStorage.getItem(RT_KEY) : null;
    if (rt && !decodeJwt(token)) {
      // Token missing or expired — refresh silently
      void refreshToken();
    }
  }, [refreshToken, impersonationToken]);

  // Auto-refresh interval — also skipped while impersonating, same reasoning as above.
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!accessToken || impersonationToken) return;
    intervalRef.current = setInterval(() => {
      void refreshToken();
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [accessToken, refreshToken, impersonationToken]);

  const login = async (email: string, password: string) => {
    const res = await fetch(apiUrl("/api/v1/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": getSessionId() },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message ?? "Login failed");
    }
    const data = await res.json();
    if (!data.accessToken) {
      // Without a token, isAuthenticated can never become true (it requires
      // both accessToken and user) — surface this as a real failure instead
      // of returning a "successful" user while the header silently stays
      // signed out.
      throw new Error("Login succeeded but no session token was returned. Please try again.");
    }
    setAccessToken(data.accessToken);
    if (data.refreshToken) {
      try {
        window.localStorage.setItem(RT_KEY, data.refreshToken);
      } catch {
        /* ignore */
      }
    }
    return decodeJwt(data.accessToken) ?? (data.user as AuthUser) ?? null;
  };

  const setSession = (token: string, refreshTokenValue?: string) => {
    setAccessToken(token);
    if (refreshTokenValue) {
      try {
        window.localStorage.setItem(RT_KEY, refreshTokenValue);
      } catch {
        /* ignore */
      }
    }
  };

  const logout = async () => {
    const rt = typeof window !== "undefined" ? window.localStorage.getItem(RT_KEY) : null;
    try {
      await fetch(apiUrl("/api/v1/auth/logout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rt }),
      });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    try {
      window.localStorage.removeItem(RT_KEY);
    } catch {
      /* ignore */
    }
  };

  const roles = effectiveUser?.roles ?? [];
  const value: AuthContextValue = {
    user: effectiveUser,
    accessToken: effectiveAccessToken,
    isAuthenticated: !!effectiveAccessToken && !!effectiveUser,
    isCustomer: roles.includes("ROLE_CUSTOMER"),
    isStaff: roles.includes("ROLE_STAFF"),
    isAdmin: roles.includes("ROLE_ADMIN"),
    login,
    logout,
    refreshToken,
    setSession,
    isImpersonating: !!impersonationToken,
    exitImpersonation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * authFetch — wraps fetch and handles 401 by refresh+retry once.
 */
export async function authFetch(
  input: string,
  init: RequestInit = {},
  refresh?: () => Promise<string | null>,
  onAuthFailed?: () => void,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res = await fetch(input, { ...init, headers });
  if (res.status !== 401 || !refresh) return res;
  const newToken = await refresh();
  if (!newToken) {
    onAuthFailed?.();
    return res;
  }
  const retryHeaders = new Headers(init.headers);
  retryHeaders.set("Authorization", `Bearer ${newToken}`);
  res = await fetch(input, { ...init, headers: retryHeaders });
  if (res.status === 401) onAuthFailed?.();
  return res;
}
