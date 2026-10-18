import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Check, Star } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useOpenWhenClear } from "@/hooks/useOpenWhenClear";
import { holdCookieBanner } from "@/lib/cookieConsent";
import { recordPromptShown } from "@/lib/engagementSignals";
import { signupFeedbackStore } from "@/services/signupFeedbackStore";

/**
 * "How easy was creating your account?" — asked once, just after signing up, and kept on our side.
 *
 * It deliberately has no Google review link: signup comes with 1,000 Reward Coupons and no
 * purchase yet, and Google does not allow reviews tied to a reward or from someone who has not
 * used the business. The Google ask comes later, after an order.
 *
 * Both signup flows (the register page and the sign-in modal) land with `justRegistered` in router
 * state; that arms a session flag here, so if signup returned the customer to the cart or checkout
 * the question simply waits for the next ordinary page in the same visit. It is asked at most once
 * per browser, only while signed in, and only when nothing else is on screen (useOpenWhenClear).
 */

const PENDING_KEY = "mpk_signup_rating_pending";
const ASKED_KEY = "mpk_signup_rating_asked";
const OPEN_DELAY_MS = 2_500;
const SKIP_PREFIXES = [
  "/admin",
  "/staff",
  "/cart",
  "/checkout",
  "/login",
  "/account/login",
  "/account/register",
  "/order-confirmation",
  "/orders/track",
];

function readFlag(storage: () => Storage, key: string): boolean {
  try {
    return storage().getItem(key) !== null;
  } catch {
    return false;
  }
}

function writeFlag(storage: () => Storage, key: string, on: boolean) {
  try {
    if (on) storage().setItem(key, "1");
    else storage().removeItem(key);
  } catch {
    /* storage unavailable — at worst the question is asked once more or not at all */
  }
}

const session = () => window.sessionStorage;
const local = () => window.localStorage;

export function SignupRatingPrompt() {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const justRegistered = Boolean(
    (location.state as { justRegistered?: boolean } | null)?.justRegistered,
  );

  const [pending, setPending] = useState(() => readFlag(session, PENDING_KEY));
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (justRegistered && !readFlag(local, ASKED_KEY)) {
      writeFlag(session, PENDING_KEY, true);
      setPending(true);
    }
  }, [justRegistered]);

  const { pathname, search } = location;
  const allowedHere =
    !SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) &&
    !new URLSearchParams(search).has("qr");
  const ready = useOpenWhenClear(pending && isAuthenticated && allowedHere && !open, OPEN_DELAY_MS);

  useEffect(() => {
    if (!ready) return;
    writeFlag(local, ASKED_KEY, true);
    writeFlag(session, PENDING_KEY, false);
    setPending(false);
    recordPromptShown();
    setOpen(true);
  }, [ready]);

  useEffect(() => {
    if (!open) return;
    return holdCookieBanner();
  }, [open]);

  async function save(n: number, text?: string) {
    setError(false);
    try {
      await signupFeedbackStore.rate(n, text);
      return true;
    } catch {
      setError(true);
      return false;
    }
  }

  function close() {
    setOpen(false);
    recordPromptShown();
  }

  const shown = hover ?? rating;
  const low = rating > 0 && rating <= 3;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-sm rounded-2xl border-border bg-background p-6 text-center">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="font-display text-2xl font-medium text-foreground">
            How easy was signing up?
          </DialogTitle>
          <DialogDescription>
            Your answer goes only to our team and helps us make it easier for the next customer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-1" onMouseLeave={() => setHover(null)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onMouseEnter={() => setHover(n)}
              onClick={() => {
                setRating(n);
                setSent(false);
                void save(n);
              }}
              className="rounded-full p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`h-9 w-9 ${n <= shown ? "fill-accent text-accent" : "text-foreground/25"}`}
              />
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-destructive">Couldn't save that. Please tap again.</p>}

        {low && !error && (
          <div className="space-y-2 text-left">
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setSent(false);
              }}
              maxLength={1000}
              placeholder="Sorry about that. What got in the way?"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              type="button"
              disabled={!comment.trim() || sent}
              onClick={async () => {
                if (await save(rating, comment)) setSent(true);
              }}
              className="w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {sent ? "Sent, thank you" : "Send"}
            </button>
          </div>
        )}

        {rating > 3 && !error && (
          <p className="inline-flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <Check className="h-4 w-4" /> Thanks, glad it was easy.
          </p>
        )}

        <button
          type="button"
          onClick={close}
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          {rating > 0 ? "Done" : "Not now"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
