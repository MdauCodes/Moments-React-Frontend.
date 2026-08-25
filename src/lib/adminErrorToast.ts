import { toast } from "sonner";
import { ApiError } from "@/services/adminApi";

// Mdau's WhatsApp — admins forward error reports here for triage.
const DEVELOPER_WHATSAPP = "254796814154";

function explainWhy(status: number | undefined, code: string | undefined): string {
  if (code === "VALIDATION_FAILED") return "The data didn't pass a validation check — check the highlighted fields.";
  if (status === 401) return "Your session has expired — sign in again.";
  if (status === 403) return "You don't have permission to do this.";
  if (status === 409) return "This conflicts with something that already exists.";
  if (status && status >= 500) return "The server hit an internal error — this is a bug, not something you did wrong.";
  return "An unexpected error occurred.";
}

/**
 * Rich, actionable admin error toast — replaces bare "Something went wrong" messages.
 * Shows what failed, why (where known), and a long-lived "Forward to Developer" button
 * that opens WhatsApp with a pre-filled report (message, status, code, traceId) so an
 * admin can escalate a real bug in one tap instead of describing it from memory.
 */
export function reportAdminError(err: unknown, context: string): void {
  const message = err instanceof Error ? err.message : "Something went wrong";
  const status = err instanceof ApiError ? err.status : undefined;
  const code = err instanceof ApiError ? err.code : undefined;
  const traceId = err instanceof ApiError ? err.traceId : undefined;
  const why = explainWhy(status, code);

  const whatsappText = [
    "Moments admin dashboard error report",
    `Where: ${context}`,
    `What: ${message}`,
    status ? `Status: ${status}` : null,
    code ? `Code: ${code}` : null,
    traceId ? `Trace ID: ${traceId}` : null,
    `When: ${new Date().toLocaleString("en-KE")}`,
  ]
    .filter(Boolean)
    .join("\n");

  toast.error(context, {
    description: `${message} — ${why}`,
    duration: 30000,
    action: {
      label: "Forward to Developer",
      onClick: () => {
        window.open(`https://wa.me/${DEVELOPER_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`, "_blank", "noopener,noreferrer");
      },
    },
  });
}

/**
 * TumaBoda booking failed for this order (see Order.tumabodaBookingFailureReason on the
 * backend) — a business-logic failure embedded in an otherwise-200 response, not a thrown
 * error, so it doesn't go through reportAdminError's err-based path above. Same loud,
 * hard-to-miss shape (long duration + WhatsApp escalation): a rider genuinely will not show up
 * for this order until someone retries the booking.
 */
export function reportTumaBodaBookingFailure(reference: string, reason: string): void {
  const whatsappText = [
    "Moments admin dashboard error report",
    `Where: TumaBoda delivery booking — order ${reference}`,
    `What: ${reason}`,
    `When: ${new Date().toLocaleString("en-KE")}`,
  ].join("\n");

  toast.error(`TumaBoda booking failed — ${reference}`, {
    description: `${reason} — no rider has been summoned for this order. Retry from the order detail page.`,
    duration: 30000,
    action: {
      label: "Forward to Developer",
      onClick: () => {
        window.open(`https://wa.me/${DEVELOPER_WHATSAPP}?text=${encodeURIComponent(whatsappText)}`, "_blank", "noopener,noreferrer");
      },
    },
  });
}
