// ----------------------------------------------------------------------------
// Storefront order store — mock-live hybrid.
//
// Tries the public Spring Boot endpoints first; falls back to a deterministic
// localStorage-backed mock so the entire checkout → processing → success →
// account/orders loop works even with no backend.
//
// Live endpoints:
//   POST   /api/v1/checkout                        -> create order
//   POST   /api/v1/payments/initiate               -> trigger STK push
//   GET    /api/v1/payments/status/{orderId}        -> poll payment status (UUID)
//   GET    /api/v1/orders/track/{reference}         -> public order tracking
//   GET    /api/v1/public/orders/{ref}?contact=     -> guest lookup
//   GET    /api/v1/customer/orders                  -> authed order list
//   GET    /api/v1/customer/orders/{ref}            -> authed order detail
// ----------------------------------------------------------------------------

import { apiUrl, apiFetch } from "@/config/api";
import { authFetch, getAccessToken } from "@/contexts/AuthContext";
import type { CartItem } from "@/contexts/CartContext";

export type CustomerOrderStatus =
  | "AWAITING_PAYMENT"
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "PAYMENT_FAILED";

export type CustomerPaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";

export interface CustomerOrderItem {
  productId: string;
  productName: string;
  primaryImageUrl: string;
  size: string;
  material: string;
  finish: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  variantLabel?: string;
  sku?: string;
  isBackorder?: boolean;
}

export type CheckoutPaymentMethod = "PAYHERO" | "CASH_ON_DELIVERY" | "BANK_TRANSFER" | "MPESA" | "CARD" | "BANK";

export type FulfillmentType = "ZONE_DELIVERY" | "PICKUP" | "OWN_COURIER";
export type CourierType = "MATATU" | "PARCEL_SERVICE" | "BOLT_SEND" | "RIDER" | "OTHER";

export interface CustomerOrder {
  id?: string;
  reference: string;
  invoiceNumber?: string | null;
  paidAt?: string | null;
  status: CustomerOrderStatus;
  paymentStatus: CustomerPaymentStatus;
  paymentMethod: CheckoutPaymentMethod;
  paymentReference?: string;
  failureReason?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  county?: string;
  notes?: string;
  items: CustomerOrderItem[];
  subtotal: number;
  shippingFee: number;
  total: number;
  currency: "KES";
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
  receiptNumber?: string;
  trackingEvents?: { at: string; label: string; description?: string }[];
  fulfillmentType?: FulfillmentType;
  courierType?: CourierType;
  courierServiceName?: string;
  courierStageOrOffice?: string;
}

export interface PlaceOrderInput {
  items: CartItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    county: string;
    postalCode?: string;
    notes?: string;
  };
  shippingFee: number;
  paymentMethod: CheckoutPaymentMethod;
  promoCode?: string;
  /** Sole Merchant rewards points to redeem against this order. */
  redeemPoints?: number;
  sessionId?: string;
  fulfillmentType?: FulfillmentType;
  courierType?: CourierType;
  courierServiceName?: string;
  courierStageOrOffice?: string;
  /** Client-generated UUID — prevents duplicate orders on network retry. */
  idempotencyKey?: string;
}

// ── Normalised status the UI cares about ─────────────────────────────────────
export type PaymentPollStatus = "PROCESSING" | "SUCCESS" | "FAILED" | "UNKNOWN";

export interface PaymentPollResult {
  status: PaymentPollStatus;
  message?: string;
  orderReference?: string;
  receiptNumber?: string;
  failureReason?: string;
}

// ── Backend response shape from GET /api/v1/payments/status/{orderId} ────────
interface BackendPaymentStatusResponse {
  orderId?: string;
  orderReference?: string;
  status?: string; // PROCESSING | SUCCESS | FAILED | NO_PAYMENT
  message?: string;
  amount?: number;
  receiptNumber?: string;
  failureReason?: string;
  paymentMethod?: string;
}

// ── localStorage helpers ──────────────────────────────────────────────────────
const STORAGE_KEY = "mpk_customer_orders_v1";

function isBrowser() {
  return typeof window !== "undefined";
}

function readAll(): CustomerOrder[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CustomerOrder[]) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: CustomerOrder[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

function nowIso() {
  return new Date().toISOString();
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function tryLiveJson<T>(path: string, init?: RequestInit, authed = false): Promise<T | null> {
  try {
    const res = authed ? await authFetch(apiUrl(path), init) : await fetch(apiUrl(path), init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ── Order DTO normaliser (tracking endpoint) ──────────────────────────────────
function normalizeTrackingDto(raw: Record<string, any>): CustomerOrder {
  return {
    id: raw.id,
    reference: raw.reference,
    invoiceNumber: raw.invoiceNumber ?? null,
    paidAt: raw.paidAt ?? null,
    status: raw.status,
    paymentStatus: raw.paymentStatus ?? "PENDING",
    paymentMethod: raw.paymentMethod ?? "MPESA",
    customerName: raw.contactName ?? raw.customerName ?? "",
    customerEmail: raw.maskedEmail ?? raw.customerEmail ?? "",
    customerPhone: raw.customerPhone ?? "",
    shippingAddress: raw.shippingAddress ?? raw.deliveryAddress ?? "",
    city: raw.city ?? "",
    items: (raw.items ?? []).map((it: any) => ({
      productId: it.productId ?? "",
      productName: it.productName ?? "",
      primaryImageUrl: it.primaryImageUrl ?? "",
      size: it.size ?? "",
      material: it.material ?? "",
      finish: it.finish ?? "",
      quantity: it.quantity ?? 0,
      unitPrice: it.unitPrice ?? 0,
      lineTotal: it.lineTotal ?? 0,
    })),
    subtotal: raw.subtotal ?? raw.totalAmount ?? 0,
    shippingFee: raw.deliveryFee ?? raw.shippingFee ?? 0,
    total: raw.totalAmount ?? raw.total ?? 0,
    currency: "KES",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
    trackingEvents: (raw.statusHistory ?? []).map((h: any) => ({
      at: h.changedAt,
      // Backend returns toStatus (not status) — fall back to status for safety
      label: (h.toStatus ?? h.status ?? "").replace(/_/g, " "),
      description: h.note ?? undefined,
    })),
  };
}

/**
 * Maps the backend's normalised status string to the UI's PaymentPollStatus.
 * Backend always returns one of: PROCESSING | SUCCESS | FAILED | NO_PAYMENT
 */
function mapBackendStatus(raw: string): PaymentPollStatus {
  const s = raw.toUpperCase();
  if (s === "SUCCESS") return "SUCCESS";
  if (s === "FAILED") return "FAILED";
  if (s === "PROCESSING" || s === "NO_PAYMENT") return "PROCESSING";
  return "UNKNOWN";
}

// ── Order store ───────────────────────────────────────────────────────────────
export const orderStore = {
  /**
   * Place an order. Strict: throws if the backend cannot be reached or
   * returns a non-2xx response. No mock fallback.
   */
  async placeOrder(input: PlaceOrderInput): Promise<{ order: CustomerOrder; source: "live" }> {
    const body: Record<string, unknown> = {
      contactName: input.customer.name,
      email: input.customer.email,
      phone: input.customer.phone,
      deliveryAddress: input.customer.address,
      city: input.customer.city,
      county: input.customer.county,
      paymentMethod: input.paymentMethod,
      fulfillmentType: input.fulfillmentType ?? "ZONE_DELIVERY",
      items: input.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        size: it.size,
        material: it.material,
        finish: it.finish,
      })),
      shippingFee: input.shippingFee,
    };
    if (input.idempotencyKey) body.idempotencyKey = input.idempotencyKey;
    if (input.courierType) body.courierType = input.courierType;
    if (input.courierServiceName) body.courierServiceName = input.courierServiceName;
    if (input.courierStageOrOffice) body.courierStageOrOffice = input.courierStageOrOffice;
    if (input.customer.postalCode) body.postalCode = input.customer.postalCode;
    if (input.customer.notes) body.notes = input.customer.notes;
    if (input.promoCode) body.promoCode = input.promoCode;
    if (input.redeemPoints) body.redeemPoints = input.redeemPoints;
    if (input.sessionId) body.sessionId = input.sessionId;

    let res: Response;
    try {
      res = await apiFetch("/api/v1/checkout", {
        method: "POST",
        session: true,
        auth: true,
        json: body,
      });
    } catch {
      throw new Error("Cannot reach the server. Check your connection and try again.");
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}) as { message?: string; error?: string });
      const msg =
        (err as any).message ??
        (err as any).error ??
        (res.status === 422
          ? "Some details are invalid. Please review the form and try again."
          : res.status === 401
            ? "Please sign in to complete checkout."
            : `Checkout failed (${res.status})`);
      throw new Error(msg);
    }

    const order = (await res.json()) as CustomerOrder;
    const all = readAll();
    if (!all.some((o) => o.reference === order.reference)) {
      writeAll([order, ...all]);
    }
    return { order, source: "live" };
  },

  /**
   * Trigger an STK push.
   * Uses POST /api/v1/payments/initiate with paymentMethod MPESA.
   */
  async startMpesaStk(
    orderId: string,
    phone: string,
    paymentMethod: CheckoutPaymentMethod = "MPESA",
  ): Promise<{ success: boolean; message?: string; errorCode?: string }> {
    let res: Response;
    try {
      res = await apiFetch("/api/v1/payments/initiate", {
        method: "POST",
        session: true,
        auth: true,
        json: { orderId, paymentMethod, phone },
      });
    } catch {
      return {
        success: false,
        errorCode: "NETWORK_ERROR",
        message: "Cannot reach the payment service. Check your connection and try again.",
      };
    }

    if (res.ok) return { success: true };

    let errorCode = "UNKNOWN";
    let message = `Payment initiation failed (${res.status})`;

    try {
      const err = (await res.json()) as { errorCode?: string; message?: string };
      errorCode = err.errorCode ?? errorCode;
      message = err.message ?? message;
    } catch {
      /* non-JSON body */
    }

    if (errorCode === "MERCHANT_UNAVAILABLE") {
      message = "Payment is temporarily unavailable. Please try again in a few minutes or contact support.";
    }

    return { success: false, errorCode, message };
  },

  /**
   * Poll payment status.
   * Calls GET /api/v1/payments/status/{orderId} (orderId is the UUID from the order).
   */
  async getPaymentStatus(orderId: string): Promise<PaymentPollResult> {
    try {
      const res = await apiFetch(`/api/v1/payments/status/${encodeURIComponent(orderId)}`, {
        session: true,
        auth: true,
      });

      if (!res.ok) {
        return { status: "UNKNOWN", message: `Status check failed (${res.status})` };
      }

      const data = (await res.json()) as BackendPaymentStatusResponse;
      const status = mapBackendStatus(data.status ?? "");

      if (status === "SUCCESS" && data.orderReference) {
        const all = readAll();
        const idx = all.findIndex((o) => o.reference === data.orderReference || o.id === orderId);
        if (idx >= 0) {
          all[idx] = {
            ...all[idx],
            paymentStatus: "SUCCESS",
            receiptNumber: data.receiptNumber ?? all[idx].receiptNumber,
            paymentReference: data.receiptNumber ?? all[idx].paymentReference,
            updatedAt: nowIso(),
          };
          writeAll(all);
        }
      }

      return {
        status,
        message: data.message,
        orderReference: data.orderReference,
        receiptNumber: data.receiptNumber,
        failureReason: data.failureReason,
      };
    } catch {
      return { status: "UNKNOWN", message: "Network error checking payment status." };
    }
  },

  /**
   * Public order tracking by reference — no auth required.
   */
  async getStatus(reference: string): Promise<{ order: CustomerOrder | null; source: "live" | "mock" }> {
    const live = await tryLiveJson<Record<string, any>>(`/api/v1/orders/track/${encodeURIComponent(reference)}`);
    if (live) {
      const order = normalizeTrackingDto(live);
      const all = readAll();
      const idx = all.findIndex((o) => o.reference === order.reference);
      if (idx >= 0) {
        // Merge into the existing local record instead of overwriting it —
        // the public tracking endpoint deliberately redacts PII (masked
        // email, no phone/address/unit price) since anyone with just the
        // reference can hit it. Blindly replacing a fuller checkout-time
        // record with the redacted one would destroy data this browser
        // already has a right to see (its own order).
        const existing = all[idx];
        all[idx] = {
          ...existing,
          status: order.status,
          paymentStatus: order.paymentStatus,
          trackingEvents: order.trackingEvents?.length ? order.trackingEvents : existing.trackingEvents,
          customerEmail: existing.customerEmail || order.customerEmail,
          customerPhone: existing.customerPhone || order.customerPhone,
          shippingAddress: existing.shippingAddress || order.shippingAddress,
          city: existing.city || order.city,
          items: existing.items?.length ? existing.items : order.items,
          total: order.total || existing.total,
        };
      } else {
        all.unshift(order);
      }
      writeAll(all);
      return { order: idx >= 0 ? all[idx] : order, source: "live" };
    }
    const found = readAll().find((o) => o.reference === reference) ?? null;
    return { order: found, source: "mock" };
  },

  /**
   * Full order detail for building an invoice/receipt PDF. Prefers this
   * browser's own local record (written by placeOrder/getPaymentStatus at
   * checkout — full pricing, address, phone) over the public tracking
   * endpoint, which is deliberately redacted. Falls back to the tracking
   * endpoint when there's no local record — e.g. a different device.
   */
  async getFullOrder(reference: string): Promise<{ order: CustomerOrder | null; source: "cached" | "live" | "mock" }> {
    const cached = readAll().find((o) => o.reference === reference);
    if (cached) return { order: cached, source: "cached" };
    const { order, source } = await this.getStatus(reference);
    return { order, source };
  },

  /** Guest lookup — reference + email or phone. */
  async lookup(reference: string, contact: string): Promise<{ order: CustomerOrder | null; source: "live" | "mock" }> {
    const live = await tryLiveJson<CustomerOrder>(
      `/api/v1/public/orders/${encodeURIComponent(reference)}?contact=${encodeURIComponent(contact)}`,
    );
    if (live) {
      const o = live as any;
      return {
        order: {
          ...o,
          customerName: o.contactName ?? o.customerName ?? "",
          customerEmail: o.email ?? o.customerEmail ?? "",
          customerPhone: o.phone ?? o.customerPhone ?? "",
          shippingAddress: o.deliveryAddress ?? o.shippingAddress ?? "",
          shippingFee: Number(o.deliveryFee ?? o.shippingFee ?? 0),
          total: Number(o.totalAmount ?? o.total ?? 0),
          subtotal: Number(o.subtotal ?? 0),
        },
        source: "live",
      };
    }
    const c = contact.trim().toLowerCase();
    const found =
      readAll().find(
        (o) =>
          o.reference === reference &&
          (o.customerEmail.toLowerCase() === c || o.customerPhone.replace(/\s+/g, "") === contact.replace(/\s+/g, "")),
      ) ?? null;
    return { order: found, source: "mock" };
  },

  /** Public order tracking by reference (alias for getStatus). */
  async trackByReference(reference: string): Promise<{ order: CustomerOrder | null; source: "live" | "mock" }> {
    return this.getStatus(reference);
  },

  /** Public order lookup by email (paginated, masked results). */
  async findByEmail(
    email: string,
    page = 0,
    size = 10,
  ): Promise<{ rows: CustomerOrder[]; total: number; totalPages: number; page: number }> {
    try {
      const res = await apiFetch(
        `/api/v1/orders/by-email?email=${encodeURIComponent(email)}&page=${page}&size=${size}`,
      );
      if (!res.ok) return { rows: [], total: 0, totalPages: 0, page };
      const data: any = await res.json().catch(() => ({}));
      const rawRows: any[] = Array.isArray(data) ? data : (data.content ?? []);
      const rows: CustomerOrder[] = rawRows.map((o: any) => ({
        ...o,
        customerName: o.contactName ?? o.customerName ?? "",
        customerEmail: o.maskedEmail ?? o.email ?? o.customerEmail ?? "",
        customerPhone: o.phone ?? o.customerPhone ?? "",
        shippingAddress: o.deliveryAddress ?? o.shippingAddress ?? "",
        shippingFee: Number(o.deliveryFee ?? o.shippingFee ?? 0),
        total: Number(o.totalAmount ?? o.total ?? 0),
        subtotal: Number(o.subtotal ?? 0),
        items: o.items ?? [],
      }));
      const totalElements = Array.isArray(data) ? rows.length : (data.totalElements ?? rows.length);
      const totalPages = Array.isArray(data) ? 1 : (data.totalPages ?? 1);
      return { rows, total: totalElements, totalPages, page };
    } catch {
      return { rows: [], total: 0, totalPages: 0, page };
    }
  },

  /** Authed: list current customer's orders. */
  async listMine(
    page = 0,
    size = 20,
  ): Promise<{
    rows: CustomerOrder[];
    total: number;
    page: number;
    totalPages: number;
    source: "live" | "mock";
  }> {
    if (getAccessToken()) {
      const live = await tryLiveJson<
        | CustomerOrder[]
        | {
            content: CustomerOrder[];
            totalElements?: number;
            totalPages?: number;
            number?: number;
          }
      >(`/api/v1/customer/orders?page=${page}&size=${size}`, undefined, true);
      if (live) {
        const rawRows = Array.isArray(live) ? live : (live.content ?? []);
        const rows = rawRows.map((o: any) => ({
          ...o,
          customerName: o.contactName ?? o.customerName ?? "",
          customerEmail: o.email ?? o.customerEmail ?? "",
          customerPhone: o.phone ?? o.customerPhone ?? "",
          shippingAddress: o.deliveryAddress ?? o.shippingAddress ?? "",
          shippingFee: Number(o.deliveryFee ?? o.shippingFee ?? 0),
          total: Number(o.totalAmount ?? o.total ?? 0),
          subtotal: Number(o.subtotal ?? 0),
        }));
        const totalElements = Array.isArray(live) ? rows.length : (live.totalElements ?? rows.length);
        const totalPages = Array.isArray(live) ? 1 : (live.totalPages ?? 1);
        const number = Array.isArray(live) ? page : (live.number ?? page);
        return { rows, total: totalElements, page: number, totalPages, source: "live" };
      }
    }
    const all = readAll();
    return { rows: all, total: all.length, page: 0, totalPages: 1, source: "mock" };
  },

  async getMine(reference: string): Promise<{ order: CustomerOrder | null; source: "live" | "mock" }> {
    if (getAccessToken()) {
      const live = await tryLiveJson<CustomerOrder>(
        `/api/v1/customer/orders/${encodeURIComponent(reference)}`,
        undefined,
        true,
      );
      if (live) {
        const o = live as any;
        return {
          order: {
            ...o,
            customerName: o.contactName ?? o.customerName ?? "",
            customerEmail: o.email ?? o.customerEmail ?? "",
            customerPhone: o.phone ?? o.customerPhone ?? "",
            shippingAddress: o.deliveryAddress ?? o.shippingAddress ?? "",
            shippingFee: Number(o.deliveryFee ?? o.shippingFee ?? 0),
            total: Number(o.totalAmount ?? o.total ?? 0),
            subtotal: Number(o.subtotal ?? 0),
          },
          source: "live",
        };
      }
    }
    const found = readAll().find((o) => o.reference === reference) ?? null;
    return { order: found, source: "mock" };
  },

  /** Reorder: re-add past order items to cart. */
  async reorder(reference: string): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await apiFetch(`/api/v1/customer/orders/${encodeURIComponent(reference)}/reorder`, {
        method: "POST",
        auth: true,
        session: true,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as { message?: string });
        return {
          ok: false,
          message: (err as any).message ?? `Reorder failed (${res.status})`,
        };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Network error" };
    }
  },

  /**
   * Initiate an M-Pesa STK payment for an order.
   * Legacy alias kept for backward compatibility.
   */
  async initiatePayment(orderId: string, phone: string, paymentMethod: CheckoutPaymentMethod = "MPESA") {
    try {
      const res = await apiFetch("/api/v1/payments/initiate", {
        method: "POST",
        session: true,
        auth: true,
        json: { orderId, paymentMethod, phone },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as { message?: string });
        return {
          ok: false as const,
          message: (err as any).message ?? `Payment initiation failed (${res.status})`,
        };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: true as const, data };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof Error ? err.message : "Network error",
      };
    }
  },
};

// ── Shipping helpers ──────────────────────────────────────────────────────────
export const SHIPPING_FLAT_KES = 350; // kept as fallback only
