// Staff link helpers (handover doc 18 §16). Pure functions only: no imports, no import.meta, so
// `npm test` (node --test) runs them directly. Addresses come in as arguments.

export interface StaffAddresses {
  crmUrl: string;
  shopUrl: string;
  staffUrl: string;
}

export const DEFAULT_ADDRESSES: StaffAddresses = {
  crmUrl: "https://crm.momentspackaging.com",
  shopUrl: "https://momentspackaging.com",
  staffUrl: "https://staff.momentspackaging.com",
};

export type HandoffTarget = "CRM" | "STORE_ADMIN";

export const STAFF_LINK_USED_KEY = "moments_staff_link_used";

/** The staff overlay text (contract). */
export const STAFF_OVERLAY_TEXT =
  "This sign-in isn't for Moments staff. Staff have their own sign-in link: ask the person who manages your account for it.";

export function isStaffMode(hostname: string, appMode?: string): boolean {
  return appMode === "staff" || hostname.toLowerCase().startsWith("staff.");
}

export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h.endsWith(".localhost");
}

function originOf(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.origin : null;
  } catch {
    return null;
  }
}

export interface ResolvedNext {
  target: HandoffTarget;
  /** Where the callback lives: the origin of the app we are handing over to. */
  origin: string;
  /** Path (+ query) inside that app to land on after the callback. */
  path: string;
}

/**
 * `?next=<full address>` is honoured only when its origin is the CRM or the shop (and, when
 * running locally, any localhost origin). Anything else returns null (ignored).
 */
export function resolveNext(
  next: string | null | undefined,
  addr: StaffAddresses,
  currentHostname: string,
): ResolvedNext | null {
  if (!next) return null;
  let u: URL;
  try {
    u = new URL(next);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.username || u.password) return null;
  const path = `${u.pathname}${u.search}` || "/";
  const crm = originOf(addr.crmUrl);
  const shop = originOf(addr.shopUrl);
  const shopOrigins = new Set<string>(shop ? [shop] : []);
  if (shop === "https://momentspackaging.com") shopOrigins.add("https://www.momentspackaging.com");
  if (u.origin === crm) return { target: "CRM", origin: u.origin, path };
  if (shopOrigins.has(u.origin)) return { target: "STORE_ADMIN", origin: u.origin, path };
  if (isLocalHost(currentHostname) && isLocalHost(u.hostname)) {
    return {
      target: u.pathname.startsWith("/admin") ? "STORE_ADMIN" : "CRM",
      origin: u.origin,
      path,
    };
  }
  return null;
}

/** Callback address for a handover (contract: Addresses). */
export function callbackUrl(
  origin: string,
  target: HandoffTarget,
  code: string,
  nextPath?: string,
): string {
  const base = origin.replace(/\/+$/, "");
  const callback = target === "CRM" ? "/auth/callback" : "/admin/auth/callback";
  const params = new URLSearchParams({ code });
  if (nextPath && nextPath !== "/") params.set("next", nextPath);
  return `${base}${callback}#${params.toString()}`;
}

/** Parse `#code=...&next=...` from the callback address. */
export function parseCallbackHash(hash: string): { code: string | null; next: string | null } {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const code = params.get("code")?.trim() || null;
  const next = params.get("next");
  return { code, next: next ? next : null };
}

/** Only /admin/... paths survive; anything else (other origins, //x, /admin/login, /admin/auth) falls back. */
export function safeAdminNext(
  next: string | null | undefined,
  fallback = "/admin/dashboard",
): string {
  if (!next || !next.startsWith("/admin")) return fallback;
  if (next.startsWith("//") || next.includes("\\") || hasControlChar(next)) return fallback;
  if (next !== "/admin" && !next.startsWith("/admin/") && !next.startsWith("/admin?"))
    return fallback;
  if (/^\/admin\/(login|auth\/callback)(\/|\?|$)/.test(next)) return fallback;
  return next === "/admin" ? fallback : next;
}

/** Staff link with the wanted page carried in `next` (a full address on the shop's own origin). */
export function staffLinkUrl(staffUrl: string, wantedOrigin: string, wantedPath?: string): string {
  const base = staffUrl.replace(/\/+$/, "");
  if (!wantedPath) return `${base}/`;
  return `${base}/?next=${encodeURIComponent(`${wantedOrigin.replace(/\/+$/, "")}${wantedPath}`)}`;
}

const CUSTOMER_ACCOUNT_TYPES = ["INDIVIDUAL_SHOPPER", "BUSINESS"];

/**
 * Is this customer-login answer really a staff account? The store's accountType is the source of
 * truth (customers are INDIVIDUAL_SHOPPER or BUSINESS; anything else is not a customer). The roles
 * set can drift, so it is used only when accountType is absent.
 */
export function isStaffRoles(
  roles: readonly string[] | undefined | null,
  accountType?: string | null,
): boolean {
  if (typeof accountType === "string" && accountType.trim()) {
    return !CUSTOMER_ACCOUNT_TYPES.includes(accountType.trim().toUpperCase());
  }
  return !!roles && (roles.includes("ROLE_STAFF") || roles.includes("ROLE_ADMIN"));
}

/** Where a deliberate store-admin sign-out goes: the staff site, told to really sign out. */
export function staffSignedOutUrl(staffUrl: string): string {
  return `${staffUrl.replace(/\/+$/, "")}/?signedout=1`;
}

/** Does the staff-site address ask for a real sign-out (`?signedout=1`)? */
export function hasSignedOutFlag(search: string): boolean {
  return new URLSearchParams(search).get("signedout") === "1";
}

/** The address (path + query + hash) with `signedout` removed. */
export function withoutSignedOut(pathname: string, search: string, hash = ""): string {
  const params = new URLSearchParams(search);
  params.delete("signedout");
  const q = params.toString();
  return `${pathname}${q ? `?${q}` : ""}${hash}`;
}

/** USE_STAFF_LINK 403 from /auth/login. */
export function isUseStaffLinkError(status: number | undefined, code: string | undefined): boolean {
  return code === "USE_STAFF_LINK" && (status === undefined || status === 403);
}

// ── Chooser tile rules ──────────────────────────────────────────────────────

function permBare(p: string): string {
  return p.replace(/^PERM\./, "").toUpperCase();
}

/** Store admin is faded when the permissions are empty or only ENQUIRY_*. */
export function storeAdminTileOpen(permissions: readonly string[] | undefined | null): boolean {
  if (!permissions || permissions.length === 0) return false;
  return permissions.some((p) => !permBare(String(p)).startsWith("ENQUIRY_"));
}

/** CRM tile: Core's /auth/me answer. 401/403, a missing role or role NONE means faded. */
export function crmTileOpen(status: number, body: unknown): boolean {
  if (status < 200 || status >= 300) return false;
  const b = (body ?? {}) as Record<string, unknown>;
  const user = (b.user ?? {}) as Record<string, unknown>;
  const raw = b.role ?? b.crmRole ?? user.role ?? user.crmRole;
  if (typeof raw !== "string" || !raw.trim()) return false;
  return raw.trim().toUpperCase() !== "NONE";
}

function hasControlChar(v: string): boolean {
  for (let i = 0; i < v.length; i++) if (v.charCodeAt(i) < 32) return true;
  return false;
}
