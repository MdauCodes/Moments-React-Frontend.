import { useMemo, useState, type FormEvent } from "react";
import { Star } from "lucide-react";

/** Compact rating + comment form for the order/delivery experience itself — separate from
 *  product reviews. Shown once on a delivered order's own detail page, hidden again once
 *  submitted (see account.orders.$reference.tsx). */
export function OrderReviewForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (rating: 1 | 2 | 3 | 4 | 5, comment: string) => Promise<void>;
}) {
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const display = useMemo(() => hoverRating ?? rating, [hoverRating, rating]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(rating, comment.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-border bg-card p-5">
      <p className="font-display text-lg">How was your order and delivery experience?</p>
      <div className="mt-3 flex items-center gap-1.5">
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
      <textarea
        rows={3}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        placeholder="Anything about the order or delivery worth telling us? (optional)"
        className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-xs hover:bg-secondary">Cancel</button>
        <button type="submit" disabled={submitting} className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit feedback"}
        </button>
      </div>
    </form>
  );
}
