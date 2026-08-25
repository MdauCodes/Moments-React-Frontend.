import { useState } from "react";
import { toast } from "sonner";
import { Section, Row } from "@/components/admin/AdminSectionUi";
import { formatDate } from "@/components/admin/commerceUi";
import { overrideDeliveryConfirmation } from "@/services/commerceApi";
import { reportAdminError } from "@/lib/adminErrorToast";
import { useAuth } from "@/contexts/AdminAuthContext";
import { resolveStaffRole, STAFF_ROLE_RANK } from "@/lib/roles";
import type { OrderRecord } from "@/services/commerceMock";

/**
 * Shared by TumaBodaFulfillmentPanel and ManualDeliveryFulfillmentPanel — Pickup has no
 * customer self-confirm step at all (face-to-face handoff is already the verification), so this
 * is never rendered there.
 *
 * Two ways an unconfirmed delivery gets resolved here, deliberately in this order:
 * 1. Read the customer their receipt code over the phone (having confirmed who you're speaking
 *    to some other way) so they still complete a genuine OTP+code self-confirmation themselves.
 * 2. Only if that's not possible — a true staff override, admin-only, gated on a mandatory note
 *    explaining how receipt was actually confirmed. Never a bare click; see
 *    OrderService.overrideDeliveryConfirmation's Javadoc for the full reasoning.
 */
export function DeliveryConfirmationSection({
  order,
  onOrderUpdated,
}: {
  order: OrderRecord;
  onOrderUpdated: (order: OrderRecord) => void;
}) {
  const o = order as OrderRecord & Record<string, any>;
  const { user } = useAuth();
  const isAdmin = (() => {
    const role = resolveStaffRole(user);
    return !!role && STAFF_ROLE_RANK[role] <= STAFF_ROLE_RANK.ADMIN;
  })();
  const [showOverride, setShowOverride] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleOverride() {
    if (!note.trim()) {
      toast.error("Explain how you confirmed the customer received this order");
      return;
    }
    setBusy(true);
    try {
      const { order: updated } = await overrideDeliveryConfirmation(order.id, note.trim());
      if (updated) {
        onOrderUpdated(updated);
        toast.success("Delivery confirmed (staff override)");
        setShowOverride(false);
        setNote("");
      }
    } catch (err) {
      reportAdminError(err, "Failed to override delivery confirmation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Customer confirmation">
      {o.customerConfirmedDeliveredAt ? (
        <Row label="Confirmed by customer" value={formatDate(o.customerConfirmedDeliveredAt)} />
      ) : (
        <>
          <div className="text-sm text-muted-foreground">
            Not yet confirmed by the customer on the track-order page.
          </div>

          {o.deliveryVerificationCode && (
            <div className="mt-2 rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs">
              Lost their receipt? After confirming who you're speaking to, read them this code —
              they still enter it themselves on the track-order page:{" "}
              <span className="font-mono font-semibold tracking-widest">{o.deliveryVerificationCode}</span>
            </div>
          )}

          {isAdmin && (
            <div className="mt-3">
              {!showOverride ? (
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => setShowOverride(true)}
                >
                  Override — mark delivered without customer confirmation
                </button>
              ) : (
                <div className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-xs font-medium text-destructive">
                    Only use this if you've genuinely confirmed receipt some other way — never a guess.
                  </p>
                  <textarea
                    className="admin-input mt-2 w-full"
                    rows={2}
                    placeholder="How did you confirm this? e.g. Phoned customer 14:20, confirmed received at gate."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={busy}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      disabled={busy || !note.trim()}
                      onClick={() => void handleOverride()}
                    >
                      {busy ? "Confirming…" : "Confirm override"}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      disabled={busy}
                      onClick={() => {
                        setShowOverride(false);
                        setNote("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
