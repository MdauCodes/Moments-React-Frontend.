import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Star, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { reviewStore, type ProductReview, type ReviewSummary } from "@/services/reviewStore";
import { orderStore, type CustomerOrder } from "@/services/orderStore";
import { useAuth } from "@/contexts/AuthContext";

interface ProductReviewsProps {
  productId: string;
  productName: string;
  /** Slug used for the public endpoints (preferred). Falls back to productId. */
  productSlug?: string;
  /** Called once after load so the parent can inject AggregateRating JSON-LD if desired. */
  onSummary?: (summary: ReviewSummary) => void;
}

export function ProductReviews({ productId, productName, productSlug, onSummary }: ProductReviewsProps) {
  const { user, isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligibleOrderRef, setEligibleOrderRef] = useState<string | null>(null);
  const [eligibleOrderId, setEligibleOrderId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const lookupKey = productSlug ?? productId;

  // Load reviews
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reviewStore.listForProduct(lookupKey).then((res) => {
      if (cancelled) return;
      setReviews(res.reviews);
      setSummary(res.summary);
      onSummary?.(res.summary);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lookupKey, onSummary]);

  // Determine if this user has a DELIVERED order containing this product → eligible to review
  useEffect(() => {
    if (!isAuthenticated) { setEligibleOrderRef(null); setEligibleOrderId(null); return; }
    let cancelled = false;
    orderStore.listMine().then(({ rows }) => {
      if (cancelled) return;
      const match = rows.find((o: CustomerOrder) =>
        o.status === "DELIVERED" && o.items.some((i) => i.productId === productId),
      );
      setEligibleOrderRef(match?.reference ?? null);
      setEligibleOrderId(match?.id ?? null);
    });
    return () => { cancelled = true; };
  }, [isAuthenticated, productId]);

  const ratingFloor = Math.floor(summary?.average ?? 0);

  return (
    <div className="space-y-6">
      {/* Header + summary */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="font-display text-xl">Customer reviews</h3>
          {summary && summary.count > 0 ? (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-5 w-5 ${n <= ratingFloor ? "fill-accent text-accent" : "text-foreground/20"}`}
                  />
                ))}
              </div>
              <span className="font-display text-lg">{summary.average.toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">({summary.count} review{summary.count === 1 ? "" : "s"})</span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No reviews yet — be the first.</p>
          )}
        </div>

        {eligibleOrderRef && !showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Write a review
          </button>
        )}
      </div>

      {/* Histogram */}
      {summary && summary.count > 0 && (
        <div className="grid gap-1.5 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.histogram[star as 1 | 2 | 3 | 4 | 5];
            const pct = summary.count === 0 ? 0 : (count / summary.count) * 100;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="w-6 text-muted-foreground">{star}★</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-8 text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Form */}
      {showForm && eligibleOrderRef && eligibleOrderId && (
        <ReviewForm
          productId={productId}
          productName={productName}
          orderId={eligibleOrderId}
          orderReference={eligibleOrderRef}
          defaultName={user ? `${user.firstName} ${user.lastName}`.trim() : ""}
          defaultEmail={user?.email}
          onCancel={() => setShowForm(false)}
          onSubmitted={(rev, sum) => {
            setReviews((rs) => [rev, ...rs]);
            setSummary(sum);
            onSummary?.(sum);
            setShowForm(false);
          }}
        />
      )}

      {/* List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <div className="flex justify-center gap-1 text-foreground/30">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="h-5 w-5" />
            ))}
          </div>
          <p className="mt-3 font-display text-lg text-foreground">No reviews yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {eligibleOrderRef
              ? "Be the first — share your experience above."
              : "Reviews open up once your order is delivered."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {reviews.map((r) => (
            <li key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{r.customerName}</p>
                    {r.verifiedPurchase && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        <ShieldCheck className="h-3 w-3" /> Verified
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-accent text-accent" : "text-foreground/20"}`} />
                      ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-KE", { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
              {r.title && <p className="mt-3 font-medium text-foreground">{r.title}</p>}
              <p className={`text-sm text-muted-foreground ${r.title ? "mt-1" : "mt-3"}`}>{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface ReviewFormProps {
  productId: string;
  productName: string;
  orderId: string;
  orderReference: string;
  defaultName: string;
  defaultEmail?: string;
  onCancel: () => void;
  onSubmitted: (review: ProductReview, summary: ReviewSummary) => void;
}

function ReviewForm({ productId, productName, orderId, orderReference, defaultName, defaultEmail, onCancel, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [name, setName] = useState(defaultName);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const display = useMemo(() => hoverRating ?? rating, [hoverRating, rating]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (body.trim().length < 10) {
      toast.error("Please write at least 10 characters");
      return;
    }
    setSubmitting(true);
    try {
      const { review } = await reviewStore.submit({
        productId,
        orderId,
        customerName: name,
        customerEmail: defaultEmail,
        rating,
        title: title || undefined,
        body,
        orderReference,
        verifiedPurchase: true,
      });
      const { summary } = await reviewStore.listForProduct(productId);
      toast.success("Review published — thank you!");
      onSubmitted(review, summary);
    } catch {
      toast.error("Could not submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Reviewing: {productName}
      </p>
      <div className="mt-3 flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n as 1 | 2 | 3 | 4 | 5)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(null)}
            className="rounded-full p-1 transition-colors hover:bg-accent/10"
            aria-label={`Rate ${n} stars`}
          >
            <Star className={`h-7 w-7 ${n <= display ? "fill-accent text-accent" : "text-foreground/30"}`} />
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Review title (optional)"
          className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>
      <textarea
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={4}
        placeholder="What did you love? What could be better?"
        className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
      />
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          Posted under your name. Verified to order {orderReference}.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-xs hover:bg-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Publish review"}
          </button>
        </div>
      </div>
    </form>
  );
}
