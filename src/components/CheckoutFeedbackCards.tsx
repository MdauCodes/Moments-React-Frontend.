import { useState } from "react";
import { Check, Star } from "lucide-react";
import { checkoutFeedbackStore, FAILED_REASONS } from "@/services/checkoutFeedbackStore";

/** One-tap star rating of the checkout itself, shown under the Google review card. */
export function CheckoutRatingCard({ reference }: { reference: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [commentSaved, setCommentSaved] = useState(false);
  const [error, setError] = useState(false);
  const shown = hover ?? rating;

  async function save(n: number, text?: string) {
    setError(false);
    try {
      await checkoutFeedbackStore.rate(reference, n, text);
      return true;
    } catch {
      setError(true);
      return false;
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-center">
      <p className="text-sm font-semibold">How was checking out today?</p>
      <div className="mt-2 flex justify-center gap-1" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => {
              setRating(n);
              void save(n);
            }}
            className="rounded-full p-1 transition-transform hover:scale-110"
          >
            <Star className={`h-8 w-8 ${n <= shown ? "fill-accent text-accent" : "text-foreground/25"}`} />
          </button>
        ))}
      </div>
      {rating > 0 && !error && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" /> Thanks — that helps us improve
        </p>
      )}
      {error && <p className="mt-1 text-xs text-destructive">Couldn't save that — please tap again.</p>}
      {rating > 0 && rating <= 3 && (
        <div className="mt-3 flex gap-2 text-left">
          <input
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setCommentSaved(false);
            }}
            maxLength={1000}
            placeholder="Sorry about that — what could we do better?"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            disabled={!comment.trim() || commentSaved}
            onClick={async () => {
              if (await save(rating, comment)) setCommentSaved(true);
            }}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {commentSaved ? "Sent" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Shown when a payment did not go through: one tap to say what stopped them. */
export function PaymentFailedFeedback({ reference }: { reference: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function send(reason: string | null, text?: string) {
    setError(false);
    try {
      await checkoutFeedbackStore.paymentFailed(reference, reason ?? undefined, text);
      return true;
    } catch {
      setError(true);
      return false;
    }
  }

  return (
    <div className="mt-6 w-full max-w-md rounded-2xl border border-border bg-card p-4 text-left">
      <p className="text-sm font-semibold">What stopped you? <span className="font-normal text-muted-foreground">(optional)</span></p>
      <div className="mt-2 flex flex-wrap gap-2">
        {FAILED_REASONS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => {
              setPicked(r.value);
              void send(r.value);
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              picked === r.value ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-secondary"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {picked && (
        <div className="mt-3 flex gap-2">
          <input
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setSent(false);
            }}
            maxLength={1000}
            placeholder="Anything else we should know?"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            disabled={!comment.trim() || sent}
            onClick={async () => {
              if (await send(picked, comment)) setSent(true);
            }}
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {sent ? "Sent" : "Send"}
          </button>
        </div>
      )}
      {picked && !error && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" /> Thanks — we'll use this to make paying easier.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">Couldn't save that — you can ignore this and try paying again.</p>}
    </div>
  );
}
