import type { Product } from "@/data/products";

export type StockState = "in_stock" | "low_stock" | "out_of_stock" | "untracked";

export interface StockInfo {
  state: StockState;
  available: number;
  threshold: number;
  label: string;
  /** True when the requested quantity is more than what's actually in stock. Distinct from
   *  canOrder below: canOrder says whether the PRODUCT is orderable at all (false only for
   *  OUT_OF_STOCK/MADE_TO_ORDER); this says whether the QUANTITY currently asked for fits within
   *  it. Only ever true for LOW_STOCK — 2026-09-27 policy change: ordering more than what's
   *  available is no longer allowed at any quantity, full stop (no more backorders/extended lead
   *  times) — callers must block the add and prompt to reduce quantity when this is true, not
   *  just note it. OUT_OF_STOCK/MADE_TO_ORDER always report false since there's no cart path left
   *  for them to modify. */
  exceedsAvailable: boolean;
  /** False for OUT_OF_STOCK and MADE_TO_ORDER — direct purchase is disabled for both (2026-09-03
   *  policy change: stop selling what isn't actually ready, however briefly, rather than
   *  auto-accepting backorders/on-demand production through checkout). Callers should swap the
   *  Add to cart control for an enquiry path (see whatsappLink in data/products) whenever this is
   *  false, not just hide it — see isMadeToOrder for which message applies. */
  canOrder: boolean;
  /** True specifically for MADE_TO_ORDER (vs plain OUT_OF_STOCK) — same canOrder:false treatment,
   *  but a different customer-facing reason/label. */
  isMadeToOrder: boolean;
}

/**
 * Compute stock state for a product or one of its variants.
 * Pass a `variant` to get variant-specific availability.
 */
export function getStockInfo(
  product: Pick<Product, "stock" | "lowStockThreshold" | "trackInventory" | "stockStatus" | "risellerUomName">,
  variant?: { stock?: number } | null,
  requestedQty = 0,
): StockInfo {
  const status = product.stockStatus;
  const threshold = product.lowStockThreshold ?? 50;
  const tracked = product.trackInventory ?? (status !== "MADE_TO_ORDER");
  const available =
    variant && typeof variant.stock === "number"
      ? variant.stock
      : (product.stock ?? 0);

  if (status === "MADE_TO_ORDER") {
    return {
      state: "out_of_stock",
      available: 0,
      threshold,
      label: "Made to order — not available for direct purchase",
      exceedsAvailable: false,
      canOrder: false,
      isMadeToOrder: true,
    };
  }

  if (status === "OUT_OF_STOCK" || (tracked && available <= 0)) {
    return {
      state: "out_of_stock",
      available: 0,
      threshold,
      label: "Out of stock",
      exceedsAvailable: false,
      canOrder: false,
      isMadeToOrder: false,
    };
  }

  if (status === "LOW_STOCK" || (tracked && available > 0 && available <= threshold)) {
    return {
      state: "low_stock",
      available,
      threshold,
      // Customer-facing: never a small count. Bulk buyers read "only 3 left" as "they can't handle
      // my order" (owner, 2026-11-27). The exact count stays in `available` for the quantity check
      // and for staff pages, which read stock from the admin API.
      label: "In stock",
      exceedsAvailable: requestedQty > available,
      canOrder: true,
      isMadeToOrder: false,
    };
  }

  if (status === "IN_STOCK" || (tracked && available > threshold)) {
    return {
      state: "in_stock",
      available,
      threshold,
      label: "In stock",
      exceedsAvailable: false,
      canOrder: true,
      isMadeToOrder: false,
    };
  }

  return {
    state: "untracked",
    available: Number.POSITIVE_INFINITY,
    threshold,
    label: "In stock",
    exceedsAvailable: false,
    canOrder: true,
    isMadeToOrder: false,
  };
}

/** Shown when a customer asks for more than the shelf holds right now. Never names the count:
 *  it points them at a bulk quote instead, which is how Moments handles large orders anyway. */
export const BULK_QUOTE_MESSAGE =
  "Need this many? We'll supply your full quantity — send us a quick request and we'll confirm the price and delivery.";

/** Pre-filled enquiry text for a bulk request of one product. */
export function bulkQuoteEnquiryMessage(productName: string, quantityText?: string): string {
  return quantityText
    ? `Please supply ${quantityText} of ${productName}. What is the price and when can you deliver?`
    : `I'd like a bulk quote for ${productName}. My quantity is: `;
}

/** The store API words its stock refusals with the exact shelf count ("Only 8 units of ... are
 *  currently in stock", "Insufficient stock ... Available: 8"). Swap those for the bulk-quote
 *  wording before a customer sees them; any other message passes through unchanged. */
export function customerStockMessage(message: string): string {
  if (/\bonly\s+\d+\s+unit/i.test(message) || /insufficient stock/i.test(message) || /available:\s*\d+/i.test(message)) {
    return "We'll supply this full quantity on request. Lower it to check out now, or send us a quick request and we'll confirm the price and delivery.";
  }
  return message;
}
