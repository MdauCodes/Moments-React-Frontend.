// ----------------------------------------------------------------------------
// Restaurant portal API (store backend `feat/restaurant-accounts`, handover doc 15 §18).
// A restaurant's people are ordinary store customers (ROLE_CUSTOMER) signed in with the usual
// cookie session; the store decides on every call what they may see and do. Shapes mirror the
// backend's RestaurantDtos / CatalogueDtos records.
// ----------------------------------------------------------------------------
import { apiUrl, getSessionId } from "@/config/api";
import { PRIVACY_POLICY_VERSION } from "@/lib/policyVersion";
import { authFetch } from "@/contexts/AuthContext";
import type {
  ApprovalRule,
  HeadRequestKind,
  PortalInvite,
  PortalMember,
  RestaurantRole,
} from "@/lib/restaurantPortal";

export interface MyRestaurant {
  id: string;
  businessName: string;
  myRole: RestaurantRole;
  deliveryFeeOnCredit: boolean;
  signByEmail: boolean;
  signByMpesa: boolean;
  brandColor?: string | null;
  brandLogoUrl?: string | null;
  restaurantCode?: string | null;
  members: PortalMember[];
  invites: PortalInvite[];
  approvalRule: ApprovalRule;
  headsLocked: boolean;
  creditEnabled: boolean;
  creditLimit?: number | null;
  paymentTermsDays?: number | null;
}

export type Invite = PortalInvite;

export interface AcceptInviteInput {
  email: string;
  code: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  password?: string;
}

export interface AcceptInviteResult {
  restaurantName: string;
  role: RestaurantRole;
  newAccount: boolean;
}

export interface HeadInput {
  email: string;
  fullName: string;
  rank: string;
  phone?: string;
}

export interface StaffInput {
  email: string;
  fullName: string;
  rank?: string;
  phone?: string;
}

export interface HeadRequestInput {
  kind: HeadRequestKind;
  memberId?: string;
  fullName?: string;
  rank?: string;
  email?: string;
  phone?: string;
  approvalRule?: ApprovalRule;
  reason: string;
}

export interface HeadRequestRow {
  id: string;
  kind: HeadRequestKind;
  memberId?: string | null;
  memberName?: string | null;
  fullName?: string | null;
  rank?: string | null;
  email?: string | null;
  phone?: string | null;
  approvalRule?: string | null;
  currentRule?: string | null;
  reason?: string | null;
  status: string;
  requestedBy?: string | null;
  createdAt: string;
  decidedAt?: string | null;
  decisionNote?: string | null;
}

export interface CatalogueLine {
  productId: string;
  productName: string;
  slug?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  unit?: string | null;
  price: number;
  priceSince?: string | null;
}

export interface ChangeLine {
  productId: string;
  productName: string;
  oldPrice?: number | null;
  newPrice?: number | null;
  removed: boolean;
}

export interface UpcomingVersion {
  label: string;
  effectiveFrom: string;
  changes: ChangeLine[];
}

export interface MyCatalogue {
  restaurantId: string;
  restaurantName: string;
  restaurantCode?: string | null;
  version?: string | null;
  effectiveFrom?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  lines: CatalogueLine[];
  upcoming: UpcomingVersion[];
}

export interface MyPriceRequest {
  id: string;
  status: string;
  createdAt: string;
  requestedBy?: string | null;
  note?: string | null;
  items: { productId: string; productName: string; quantityNote?: string | null }[];
  declineReason?: string | null;
  publishedVersion?: string | null;
  /** "KG-2026-3" once the request is priced (null before): the quote form exists only then. */
  quoteNumber?: string | null;
}

export interface PriceRequestInput {
  items: { productId: string; quantityNote?: string }[];
  note?: string;
}

// ---- purchase orders (handover doc 15 §21: the step 4 contract; not on the store yet) ----

export type PoStage =
  | "AWAITING_SIGNED_COPY"
  | "AWAITING_PAYMENT"
  | "CONFIRMING_PAYMENT"
  | "AWAITING_TOP_UP"
  | "CHECKING_SIGNED_COPY"
  | "SENT_BACK"
  | "HELD"
  | "WITH_MOMENTS"
  | "BEING_PREPARED"
  | "AWAITING_FINAL_SIGNATURE"
  | "READY_FOR_PICKUP"
  | "ON_ITS_WAY"
  | "DELIVERED"
  | "CANCELLED";

export interface PoPerson {
  name: string;
  rank?: string | null;
  email?: string | null;
}

export interface PoRow {
  orderId: string;
  poNumber: string;
  stage: PoStage;
  placedBy: PoPerson;
  placedAt: string;
  total: number;
  paymentMethod?: string | null;
  itemCount: number;
  /** This person has something to do: sign and upload, pay, or top up (§23.7). */
  needsMe: boolean;
  /** Something to pay now (amountDue > 0). */
  awaitingPayment?: boolean;
  amountDue?: number | null;
}

export interface SignedCopyFile {
  index: number;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface SignedCopy {
  id: string;
  side: "RESTAURANT" | "MOMENTS";
  /** Which version of the PO this copy signs. */
  revision?: number;
  uploadedBy: PoPerson;
  uploadedAt: string;
  note?: string | null;
  files: SignedCopyFile[];
  status: "UPLOADED" | "SENT_BACK" | "ACCEPTED";
  decidedBy?: string | null;
  decidedAt?: string | null;
  reason?: string | null;
}

export interface PoLine {
  productId?: string | null;
  code?: string | null;
  name: string;
  pack?: string | null;
  qty: number;
  unitPrice: number;
  amount: number;
}

/** Moments' bank account for restaurants' transfers (doc 15 §23.11), managed in Moments' settings. */
export interface BankDetails {
  bank?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  branch?: string | null;
  /** e.g. "Use your PO number as the reference". */
  paymentInstructions?: string | null;
}

/** Money on a PO (§23.7): the balance Moments holds is used first; amountDue is what is left to pay now. */
export interface PoMoney {
  total: number;
  balanceApplied: number;
  paidAmount: number;
  amountDue: number;
  /** The part of amountDue owed after Moments raised the total. */
  topUpDue: number;
  /** The restaurant's number: the default for the M-Pesa prompt; any other may be used. */
  defaultPayerPhone?: string | null;
  bankTransferReference?: string | null;
  bankTransferSentAt?: string | null;
  /** Moments' own account, set by a Super Admin (§23.11); null until it is set. */
  bankDetails?: BankDetails | null;
}

export interface PoTopUp {
  id: string;
  method: "MPESA" | "BANK";
  amount: number;
  status: "PENDING" | "CONFIRMED" | "FAILED" | "REJECTED";
  reference?: string | null;
  at: string;
}

export interface PoRevision {
  revision: number;
  at: string;
  changedBy?: string | null;
  note?: string | null;
  oldTotal: number;
  newTotal: number;
}

export interface PoDetail {
  orderId: string;
  /** The display number: PO-KG-2026-0042, or PO-KG-2026-0042-R2 after Moments changed it. */
  poNumber: string;
  /** 1, then 2 and up after each change Moments makes (the heads sign the new version). */
  revision?: number;
  stage: PoStage;
  catalogueVersion?: string | null;
  placedBy: PoPerson;
  placedAt: string;
  lines: PoLine[];
  itemsTotal: number;
  deliveryFee?: number | null;
  total: number;
  /** The store says whether VAT is included (it always is for restaurant prices); older drafts sent the amount. */
  vatIncluded?: boolean | number | null;
  paymentMethod?: string | null;
  creditDueDays?: number | null;
  delivery?: {
    method?: string | null;
    address?: string | null;
    receiver?: string | null;
    phone?: string | null;
  } | null;
  approvalRule?: string | null;
  signingMethod: "MANUAL" | "EMAIL_CODE" | "MPESA";
  heads: { name: string; rank?: string | null; mustSign: boolean }[];
  signedCopies: SignedCopy[];
  approvals?: unknown[];
  momentsSignedCopy?: SignedCopy | null;
  sentBackReason?: string | null;
  history: { at: string; text: string }[];
  /** This person may upload the signed copy now (as `needsMe` on the row). */
  canUpload?: boolean;
  /** The shop order's reference (MP-...), as on payment receipts. */
  orderReference?: string | null;
  paymentStatus?: string | null;
  /** Something to pay now: the order after approval, or a top-up. */
  awaitingPayment?: boolean;
  money?: PoMoney | null;
  /** This person may pay now (AWAITING_PAYMENT). */
  canPay?: boolean;
  /** The restaurant may still cancel it: only before it reaches Moments. */
  canCancel?: boolean;
  topUps?: PoTopUp[];
  revisions?: PoRevision[];
  /** Moments is reviewing a change to this PO (§23.9-§23.10): show it; nothing else to do meanwhile. */
  changeUnderReview?: boolean;
  /** What this person may do now and, when not, the store's own words for why (§23.10). */
  actions?: PoAction[];
}

/**
 * One action on a PO as the store sees it for this person (§23.8-§23.10). Restaurant keys:
 * UPLOAD_SIGNED_COPY, PAY, CANCEL, and CHANGE_UNDER_REVIEW while a change waits. `text` is shown as
 * given wherever the restaurant meets a limit.
 */
export interface PoAction {
  key: string;
  allowed: boolean;
  needsApproval: boolean;
  approvers: string[];
  text?: string | null;
}

export interface BalanceMovement {
  id: string;
  at: string;
  kind:
    | "KEPT_FROM_CANCEL"
    | "KEPT_FROM_CHANGE"
    | "APPLIED_TO_PO"
    | "RETURNED_UNUSED"
    | "REFUNDED"
    | "SET_AGAINST_CREDIT";
  amount: number;
  balanceChange: number;
  orderId?: string | null;
  orderReference?: string | null;
  reference?: string | null;
  note?: string | null;
  by?: string | null;
}

/** Money Moments holds for the restaurant ("Moments owes you", §23.4 B). */
export interface BalanceView {
  restaurantId: string;
  restaurantName: string;
  balance: number;
  movements: BalanceMovement[];
}

/** The shop's payment status for an order (GET /api/v1/payments/status/{orderId}). */
export interface OrderPaymentStatus {
  status?: string; // PROCESSING | SUCCESS | FAILED | NO_PAYMENT
  message?: string | null;
  amount?: number | null;
  receiptNumber?: string | null;
  failureReason?: string | null;
}

/** Placing a PO from the catalogue (doc 15 §21): the shop's checkout, as a CATALOGUE order. */
export interface PlacePoInput {
  contactName: string;
  email: string;
  phone: string;
  paymentMethod: "CREDIT" | "MPESA" | "BANK_TRANSFER";
  delivery:
    | { method: "PICKUP" }
    | { method: "DELIVERY"; address: string; county: string; receiver: string };
  notes?: string;
  items: { productId: string; quantity: number }[];
  /** One per attempt, so a double tap or a retry can't place the order twice. */
  idempotencyKey: string;
}

export interface PlacedPo {
  id: string;
  reference?: string | null;
  poNumber?: string | null;
  stage?: PoStage | null;
}

// ---- credit (doc 15 §19.4, §19.7: built on the store branch, 567ee71) ----

export interface ChargeRow {
  id: string;
  orderId: string;
  orderReference: string;
  chargedAt: string;
  amount: number;
  paid: number;
  open: number;
  status: "OPEN" | "VOID";
  /** null = not delivered yet, so not due yet. */
  deliveredAt?: string | null;
  dueOn?: string | null;
  overdue: boolean;
}

export interface PaymentRow {
  id: string;
  method: "MPESA_PROMPT" | "MPESA_RECEIPT" | "BANK" | "CHEQUE" | "CASH";
  amount: number;
  reference?: string | null;
  paidOn?: string | null;
  status: "PENDING" | "CONFIRMED" | "REJECTED" | "FAILED";
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  rejectReason?: string | null;
  createdAt: string;
}

export interface CreditSummary {
  restaurantId: string;
  restaurantName: string;
  creditEnabled: boolean;
  creditLimit?: number | null;
  paymentTermsDays?: number | null;
  deliveryFeeOnCredit: boolean;
  owed: number;
  available: number;
  overdue: number;
  nextDueOn?: string | null;
  nextDueAmount?: number | null;
  unallocated: number;
  openCharges: ChargeRow[];
  recentPayments: PaymentRow[];
}

export interface PromptStatus {
  id: string;
  status: PaymentRow["status"];
  amount: number;
  message?: string | null;
}

/** An error from the store, with its HTTP status and the store's own message. */
export class RestaurantApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RestaurantApiError";
  }
}

const NETWORK_MESSAGE = "We couldn't reach Moments. Check your internet connection and try again.";

/**
 * An error the restaurant can act on. The store's own message when it sends one (it says what
 * happened and what to do); otherwise what we were doing and the next step, never a bare code.
 */
async function readError(res: Response, fallback: string): Promise<RestaurantApiError> {
  const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  if (body.message) return new RestaurantApiError(body.message, res.status);
  let message: string;
  if (res.status === 429) {
    message = "Too many tries in a short time. Wait a minute, then try again.";
  } else if (res.status === 403) {
    message = `${fallback} Your role in the restaurant doesn't allow this; ask your restaurant's contact person.`;
  } else if (res.status === 401) {
    message = `${fallback} You've been signed out; sign in again and retry.`;
  } else {
    message = `${fallback} Please try again in a moment; if it keeps happening, tell your contact at Moments.`;
  }
  return new RestaurantApiError(message, res.status);
}

/** fetch through the session, turning a dropped connection into words instead of "Failed to fetch". */
async function send(input: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await authFetch(input, init);
  } catch {
    throw new RestaurantApiError(NETWORK_MESSAGE, 0);
  }
}

async function call<T>(
  path: string,
  init: RequestInit = {},
  fallback = "Something went wrong.",
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await send(apiUrl(path), { ...init, headers });
  if (!res.ok) throw await readError(res, fallback);
  return (await res.json()) as T;
}

/** The file name the store sends, or a fallback, from a Content-Disposition header. */
function fileNameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain ? plain[1] : fallback;
}

/** Fetches a PDF the store makes and saves it on the phone or computer. */
async function savePdfFrom(path: string, fallbackName: string, what: string): Promise<void> {
  const res = await send(apiUrl(path));
  if (!res.ok) throw await readError(res, `Couldn't download ${what}.`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFrom(res, fallbackName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const post = <T>(path: string, body: unknown, fallback?: string) =>
  call<T>(path, { method: "POST", body: JSON.stringify(body) }, fallback);

export const restaurantApi = {
  /** Public: joining with the emailed code (5 wrong tries lock the invite). */
  async acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
    let res: Response;
    try {
      res = await fetch(apiUrl("/api/v1/public/restaurant-invites/accept"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      throw new RestaurantApiError(NETWORK_MESSAGE, 0);
    }
    if (!res.ok) throw await readError(res, "We couldn't check that code.");
    return (await res.json()) as AcceptInviteResult;
  },

  /** The signed-in member's restaurant; a 404 means they are not part of one. */
  async mine(): Promise<MyRestaurant | null> {
    const res = await send(apiUrl("/api/v1/restaurant/me"));
    if (res.status === 404) return null;
    if (!res.ok) throw await readError(res, "We couldn't open your restaurant.");
    return (await res.json()) as MyRestaurant;
  },

  addHead: (head: HeadInput) =>
    post<Invite>("/api/v1/restaurant/me/heads", head, "Couldn't add that head."),

  inviteStaff: (person: StaffInput) =>
    post<Invite>(
      "/api/v1/restaurant/me/invites",
      { ...person, role: "BUYER" },
      "Couldn't invite that person.",
    ),

  finishSetup: () =>
    post<MyRestaurant>("/api/v1/restaurant/me/setup/finish", {}, "Couldn't finish the setup."),

  headRequests: () =>
    call<HeadRequestRow[]>(
      "/api/v1/restaurant/me/head-requests",
      {},
      "We couldn't load your requests.",
    ),

  requestHeadChange: (input: HeadRequestInput) =>
    post<HeadRequestRow>(
      "/api/v1/restaurant/me/head-requests",
      input,
      "Couldn't send the request.",
    ),

  catalogue: () =>
    call<MyCatalogue>("/api/v1/restaurant/me/catalogue", {}, "We couldn't load your catalogue."),

  priceRequests: () =>
    call<MyPriceRequest[]>(
      "/api/v1/restaurant/me/price-requests",
      {},
      "We couldn't load your requests.",
    ),

  requestPrices: (input: PriceRequestInput) =>
    post<MyPriceRequest>(
      "/api/v1/restaurant/me/price-requests",
      input,
      "Couldn't send the pricing request.",
    ),
  /** The quote form the store renders (also attached to the publish email), so there is one version. */
  downloadQuote: (requestId: string, quoteNumber?: string | null) =>
    savePdfFrom(
      `/api/v1/restaurant/me/price-requests/${requestId}/quote.pdf`,
      quoteNumber ? `Quote-${quoteNumber}.pdf` : "Quote.pdf",
      "the quote",
    ),

  purchaseOrders: (stage?: PoStage) =>
    call<PoRow[]>(
      `/api/v1/restaurant/me/purchase-orders${stage ? `?stage=${stage}` : ""}`,
      {},
      "We couldn't load your orders.",
    ),

  purchaseOrder: (orderId: string) =>
    call<PoDetail>(
      `/api/v1/restaurant/me/purchase-orders/${orderId}`,
      {},
      "We couldn't open this order.",
    ),

  downloadPo: (orderId: string, poNumber: string) =>
    savePdfFrom(
      `/api/v1/restaurant/me/purchase-orders/${orderId}/pdf`,
      `${poNumber}.pdf`,
      "the purchase order",
    ),

  signedCopies: (orderId: string) =>
    call<SignedCopy[]>(
      `/api/v1/restaurant/me/purchase-orders/${orderId}/signed-copies`,
      {},
      "Couldn't load the signed copies.",
    ),

  /** Multipart: `files` (1-10; PDF, JPG, PNG; up to 10 MB each) and an optional note. */
  async uploadSignedCopy(orderId: string, files: File[], note?: string): Promise<SignedCopy> {
    const form = new FormData();
    files.forEach((f) => form.append("files", f, f.name));
    if (note) form.append("note", note);
    const res = await send(
      apiUrl(`/api/v1/restaurant/me/purchase-orders/${orderId}/signed-copies`),
      { method: "POST", body: form },
    );
    if (!res.ok) throw await readError(res, "Couldn't upload the signed copy.");
    return (await res.json()) as SignedCopy;
  },

  /** Opens one page of a signed copy (the store redirects to a short-lived private link). */
  signedCopyFileUrl: (orderId: string, copyId: string, index: number) =>
    apiUrl(
      `/api/v1/restaurant/me/purchase-orders/${orderId}/signed-copies/${copyId}/files/${index}`,
    ),
  /**
   * Places the PO. Prices always come from the restaurant's catalogue on the store; nothing is
   * charged at placing (the signed copy comes first). Delivery is arranged by Moments.
   */
  async placePo(input: PlacePoInput): Promise<PlacedPo> {
    const body: Record<string, unknown> = {
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      paymentMethod: input.paymentMethod,
      restaurantOrder: "CATALOGUE",
      items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      notes: input.notes || undefined,
      idempotencyKey: input.idempotencyKey,
      consentPolicyVersion: PRIVACY_POLICY_VERSION,
      sessionId: getSessionId(),
    };
    if (input.delivery.method === "PICKUP") {
      body.fulfillmentType = "PICKUP";
    } else {
      body.fulfillmentType = "MANUAL_DELIVERY";
      body.courierType = "RIDER";
      body.deliveryAddress = input.delivery.address;
      body.county = input.delivery.county;
      body.collectorName = input.delivery.receiver;
    }
    const res = await send(apiUrl("/api/v1/checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": getSessionId() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await readError(res, "The order wasn't placed.");
    return (await res.json()) as PlacedPo;
  },
  /** The restaurant's credit: a 404 or 405 means the store doesn't have credit yet. */
  credit: () =>
    call<CreditSummary>(
      "/api/v1/restaurant/me/credit",
      {},
      "We couldn't load your credit account.",
    ),

  /** Sends an M-Pesa prompt to `phone` for `amount` (everything owed when left out). */
  payCredit: (input: { amount?: number; phone: string }) =>
    post<PromptStatus>(
      "/api/v1/restaurant/me/credit/pay",
      input,
      "Couldn't send the M-Pesa prompt.",
    ),

  creditPayment: (id: string) =>
    call<PromptStatus>(
      `/api/v1/restaurant/me/credit/payments/${id}`,
      {},
      "We couldn't check the payment yet.",
    ),
  /**
   * Pay a pay-now PO by M-Pesa once Moments has accepted its signed copy (§21.1): the shop's own
   * payment calls, without the shop's order-history and ad-tracking side effects.
   */
  async payPoByMpesa(orderId: string, phone: string): Promise<void> {
    const res = await send(apiUrl("/api/v1/payments/initiate"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": getSessionId() },
      body: JSON.stringify({ orderId, paymentMethod: "MPESA", phone }),
    });
    if (!res.ok) throw await readError(res, "Couldn't send the M-Pesa prompt.");
  },

  poPaymentStatus: (orderId: string) =>
    call<OrderPaymentStatus>(
      `/api/v1/payments/status/${encodeURIComponent(orderId)}`,
      { headers: { "X-Session-Id": getSessionId() } },
      "We couldn't check the payment yet.",
    ),
  /** Paying by bank instead of M-Pesa: the restaurant says the transfer is sent (§23.7). */
  bankTransferSent: (orderId: string, reference?: string) =>
    post<PoDetail>(
      `/api/v1/restaurant/me/purchase-orders/${orderId}/bank-transfer-sent`,
      { reference: reference || undefined },
      "We couldn't record that the transfer was sent.",
    ),

  /** Pays what is left after Moments raised the PO's total. */
  topUp: (
    orderId: string,
    input: { method: "MPESA" | "BANK"; phone?: string; reference?: string },
  ) =>
    post<PoTopUp>(
      `/api/v1/restaurant/me/purchase-orders/${orderId}/top-up`,
      input,
      "Couldn't start the top-up.",
    ),

  /** Only before the PO reaches Moments; after that the store answers 409 "Ask Moments to cancel it." */
  cancelPo: (orderId: string, reason?: string) =>
    post<PoDetail>(
      `/api/v1/restaurant/me/purchase-orders/${orderId}/cancel`,
      { reason: reason || undefined },
      "The order wasn't cancelled.",
    ),

  balance: () =>
    call<BalanceView>(
      "/api/v1/restaurant/me/balance",
      {},
      "We couldn't load your balance with Moments.",
    ),
};
