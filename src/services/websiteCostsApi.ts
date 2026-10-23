// The admin's log of what running the website costs, and how it compares with what the site earns.
//   GET/POST /api/v1/admin/website-costs, PUT/DELETE /api/v1/admin/website-costs/{id}   (admins only)
//   GET /api/v1/admin/analytics/costs-vs-revenue?from=<ISO instant>&to=<ISO instant>      (admins only)
import { adminFetch, ApiError } from "@/services/adminApi";

export type CostRecurrence = "ONE_OFF" | "MONTHLY" | "YEARLY";

export const COST_CATEGORIES = [
  { value: "HOSTING", label: "Hosting" },
  { value: "DOMAIN", label: "Domain" },
  { value: "DEVELOPMENT", label: "Development" },
  { value: "ADVERTISING", label: "Advertising" },
  { value: "PAYMENT_FEES", label: "Payment fees" },
  { value: "SOFTWARE", label: "Software" },
  { value: "OTHER", label: "Other" },
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number]["value"];

export const categoryLabel = (c: string) => COST_CATEGORIES.find((x) => x.value === c)?.label ?? c;

export interface WebsiteCost {
  id: string;
  name: string;
  category: CostCategory;
  amountKes: number;
  recurrence: CostRecurrence;
  /** yyyy-mm-dd */
  startDate: string;
  endDate: string | null;
  notes: string | null;
}

export type WebsiteCostInput = Omit<WebsiteCost, "id">;

export interface CostsVsRevenue {
  months: {
    month: string;
    revenueKes: number;
    productCostKes: number;
    websiteCostKes: number;
    profitKes: number;
  }[];
  totalRevenueKes: number;
  totalProductCostKes: number;
  totalWebsiteCostKes: number;
  totalProfitKes: number;
  websiteCostByCategory: { category: CostCategory; amountKes: number }[];
  unitsMissingCostPriceCount: number;
}

async function send<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await adminFetch(path, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = ((await res.json()) as { message?: string }).message ?? message;
    } catch {
      /* not JSON */
    }
    throw new ApiError({ status: res.status, message });
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const listWebsiteCosts = () => send<WebsiteCost[]>("/api/v1/admin/website-costs");

export const createWebsiteCost = (input: WebsiteCostInput) =>
  send<WebsiteCost>("/api/v1/admin/website-costs", { method: "POST", body: JSON.stringify(input) });

export const updateWebsiteCost = (id: string, input: WebsiteCostInput) =>
  send<WebsiteCost>(`/api/v1/admin/website-costs/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const deleteWebsiteCost = (id: string) =>
  send<void>(`/api/v1/admin/website-costs/${encodeURIComponent(id)}`, { method: "DELETE" });

export function getCostsVsRevenue(from: Date, to: Date): Promise<CostsVsRevenue> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  return send<CostsVsRevenue>(`/api/v1/admin/analytics/costs-vs-revenue?${params.toString()}`);
}
