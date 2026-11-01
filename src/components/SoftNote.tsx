import { Info } from "lucide-react";

/** A calm, dismissible message for something the shopper ran into (a coupon limit, a code that
 *  doesn't fit this order). Reads as information, not a failure: no red, no alarm, one button. */
export function SoftNote({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
      <p className="min-w-0 flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 rounded-full border border-amber-300 bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold hover:bg-white"
      >
        Got it
      </button>
    </div>
  );
}
