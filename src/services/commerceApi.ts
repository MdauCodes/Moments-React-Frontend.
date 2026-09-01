// ----------------------------------------------------------------------------
// Admin commerce API client — all calls hit the live backend via adminFetch,
// which attaches the Authorization: Bearer <token> header from AdminAuthContext.
// No mock fallback.
// ----------------------------------------------------------------------------

import { adminFetch, ApiError } from "@/services/adminApi";
import type {
  CustomerRecord,
  DashboardStats,
  OrderRecord,
  OrderStatus,
  PaymentGateway,
  PaymentRecord,
} from "@/services/commerceMock";

type Source = "live";

function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function getJson<T>(path: string): Promise<T> {
  const res = await adminFetch(path);
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  return (await res.json()) as T;
}

function unwrapPage<T>(data: { content?: T[]; totalElements?: number; totalPages?: number } | T[]): {
  rows: T[];
  total: number;
  totalPages: number;
} {
  if (Array.isArray(data)) return { rows: data, total: data.length, totalPages: 1 };
  const rows = data.content ?? [];
  return { rows, total: data.totalElements ?? rows.length, totalPages: data.totalPages ?? 1 };
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// Map backend PaymentMethod → frontend PaymentGateway type.
// Backend: PAYHERO | MPESA | BANK_TRANSFER | CASH_ON_DELIVERY
// Frontend type now matches backend exactly.
function normalizeGateway(raw: string | undefined): PaymentGateway {
  if (!raw) return "MPESA";
  const upper = raw.toUpperCase();
  if (upper === "PAYHERO") return "PAYHERO";
  if (upper === "MPESA" || upper === "M_PESA") return "MPESA";
  if (upper === "BANK_TRANSFER" || upper === "BANK") return "BANK_TRANSFER";
  if (upper === "CASH_ON_DELIVERY" || upper === "COD") return "CASH_ON_DELIVERY";
  return "MPESA";
}

// Normalise backend OrderDto → frontend OrderRecord.
// Backend serialises BigDecimal as number-or-string; coerce every monetary
// field to a real number here so downstream UI never gets NaN.
function normalizeOrder(raw: any): OrderRecord {
  const items = (raw?.items ?? []).map((it: any) => ({
    productId: it.productId ?? it.id ?? "",
    name: it.productName ?? it.name ?? "",
    qty: num(it.quantity ?? it.qty),
    unitPrice: num(it.unitPrice),
    imageUrl: it.primaryImageUrl ?? it.imageUrl,
    category: it.category,
    size: it.size,
    material: it.material,
    finish: it.finish,
    lineTotal: num(it.lineTotal ?? num(it.unitPrice) * num(it.quantity ?? it.qty)),
  }));

  const subtotal = num(raw?.subtotal);
  const shippingFee = num(raw?.deliveryFee ?? raw?.shippingFee);
  const total = num(raw?.totalAmount ?? raw?.total);

  return {
    id: raw?.id ?? raw?.reference ?? "",
    reference: raw?.reference ?? raw?.id ?? "",

    // Backend field: status (OrderStatus enum) — pass through directly.
    // If the value arrives in an unexpected shape, default to PENDING_PAYMENT.
    status: (raw?.status as OrderStatus) ?? "PENDING_PAYMENT",
    statusV2: raw?.statusV2 ?? null,

    // Backend field: paymentStatus (PaymentStatus enum).
    // Backend values: PENDING | PAID | FAILED | REFUNDED
    paymentStatus: raw?.paymentStatus ?? "PENDING",

    // Backend field: paymentMethod (PaymentMethod enum).
    // Normalised → PaymentGateway type used by the UI.
    paymentGateway: normalizeGateway(raw?.paymentMethod ?? raw?.paymentGateway),

    customerName: raw?.contactName ?? raw?.customerName ?? "",
    customerEmail: raw?.email ?? raw?.customerEmail ?? raw?.maskedEmail ?? "",
    customerPhone: raw?.phone ?? raw?.customerPhone ?? "",
    shippingAddress: raw?.deliveryAddress ?? raw?.shippingAddress ?? "",
    city: raw?.city ?? "",
    county: raw?.county,
    postalCode: raw?.postalCode,

    items,
    subtotal: subtotal || items.reduce((s: number, it: any) => s + (it.lineTotal ?? 0), 0),
    shippingFee,
    discount: num(raw?.discount),
    total: total || subtotal + shippingFee,
    currency: "KES",

    createdAt: raw?.createdAt ?? new Date().toISOString(),
    updatedAt: raw?.updatedAt ?? raw?.createdAt ?? new Date().toISOString(),

    tumabodaTrackingCode: raw?.tumabodaTrackingCode,
    notes: raw?.notes,
    staffNotes: raw?.staffNotes ?? "",
    assignedTo: raw?.assignedTo,
    assignedToId: raw?.assignedToId,
    contentsVerified: raw?.contentsVerified ?? false,
    deliveryConfirmationStatus: raw?.deliveryConfirmationStatus,
    vatAmount: num(raw?.vatAmount),
    taxableAmount: num(raw?.taxableAmount),
    vatRate: raw?.vatRate != null ? Number(raw.vatRate) : undefined,
    etrRequested: raw?.etrRequested ?? false,
    documentBundleStatus: raw?.documentBundleStatus ?? null,
    documentsEmail: raw?.documentsEmail,
    promoCode: raw?.promoCode,
    paymentMethod: raw?.paymentMethod,
    fulfillmentType: raw?.fulfillmentType,
    isTestOrder: raw?.isTestOrder ?? false,
    courierType: raw?.courierType,
    courierServiceName: raw?.courierServiceName,
    courierStageOrOffice: raw?.courierStageOrOffice,
    collectorName: raw?.collectorName,
    deliveryFeeAmount: raw?.deliveryFeeAmount != null ? num(raw.deliveryFeeAmount) : undefined,
    deliveryFeeStatus: raw?.deliveryFeeStatus,
    deliveryFeeMethod: raw?.deliveryFeeMethod,
    tumabodaStatus: raw?.tumabodaStatus,
    tumabodaDeliveryId: raw?.tumabodaDeliveryId,
    tumabodaDeliveryNumber: raw?.tumabodaDeliveryNumber,
    tumabodaCost: raw?.tumabodaCost != null ? num(raw.tumabodaCost) : undefined,
    tumabodaRiderVerifiedAt: raw?.tumabodaRiderVerifiedAt,
    tumabodaBookingFailureReason: raw?.tumabodaBookingFailureReason ?? null,
    tumabodaContactPhone: raw?.tumabodaContactPhone ?? null,
    customerConfirmedDeliveredAt: raw?.customerConfirmedDeliveredAt,
    deliveryVerificationCode: raw?.deliveryVerificationCode ?? null,
    refundRequestedAt: raw?.refundRequestedAt,
    refundRequestReason: raw?.refundRequestReason,
    refundRequestedBy: raw?.refundRequestedBy,
    refundResolvedAt: raw?.refundResolvedAt,
    statusHistory: (raw?.statusHistory ?? []).map((h: any) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      note: h.note,
      changedBy: h.changedBy,
      changedAt: h.changedAt,
    })),
  } as OrderRecord;
}

// ---------- Orders ----------

export interface ListOrdersParams {
  status?: string;
  fulfillmentType?: string;
  q?: string;
  page?: number;
  size?: number;
}

export interface ListOrdersResult {
  rows: OrderRecord[];
  total: number;
  totalPages: number;
  source: Source;
}

export async function listOrders(params: ListOrdersParams = {}): Promise<ListOrdersResult> {
  // Backend filter param is "status" with OrderStatus enum value — pass through directly.
  const data = await getJson<{ content?: any[]; totalElements?: number; totalPages?: number } | any[]>(
    `/api/v1/admin/orders${qs(params as Record<string, unknown>)}`,
  );
  const { rows, total, totalPages } = unwrapPage<any>(data);
  return { rows: rows.map(normalizeOrder), total, totalPages, source: "live" };
}

export async function getOrder(id: string): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const raw = await getJson<any>(`/api/v1/admin/orders/${encodeURIComponent(id)}`);
  return { order: normalizeOrder(raw), source: "live" };
}

// POST /api/v1/admin/orders — staff placing a phone-in order on a customer's behalf. Routes
// through the same CheckoutService the public checkout page uses (pricing, stock, fulfillment
// validation all identical), so this mirrors CheckoutRequest almost field-for-field. The created
// order lands in PENDING_PAYMENT exactly like a normal order — payment is collected afterward
// from the order detail page (STK push, or record a manual Till/Cash/bank payment), same as any
// other order.
export interface CreateOrderItem {
  productId: string;
  quantity: number;
  size?: string;
  material?: string;
  finish?: string;
}

export interface CreateOrderParams {
  customerId?: string; // attach to an existing customer's account instead of a guest order
  contactName: string;
  email: string;
  phone: string;
  deliveryAddress?: string;
  city?: string;
  county?: string;
  notes?: string;
  paymentMethod: PaymentGateway;
  fulfillmentType: "PICKUP" | "MANUAL_DELIVERY";
  courierType?: string;
  courierServiceName?: string;
  courierStageOrOffice?: string;
  collectorName?: string;
  items: CreateOrderItem[];
}

export async function createOrder(params: CreateOrderParams): Promise<{ order: OrderRecord; source: Source }> {
  const res = await adminFetch("/api/v1/admin/orders", {
    method: "POST",
    body: JSON.stringify(params),
  });
  if (!res.ok) throw await res.json().then((data) => new ApiError({ status: res.status, ...data })).catch(() => new ApiError({ status: res.status, message: res.statusText }));
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// Backend PATCH /api/v1/admin/orders/{id}/status
// Body: { status: OrderStatus, staffNotes?: string, receiptReference?: string }
export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  staffNotes?: string,
  receiptReference?: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, staffNotes, receiptReference }),
  });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// Backend PATCH /api/v1/admin/orders/{id}/assign
// Body: { assignedTo: string }  ← backend field name is assignedTo, not assigneeId
export async function assignOrder(
  id: string,
  assignedTo: string,
  assignedToId?: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ assignedTo, assignedToId }),
  });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// PATCH /api/v1/admin/orders/{id}/dispatch-confirm
export type DeliveryConfirmation =
  | "CUSTOMER_PAYS_COURIER"
  | "CUSTOMER_PAYS_BUSINESS"
  | "REVERTED_TO_PICKUP"
  | "CONFIRM_LATER";

export async function dispatchConfirmOrder(
  id: string,
  deliveryConfirmationStatus: DeliveryConfirmation,
  contentsVerified = true,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/dispatch-confirm`, {
    method: "PATCH",
    body: JSON.stringify({ deliveryConfirmationStatus, contentsVerified }),
  });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// GET /api/v1/admin/users/assignable — only enabled staff, no customers.
export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  /** Backend role name e.g. "DISPATCHER", "SUPERVISOR". */
  staffRoleName?: string;
  /** Human label e.g. "Dispatcher". */
  staffRoleDisplay?: string;
}
export async function listAssignableUsers(): Promise<AssignableUser[]> {
  try {
    const raw = await getJson<any>("/api/v1/admin/users/assignable");
    const rows: any[] = Array.isArray(raw) ? raw : (raw?.content ?? []);
    return rows.map((u) => {
      const name =
        u.name ??
        ([u.firstName, u.lastName].filter(Boolean).join(" ") ||
          u.email ||
          "Unnamed");
      return {
        id: String(u.id ?? ""),
        name,
        email: u.email ?? "",
        staffRoleName: u.staffRoleName ?? u.staffRole,
        staffRoleDisplay: u.staffRoleDisplay,
      };
    });
  } catch {
    return [];
  }
}

// Refunds are deliberately NOT one automated action — logging a request never touches
// payment/inventory by itself; those are separate, explicit admin-only steps below.

// PATCH /api/v1/admin/orders/{id}/refund-request  (@IsStaffOrAdmin)
export async function requestOrderRefund(
  id: string,
  reason: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/refund-request`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// PATCH /api/v1/admin/orders/{id}/refund-request/resolve  (@IsStaffOrAdmin)
export async function resolveOrderRefundRequest(
  id: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/refund-request/resolve`, {
    method: "PATCH",
  });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// PATCH /api/v1/admin/orders/{id}/mark-payment-refunded  (@IsAdmin only)
export async function markOrderPaymentRefunded(
  id: string,
  reason: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/mark-payment-refunded`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// POST /api/v1/admin/orders/{id}/delivery-fee/stk-push
export async function triggerDeliveryFeeStk(
  id: string,
  amount: number,
  phone: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/delivery-fee/stk-push`, {
    method: "POST",
    body: JSON.stringify({ amount, phone }),
  });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// POST /api/v1/admin/orders/{id}/delivery-fee/record
export async function recordDeliveryFeePaid(
  id: string,
  amount: number,
  method: "SELF_PAID" | "ADMIN_STK" | "MANUAL_RECORD",
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/delivery-fee/record`, {
    method: "POST",
    body: JSON.stringify({ amount, method }),
  });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// PATCH /api/v1/admin/orders/{id}/restore-inventory  (@IsAdmin only)
export async function restoreOrderInventory(
  id: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/restore-inventory`, {
    method: "PATCH",
  });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// GET /api/v1/admin/orders/{id}/delivery-note.pdf — the document carrying the delivery-
// verification QR/code, for staff to print and physically attach to the parcel. Never emailed,
// never Cloudinary-hosted — see DeliveryNotePdfService.
export async function fetchDeliveryNote(id: string): Promise<Blob> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/delivery-note.pdf`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError({ status: res.status, message: body?.message, code: body?.code });
  }
  return res.blob();
}

// POST /api/v1/admin/orders/{id}/override-delivery-confirmation  (@IsAdmin only)
export async function overrideDeliveryConfirmation(
  id: string,
  note: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/override-delivery-confirmation`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError({ status: res.status, message: body?.message, code: body?.code });
  }
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// POST /api/v1/admin/orders/{id}/retry-tumaboda-delivery
export async function retryTumaBodaDelivery(
  id: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/retry-tumaboda-delivery`, {
    method: "POST",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError({ status: res.status, message: body?.message, code: body?.code });
  }
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// A stuck TumaBoda order (booking permanently failed, retrying won't help) — switches
// fulfillmentType to MANUAL_DELIVERY and carries the already-charged delivery fee over as paid.
export async function rerouteToManualDelivery(
  id: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/reroute-to-manual-delivery`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError({ status: res.status, message: body?.message, code: body?.code });
  }
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// POST /api/v1/admin/orders/{id}/scan-rider — staff scan the rider's QR at pickup
// (TumaBoda identity verification; see PaymentService.scanRiderForOrder).
export async function scanRiderForOrder(
  id: string,
  scannedCode: string,
): Promise<{ order: OrderRecord | undefined; source: Source }> {
  const res = await adminFetch(`/api/v1/admin/orders/${encodeURIComponent(id)}/scan-rider`, {
    method: "POST",
    body: JSON.stringify({ scannedCode }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError({ status: res.status, message: body?.message, code: body?.code });
  }
  const raw = await res.json();
  return { order: normalizeOrder(raw), source: "live" };
}

// ---------- Payments ----------

/** A PaymentRecord still stuck in INITIATED/PROCESSING after the automatic STK reconciliation
 *  sweep (every 10 minutes) has had a chance to resolve it — see PaymentService.listStuckPayments
 *  and StkReconciliationJob on the backend. */
export interface StuckPayment {
  paymentRecordId: string;
  orderId: string;
  orderReference: string;
  contactName: string;
  phone: string;
  amount: number;
  status: string;
  checkoutRequestId: string | null;
  createdAt: string;
  fulfillmentType: string | null;
}

export async function fetchStuckPayments(): Promise<StuckPayment[]> {
  return getJson<StuckPayment[]>("/api/v1/admin/orders/stuck-payments");
}


// ---------- Dashboard ----------

export interface DashboardResult extends DashboardStats {
  source: Source;
}

export async function getDashboardStats(): Promise<DashboardResult> {
  const stats = await getJson<DashboardStats>("/api/v1/admin/dashboard/stats");
  return { ...stats, source: "live" };
}

// ---------- Customers ----------

export interface ListCustomersParams {
  q?: string;
  status?: string;
  segment?: string;
  page?: number;
  size?: number;
}

export interface ListCustomersResult {
  rows: CustomerRecord[];
  total: number;
  totalPages: number;
  source: Source;
}

export async function listCustomers(params: ListCustomersParams = {}): Promise<ListCustomersResult> {
  const data = await getJson<
    { content?: CustomerRecord[]; totalElements?: number; totalPages?: number } | CustomerRecord[]
  >(`/api/v1/admin/customers${qs(params as Record<string, unknown>)}`);
  return { ...unwrapPage(data), source: "live" };
}

export async function getCustomer(
  id: string,
): Promise<{ customer: CustomerRecord | undefined; orders: OrderRecord[]; source: Source }> {
  const data = await getJson<{ customer: CustomerRecord; orders?: any[] }>(
    `/api/v1/admin/customers/${encodeURIComponent(id)}`,
  );
  return { customer: data.customer, orders: (data.orders ?? []).map(normalizeOrder), source: "live" };
}

export interface ImpersonationSession {
  accessToken: string;
  expiresIn: number;
  customerName: string;
  accountType: "INDIVIDUAL_SHOPPER" | "BUSINESS" | null;
}

/** Sandbox/test-mode system — Super-Admin only. Flags/unflags a customer account as a
 *  designated internal test account; any order it places from this point on routes to sandbox
 *  gateways and is excluded from all revenue/analytics reporting. Never affects orders already placed. */
export async function setCustomerTestAccount(id: string, isTestAccount: boolean): Promise<CustomerRecord> {
  const res = await adminFetch(`/api/v1/admin/customers/${encodeURIComponent(id)}/test-account`, {
    method: "PATCH",
    body: JSON.stringify({ isTestAccount }),
  });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  return (await res.json()) as CustomerRecord;
}

/** Mints a short-lived session that lets an admin preview/act inside this customer's real dashboard. */
export async function impersonateCustomer(id: string): Promise<ImpersonationSession> {
  const res = await adminFetch(`/api/v1/admin/customers/${encodeURIComponent(id)}/impersonate`, { method: "POST" });
  if (!res.ok) throw new ApiError({ status: res.status, message: res.statusText });
  return (await res.json()) as ImpersonationSession;
}

// ---------- Analytics ----------
// Backend GET /api/v1/admin/analytics/overview returns a flat operational shape:
//   revenueToday, revenueWeek, revenueMTD,
//   ordersToday, ordersPending, ordersInProd, ordersTotal,
//   totalProducts, totalUsers, totalEnquiries, totalLeads,
//   topProducts: string[]

export interface AnalyticsOverviewResponse {
  revenueToday: number;
  revenueWeek: number;
  revenueMTD: number;
  ordersToday: number;
  ordersPending: number;
  ordersInProd: number;
  ordersTotal: number;
  totalProducts: number;
  totalUsers: number;
  totalEnquiries: number;
  totalLeads: number;
  topProducts: string[];
}

export interface AnalyticsResult extends AnalyticsOverviewResponse {
  source: Source;
}

export async function getAnalyticsOverview(): Promise<AnalyticsResult> {
  const raw = await getJson<any>(`/api/v1/admin/analytics/overview`);
  console.log("[analytics/overview] raw response:", raw);
  const r = raw?.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : raw;
  const num = (v: unknown) => Number(v ?? 0) || 0;
  const top = Array.isArray(r?.topProducts) ? r.topProducts.map((x: unknown) => String(x)) : [];
  return {
    revenueToday: num(r?.revenueToday),
    revenueWeek: num(r?.revenueWeek),
    revenueMTD: num(r?.revenueMTD),
    ordersToday: num(r?.ordersToday),
    ordersPending: num(r?.ordersPending),
    ordersInProd: num(r?.ordersInProd),
    ordersTotal: num(r?.ordersTotal),
    totalProducts: num(r?.totalProducts),
    totalUsers: num(r?.totalUsers),
    totalEnquiries: num(r?.totalEnquiries),
    totalLeads: num(r?.totalLeads),
    topProducts: top,
    source: "live",
  };
}

// ---------- Analytics: revenue summary (Phase 1 of the comprehensive dashboard) ----------
// Backend GET /api/v1/admin/analytics/revenue?from=<ISO instant>&to=<ISO instant>

export interface PaymentMethodBreakdown {
  method: string;
  successCount: number;
  failedCount: number;
  otherCount: number;
  successRatePercent: number;
}

export interface RevenueSummary {
  rangeStart: string;
  rangeEnd: string;
  paidRevenue: number;
  paidOrderCount: number;
  pendingPaymentValue: number;
  pendingOrderCount: number;
  failedPaymentValue: number;
  failedOrderCount: number;
  refundedValue: number;
  refundedOrderCount: number;
  averageOrderValue: number;
  byMethod: PaymentMethodBreakdown[];
}

export async function getRevenueSummary(from: Date, to: Date): Promise<RevenueSummary> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<RevenueSummary>(`/api/v1/admin/analytics/revenue?${params.toString()}`);
}

// ---------- Analytics: revenue trend chart ----------
// Backend GET /api/v1/admin/analytics/revenue-trend?from=<ISO instant>&to=<ISO instant>

export interface DailyRevenuePoint {
  date: string;
  paidKes: number;
  pendingKes: number;
  failedKes: number;
}

export interface RevenueTrend {
  rangeStart: string;
  rangeEnd: string;
  points: DailyRevenuePoint[];
}

export async function getRevenueTrend(from: Date, to: Date): Promise<RevenueTrend> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<RevenueTrend>(`/api/v1/admin/analytics/revenue-trend?${params.toString()}`);
}

// ---------- Analytics: operations summary (Phase 2) ----------
// Backend GET /api/v1/admin/analytics/operations?from=<ISO instant>&to=<ISO instant>

export interface StatusCount {
  status: string;
  count: number;
}

export interface StatusDuration {
  status: string;
  avgHours: number;
  sampleCount: number;
}

export interface OperationsSummary {
  rangeStart: string;
  rangeEnd: string;
  totalOrders: number;
  funnel: StatusCount[];
  avgTimeInStage: StatusDuration[];
  cancelledOrders: number;
  cancellationRatePercent: number;
  distinctCustomerCount: number;
  repeatCustomerCount: number;
  repeatCustomerRatePercent: number;
  refundRequestedCount: number;
  refundRequestedValue: number;
  refundResolvedCount: number;
  avgRefundResolutionHours: number;
}

export async function getOperationsSummary(from: Date, to: Date): Promise<OperationsSummary> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<OperationsSummary>(`/api/v1/admin/analytics/operations?${params.toString()}`);
}

// ---------- Analytics: rewards economics (Phase 3) ----------
// Backend GET /api/v1/admin/analytics/rewards?from=<ISO instant>&to=<ISO instant>

export interface RewardsSourceBreakdown {
  source: string;
  coupons: number;
  valueKes: number;
}

export interface TopWalletHolder {
  name: string;
  balance: number;
  valueKes: number;
}

export interface RewardsEconomics {
  rangeStart: string;
  rangeEnd: string;
  outstandingBalanceCoupons: number;
  outstandingBalanceValueKes: number;
  redeemedCouponsInRange: number;
  redeemedValueKesInRange: number;
  earnedInRange: RewardsSourceBreakdown[];
  referralConversionRatePercent: number;
  referralSignupsInRange: number;
  referralConfirmedInRange: number;
  estimatedProgramCostKesInRange: number;
  medianWalletBalance: number;
  topHolders: TopWalletHolder[];
}

export async function getRewardsEconomics(from: Date, to: Date): Promise<RewardsEconomics> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<RewardsEconomics>(`/api/v1/admin/analytics/rewards?${params.toString()}`);
}

// ---------- Analytics: tax report (Phase 4) ----------
// Backend GET /api/v1/admin/analytics/tax?from=<ISO instant>&to=<ISO instant>

export interface TaxReport {
  rangeStart: string;
  rangeEnd: string;
  vatableSalesKes: number;
  outputVatKes: number;
  cogsForInputVatKes: number;
  inputVatKes: number;
  vatToRemitKes: number;
  unitsMissingCostOrVatRateCount: number;
  paidOrderCount: number;
  taxInvoiceRequestedCount: number;
  etrRequestedCount: number;
  documentBundleStatusCounts: StatusCount[];
}

export async function getTaxReport(from: Date, to: Date): Promise<TaxReport> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<TaxReport>(`/api/v1/admin/analytics/tax?${params.toString()}`);
}

// ---------- Analytics: products & inventory (Phase 5) ----------
// Backend GET /api/v1/admin/analytics/products?from=<ISO instant>&to=<ISO instant>

export interface ProductPerformance {
  productName: string;
  unitsSold: number;
  revenueKes: number;
}

export interface StockAlert {
  productName: string;
  stockCount: number;
  lowStockThreshold: number;
  stockStatus: string;
}

export interface ProductsInventory {
  rangeStart: string;
  rangeEnd: string;
  topSellingByRevenue: ProductPerformance[];
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalInventoryCostValueKes: number;
  totalInventoryRetailValueKes: number;
  productsMissingCostPriceCount: number;
  lowStockAlerts: StockAlert[];
}

export async function getProductsInventory(from: Date, to: Date): Promise<ProductsInventory> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<ProductsInventory>(`/api/v1/admin/analytics/products?${params.toString()}`);
}

// ---------- Analytics: profitability (Phase 6) ----------
// Backend GET /api/v1/admin/analytics/profitability?from=<ISO instant>&to=<ISO instant>

export interface Profitability {
  rangeStart: string;
  rangeEnd: string;
  paidRevenueKes: number;
  estimatedCogsKes: number;
  estimatedGrossProfitKes: number;
  grossMarginPercent: number;
  unitsMissingCostPriceCount: number;
  couponRedemptionCostKes: number;
  estimatedNetProfitKes: number;
  netMarginPercent: number;
}

export async function getProfitability(from: Date, to: Date): Promise<Profitability> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<Profitability>(`/api/v1/admin/analytics/profitability?${params.toString()}`);
}

// ---------- Analytics: profitability breakdown & daily trend ----------
// Backend GET /api/v1/admin/analytics/profitability-breakdown, /profitability-trend

export interface ProfitabilityByProduct {
  productId: string;
  productName: string;
  unitsSold: number;
  revenueKes: number;
  cogsKes: number;
  grossProfitKes: number;
  marginPercent: number;
  listGrossProfitPercent: number | null;
  marginGapPercent: number | null;
}

export interface ProfitabilityLine {
  groupId: string;
  groupName: string;
  unitsSold: number;
  revenueKes: number;
  cogsKes: number;
  grossProfitKes: number;
  marginPercent: number;
}

export interface ProfitabilityBreakdown {
  rangeStart: string;
  rangeEnd: string;
  byProduct: ProfitabilityByProduct[];
  byCategory: ProfitabilityLine[];
  bySubcategory: ProfitabilityLine[];
  byIndustry: ProfitabilityLine[];
  unitsMissingCostPriceCount: number;
  unitsUnclassifiedCount: number;
}

export async function getProfitabilityBreakdown(from: Date, to: Date): Promise<ProfitabilityBreakdown> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<ProfitabilityBreakdown>(`/api/v1/admin/analytics/profitability-breakdown?${params.toString()}`);
}

export interface DailyProfitPoint {
  date: string;
  revenueKes: number;
  netRevenueKes: number;
  cogsKes: number;
  grossProfitKes: number;
}

export interface DailyProfitTrend {
  rangeStart: string;
  rangeEnd: string;
  points: DailyProfitPoint[];
  unitsMissingCostPriceCount: number;
}

export async function getDailyProfitTrend(from: Date, to: Date): Promise<DailyProfitTrend> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<DailyProfitTrend>(`/api/v1/admin/analytics/profitability-trend?${params.toString()}`);
}

// ---------- Analytics: monthly projection (Phase 7) ----------
// Backend GET /api/v1/admin/analytics/projection — no params, always the current month.

export interface MonthlyProjection {
  monthStart: string;
  monthEnd: string;
  sampleStart: string;
  sampleEnd: string;
  sampleDays: number;
  daysInMonth: number;
  sampleRevenueKes: number;
  projectedRevenueKes: number;
  sampleGrossProfitKes: number;
  projectedGrossProfitKes: number;
  sampleCostsKes: number;
  projectedCostsKes: number;
}

export async function getMonthlyProjection(): Promise<MonthlyProjection> {
  return getJson<MonthlyProjection>(`/api/v1/admin/analytics/projection`);
}

// ---------- Analytics: customers (Phase 8) ----------
// Backend GET /api/v1/admin/analytics/customers?from=<ISO instant>&to=<ISO instant>

export interface AccountTypeBreakdown {
  accountType: string;
  customerCount: number;
  revenueKes: number;
}

export interface TopCustomer {
  name: string;
  accountType: string;
  lifetimeOrderCount: number;
  lifetimeRevenueKes: number;
}

export interface CustomerAnalytics {
  rangeStart: string;
  rangeEnd: string;
  newPayingCustomersInRange: number;
  newCustomerFirstOrderValueKes: number;
  byAccountType: AccountTypeBreakdown[];
  topCustomersByLifetimeValue: TopCustomer[];
}

export async function getCustomerAnalytics(from: Date, to: Date): Promise<CustomerAnalytics> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<CustomerAnalytics>(`/api/v1/admin/analytics/customers?${params.toString()}`);
}

// ---------- Analytics: geographic ----------
// Backend GET /api/v1/admin/analytics/geographic?from=<ISO instant>&to=<ISO instant>

export interface GeographicBreakdown {
  region: string;
  orderCount: number;
  revenueKes: number;
}

export interface GeographicAnalytics {
  rangeStart: string;
  rangeEnd: string;
  byCounty: GeographicBreakdown[];
}

export async function getGeographicAnalytics(from: Date, to: Date): Promise<GeographicAnalytics> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<GeographicAnalytics>(`/api/v1/admin/analytics/geographic?${params.toString()}`);
}

// ---------- Analytics: delivery ----------
// Backend GET /api/v1/admin/analytics/delivery?from=<ISO instant>&to=<ISO instant>

export interface DeliveryPerformance {
  fulfillmentType: string;
  totalOrders: number;
  deliveredCount: number;
  cancelledCount: number;
  deliveryRatePercent: number;
  avgDeliveryHours: number;
  deliverySampleCount: number;
  paidRevenue: number;
  /** null when there were no paid orders of this type in range — not a misleading zero. */
  avgOrderValue: number | null;
}

export interface DeliveryAnalytics {
  rangeStart: string;
  rangeEnd: string;
  byFulfillmentType: DeliveryPerformance[];
}

export async function getDeliveryAnalytics(from: Date, to: Date): Promise<DeliveryAnalytics> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<DeliveryAnalytics>(`/api/v1/admin/analytics/delivery?${params.toString()}`);
}

// ---------- Analytics: signups & demographics (Sales tab) ----------
// Backend GET /api/v1/admin/analytics/signups-trend and /demographics — both new endpoints.
// Deliberately distinct from CustomerAnalytics.newPayingCustomersInRange above (first PAID
// order in range) — a raw signup and a first paid order for the same person can land in
// different periods, so these must be labeled distinctly wherever both appear.

export interface DailySignupPoint {
  date: string;
  signups: number;
}

export interface SignupTrend {
  rangeStart: string;
  rangeEnd: string;
  points: DailySignupPoint[];
}

export async function getSignupTrend(from: Date, to: Date): Promise<SignupTrend> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<SignupTrend>(`/api/v1/admin/analytics/signups-trend?${params.toString()}`);
}

export interface GenderCount {
  gender: string;
  count: number;
}

export interface AgeBracketCount {
  bracket: string;
  count: number;
}

export interface DemographicsBreakdown {
  rangeStart: string;
  rangeEnd: string;
  byGender: GenderCount[];
  byAgeBracket: AgeBracketCount[];
  excludedBusinessPathCount: number;
}

export async function getDemographicsBreakdown(from: Date, to: Date): Promise<DemographicsBreakdown> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return getJson<DemographicsBreakdown>(`/api/v1/admin/analytics/demographics?${params.toString()}`);
}

// ---------- Analytics: alerts ----------
// Backend GET /api/v1/admin/analytics/alerts — no params, always the current live snapshot.

export interface Alerts {
  checkedAt: string;
  stalePendingOrders: number;
  failedPaymentsRecent: number;
  lowStockCount: number;
  outOfStockCount: number;
  unresolvedRefunds: number;
}

export async function getAlerts(): Promise<Alerts> {
  return getJson<Alerts>(`/api/v1/admin/analytics/alerts`);
}

// ---------- Analytics: needs attention ----------
// Backend GET /api/v1/admin/analytics/needs-attention — no params, always the current live snapshot.

export interface LapsedCustomer {
  customerId: string;
  name: string;
  email: string;
  lastOrderAt: string;
  averageGapDays: number;
  daysSinceLastOrder: number;
}

export interface SalesDropAlert {
  metric: string;
  currentValue: number;
  priorValue: number;
  dropPercent: number;
}

export interface UnderperformingProduct {
  productId: string;
  name: string;
  stockCount: number;
}

export interface SuspiciousAccount {
  userId: string;
  name: string;
  email: string;
  registrationIp: string;
  createdAt: string;
  accountsSharingIp: number;
}

export interface TumaBodaAttentionOrder {
  orderId: string;
  reference: string;
  /** "NO_DELIVERY_CREATED" or "DELIVERY_FAILED"/"DELIVERY_RETURNED"/"DELIVERY_CANCELLED". */
  reason: string;
  createdAt: string;
}

export interface UnconfirmedDelivery {
  orderId: string;
  reference: string;
  fulfillmentType: string | null;
  createdAt: string;
}

export interface NeedsAttentionSummary {
  operationalAlerts: Alerts;
  lapsedCustomers: LapsedCustomer[];
  salesDropAlerts: SalesDropAlert[];
  underperformingProducts: UnderperformingProduct[];
  suspiciousAccounts: SuspiciousAccount[];
  tumaBodaOrdersNeedingAttention: TumaBodaAttentionOrder[];
  unconfirmedDeliveries: UnconfirmedDelivery[];
}

export async function getNeedsAttention(): Promise<NeedsAttentionSummary> {
  return getJson<NeedsAttentionSummary>(`/api/v1/admin/analytics/needs-attention`);
}

// ---------- Exports ----------

export async function exportOrders(params: ListOrdersParams = {}): Promise<{ rows: OrderRecord[]; source: Source }> {
  const res = await listOrders({ ...params, size: 1000 });
  return { rows: res.rows, source: res.source };
}


export async function exportCustomers(
  params: ListCustomersParams = {},
): Promise<{ rows: CustomerRecord[]; source: Source }> {
  const res = await listCustomers({ ...params, size: 1000 });
  return { rows: res.rows, source: res.source };
}
