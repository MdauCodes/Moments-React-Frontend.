// Pure helpers for the restaurant portal (handover doc 15 §16-§18). No React, no network, no "@/"
// imports, so `npm test` (node --test) can load this file directly. Every rule here is only for
// showing things; the store backend checks every permission and every value again.

export type RestaurantRole = "OWNER" | "APPROVER" | "BUYER";
export type ApprovalRule = "ALL" | "ANY";

export interface PortalMember {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  role: RestaurantRole;
  active: boolean;
  joinedAt?: string | null;
  rank?: string | null;
}

export interface PortalInvite {
  id: string;
  email: string;
  fullName?: string | null;
  role: RestaurantRole;
  status: string;
  expiresAt?: string | null;
  createdAt?: string | null;
  invitedBy?: string | null;
}

/** One row on the Team page or in the setup lists: a member who joined, or an invite not taken up yet. */
export interface TeamPerson {
  key: string;
  memberId: string | null;
  name: string;
  email: string;
  phone: string | null;
  rank: string | null;
  role: RestaurantRole;
  joined: boolean;
}

export interface TeamSplit {
  heads: TeamPerson[];
  staff: TeamPerson[];
}

export const isHeadRole = (role: RestaurantRole | null | undefined): boolean =>
  role === "OWNER" || role === "APPROVER";

/**
 * Heads (OWNER, APPROVER) and staff (BUYER), each with joined members first and then pending
 * invites whose email is not already a member. The owner (contact person) leads the heads.
 */
export function splitTeam(members: PortalMember[], invites: PortalInvite[]): TeamSplit {
  const active = members.filter((m) => m.active);
  const memberEmails = new Set(active.map((m) => m.email.toLowerCase()));
  const fromMember = (m: PortalMember): TeamPerson => ({
    key: `m-${m.id}`,
    memberId: m.id,
    name: m.name,
    email: m.email,
    phone: m.phone || null,
    rank: m.rank || null,
    role: m.role,
    joined: true,
  });
  const fromInvite = (i: PortalInvite): TeamPerson => ({
    key: `i-${i.id}`,
    memberId: null,
    name: i.fullName || i.email,
    email: i.email,
    phone: null,
    rank: null,
    role: i.role,
    joined: false,
  });
  const pending = invites.filter(
    (i) => i.status === "PENDING" && !memberEmails.has(i.email.toLowerCase()),
  );
  const order = (p: TeamPerson) => (p.role === "OWNER" ? 0 : 1);
  const heads = [
    ...active.filter((m) => isHeadRole(m.role)).map(fromMember),
    ...pending.filter((i) => isHeadRole(i.role)).map(fromInvite),
  ].sort((a, b) => order(a) - order(b));
  const staff = [
    ...active.filter((m) => m.role === "BUYER").map(fromMember),
    ...pending.filter((i) => i.role === "BUYER").map(fromInvite),
  ];
  return { heads, staff };
}

/** "David and Grace", "David, Grace and Peter". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export const firstName = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? fullName;

export function ruleText(rule: string | null | undefined): string {
  return rule === "ANY" ? "any one head approves" : "every head approves";
}

export function roleLabel(role: RestaurantRole | null | undefined): string {
  if (role === "OWNER") return "Owner";
  if (role === "APPROVER") return "Head";
  return "Staff";
}

/** Two or three letters for the header badge: the restaurant code if it has one, else initials. */
export function badgeLetters(name: string, code?: string | null): string {
  if (code && /^[A-Za-z]{2,4}\d?$/.test(code)) return code.toUpperCase().slice(0, 3);
  const words = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "R";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const DEFAULT_BRAND = "#1D4F5A";

/** The restaurant's colour when it is a plain #RRGGBB, else the portal's default teal. */
export function brandColor(value: string | null | undefined): string {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : DEFAULT_BRAND;
}

/** White or near-black text, whichever reads better on the given #RRGGBB background. */
export function textOn(hex: string): string {
  const c = brandColor(hex).slice(1);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(c.slice(i, i + 2), 16)));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const contrastWhite = 1.05 / (lum + 0.05);
  const contrastDark = (lum + 0.05) / 0.0614; // #17241C
  return contrastWhite >= contrastDark ? "#FFFFFF" : "#17241C";
}

const kesFormat = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 });

export function kes(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n == null || !Number.isFinite(n)) return "KES —";
  return `KES ${kesFormat.format(n)}`;
}

const NAIROBI = "Africa/Nairobi";

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: NAIROBI });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: NAIROBI });
  const time = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: NAIROBI,
  });
  return `${day}, ${time}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmail = (v: string): boolean => EMAIL_RE.test(v.trim());

/** 6 digits, spaces allowed ("731 506"). Returns the digits or null. */
export function cleanCode(v: string): string | null {
  const digits = v.replace(/\s+/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** The design asks for at least 10 characters (the server's own floor is 8). */
export const MIN_PASSWORD = 10;

export interface PasswordCheck {
  longEnough: boolean;
  matches: boolean;
  ok: boolean;
}

export function checkPassword(password: string, again: string): PasswordCheck {
  const longEnough = password.length >= MIN_PASSWORD;
  const matches = password.length > 0 && password === again;
  return { longEnough, matches, ok: longEnough && matches };
}

/**
 * What joining still needs, read from the store's answer to a code-only attempt
 * (POST /public/restaurant-invites/accept with just the email and code). The store checks the code
 * first and writes nothing else before these errors, so a right code with something missing leaves
 * the invite open:
 * - a new person needs their names and a password ("Enter your first name."),
 * - the contact person (whose account Moments opened) needs a password ("Choose a password ..."),
 * - anything else (a wrong or expired code, too many tries) stays on the code step.
 */
export type JoinNeed = "names" | "password" | "code-error";

export function classifyJoinError(message: string): JoinNeed {
  const m = message.toLowerCase();
  if (m.includes("first name") || m.includes("last name")) return "names";
  if (m.includes("password")) return "password";
  return "code-error";
}

export type HeadRequestKind = "ADD" | "REMOVE" | "REPLACE" | "RULE";

export const HEAD_REQUEST_KINDS: { value: HeadRequestKind; label: string }[] = [
  { value: "ADD", label: "Add a head" },
  { value: "REMOVE", label: "Remove a head" },
  { value: "REPLACE", label: "Replace a head" },
  { value: "RULE", label: "Change the rule (every head / any one head)" },
];

export interface HeadRequestDraft {
  kind: HeadRequestKind;
  memberId: string;
  fullName: string;
  rank: string;
  email: string;
  phone: string;
  approvalRule: ApprovalRule | "";
  reason: string;
}

/** The first problem with a head-change request, in the store's own words, or null when it can go. */
export function headRequestProblem(d: HeadRequestDraft, currentRule: string): string | null {
  if ((d.kind === "REMOVE" || d.kind === "REPLACE") && !d.memberId) {
    return "Choose which head steps down. (The contact person stays a head.)";
  }
  if (
    (d.kind === "ADD" || d.kind === "REPLACE") &&
    (!d.fullName.trim() || !d.rank.trim() || !isEmail(d.email))
  ) {
    return "Enter the new head's full name, rank and email.";
  }
  if (d.kind === "RULE") {
    if (!d.approvalRule) return "Choose the rule you want.";
    if (d.approvalRule === currentRule) return "That is already your rule.";
  }
  if (!d.reason.trim()) return "Say why, so Moments can decide.";
  if (d.reason.trim().length > 500) return "Keep the reason under 500 characters.";
  return null;
}

export interface HeadRequestLike {
  kind: string;
  memberName?: string | null;
  fullName?: string | null;
  rank?: string | null;
  approvalRule?: string | null;
}

/** "add Peter Mwangi (Operations manager) as a head" */
export function describeHeadRequest(r: HeadRequestLike): string {
  const who = r.fullName ? `${r.fullName}${r.rank ? ` (${r.rank})` : ""}` : "";
  switch (r.kind) {
    case "ADD":
      return `add ${who} as a head`;
    case "REMOVE":
      return `remove ${r.memberName ?? "a head"} as a head`;
    case "REPLACE":
      return `replace ${r.memberName ?? "a head"} with ${who}`;
    case "RULE":
      return `change the rule to: ${ruleText(r.approvalRule)}`;
    default:
      return "change the heads";
  }
}

export function headRequestStatus(status: string): { label: string; tone: Tone } {
  switch (status) {
    case "APPROVED":
      return { label: "Approved", tone: "good" };
    case "DECLINED":
      return { label: "Declined", tone: "bad" };
    case "WITHDRAWN":
      return { label: "Withdrawn", tone: "muted" };
    default:
      return { label: "Waiting for Moments", tone: "wait" };
  }
}

export type Tone = "good" | "bad" | "wait" | "muted" | "info";

/**
 * A pricing request as the restaurant sees it. Moments' own working steps (handed to someone,
 * prices proposed) all read "With Moments": the restaurant never sees who is pricing or what.
 */
export function priceRequestStatus(
  status: string,
  publishedVersion?: string | null,
): { label: string; tone: Tone } {
  if (status === "PUBLISHED") {
    return {
      label: publishedVersion ? `Priced · in ${publishedVersion}` : "Priced",
      tone: "good",
    };
  }
  if (status === "DECLINED") return { label: "Declined", tone: "bad" };
  return { label: "With Moments", tone: "wait" };
}

export interface CatalogueLineLike {
  productId: string;
  productName: string;
  category?: string | null;
}

/** Lines grouped by category in the order they came (the store sorts by category, then name). */
export function groupByCategory<T extends CatalogueLineLike>(
  lines: T[],
): { category: string; lines: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const line of lines) {
    const key = line.category?.trim() || "Other";
    const list = groups.get(key);
    if (list) list.push(line);
    else groups.set(key, [line]);
  }
  return [...groups.entries()].map(([category, ls]) => ({ category, lines: ls }));
}

export function filterLines<T extends CatalogueLineLike>(lines: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return lines;
  return lines.filter(
    (l) => l.productName.toLowerCase().includes(q) || (l.category ?? "").toLowerCase().includes(q),
  );
}

export interface ChangeLineLike {
  productName: string;
  oldPrice?: number | string | null;
  newPrice?: number | string | null;
  removed: boolean;
}

/** "From 1 Dec: Kraft box 1000 ml goes to KES 1,190." */
export function describeChange(effectiveFrom: string, c: ChangeLineLike): string {
  const day = shortDate(effectiveFrom);
  if (c.removed) return `From ${day}: ${c.productName} leaves your catalogue.`;
  if (c.oldPrice == null) return `From ${day}: ${c.productName} joins at ${kes(c.newPrice)}.`;
  return `From ${day}: ${c.productName} goes from ${kes(c.oldPrice)} to ${kes(c.newPrice)}.`;
}

/**
 * The setup's closing sentence (RestaurantSetupPhone, last frame), said to the contact person:
 * "David and Grace (heads) and James (staff) have their invites. Any of you can place an order;
 * it goes to you, David and Grace to approve, then to Moments."
 */
export function setupDoneSentence(
  heads: TeamPerson[],
  staff: TeamPerson[],
  rule: string | null | undefined,
): string {
  const otherHeads = heads.filter((h) => h.role !== "OWNER").map((h) => firstName(h.name));
  const staffNames = staff.map((s) => firstName(s.name));
  const parts: string[] = [];
  if (otherHeads.length) {
    parts.push(`${joinNames(otherHeads)} (${otherHeads.length > 1 ? "heads" : "head"})`);
  }
  if (staffNames.length) parts.push(`${joinNames(staffNames)} (staff)`);
  const invitedCount = otherHeads.length + staffNames.length;
  const first =
    invitedCount === 0
      ? ""
      : invitedCount === 1
        ? `${parts[0]} has an invite. `
        : `${joinNames(parts)} have their invites. `;
  const approvers = ["you", ...otherHeads];
  const approve =
    approvers.length === 1
      ? "you approve it"
      : rule === "ANY"
        ? `one of ${joinNames(approvers)} approves it`
        : `${joinNames(approvers)} approve it`;
  return `${first}Any of you can place an order; ${approve}, then it goes to Moments.`;
}
