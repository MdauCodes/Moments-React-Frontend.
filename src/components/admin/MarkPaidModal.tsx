import { useState } from "react";
import { Loader2 } from "lucide-react";
import { formatKes } from "@/components/admin/commerceUi";

/** Replaces the old window.confirm() for resolving a stuck payment — requires a real M-Pesa
 *  reference before submitting, both so the audit trail (Order status-change log, enriched with
 *  amount) is actually checkable later, and so a staff member can't click through on autopilot
 *  the way a browser confirm() invites. */
export function MarkPaidModal({
  orderReference,
  amount,
  busy,
  onConfirm,
  onCancel,
}: {
  orderReference: string;
  amount: number;
  busy: boolean;
  onConfirm: (referenceNote: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div
        className="admin-modal"
        style={{ maxWidth: 460 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: 0, fontSize: 16 }}>Mark {orderReference} as paid?</h3>
        <p style={{ fontSize: 13, color: "var(--admin-muted)", marginTop: 8 }}>
          Confirm <b>{formatKes(amount)}</b> was actually received — check the customer's M-Pesa
          confirmation message first. This is logged with your name, the amount, and the note
          below.
        </p>
        <label style={{ display: "block", marginTop: 14, fontSize: 12, fontWeight: 600 }}>
          M-Pesa reference / confirmation note (required)
          <textarea
            className="admin-input"
            style={{ width: "100%", minHeight: 64, marginTop: 6, resize: "vertical" }}
            placeholder="e.g. M-Pesa code SGH7X2K9QP, confirmed with customer via WhatsApp"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
        </label>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button className="admin-btn admin-btn-ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="admin-btn admin-btn-primary"
            disabled={busy || trimmed.length === 0}
            onClick={() => onConfirm(trimmed)}
          >
            {busy ? <Loader2 size={14} className="mr-1 animate-spin inline" /> : null}
            Confirm paid
          </button>
        </div>
      </div>
    </div>
  );
}
