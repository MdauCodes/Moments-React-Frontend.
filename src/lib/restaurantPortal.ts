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

const kesWhole = new Intl.NumberFormat("en-KE", { maximumFractionDigits: 0 });
const kesCents = new Intl.NumberFormat("en-KE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "KES 1,190", or "KES 41,449.60" when there are cents. */
export function kes(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (n == null || !Number.isFinite(n)) return "KES —";
  const whole = Math.round(n * 100) % 100 === 0;
  return `KES ${(whole ? kesWhole : kesCents).format(n)}`;
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

// ---- purchase orders (doc 15 §20-§21) ----

/**
 * What a PO's stage says to the restaurant (doc 15 §23.7: the heads sign, then it is paid or goes
 * on credit, then Moments sees it). `revision` > 1 at AWAITING_SIGNED_COPY means Moments changed the
 * PO and the heads sign the new version.
 */
export function poStageText(
  stage: string,
  signingMethod?: string,
  revision?: number,
): { label: string; tone: Tone } {
  switch (stage) {
    case "AWAITING_SIGNED_COPY":
      if (revision && revision > 1) return { label: `Version ${revision} to sign`, tone: "wait" };
      return signingMethod && signingMethod !== "MANUAL"
        ? { label: "With the heads", tone: "wait" }
        : { label: "Waiting for the signed copy", tone: "wait" };
    case "AWAITING_PAYMENT":
      return { label: "Approved · waiting for payment", tone: "wait" };
    case "CONFIRMING_PAYMENT":
      return { label: "Bank transfer · Moments is confirming", tone: "info" };
    case "AWAITING_TOP_UP":
      return { label: "Moments changed the total · top up", tone: "wait" };
    case "CHECKING_SIGNED_COPY":
      return { label: "With Moments · checking the signed copy", tone: "info" };
    case "SENT_BACK":
      return { label: "Sent back: upload a new signed copy", tone: "bad" };
    case "HELD":
      return { label: "Held for Moments' approval", tone: "wait" };
    case "WITH_MOMENTS":
      return { label: "With Moments", tone: "info" };
    case "BEING_PREPARED":
      return { label: "Being prepared at Moments", tone: "info" };
    case "AWAITING_FINAL_SIGNATURE":
      return { label: "Waiting for Moments' final signature", tone: "info" };
    case "READY_FOR_PICKUP":
      return { label: "Ready for pickup", tone: "good" };
    case "ON_ITS_WAY":
      return { label: "On its way", tone: "good" };
    case "DELIVERED":
      return { label: "Delivered", tone: "good" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "muted" };
    default:
      return { label: "In progress", tone: "muted" };
  }
}

/** Stages that are finished: they leave "Orders in progress". */
export const isPoClosed = (stage: string): boolean =>
  stage === "DELIVERED" || stage === "CANCELLED";

/** A signed copy may be uploaded only at these stages (the store checks too). */
export const canUploadAt = (stage: string): boolean =>
  stage === "AWAITING_SIGNED_COPY" || stage === "SENT_BACK";

export const SIGNED_COPY_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const SIGNED_COPY_MAX_FILES = 10;
export const SIGNED_COPY_MAX_BYTES = 10 * 1024 * 1024;
/** The store takes up to 30 MB in one upload (§21.1). */
export const SIGNED_COPY_MAX_TOTAL = 30 * 1024 * 1024;

export interface FileLike {
  name: string;
  type: string;
  size: number;
}

/** The first problem with the files picked for a signed copy, or null when they can go. */
export function signedCopyProblem(files: FileLike[]): string | null {
  if (files.length === 0) return "Add the scan or photos of the signed PO.";
  if (files.length > SIGNED_COPY_MAX_FILES) {
    return `Up to ${SIGNED_COPY_MAX_FILES} files at a time. Put several pages in one PDF if you can.`;
  }
  const lowerName = (f: FileLike) => f.name.toLowerCase();
  for (const f of files) {
    const okType = SIGNED_COPY_TYPES.includes(f.type) || /\.(pdf|jpe?g|png)$/.test(lowerName(f));
    if (!okType) return `${f.name} isn't a PDF, JPG or PNG.`;
    if (f.size > SIGNED_COPY_MAX_BYTES) return `${f.name} is over 10 MB. Scan at a lower quality.`;
    if (f.size === 0) return `${f.name} is empty.`;
  }
  if (files.reduce((sum, f) => sum + f.size, 0) > SIGNED_COPY_MAX_TOTAL) {
    return "Together the files are over 30 MB. Scan at a lower quality or send fewer pages.";
  }
  return null;
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "Every head signs" / "One head signs", for the signature boxes on the printed PO. */
export function signRuleText(rule: string | null | undefined, heads: number): string {
  if (heads <= 1) return "The head signs the printed PO.";
  return rule === "ANY"
    ? "Any one head signs the printed PO."
    : `All ${heads} heads sign the printed PO.`;
}

// ---- placing a PO from the catalogue (doc 15 §21: POST /checkout with restaurantOrder CATALOGUE) ----

export interface OrderLineLike {
  productId: string;
  productName: string;
  unit?: string | null;
  price: number | string;
}

export interface OrderSummaryLine {
  productId: string;
  productName: string;
  unit: string;
  qty: number;
  price: number;
  amount: number;
}

/** The PO's lines and total as the restaurant will see them; the store prices it again itself. */
export function orderSummary(
  lines: OrderLineLike[],
  quantities: Record<string, number>,
): { lines: OrderSummaryLine[]; total: number; count: number } {
  const out: OrderSummaryLine[] = [];
  for (const l of lines) {
    const qty = Math.floor(quantities[l.productId] ?? 0);
    if (qty <= 0) continue;
    const price = Number(l.price);
    out.push({
      productId: l.productId,
      productName: l.productName,
      unit: l.unit ?? "",
      qty,
      price,
      amount: Math.round(price * qty * 100) / 100,
    });
  }
  const total = Math.round(out.reduce((s, l) => s + l.amount, 0) * 100) / 100;
  return { lines: out, total, count: out.reduce((s, l) => s + l.qty, 0) };
}

/** Keeps a typed quantity sensible: whole, 0 to 9,999. */
export function clampQty(value: number | string): number {
  const n = typeof value === "string" ? parseInt(value, 10) : value;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(9999, Math.floor(n));
}

export interface DeliveryDraft {
  method: "DELIVERY" | "PICKUP";
  address: string;
  county: string;
  receiver: string;
  phone: string;
}

/** The first problem with the order's delivery details (the store checks again), or null. */
export function deliveryProblem(d: DeliveryDraft): string | null {
  if (!d.phone.trim() || d.phone.replace(/\D/g, "").length < 9) {
    return "Enter a phone number Moments can call about this order.";
  }
  if (d.method === "PICKUP") return null;
  if (!d.address.trim()) return "Enter where Moments should deliver.";
  if (d.receiver.trim().split(/\s+/).length < 2) {
    return "Enter the full name (first and last) of whoever receives the order.";
  }
  return null;
}

// ---- credit (doc 15 §19) ----

/** How much of the limit is used, 0-100, for the bar. */
export function creditUsedPct(owed: number, limit: number | null | undefined): number {
  if (!limit || limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((owed / limit) * 100)));
}

export function paymentMethodText(method: string): string {
  switch (method) {
    case "MPESA_PROMPT":
      return "M-Pesa (from the portal)";
    case "MPESA_RECEIPT":
      return "M-Pesa";
    case "BANK":
      return "Bank";
    case "CHEQUE":
      return "Cheque";
    case "CASH":
      return "Cash";
    default:
      return method;
  }
}

export function paymentStatusText(status: string): { label: string; tone: Tone } {
  switch (status) {
    case "CONFIRMED":
      return { label: "Received", tone: "good" };
    case "REJECTED":
      return { label: "Not accepted", tone: "bad" };
    case "FAILED":
      return { label: "Didn't go through", tone: "bad" };
    default:
      return { label: "Being confirmed", tone: "wait" };
  }
}

/** When a credit charge is due, in plain words. */
export function chargeDueText(c: {
  deliveredAt?: string | null;
  dueOn?: string | null;
  overdue: boolean;
}): {
  label: string;
  tone: Tone;
} {
  if (!c.deliveredAt) return { label: "Due once delivered", tone: "muted" };
  if (c.overdue) return { label: `Overdue since ${shortDate(c.dueOn)}`, tone: "bad" };
  return { label: `Due ${shortDate(c.dueOn)}`, tone: "wait" };
}

/** The amount the M-Pesa prompt will ask for: whole shillings, rounded up, as the store does. */
export function promptAmount(amount: number): number {
  return Math.ceil(Math.round(amount * 100) / 100);
}

/** The first problem with a "Pay by M-Pesa" entry, in the store's words, or null. */
export function payProblem(amount: number, owed: number, phone: string): string | null {
  if (owed <= 0) return "Your restaurant owes nothing right now.";
  if (!Number.isFinite(amount) || amount < 1 || amount > promptAmount(owed)) {
    return `Pay between KES 1 and what your restaurant owes, ${kes(promptAmount(owed))}.`;
  }
  if (phone.replace(/\D/g, "").length < 9)
    return "Enter the M-Pesa phone number to send the prompt to.";
  return null;
}

// ---- what the store says this person may do on a PO (doc 15 §23.10) ----

export interface ActionLike {
  key: string;
  allowed: boolean;
  text?: string | null;
}

/** The store's entry for one action, if it sent one. */
export function findAction<T extends ActionLike>(
  actions: T[] | null | undefined,
  key: string,
): T | undefined {
  return (actions ?? []).find((a) => a.key === key);
}

/**
 * May this person do it now? The store's answer when it sent one; otherwise the older fields
 * (`fallback`), so a store without `actions[]` still works. The store checks again either way.
 */
export function actionAllowed(
  actions: ActionLike[] | null | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const a = findAction(actions, key);
  return a ? a.allowed : fallback;
}

/** The store's words for a limit the restaurant meets: a refused action with text to show. */
export function actionLimitText(
  actions: ActionLike[] | null | undefined,
  key: string,
): string | null {
  const a = findAction(actions, key);
  return a && !a.allowed && a.text ? a.text : null;
}

// ---- paying a PO (doc 15 §23) ----

/** The VAT inside a VAT-inclusive amount at 16%, rounded to the cent. */
export function vatShare(gross: number): number {
  return Math.round(((gross * 16) / 116) * 100) / 100;
}

export interface PoMoneyLike {
  total: number;
  paidAmount: number;
  amountDue: number;
}

/** Paid / Not paid / On credit, for every PO at every stage. */
export function poPaymentBadge(
  paymentMethod: string | null | undefined,
  money: PoMoneyLike | null | undefined,
  stage: string,
): { label: string; tone: Tone } {
  if (stage === "CANCELLED") return { label: "Cancelled", tone: "muted" };
  if (paymentMethod === "CREDIT") return { label: "On credit", tone: "info" };
  if (!money) return { label: "Not paid", tone: "muted" };
  if (money.amountDue <= 0 && money.paidAmount >= money.total)
    return { label: "Paid", tone: "good" };
  if (stage === "CONFIRMING_PAYMENT")
    return { label: "Bank transfer being confirmed", tone: "wait" };
  if (money.paidAmount > 0)
    return { label: `Partly paid · ${kes(money.amountDue)} to pay`, tone: "wait" };
  return { label: "Not paid", tone: stage === "AWAITING_PAYMENT" ? "wait" : "muted" };
}

/** A line of "Moments owes you" history, in plain words. */
export function balanceMovementText(kind: string): string {
  switch (kind) {
    case "KEPT_FROM_CANCEL":
      return "Kept from a cancelled order";
    case "KEPT_FROM_CHANGE":
      return "Kept when Moments lowered an order";
    case "APPLIED_TO_PO":
      return "Used towards an order";
    case "RETURNED_UNUSED":
      return "Returned from an order not used";
    case "REFUNDED":
      return "Refunded to you";
    case "SET_AGAINST_CREDIT":
      return "Set against what you owe on credit";
    default:
      return kind;
  }
}
