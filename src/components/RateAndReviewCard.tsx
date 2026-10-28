import { useState } from "react";
import { Check, Star } from "lucide-react";
import { toast } from "sonner";
import { checkoutFeedbackStore } from "@/services/checkoutFeedbackStore";
import { openGoogleReview } from "@/lib/googleReview";

/** The thank-you page's one review card: a star tap rates us on our own site, and one more tap
 *  saves the customer's comment, copies it and opens Google's review form beside the page.
 *  The Google button is offered for every rating (Google forbids inviting only happy customers). */
export function RateAndReviewCard({ reference }: { reference: string }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [commentSaved, setCommentSaved] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = hover ?? rating;
  const unhappy = rating > 0 && rating <= 3;

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

  async function saveComment() {
    if (!comment.trim() || commentSaved) return;
    if (await save(rating, comment)) setCommentSaved(true);
  }

  async function postOnGoogle() {
    setBusy(true);
    try {
      // Keep the words on our side too, then hand them to Google.
      if (rating > 0) await saveComment();
      const { copied } = await openGoogleReview(comment);
      toast.success(
        copied
          ? "Your comment is copied — paste it into the Google window, pick your stars and tap Post."
          : "Google's review window is open — pick your stars and tap Post.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-3xl border-2 border-accent/40 bg-accent/10 p-6 text-center">
      <h2 className="font-display text-xl">How was shopping with us?</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Tap the stars. It takes a second and helps us improve.
      </p>
      <div className="mt-3 flex justify-center gap-1" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => {
              setRating(n);
              setCommentSaved(false);
              void save(n, comment.trim() || undefined);
            }}
            className="rounded-full p-1 transition-transform hover:scale-110"
          >
            <Star
              className={`h-9 w-9 ${n <= shown ? "fill-accent text-accent" : "text-foreground/25"}`}
            />
          </button>
        ))}
      </div>

      {rating > 0 && !error && (
        <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" /> Thanks, your rating is saved
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-destructive">Couldn't save that — please tap again.</p>
      )}

      {rating > 0 && (
        <div className="mx-auto mt-4 max-w-sm text-left">
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setCommentSaved(false);
            }}
            maxLength={1000}
            placeholder={
              unhappy
                ? "Sorry about that — what could we do better?"
                : "What did you like? (optional)"
            }
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              disabled={busy}
              onClick={() => void postOnGoogle()}
              className={`flex-1 rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60 ${
                unhappy
                  ? "border border-border bg-background hover:bg-muted"
                  : "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
              }`}
            >
              {comment.trim() ? "Post it on Google too" : "Review us on Google too"}
            </button>
            {comment.trim() && (
              <button
                type="button"
                disabled={commentSaved}
                onClick={() => void saveComment()}
                className={`flex-1 rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-60 ${
                  unhappy
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                    : "border border-border bg-background hover:bg-muted"
                }`}
              >
                {commentSaved ? "Sent" : "Send to Moments"}
              </button>
            )}
          </div>
        </div>
      )}

      {rating === 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void postOnGoogle()}
          className="mt-3 text-xs text-muted-foreground underline hover:text-foreground"
        >
          Or go straight to Google reviews
        </button>
      )}
    </div>
  );
}
