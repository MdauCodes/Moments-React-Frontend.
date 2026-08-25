import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { InlineProgress } from "@/components/InlineProgress";
import { accountPrivacyStore } from "@/services/accountPrivacyStore";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

/**
 * Right of access / portability + right to erasure (ODPC / Data Protection Act, 2019). Both
 * requests are queued for admin review — see ChangeRequestService/AccountDeletionService on the
 * backend. Deletion additionally requires an OTP before it's even queued, since it's the one
 * irreversible-once-approved action here. Self-contained styling (not dependent on either
 * dashboard's own card wrapper) so it's shared between the Individual Shopper profile page and
 * the Business Account dashboard rather than forked per page.
 */
export function PrivacyDataSection() {
  const [exporting, setExporting] = useState(false);
  const [deleteStage, setDeleteStage] = useState<"idle" | "otp-sent" | "pending" | "requesting" | "confirming">("idle");
  const [otp, setOtp] = useState("");

  async function requestExport() {
    setExporting(true);
    try {
      const { message } = await accountPrivacyStore.requestDataExport();
      toast.success(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request data export.");
    } finally {
      setExporting(false);
    }
  }

  async function requestDeletion() {
    setDeleteStage("requesting");
    try {
      const { message } = await accountPrivacyStore.requestDeletion();
      toast.success(message);
      setDeleteStage("otp-sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to request account deletion.");
      setDeleteStage("idle");
    }
  }

  async function confirmDeletion(e: React.FormEvent) {
    e.preventDefault();
    if (otp.trim().length !== 6) return;
    setDeleteStage("confirming");
    try {
      const { message } = await accountPrivacyStore.confirmDeletion(otp.trim());
      toast.success(message);
      setDeleteStage("pending");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid or expired code.");
      setDeleteStage("otp-sent");
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-background/40 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Privacy & data</p>
      </div>
      <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-medium text-foreground">Download your data</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Get a copy of everything we hold about you — profile, orders, wishlist, business account and enquiries.
          </p>
          <button
            type="button"
            onClick={requestExport}
            disabled={exporting}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
          >
            {exporting && <InlineProgress size="sm" />} Request my data
          </button>
        </div>

        <div>
          <p className="text-sm font-medium text-destructive">Delete your account</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Permanently deletes your account and personal data after a 14-day grace period, once approved.
          </p>
          {deleteStage === "idle" && (
            <button
              type="button"
              onClick={requestDeletion}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-destructive/40 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/5"
            >
              Request account deletion
            </button>
          )}
          {deleteStage === "requesting" && (
            <span className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground"><InlineProgress size="sm" /> Sending code…</span>
          )}
          {(deleteStage === "otp-sent" || deleteStage === "confirming") && (
            <form onSubmit={confirmDeletion} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                className={inputCls}
                style={{ maxWidth: 130 }}
                placeholder="6-digit code"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              />
              <button
                type="submit"
                disabled={deleteStage === "confirming" || otp.trim().length !== 6}
                className="inline-flex items-center gap-2 rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {deleteStage === "confirming" && <InlineProgress size="sm" />} Confirm
              </button>
            </form>
          )}
          {deleteStage === "pending" && (
            <p className="mt-3 text-xs text-muted-foreground">Submitted for admin review — you'll get an email once it's approved.</p>
          )}
        </div>
      </div>
    </div>
  );
}
