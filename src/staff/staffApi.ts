import { apiUrl } from "@/config/api";
import { CORE_API_URL } from "@/config/staff";
import { crmTileOpen, type HandoffTarget } from "@/lib/staffLink";

export const STAFF_SESSION_KEY = "moments_staff_session";
export const STAFF_DEVICE_KEY = "moments_staff_device";

export interface StaffSession {
  accessToken: string;
  refreshToken?: string;
  user?: { id?: string; email?: string; firstName?: string; lastName?: string; roles?: string[] };
  staff?: { staffRoleName?: string; permissions?: string[] };
}

export class StaffApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function setItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage full or blocked: the session lasts for this page only */
  }
}
function removeItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function readSession(): StaffSession | null {
  try {
    const raw = getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as StaffSession;
    return s?.accessToken ? s : null;
  } catch {
    return null;
  }
}
export const writeSession = (s: StaffSession): void =>
  setItem(STAFF_SESSION_KEY, JSON.stringify(s));
export const clearSession = (): void => removeItem(STAFF_SESSION_KEY);
export const readDeviceToken = (): string | undefined => getItem(STAFF_DEVICE_KEY) || undefined;
export const writeDeviceToken = (t: string): void => setItem(STAFF_DEVICE_KEY, t);

async function post<T>(
  path: string,
  body: unknown,
  bearer?: string,
  credentials: RequestCredentials = "omit",
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(apiUrl(path), {
      method: "POST",
      credentials,
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new StaffApiError(
      0,
      "NETWORK",
      "We can't reach the sign-in service. Check your connection and try again.",
    );
  }
  const data = (await res.json().catch(() => ({}))) as { code?: string; message?: string } & Record<
    string,
    unknown
  >;
  if (!res.ok)
    throw new StaffApiError(res.status, data.code, data.message ?? "Something went wrong");
  return data as T;
}

export type LoginAnswer =
  | ({ kind: "STAFF" } & StaffSession)
  | { kind: "CODE_REQUIRED"; challengeId: string; emailHint?: string }
  | { kind: "CUSTOMER" };

export const staffLogin = (email: string, password: string, turnstileToken?: string) =>
  post<LoginAnswer>(
    "/api/v1/auth/staff/login",
    {
      email,
      password,
      turnstileToken: turnstileToken || undefined,
      deviceToken: readDeviceToken(),
    },
    undefined,
    "include",
  );

export const staffVerify = (challengeId: string, code: string, rememberDevice: boolean) =>
  post<{ kind?: string; deviceToken?: string } & StaffSession>("/api/v1/auth/staff/login/verify", {
    challengeId,
    code,
    rememberDevice,
  });

export async function refreshSession(s: StaffSession): Promise<StaffSession | null> {
  if (!s.refreshToken) return null;
  try {
    const data = await post<Partial<StaffSession> & { token?: string }>("/api/v1/auth/refresh", {
      refreshToken: s.refreshToken,
    });
    const accessToken = data.accessToken ?? data.token;
    if (!accessToken) return null;
    const next: StaffSession = {
      ...s,
      accessToken,
      refreshToken: data.refreshToken ?? s.refreshToken,
      user: data.user ?? s.user,
      staff: data.staff ?? s.staff,
    };
    writeSession(next);
    return next;
  } catch {
    return null;
  }
}

export const requestHandoff = (accessToken: string, target: HandoffTarget) =>
  post<{ code: string; expiresInSeconds?: number }>(
    "/api/v1/auth/handoff",
    { target },
    accessToken,
  );

/** Handoff with one refresh retry on 401. Returns the code, or null when the session is gone. */
export async function handoffWithRefresh(
  s: StaffSession,
  target: HandoffTarget,
): Promise<string | null> {
  try {
    return (await requestHandoff(s.accessToken, target)).code;
  } catch (e) {
    if (!(e instanceof StaffApiError) || e.status !== 401) throw e;
    const next = await refreshSession(s);
    if (!next) return null;
    return (await requestHandoff(next.accessToken, target)).code;
  }
}

export async function logoutStaff(s: StaffSession | null): Promise<void> {
  clearSession();
  if (!s?.refreshToken) return;
  try {
    await fetch(apiUrl("/api/v1/auth/logout"), {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: s.refreshToken }),
    });
  } catch {
    /* ignore */
  }
}

async function crmMe(accessToken: string): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await fetch(`${CORE_API_URL.replace(/\/+$/, "")}/api/v1/auth/me`, {
      credentials: "omit",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch {
    return null;
  }
}

/**
 * Core: is the CRM open to this person? On 401 the session is refreshed once and the check retried.
 * Returns false only when Core really answers no access (or the session is gone).
 */
export async function checkCrmAccess(session: StaffSession): Promise<boolean> {
  let r = await crmMe(session.accessToken);
  if (r?.status === 401) {
    const next = await refreshSession(session);
    if (!next) return false;
    r = await crmMe(next.accessToken);
  }
  return r ? crmTileOpen(r.status, r.body) : false;
}
