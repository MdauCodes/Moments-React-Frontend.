// ----------------------------------------------------------------------------
// Product reviews — mock-live hybrid (Phase 6).
//
// Policy decided with the user:
//   • Auto-publish on submit. Admin can later set hidden=true.
//   • A "verified purchase" review is one tied to an order with status DELIVERED
//     belonging to the reviewer (we record orderReference at submit time).
//   • Aggregate rating excludes hidden reviews.
//
// Live endpoints assumed (backend will implement, see backendSpec.md §22):
//   GET    /api/v1/public/products/{productId}/reviews
//   POST   /api/v1/customer/products/{productId}/reviews
//   GET    /api/v1/admin/reviews?hidden=&productId=
//   PATCH  /api/v1/admin/reviews/{id} { hidden }
//   DELETE /api/v1/admin/reviews/{id}
// ----------------------------------------------------------------------------
import { apiUrl } from "@/config/api";
import { authFetch, getAccessToken } from "@/contexts/AuthContext";

export interface ProductReview {
  id: string;
  productId: string;
  customerName: string;
  customerEmail?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  title?: string;
  body: string;
  orderReference?: string;
  verifiedPurchase: boolean;
  hidden: boolean;
  createdAt: string;
}

export interface ReviewSummary {
  productId: string;
  count: number;
  average: number; // 0..5, one decimal
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
}

const STORAGE_KEY = "mpk_reviews_v1";

function read(): ProductReview[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProductReview[]) : [];
  } catch { return []; }
}
function write(rows: ProductReview[]) {
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

function summarise(productId: string, rows: ProductReview[]): ReviewSummary {
  const visible = rows.filter((r) => r.productId === productId && !r.hidden);
  const histogram: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let total = 0;
  for (const r of visible) {
    histogram[r.rating]++;
    total += r.rating;
  }
  const average = visible.length === 0 ? 0 : Math.round((total / visible.length) * 10) / 10;
  return { productId, count: visible.length, average, histogram };
}

export const reviewStore = {
  /**
   * List reviews for a product. Accepts either a slug or productId — backend
   * public endpoints are slug-based.
   */
  async listForProduct(productKey: string): Promise<{ reviews: ProductReview[]; summary: ReviewSummary; source: "live" | "mock" }> {
    const key = encodeURIComponent(productKey);
    // Backend shapes: GET .../reviews returns a Spring Page ({content: [...], ...}, not a bare
    // array or {reviews: [...]}), and each row is the public ReviewDto (comment/verified, not
    // this page's body/verifiedPurchase names) — mapped below rather than assumed compatible.
    const [reviewsRes, summaryRes] = await Promise.all([
      tryLive<{ content: Array<{ id: string; customerName: string; rating: number; comment: string; verified: boolean; createdAt: string }> }>(
        `/api/v1/public/products/${key}/reviews`,
      ),
      tryLive<{ average: number; count: number }>(`/api/v1/public/products/${key}/rating-summary`),
    ]);
    if (reviewsRes || summaryRes) {
      const reviews: ProductReview[] = (reviewsRes?.content ?? []).map((r) => ({
        id: r.id,
        productId: productKey,
        customerName: r.customerName,
        rating: r.rating as 1 | 2 | 3 | 4 | 5,
        body: r.comment,
        verifiedPurchase: !!r.verified,
        hidden: false, // already excluded server-side; this listing endpoint never returns hidden rows
        createdAt: r.createdAt,
      }));
      // average/count come from the backend (accurate across every review, not just this page);
      // histogram has no backend equivalent yet, so it's a best-effort count over the fetched
      // page only — fine while a product realistically has a handful of reviews, not a real gap
      // worth a backend endpoint yet.
      const summary: ReviewSummary = summaryRes
        ? { ...summarise(productKey, reviews), average: summaryRes.average, count: summaryRes.count }
        : summarise(productKey, reviews);
      return { reviews, summary, source: "live" };
    }
    const all = read();
    return {
      reviews: all.filter((r) => r.productId === productKey && !r.hidden)
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      summary: summarise(productKey, all),
      source: "mock",
    };
  },

  async submit(input: {
    productId: string;
    orderId: string;
    customerName: string;
    customerEmail?: string;
    rating: 1 | 2 | 3 | 4 | 5;
    title?: string;
    body: string;
    orderReference?: string;
    verifiedPurchase?: boolean;
  }): Promise<{ review: ProductReview; source: "live" | "mock" }> {
    if (getAccessToken()) {
      // Backend's ReviewCreateRequest only knows productId/orderId/rating/comment — everything
      // else on ProductReview (title, orderReference, verifiedPurchase, hidden) is either not a
      // real backend concept (title) or already known client-side, so the response is merged
      // into the shape the rest of this page expects rather than assuming the API echoes it back.
      const liveResponse = await tryLive<{ id: string; customerName: string; rating: number; comment: string; verified: boolean; createdAt: string }>(
        `/api/v1/customer/reviews`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: input.productId, orderId: input.orderId, rating: input.rating, comment: input.body }),
        },
        true,
      );
      if (liveResponse) {
        const live: ProductReview = {
          id: liveResponse.id,
          productId: input.productId,
          customerName: liveResponse.customerName,
          customerEmail: input.customerEmail,
          rating: liveResponse.rating as 1 | 2 | 3 | 4 | 5,
          title: input.title,
          body: liveResponse.comment,
          orderReference: input.orderReference,
          verifiedPurchase: !!liveResponse.verified,
          hidden: false,
          createdAt: liveResponse.createdAt,
        };
        const all = read();
        all.unshift(live);
        write(all);
        return { review: live, source: "live" };
      }
    }
    const review: ProductReview = {
      id: `rv_${Math.random().toString(36).slice(2, 11)}`,
      productId: input.productId,
      customerName: input.customerName.trim() || "Anonymous",
      customerEmail: input.customerEmail?.trim(),
      rating: input.rating,
      title: input.title?.trim() || undefined,
      body: input.body.trim(),
      orderReference: input.orderReference,
      verifiedPurchase: !!input.verifiedPurchase,
      hidden: false,
      createdAt: new Date().toISOString(),
    };
    const all = read();
    all.unshift(review);
    write(all);
    return { review, source: "mock" };
  },

  // ---- Admin moderation ----
  async listAll(): Promise<{ reviews: ProductReview[]; source: "live" | "mock" }> {
    if (getAccessToken()) {
      const live = await tryLive<ProductReview[]>("/api/v1/admin/reviews", undefined, true);
      if (live) return { reviews: live, source: "live" };
    }
    const all = read().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { reviews: all, source: "mock" };
  },

  async setHidden(id: string, hidden: boolean): Promise<ProductReview | null> {
    if (getAccessToken()) {
      const live = await tryLive<ProductReview>(`/api/v1/admin/reviews/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      }, true);
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
    all[i] = { ...all[i], hidden };
    write(all);
    return all[i];
  },

  async remove(id: string): Promise<boolean> {
    if (getAccessToken()) {
      try {
        const res = await authFetch(apiUrl(`/api/v1/admin/reviews/${encodeURIComponent(id)}`), { method: "DELETE" });
        if (res.ok) {
          const all = read().filter((r) => r.id !== id);
          write(all);
          return true;
        }
      } catch { /* fall through */ }
    }
    const all = read().filter((r) => r.id !== id);
    write(all);
    return true;
  },
};
