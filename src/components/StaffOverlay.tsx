import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STAFF_OVERLAY_TEXT } from "@/lib/staffLink";

/**
 * The staff overlay (handover doc 18 §16): shown instead of a staff sign-in form. With `onClose`
 * it can be dismissed (customer login); without it the dialog stays until the person leaves.
 */
export function StaffOverlay({
  onClose,
  leaveHref = "/",
}: {
  onClose?: () => void;
  leaveHref?: string;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      <DialogContent
        hideCloseButton={!onClose}
        className="w-[calc(100vw-2rem)] max-w-md rounded-2xl"
      >
        <DialogHeader>
          <DialogTitle>Staff sign-in</DialogTitle>
          <DialogDescription>{STAFF_OVERLAY_TEXT}</DialogDescription>
        </DialogHeader>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            OK
          </button>
        ) : (
          <a
            href={leaveHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Back to website
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
