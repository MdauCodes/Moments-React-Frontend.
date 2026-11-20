import { toast } from "sonner";
import type { RisellerSaleRow } from "@/services/risellerSalesApi";

/**
 * What staff see after Sync / Try again. A refusal stays on screen until closed and gives
 * Riseller's reason in plain words, so staff can raise it with Riseller directly (for example
 * "Riseller has not switched on website sales for Moments yet").
 */
export function showRisellerSaleResult(ref: string, row: RisellerSaleRow) {
  switch (row.status) {
    case "SENT":
      toast.success(`${ref} is recorded in Riseller as invoice ${row.invoiceNo}.`);
      return;
    case "NEEDS_ATTENTION":
      toast.error(`${ref} was NOT recorded in Riseller`, {
        description: `${row.lastError ?? "Riseller gave no reason."} The order is kept under Products → Riseller Sales ("Needs you").`,
        duration: Infinity,
        closeButton: true,
      });
      return;
    case "FAILED":
      toast.warning(`${ref} is not in Riseller yet`, {
        description: `${row.lastError ?? "Riseller gave no clear answer."} It will try again by itself; follow it under Products → Riseller Sales.`,
        duration: 20_000,
        closeButton: true,
      });
      return;
    case "PENDING":
      toast.message(`${ref} is queued for Riseller.`, {
        description: row.lastError ?? undefined,
      });
      return;
    default:
      toast.message(`${ref}: ${row.lastError ?? "no change"}`);
  }
}
