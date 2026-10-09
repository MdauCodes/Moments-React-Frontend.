import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openGoogleReview } from "@/lib/googleReview";

/** One-tap invitation to review Moments Packaging on Google. Shown to every customer regardless
 *  of how they rated the order (Google forbids inviting only the happy ones). The dialog keeps the
 *  customer on our site while the Google form opens in a window beside it. */
export function GoogleReviewPrompt({
  initialComment = "",
  variant = "card",
}: {
  initialComment?: string;
  variant?: "card" | "link";
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState(initialComment);
  const [busy, setBusy] = useState(false);

  async function handleOpen() {
    setBusy(true);
    try {
      const { copied } = await openGoogleReview(comment);
      toast.success(
        copied
          ? "Your comment is copied — paste it into the Google window and tap Post."
          : "Google's review window is open — choose your stars and tap Post.",
      );
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {variant === "card" ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15">
              <Star className="h-5 w-5 fill-accent text-accent" />
            </span>
            <div>
              <p className="text-sm font-semibold">Enjoyed shopping with us?</p>
              <p className="text-xs text-muted-foreground">
                A quick Google review helps other businesses find us.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Review us on Google
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Loved shopping with us? Review us on Google
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Review Moments Packaging on Google</DialogTitle>
            <DialogDescription>
              Write a line or two below, and we will copy it for you. Google opens in a small
              window beside this page — just paste, pick your stars and tap Post.
            </DialogDescription>
          </DialogHeader>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
            placeholder="What did you like? (optional)"
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleOpen()}
            className="w-full rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {comment.trim() ? "Copy my comment & open Google" : "Open Google reviews"}
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
