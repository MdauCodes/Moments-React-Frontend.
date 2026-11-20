// Website sales sent to Riseller automatically. Backend: AdminRisellerSalesController.
import { adminJson } from "@/services/adminApi";

export type RisellerSaleStatus =
  "PENDING" | "FAILED" | "NEEDS_ATTENTION" | "SENT" | "ENTERED_BY_HAND" | "NOT_NEEDED";

export interface RisellerSalesOverview {
  enabled: boolean;
  enabledSince: string | null;
  /** Orders paid before sending was turned on, waiting for Sync / Already entered. */
  backlogOrders: number;
  counts: Record<RisellerSaleStatus, number>;
}

export interface RisellerBacklogOrder {
  orderId: string;
  orderReference: string;
  customerName: string | null;
  paidAt: string;
  orderTotal: number | null;
  /** Someone already ticked this order "Entered" by hand (old reminder): staff re-check it. */
  tickedBy: string | null;
  tickedAt: string | null;
  /** Set when a Sync was tried and has not gone through yet; the order stays listed until it does. */
  status: "FAILED" | "NEEDS_ATTENTION" | null;
  lastError: string | null;
  attempts: number;
  lines: {
    productName: string;
    productCode: string | null;
    units: number;
    unitName: string | null;
  }[];
}

export interface RisellerSaleRow {
  orderId: string;
  orderReference: string;
  status: RisellerSaleStatus;
  origin: "AUTO" | "BACKLOG";
  attempts: number;
  lastError: string | null;
  invoiceNo: string | null;
  sentTotal: number | null;
  sentAt: string | null;
  nextAttemptAt: string | null;
  decidedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const BASE = "/api/v1/admin/riseller-sales";

export const getRisellerSalesOverview = () => adminJson<RisellerSalesOverview>(`${BASE}/overview`);

export const listRisellerBacklog = () => adminJson<RisellerBacklogOrder[]>(`${BASE}/backlog`);

export const listRisellerSales = (limit = 200) =>
  adminJson<RisellerSaleRow[]>(`${BASE}?limit=${limit}`);

const post = (orderId: string, action: "sync" | "entered" | "retry") =>
  adminJson<RisellerSaleRow>(`${BASE}/orders/${encodeURIComponent(orderId)}/${action}`, {
    method: "POST",
  });

/** Not in Riseller yet: send it now. */
export const syncRisellerOrder = (orderId: string) => post(orderId, "sync");
/** Someone already keyed it into Riseller by hand: never send it. */
export const markRisellerOrderEntered = (orderId: string) => post(orderId, "entered");
export const retryRisellerOrder = (orderId: string) => post(orderId, "retry");

export const setRisellerSalesSwitch = (enabled: boolean) =>
  adminJson<RisellerSalesOverview>(`${BASE}/switch?enabled=${enabled}`, { method: "PUT" });
