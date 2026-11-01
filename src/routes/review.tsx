import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Check, Star } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { GoogleReviewPrompt } from "@/components/GoogleReviewPrompt";
import { apiUrl } from "@/config/api";

interface ProductRow {
  productId: string;
  productName: string;
  rating?: number | null;
  comment?: string | null;
}

interface ReviewContext {
  reference: string;
  firstName: string;
  eligible: boolean;
  orderRating?: number | null;
  orderComment?: string | null;
  products: ProductRow[];
}

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Could not save your review");
}

function Stars({
  value,
  onPick,
  size = "h-10 w-10",
}: {
  value: number;
  onPick: (n: number) => void;
  size?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div className="flex items-center justify-center gap-1" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onPick(n)}
          onMouseEnter={() => setHover(n)}
          className="rounded-full p-1 transition-transform hover:scale-110"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
        >
          <Star className={`${size} ${n <= shown ? "fill-accent text-accent" : "text-foreground/25"}`} />
        </button>
      ))}
    </div>
  );
}

function ProductRating({
  row,
  reference,
  token,
}: {
  row: ProductRow;
  reference: string;
  token: string;
}) {
  const [rating, setRating] = useState(row.rating ?? 0);
  const [comment, setComment] = useState(row.comment ?? "");
  const [saved, setSaved] = useState(!!row.rating);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function save(nextRating: number, nextComment?: string) {
    setSaving(true);
    setError(false);
    try {
      await post(`/api/v1/public/order-reviews/${encodeURIComponent(reference)}/product`, {
        token,
        productId: row.productId,
        rating: nextRating,
        comment: nextComment,
      });
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{row.productName}</p>
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5" /> Saved
          </span>
        )}
      </div>
      <div className="mt-2">
        <Stars
          value={rating}
          size="h-7 w-7"
          onPick={(n) => {
            setRating(n);
            void save(n);
          }}
        />
      </div>
      {rating > 0 && (
        <div className="mt-2 flex gap-2">
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder="Add a few words about it (optional)"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            disabled={saving || !comment.trim()}
            onClick={() => void save(rating, comment)}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50"
          >
            Save
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive">Couldn't save that — please try again.</p>}
    </li>
  );
}

/** Account-free review page reached from the review-request email. Opening it from a star in the
 *  email already carries that rating (?rating=n), which is saved immediately — one tap from the
 *  inbox is a complete rating. Everything after that (comment, Google, per-product stars) is
 *  optional and each step saves on its own. */
export default function ReviewPage() {
  const { reference = "" } = useParams<{ reference: string }>();
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";
  const preRating = Number(params.get("rating")) || 0;

  const [ctx, setCtx] = useState<ReviewContext | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [commentSaved, setCommentSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const autoSubmitted = useRef(false);

  const saveOrder = useCallback(
    async (n: number, text?: string) => {
      setSaving(true);
      setError(false);
      try {
        await post(`/api/v1/public/order-reviews/${encodeURIComponent(reference)}/order`, {
          token,
          rating: n,
          comment: text,
        });
        return true;
      } catch {
        setError(true);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [reference, token],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          apiUrl(`/api/v1/public/order-reviews/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`),
        );
        if (!res.ok) throw new Error("invalid");
        const data = (await res.json()) as ReviewContext;
        if (cancelled) return;
        setCtx(data);
        setRating(data.orderRating ?? 0);
        setComment(data.orderComment ?? "");
        setCommentSaved(!!data.orderComment);
        setState("ready");
        if (data.eligible && preRating >= 1 && preRating <= 5 && !data.orderRating && !autoSubmitted.current) {
          autoSubmitted.current = true;
          setRating(preRating);
          void saveOrder(preRating);
        }
      } catch {
        if (!cancelled) setState("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reference, token, preRating, saveOrder]);

  const low = rating > 0 && rating <= 3;

  return (
    <SiteLayout>
      <section className="mx-auto max-w-xl px-5 py-12 lg:py-16">
        {state === "loading" && <p className="text-center text-sm text-muted-foreground">Loading…</p>}

        {state === "invalid" && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <h1 className="font-display text-2xl">This review link isn't valid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              It may have been copied incompletely. You can still reach us from the contact page.
            </p>
            <Link to="/" className="mt-5 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
              Back to the shop
            </Link>
          </div>
        )}

        {state === "ready" && ctx && !ctx.eligible && (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <h1 className="font-display text-2xl">Not quite yet</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Order {ctx.reference} can be reviewed once it has been delivered or collected.
            </p>
          </div>
        )}

        {state === "ready" && ctx && ctx.eligible && (
          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 text-center sm:p-8">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Order {ctx.reference}</p>
              <h1 className="mt-1 font-display text-2xl">
                {ctx.firstName ? `Hi ${ctx.firstName}, how did we do?` : "How did we do?"}
              </h1>
              <div className="mt-4">
                <Stars
                  value={rating}
                  onPick={(n) => {
                    setRating(n);
                    void saveOrder(n);
                  }}
                />
              </div>
              {rating > 0 && !error && (
                <p className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Thanks — your rating is saved"}
                </p>
              )}
              {error && <p className="mt-2 text-xs text-destructive">Couldn't save that — please tap again.</p>}

              {rating > 0 && (
                <div className="mt-5 text-left">
                  <label className="text-sm font-semibold">
                    {low ? "We're sorry. What went wrong?" : "What did you like?"}
                  </label>
                  {low && (
                    <p className="text-xs text-muted-foreground">
                      This goes straight to our team and isn't published.
                    </p>
                  )}
                  <textarea
                    rows={3}
                    value={comment}
                    onChange={(e) => {
                      setComment(e.target.value);
                      setCommentSaved(false);
                    }}
                    maxLength={1000}
                    placeholder="Optional"
                    className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                  <div className="mt-2 flex items-center justify-end gap-3">
                    {commentSaved && comment.trim() && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5" /> Saved
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={saving || !comment.trim() || commentSaved}
                      onClick={async () => {
                        if (await saveOrder(rating, comment)) setCommentSaved(true);
                      }}
                      className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Save comment
                    </button>
                  </div>
                </div>
              )}
            </div>

            {rating > 0 && <GoogleReviewPrompt initialComment={low ? "" : comment} />}

            {rating > 0 && ctx.products.length > 0 && (
              <div>
                <h2 className="font-display text-lg">Rate what you bought</h2>
                <p className="text-xs text-muted-foreground">
                  Tap stars for any product — it shows on its page to help other buyers.
                </p>
                <ul className="mt-3 space-y-3">
                  {ctx.products.map((p) => (
                    <ProductRating key={p.productId} row={p} reference={ctx.reference} token={token} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
