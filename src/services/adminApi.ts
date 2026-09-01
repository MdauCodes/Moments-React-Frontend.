import { apiUrl } from "@/config/api";

export const ADMIN_SESSION_STORAGE_KEY = "moments_admin_token";
export const ADMIN_SESSION_CHANGED_EVENT = "moments-admin-session-changed";
export const ADMIN_LOGOUT_EVENT = "moments-admin-logout";
export const ADMIN_REFRESH_INTERVAL_MS = 14 * 60 * 1000;

export type AdminRole = "ADMIN" | "STAFF";
export type BackendRole = "ROLE_ADMIN" | "ROLE_STAFF";
export type ErrorCode =
  | "BAD_CREDENTIALS"
  | "VALIDATION_FAILED"
  | "INVALID_FILE"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMIT_EXCEEDED"
  | "ACCESS_DENIED"
  | "INTERNAL_ERROR";

export interface AdminSession {
  id?: string;
  name: string;
  email: string;
  role: AdminRole;
  roles: BackendRole[];
  token: string;
  refreshToken?: string;
  // ── Extended claims (Section 1 of admin overhaul) ──
  isStaff?: boolean;
  staffRole?: string;          // e.g. "SUPER_ADMIN", "DISPATCHER"
  staffRoleDisplay?: string;   // human label e.g. "Dispatcher"
  permissions?: string[];      // permission codes (PERM.*)
  mustChangePassword?: boolean;
}

export interface ApiErrorShape {
  timestamp?: string;
  status?: number;
  error?: string;
  code?: ErrorCode | string;
  message?: string;
  fields?: Record<string, string>;
  traceId?: string;
}

export class ApiError extends Error {
  status?: number;
  code?: string;
  fields?: Record<string, string>;
  traceId?: string;

  constructor(payload: ApiErrorShape, fallback = "Something went wrong, try again") {
    super(mapApiErrorMessage(payload, fallback));
    this.name = "ApiError";
    this.status = payload.status;
    this.code = payload.code;
    this.fields = payload.fields;
    this.traceId = payload.traceId;
  }
}

type AuthResponse = {
  accessToken?: string;
  refreshToken?: string;
  token?: string;
  name?: string;
  email?: string;
  role?: AdminRole | BackendRole | string;
  roles?: string[];
  isStaff?: boolean;
  staffRole?: string;
  staffRoleDisplay?: string;
  permissions?: string[];
  mustChangePassword?: boolean;
  user?: {
    id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: AdminRole | BackendRole | string;
    roles?: string[];
    isStaff?: boolean;
    staffRole?: string;
    staffRoleDisplay?: string;
    permissions?: string[];
    mustChangePassword?: boolean;
  };
};

let accessTokenMemory: string | null = null;
let refreshPromise: Promise<AdminSession | null> | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function notifySessionChanged(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(ADMIN_SESSION_CHANGED_EVENT));
}

function notifyLoggedOut(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(ADMIN_LOGOUT_EVENT));
}

function hasCompactJwtShape(token: string): boolean {
  const periodCount = (token.match(/\./g) ?? []).length;
  return periodCount === 2 || periodCount === 4;
}

function decodeJwtPayload(token: string): { exp?: number } | null {
  try {
    if (!hasCompactJwtShape(token) || !isBrowser()) return null;
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = window.atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return JSON.parse(json) as { exp?: number };
  } catch {
    return null;
  }
}

export function isJwtExpired(token: string | undefined, skewMs = 30_000): boolean {
  if (!token) return true;
  if (!hasCompactJwtShape(token)) return true;
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return false;
  return payload.exp * 1000 <= Date.now() + skewMs;
}

export function getJwtExpiresAt(token: string | undefined): number | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

export function isAdminRole(role: unknown): role is AdminRole {
  return role === "ADMIN" || role === "STAFF";
}

export function toBackendRole(role: AdminRole): BackendRole {
  return role === "ADMIN" ? "ROLE_ADMIN" : "ROLE_STAFF";
}

export function normalizeRoleValue(role: unknown): AdminRole | null {
  const normalized = String(role ?? "").replace(/^ROLE_/, "");
  return isAdminRole(normalized) ? normalized : null;
}

function normalizeRoles(data: AuthResponse, fallback?: AdminSession): BackendRole[] {
  const rawRoles = [data.user?.role, data.role, ...(data.user?.roles ?? []), ...(data.roles ?? []), ...(fallback?.roles ?? [])];
  const roles = rawRoles
    .map(normalizeRoleValue)
    .filter((role): role is AdminRole => !!role)
    .map(toBackendRole);
  return Array.from(new Set(roles));
}

function primaryRole(roles: BackendRole[], fallback?: AdminRole): AdminRole | null {
  if (roles.includes("ROLE_ADMIN")) return "ADMIN";
  if (roles.includes("ROLE_STAFF")) return "STAFF";
  return fallback ?? null;
}

export function mapApiErrorMessage(payload: ApiErrorShape, fallback = "Something went wrong, try again"): string {
  switch (payload.code) {
    case "BAD_CREDENTIALS":
      return "Invalid email or password";
    case "RATE_LIMIT_EXCEEDED":
      return "Too many attempts, wait a minute";
    case "ACCESS_DENIED":
      return "You don't have permission";
    case "INTERNAL_ERROR":
      return "Something went wrong, try again";
    case "VALIDATION_FAILED":
      return payload.message || "Please check the highlighted fields";
    case "INVALID_FILE":
      return "Only JPEG, PNG or WebP under 5MB allowed";
    default:
      return payload.message || fallback;
  }
}

async function parseApiError(res: Response): Promise<ApiError> {
  try {
    const data = (await res.json()) as ApiErrorShape;
    return new ApiError({ status: res.status, ...data });
  } catch {
    return new ApiError({ status: res.status, message: res.statusText });
  }
}

export function normalizeAdminSession(data: AuthResponse, fallback?: Partial<AdminSession>): AdminSession {
  const token = (data.accessToken ?? data.token ?? fallback?.token)?.replace(/^Bearer\s+/i, "");
  const refreshToken = (data.refreshToken ?? fallback?.refreshToken)?.replace(/^Bearer\s+/i, "");
  const email = data.user?.email ?? data.email ?? fallback?.email;
  const firstName = data.user?.firstName?.trim() ?? "";
  const lastName = data.user?.lastName?.trim() ?? "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const roles = normalizeRoles(data, fallback as AdminSession | undefined);
  const role = primaryRole(roles, fallback?.role);

  if (!token || !email) throw new Error("Authentication response was missing required session details");
  if (!role) throw new Error("This account is not authorised for the admin dashboard");

  // Decode extended JWT claims (or fall back to top-level / user.* fields).
  const jwt = decodeJwtPayload(token) as unknown as Record<string, unknown> | null;
  const pickArr = (...vals: unknown[]): string[] | undefined => {
    for (const v of vals) if (Array.isArray(v)) return (v as unknown[]).map(String);
    return undefined;
  };
  const pickBool = (...vals: unknown[]): boolean | undefined => {
    for (const v of vals) if (typeof v === "boolean") return v;
    return undefined;
  };
  const pickStr = (...vals: unknown[]): string | undefined => {
    for (const v of vals) if (typeof v === "string" && v) return v;
    return undefined;
  };

  return {
    id: data.user?.id ?? fallback?.id ?? (jwt?.userId as string | undefined) ?? (jwt?.sub as string | undefined),
    token,
    refreshToken,
    roles: roles.length ? roles : [toBackendRole(role)],
    name: data.user?.name ?? (fullName || undefined) ?? data.name ?? fallback?.name ?? email,
    email,
    role,
    isStaff: pickBool(data.isStaff, data.user?.isStaff, jwt?.isStaff) ?? true,
    staffRole: pickStr(data.staffRole, data.user?.staffRole, jwt?.staffRole),
    staffRoleDisplay: pickStr(data.staffRoleDisplay, data.user?.staffRoleDisplay, jwt?.staffRoleDisplay),
    permissions: pickArr(data.permissions, data.user?.permissions, jwt?.permissions),
    mustChangePassword: pickBool(data.mustChangePassword, data.user?.mustChangePassword, jwt?.mustChangePassword) ?? false,
  };
}

// PATCH /api/v1/auth/staff/change-password — body { currentPassword, newPassword }.
// Returns refreshed session if backend issues new tokens; otherwise clears the
// mustChangePassword flag locally so the user can proceed.
export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<AdminSession | null> {
  const current = readAdminSession();
  if (!current) return null;
  const res = await fetch(apiUrl("/api/v1/auth/staff/change-password"), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${current.token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw await parseApiError(res);
  let next: AdminSession;
  try {
    const data = (await res.json()) as AuthResponse;
    next = normalizeAdminSession(data, current);
  } catch {
    next = { ...current, mustChangePassword: false };
  }
  next.mustChangePassword = false;
  writeAdminSession(next);
  return next;
}

export function readAdminSession(): AdminSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSession;
    if (!parsed.refreshToken || !isAdminRole(parsed.role)) return null;
    if (parsed.token) accessTokenMemory = parsed.token;
    return { ...parsed, roles: parsed.roles ?? [toBackendRole(parsed.role)] };
  } catch {
    clearAdminSession();
    return null;
  }
}

export function writeAdminSession(session: AdminSession): void {
  accessTokenMemory = session.token;
  if (!isBrowser()) return;
  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(session));
  notifySessionChanged();
}

export function clearAdminSession(): void {
  accessTokenMemory = null;
  if (!isBrowser()) return;
  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
  notifySessionChanged();
}

export async function loginAdmin(email: string, password: string): Promise<AdminSession> {
  const res = await fetch(apiUrl("/api/v1/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await parseApiError(res);
  const next = normalizeAdminSession((await res.json()) as AuthResponse, { email });
  writeAdminSession(next);
  return next;
}

export async function refreshAdminSession(session = readAdminSession()): Promise<AdminSession | null> {
  if (!session?.refreshToken) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const res = await fetch(apiUrl("/api/v1/auth/refresh"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    if (!res.ok) return null;
    const next = normalizeAdminSession((await res.json()) as AuthResponse, session);
    writeAdminSession(next);
    return next;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function logoutAdmin(): Promise<void> {
  const session = readAdminSession();
  clearAdminSession();
  if (session?.refreshToken) {
    try {
      await fetch(apiUrl("/api/v1/auth/logout"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    } catch {
      // ignore network failures during logout
    }
  }
}

export async function getValidAdminSession(): Promise<AdminSession | null> {
  const session = readAdminSession();
  if (!session) return null;
  if (accessTokenMemory && !isJwtExpired(accessTokenMemory)) return { ...session, token: accessTokenMemory };
  const refreshed = await refreshAdminSession(session);
  if (!refreshed) clearAdminSession();
  return refreshed;
}

export async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  const session = await getValidAdminSession();
  if (!session) {
    clearAdminSession();
    notifyLoggedOut();
    throw new ApiError({ status: 401, code: "BAD_CREDENTIALS", message: "Admin session expired. Please sign in again." });
  }

  const makeRequest = (token: string) => {
    const isFormData = init?.body instanceof FormData;
    // Every admin action carries which admin page/section it was triggered from, so the audit
    // log can record "where they went" alongside who did what — read on the backend via
    // AuditLogService.extractSourcePage(). Single choke point (adminFetch), so no per-page
    // instrumentation is needed anywhere else.
    const sourcePage = isBrowser() ? window.location.pathname : undefined;
    return fetch(apiUrl(path), {
      ...init,
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        Authorization: `Bearer ${token}`,
        ...(sourcePage ? { "X-Admin-Page": sourcePage } : {}),
        ...init?.headers,
      },
    });
  };

  let res = await makeRequest(session.token);
  if (res.status === 401) {
    const refreshed = await refreshAdminSession(session);
    if (refreshed) res = await makeRequest(refreshed.token);
  }

  if (res.status === 401) {
    clearAdminSession();
    notifyLoggedOut();
    throw await parseApiError(res);
  }
  if (res.status === 403) throw new ApiError({ status: 403, code: "ACCESS_DENIED" });
  return res;
}

export async function adminJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await adminFetch(path, init);
  if (!res.ok) throw await parseApiError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
