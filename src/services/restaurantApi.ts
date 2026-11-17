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
  needsMe: boolean;
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
  code?: string | null;
  name: string;
  pack?: string | null;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface PoDetail {
  orderId: string;
  poNumber: string;
  stage: PoStage;
  catalogueVersion?: string | null;
  placedBy: PoPerson;
  placedAt: string;
  lines: PoLine[];
  itemsTotal: number;
  deliveryFee?: number | null;
  total: number;
  vatIncluded?: number | null;
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

async function readError(res: Response, fallback: string): Promise<RestaurantApiError> {
  const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  let message = body.message || body.error || fallback;
  if (res.status === 429 && !body.message) message = "Too many tries. Wait a little and try again.";
  if (res.status === 403 && !body.message) message = "That isn't open to your role.";
  return new RestaurantApiError(message, res.status);
}

async function call<T>(
  path: string,
  init: RequestInit = {},
  fallback = "Something went wrong.",
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await authFetch(apiUrl(path), { ...init, headers });
  if (!res.ok) throw await readError(res, `${fallback} (${res.status})`);
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
  const res = await authFetch(apiUrl(path));
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
    const res = await fetch(apiUrl("/api/v1/public/restaurant-invites/accept"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await readError(res, "That code didn't work.");
    return (await res.json()) as AcceptInviteResult;
  },

  /** The signed-in member's restaurant; a 404 means they are not part of one. */
  async mine(): Promise<MyRestaurant | null> {
    const res = await authFetch(apiUrl("/api/v1/restaurant/me"));
    if (res.status === 404) return null;
    if (!res.ok) throw await readError(res, "Couldn't load your restaurant.");
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
    call<HeadRequestRow[]>("/api/v1/restaurant/me/head-requests", {}, "Couldn't load requests."),

  requestHeadChange: (input: HeadRequestInput) =>
    post<HeadRequestRow>(
      "/api/v1/restaurant/me/head-requests",
      input,
      "Couldn't send the request.",
    ),

  catalogue: () =>
    call<MyCatalogue>("/api/v1/restaurant/me/catalogue", {}, "Couldn't load your catalogue."),

  priceRequests: () =>
    call<MyPriceRequest[]>("/api/v1/restaurant/me/price-requests", {}, "Couldn't load requests."),

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
      "Couldn't load your orders.",
    ),

  purchaseOrder: (orderId: string) =>
    call<PoDetail>(
      `/api/v1/restaurant/me/purchase-orders/${orderId}`,
      {},
      "Couldn't load this order.",
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
    const res = await authFetch(
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
    const res = await authFetch(apiUrl("/api/v1/checkout"), {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Session-Id": getSessionId() },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await readError(res, "Couldn't place the order.");
    return (await res.json()) as PlacedPo;
  },
  /** The restaurant's credit: a 404 or 405 means the store doesn't have credit yet. */
  credit: () =>
    call<CreditSummary>("/api/v1/restaurant/me/credit", {}, "Couldn't load your credit."),

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
      "Couldn't check the payment.",
    ),
};
