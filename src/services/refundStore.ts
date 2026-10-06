// ----------------------------------------------------------------------------
// Refund / return requests — mock-live hybrid (Phase 6).
//
// Policy decided with the user:
//   • Eligible only when order.status === "DELIVERED" AND now - deliveredAt <= 14 days.
//   • Customer submits a reason + optional desired action (refund / replace).
//   • Admin reviews in /admin/orders/$id; can mark APPROVED / REJECTED / RESOLVED.
//
// Live endpoints assumed (backend will implement, see backendSpec.md §22):
//   POST   /api/v1/customer/orders/{ref}/refund-request
//   GET    /api/v1/customer/orders/{ref}/refund-request
//   GET    /api/v1/admin/refund-requests
//   GET    /api/v1/admin/orders/{ref}/refund-request
//   PATCH  /api/v1/admin/refund-requests/{id} { status, adminNote }
// ----------------------------------------------------------------------------
import { apiUrl } from "@/config/api";
import { authFetch, getAccessToken } from "@/contexts/AuthContext";
import type { CustomerOrder } from "@/services/orderStore";

export type RefundRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "RESOLVED";
/** CANCEL_ORDER is how a customer cancels a PAID order. Refunds are always sent by hand, so it is a
 *  request staff answer — never an instant cancel-and-refund. PENDING = under review (the order
 *  stays active), APPROVED = order cancelled and the refund is owed, REJECTED = the order carries
 *  on, RESOLVED = the refund has been sent. */
export type RefundDesiredAction = "REFUND" | "REPLACE" | "STORE_CREDIT" | "CANCEL_ORDER";

export interface RefundRequest {
  id: string;
  orderReference: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  reason: string;
  desiredAction: RefundDesiredAction;
  status: RefundRequestStatus;
  adminNote?: string;
  /** The order's own state when the request was read — lets whoever answers see how far it got. */
  orderStatus?: string;
  paymentStatus?: string;
  orderTotal?: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "mpk_refund_requests_v1";
const REFUND_WINDOW_DAYS = 14;

function read(): RefundRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RefundRequest[]) : [];
  } catch { return []; }
}
function write(rows: RefundRequest[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch { /* ignore */ }
}

async function tryLive<T>(path: string, init?: RequestInit, authed = false): Promise<T | null> {
  try {
    const res = authed
      ? await authFetch(apiUrl(path), init)
      : await fetch(apiUrl(path), init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

/** When did this order get delivered? Walks the trackingEvents looking for a DELIVERED label. */
function deliveredAt(order: CustomerOrder): string | null {
  if (order.status !== "DELIVERED") return null;
  const ev = order.trackingEvents?.find((e) => /deliver/i.test(e.label));
  return ev?.at ?? order.updatedAt ?? null;
}

export function refundEligibility(order: CustomerOrder): {
  eligible: boolean;
  reason?: string;
  daysRemaining?: number;
} {
  if (order.status === "REFUNDED") return { eligible: false, reason: "Already refunded" };
  if (order.status === "CANCELLED") return { eligible: false, reason: "Order was cancelled" };
  if (order.status !== "DELIVERED") return { eligible: false, reason: "Order has not been delivered yet" };
  const dAt = deliveredAt(order);
  if (!dAt) return { eligible: false, reason: "Delivery date unavailable" };
  const ageDays = (Date.now() - new Date(dAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays > REFUND_WINDOW_DAYS) {
    return { eligible: false, reason: `Refund window of ${REFUND_WINDOW_DAYS} days has passed` };
  }
  return { eligible: true, daysRemaining: Math.max(0, Math.ceil(REFUND_WINDOW_DAYS - ageDays)) };
}

/**
 * What a customer can do about cancelling an order, decided from the order alone:
 *  - "direct"  — nothing has been paid yet, so it can be cancelled on the spot;
 *  - "request" — it has been paid and is still with us, so they ask and our team answers (refunds
 *                are always sent by hand);
 *  - "none"    — on its way, delivered, or already cancelled/refunded (a delivered order uses the
 *                refund/replacement request above instead).
 * The backend enforces the same rules; this only decides which control to show.
 */
export type CancelOption = { kind: "direct" } | { kind: "request" } | { kind: "none" };

const CANCELLABLE_WHEN_PAID = ["PAID", "PAYMENT_VERIFIED", "IN_PRODUCTION", "READY_FOR_DISPATCH"];

export function cancelOption(order: CustomerOrder): CancelOption {
  // "SUCCESS" is the mock-era spelling of the real backend's "PAID".
  const paid = String(order.paymentStatus) === "PAID" || String(order.paymentStatus) === "SUCCESS";
  if (paid) {
    return CANCELLABLE_WHEN_PAID.includes(order.status) ? { kind: "request" } : { kind: "none" };
  }
  return order.status === "PENDING_PAYMENT" ? { kind: "direct" } : { kind: "none" };
}

export const refundStore = {
  REFUND_WINDOW_DAYS,

  /**
   * Asks our team to cancel a paid order and refund it. Deliberately NOT routed through submit()
   * above: that one falls back to a browser-local mock when the server says no, which would show
   * the customer "request sent" for a request nobody will ever see — exactly what must not happen
   * for money. This throws the server's own message instead (not paid, already on its way, …).
   */
  async submitCancellation(order: CustomerOrder, reason: string): Promise<RefundRequest> {
    if (!getAccessToken()) throw new Error("Please sign in to send a cancellation request.");
    let res: Response;
    try {
      res = await authFetch(
        apiUrl(`/api/v1/customer/orders/${encodeURIComponent(order.reference)}/refund-request`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim(), desiredAction: "CANCEL_ORDER" satisfies RefundDesiredAction }),
        },
      );
    } catch {
      throw new Error("Cannot reach the server. Check your connection and try again.");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}) as { message?: string });
      throw new Error((err as { message?: string }).message ?? "Couldn't send your request right now.");
    }
    const live = (await res.json()) as RefundRequest;
    const all = read().filter((r) => r.orderReference !== order.reference);
    all.unshift(live);
    write(all);
    return live;
  },

  async submit(order: CustomerOrder, input: {
    reason: string;
    desiredAction: RefundDesiredAction;
  }): Promise<{ request: RefundRequest; source: "live" | "mock" }> {
    if (getAccessToken()) {
      const live = await tryLive<RefundRequest>(
        `/api/v1/customer/orders/${encodeURIComponent(order.reference)}/refund-request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        true,
      );
      if (live) {
        const all = read().filter((r) => r.orderReference !== order.reference);
        all.unshift(live);
        write(all);
        return { request: live, source: "live" };
      }
    }
    const now = new Date().toISOString();
    const request: RefundRequest = {
      id: `rf_${Math.random().toString(36).slice(2, 11)}`,
      orderReference: order.reference,
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      reason: input.reason.trim(),
      desiredAction: input.desiredAction,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
    const all = read().filter((r) => r.orderReference !== order.reference);
    all.unshift(request);
    write(all);
    return { request, source: "mock" };
  },

  async getForOrder(orderReference: string): Promise<RefundRequest | null> {
    if (getAccessToken()) {
      const live = await tryLive<RefundRequest>(
        `/api/v1/customer/orders/${encodeURIComponent(orderReference)}/refund-request`,
        undefined,
        true,
      );
      if (live) return live;
    }
    return read().find((r) => r.orderReference === orderReference) ?? null;
  },

  // ---- Admin ----
  async listAll(): Promise<{ rows: RefundRequest[]; source: "live" | "mock" }> {
    if (getAccessToken()) {
      const live = await tryLive<RefundRequest[]>("/api/v1/admin/refund-requests", undefined, true);
      if (live) return { rows: live, source: "live" };
    }
    return { rows: read().sort((a, b) => b.createdAt.localeCompare(a.createdAt)), source: "mock" };
  },

  async getAdminForOrder(orderReference: string): Promise<RefundRequest | null> {
    if (getAccessToken()) {
      const live = await tryLive<RefundRequest>(
        `/api/v1/admin/orders/${encodeURIComponent(orderReference)}/refund-request`,
        undefined,
        true,
      );
      if (live) return live;
    }
    return read().find((r) => r.orderReference === orderReference) ?? null;
  },

  async updateStatus(id: string, status: RefundRequestStatus, adminNote?: string): Promise<RefundRequest | null> {
    if (getAccessToken()) {
      const live = await tryLive<RefundRequest>(
        `/api/v1/admin/refund-requests/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, adminNote }),
        },
        true,
      );
      if (live) {
        const all = read();
        const i = all.findIndex((r) => r.id === id);
        if (i >= 0) { all[i] = live; write(all); }
        return live;
      }
    }
    const all = read();
    const i = all.findIndex((r) => r.id === id);
    if (i < 0) return null;
    all[i] = { ...all[i], status, adminNote, updatedAt: new Date().toISOString() };
    write(all);
    return all[i];
  },
};
