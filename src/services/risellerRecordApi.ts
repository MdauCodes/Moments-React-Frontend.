// Online sales an admin still has to enter in Riseller by hand. Backend: AdminRisellerRecordController.
import { adminJson } from "@/services/adminApi";

export interface RisellerRecordSummary {
  /** Products with something to enter. */
  products: number;
  lines: number;
  oldestAt: string | null;
}

export interface RisellerPendingProduct {
  productId: string;
  productName: string;
  productCode: string | null;
  unitName: string | null;
  /** Take this many off in Riseller. */
  soldUnits: number;
  /** Put this many back in Riseller (sales already entered, then cancelled or refunded). */
  putBackUnits: number;
  orderReferences: string[];
  lineIds: string[];
  oldestAt: string;
}

const BASE = "/api/v1/admin/riseller-record";

export function getRisellerRecordSummary(): Promise<RisellerRecordSummary> {
  return adminJson<RisellerRecordSummary>(`${BASE}/summary`);
}

export function listRisellerPending(): Promise<RisellerPendingProduct[]> {
  return adminJson<RisellerPendingProduct[]>(`${BASE}/pending`);
}

export function markRisellerRecorded(
  productId: string,
  lineIds: string[],
): Promise<{ recorded: number }> {
  return adminJson<{ recorded: number }>(
    `${BASE}/products/${encodeURIComponent(productId)}/recorded`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineIds }),
    },
  );
}
