import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckoutRatingCard, type CheckoutRatingState } from "@/components/CheckoutFeedbackCards";
import { useOpenWhenClear } from "@/hooks/useOpenWhenClear";
import { holdCookieBanner } from "@/lib/cookieConsent";
import { recordPromptShown } from "@/lib/engagementSignals";
import { openGoogleReview } from "@/lib/googleReview";

const SHOWN_PREFIX = "mpk_after_payment_review:";
const OPEN_DELAY_MS = 3_000;

function alreadyShown(reference: string): boolean {
  try {
    return window.localStorage.getItem(SHOWN_PREFIX + reference) !== null;
  } catch {
    return false;
  }
}

function markShown(reference: string) {
  try {
    window.localStorage.setItem(SHOWN_PREFIX + reference, "1");
  } catch {
    /* storage unavailable — at worst it opens again on a reload */
  }
}

/**
 * The pop-up a few seconds after the order-confirmation thank-you: how checking out went (stars,
 * with a comment box for 3 or less), then a Google review offered to everyone whatever they rated
 * (Google forbids asking only the happy ones). It opens once per order reference, only once the
 * order has loaded and nothing else is on screen, and stamps the engagement clock on open and
 * close so the guest "create an account" prompt waits its usual gap instead of following straight
 * after. The same rating and Google button stay on the page once it is closed (`rating` is shared
 * with the page's card).
 */
export function AfterPaymentReviewDialog({
  reference,
  ready,
  rating,
}: {
  reference: string;
  ready: boolean;
  rating: CheckoutRatingState;
}) {
  const [open, setOpen] = useState(false);
  const clear = useOpenWhenClear(ready && !open && !alreadyShown(reference), OPEN_DELAY_MS);

  useEffect(() => {
    if (!clear) return;
    markShown(reference);
    recordPromptShown();
    setOpen(true);
  }, [clear, reference]);

  useEffect(() => {
    if (!open) return;
    return holdCookieBanner();
  }, [open]);

  function close() {
    setOpen(false);
    recordPromptShown();
  }

  async function google() {
    await openGoogleReview();
    toast.success("Google's review window is open. Choose your stars and tap Post.");
    close();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-sm rounded-2xl border-border bg-background p-6 text-center">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="font-display text-2xl font-medium text-foreground">
            Thank you for your order
          </DialogTitle>
          <DialogDescription>One quick question before you go.</DialogDescription>
        </DialogHeader>

        <CheckoutRatingCard reference={reference} state={rating} bare />

        <div className="border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            A short Google review, now or once your order arrives, helps other businesses find us.
          </p>
          <button
            type="button"
            onClick={() => void google()}
            className="mt-3 w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Review us on Google
          </button>
        </div>

        <button
          type="button"
          onClick={close}
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          {rating.rating > 0 ? "Done" : "Not now"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
