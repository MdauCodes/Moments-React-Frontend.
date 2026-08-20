import { useRef, useState } from "react";
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
  // Opened synchronously on click, before the (async) fetch — calling window.open() AFTER an
  // await is no longer treated as a direct response to the user's click by most browsers' popup
  // blockers, so it silently never appeared. Found live: staff clicking this got nothing, no
  // error, no new tab. Same fix as orders.track.tsx's document downloads.
  const pendingWindow = useRef<Window | null>(null);

  function handleClick() {
    pendingWindow.current?.close();
    pendingWindow.current = window.open("", "_blank", "noopener");
    void generateAndShow();
  }

  async function generateAndShow() {
    setBusy(true);
    try {
      const blob = await fetchDeliveryNote(orderId);
      const url = URL.createObjectURL(blob);
      if (pendingWindow.current) {
        pendingWindow.current.location.href = url;
      } else {
        window.open(url, "_blank", "noopener");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      pendingWindow.current?.close();
      reportAdminError(err, "Failed to generate delivery note");
    } finally {
      setBusy(false);
      pendingWindow.current = null;
    }
  }

  return (
    <button
      type="button"
      className="admin-btn admin-btn-ghost"
      style={{ fontSize: 12 }}
      disabled={busy}
      onClick={handleClick}
      title="Print this and attach it to the parcel before handoff"
    >
      {busy ? <Loader2 size={13} className="mr-1 animate-spin inline" /> : <FileText size={13} className="mr-1 inline" />}
      Delivery note
    </button>
  );
}
