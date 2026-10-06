import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useSiteConfig } from "@/contexts/SiteConfigContext";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);

/** Asking us to cancel an order that has already been paid. Shared by the signed-in order page and
 *  the guest track-order page. Says plainly how it works — a request our team answers, the order
 *  carrying on until then, the refund sent by hand — so nobody expects an instant refund. */
export function CancelOrderForm({
  onCancel,
  onSubmit,
  total,
}: {
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
  total: number;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { companyPhone, whatsappNumber } = useSiteConfig();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) {
      toast.error("Please tell us why you'd like to cancel (at least 10 characters)");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send your request right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-border bg-card p-5">
      <p className="font-display text-lg">Cancel this order and ask for a refund</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>You've already paid, so our team cancels it for you — this is a request, not an instant cancel.</li>
        <li>Your order stays active until we confirm. We'll reply within 2 business days.</li>
        <li>If we approve, we cancel the order and send {fmt(total)} back to the M-Pesa number you paid with. Refunds are sent by hand.</li>
        <li>If it's already in production we may not be able to cancel it — we'll tell you either way.</li>
      </ul>
      <textarea
        required
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={1000}
        placeholder="Why would you like to cancel? (e.g. ordered the wrong size)"
        className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-xs hover:bg-secondary">
          Keep my order
        </button>
        <button type="submit" disabled={submitting} className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {submitting ? "Sending…" : "Send cancellation request"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Prefer to talk it through? Call{" "}
        <a href={`tel:+${whatsappNumber}`} className="underline hover:text-foreground">{companyPhone}</a>
        {" "}or{" "}
        <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer" className="underline hover:text-foreground">WhatsApp us</a>.
      </p>
    </form>
  );
}
