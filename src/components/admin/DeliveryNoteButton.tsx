import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { fetchDeliveryNote } from "@/services/commerceApi";
import { reportAdminError } from "@/lib/adminErrorToast";

/**
 * Opens the delivery note in a new tab for printing — the document that actually carries the
 * verification QR/code (see DeliveryNotePdfService). Deliberately a manual, on-demand action
 * rather than something auto-generated on dispatch: staff print and physically attach it to the
 * parcel at whatever point in packing suits them, and may need to reprint if the first copy is
 * damaged before handoff.
 */
export function DeliveryNoteButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const blob = await fetchDeliveryNote(orderId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      reportAdminError(err, "Failed to generate delivery note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className="admin-btn admin-btn-ghost"
      style={{ fontSize: 12 }}
      disabled={busy}
      onClick={() => void handleClick()}
      title="Print this and attach it to the parcel before handoff"
    >
      {busy ? <Loader2 size={13} className="mr-1 animate-spin inline" /> : <FileText size={13} className="mr-1 inline" />}
      Delivery note
    </button>
  );
}
