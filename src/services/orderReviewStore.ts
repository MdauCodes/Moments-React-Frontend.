// ----------------------------------------------------------------------------
// Order/delivery-experience reviews — separate from reviewStore.ts (product reviews).
// Minimal version per explicit product decision: rating + comment, one per order, unlocked once
// DELIVERED. No time window, no photos, no incentive tie-in.
//
// Live endpoints:
//   POST /api/v1/customer/orders/{ref}/review   { rating, comment }
//   GET  /api/v1/customer/orders/{ref}/review
//   GET  /api/v1/admin/order-reviews
// ----------------------------------------------------------------------------
import { apiUrl } from "@/config/api";
import { authFetch, getAccessToken } from "@/contexts/AuthContext";

export interface OrderReview {
  id: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
}

export interface AdminOrderReview {
  id: string;
  orderReference: string;
  customerName: string;
  customerEmail: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
}

const STORAGE_KEY = "mpk_order_reviews_v1";

function read(): Record<string, OrderReview> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, OrderReview>) : {};
  } catch { return {}; }
}
function write(rows: Record<string, OrderReview>) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows)); } catch { /* ignore */ }
}

async function tryLive<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await authFetch(apiUrl(path), init);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}

export const orderReviewStore = {
  async getForOrder(orderReference: string): Promise<OrderReview | null> {
    if (getAccessToken()) {
      const live = await tryLive<OrderReview>(`/api/v1/customer/orders/${encodeURIComponent(orderReference)}/review`);
      if (live) return live;
    }
    return read()[orderReference] ?? null;
  },

  async submit(orderReference: string, input: { rating: 1 | 2 | 3 | 4 | 5; comment?: string }): Promise<OrderReview> {
    if (getAccessToken()) {
      const live = await tryLive<OrderReview>(
        `/api/v1/customer/orders/${encodeURIComponent(orderReference)}/review`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
      );
      if (live) {
        const all = read();
        all[orderReference] = live;
        write(all);
        return live;
      }
    }
    const review: OrderReview = {
      id: `orv_${Math.random().toString(36).slice(2, 11)}`,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date().toISOString(),
    };
    const all = read();
    all[orderReference] = review;
    write(all);
    return review;
  },

  // ---- Admin ----
  async listAll(): Promise<{ rows: AdminOrderReview[]; source: "live" | "mock" }> {
    if (getAccessToken()) {
      const live = await tryLive<AdminOrderReview[]>("/api/v1/admin/order-reviews");
      if (live) return { rows: live, source: "live" };
    }
    return { rows: [], source: "mock" };
  },
};
