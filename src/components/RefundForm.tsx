import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useSiteConfig } from "@/contexts/SiteConfigContext";
import type { RefundDesiredAction } from "@/services/refundStore";

/** Shared by the logged-in account order page and the guest track-order page — same form,
 *  same policy framing, just a different submit handler underneath. */
export function RefundForm({
  onCancel,
  onSubmit,
  daysRemaining,
}: {
  onCancel: () => void;
  onSubmit: (reason: string, desiredAction: RefundDesiredAction) => Promise<void>;
  daysRemaining: number;
}) {
  const [reason, setReason] = useState("");
  const [desiredAction, setDesiredAction] = useState<RefundDesiredAction>("REFUND");
  const [submitting, setSubmitting] = useState(false);
  const { companyPhone, whatsappNumber } = useSiteConfig();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) {
      toast.error("Please describe the issue (at least 10 characters)");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(reason.trim(), desiredAction);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-border bg-card p-5">
      <p className="font-display text-lg">Request a refund or replacement</p>
      <p className="mt-1 text-xs text-muted-foreground">
        You have {daysRemaining} day{daysRemaining === 1 ? "" : "s"} left in the 14-day return window.
      </p>
      <div className="mt-4 grid gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preferred resolution</label>
        <div className="flex flex-wrap gap-2">
          {(["REFUND", "REPLACE", "STORE_CREDIT"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setDesiredAction(opt)}
              className={`rounded-full border px-4 py-1.5 text-xs ${
                desiredAction === opt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"
              }`}
            >
              {opt === "REFUND" ? "Refund" : opt === "REPLACE" ? "Replacement" : "Store credit"}
            </button>
          ))}
        </div>
        <textarea
          required
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          placeholder="Tell us what went wrong (damaged, wrong item, late delivery, …)"
          className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-xs hover:bg-secondary">Cancel</button>
        <button type="submit" disabled={submitting} className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit request"}
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
