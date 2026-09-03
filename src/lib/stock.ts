import type { Product } from "@/data/products";

export type StockState = "in_stock" | "low_stock" | "out_of_stock" | "untracked";

export interface StockInfo {
  state: StockState;
  available: number;
  threshold: number;
  label: string;
  /** True when an order would exceed available units (backorder mode) — still allowed, distinct
   *  from canOrder below. Only ever true for LOW_STOCK; OUT_OF_STOCK/MADE_TO_ORDER always report
   *  isBackorder: false since there's no cart path left for them to modify. */
  isBackorder: boolean;
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
  product: Pick<Product, "stock" | "lowStockThreshold" | "trackInventory" | "stockStatus">,
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
      isBackorder: false,
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
      isBackorder: false,
      canOrder: false,
      isMadeToOrder: false,
    };
  }

  if (status === "LOW_STOCK" || (tracked && available > 0 && available <= threshold)) {
    return {
      state: "low_stock",
      available,
      threshold,
      label: `Only ${available.toLocaleString()} left`,
      isBackorder: requestedQty > available,
      canOrder: true,
      isMadeToOrder: false,
    };
  }

  if (status === "IN_STOCK" || (tracked && available > threshold)) {
    return {
      state: "in_stock",
      available,
      threshold,
      label: `In stock — ${available.toLocaleString()} units`,
      isBackorder: false,
      canOrder: true,
      isMadeToOrder: false,
    };
  }

  return {
    state: "untracked",
    available: Number.POSITIVE_INFINITY,
    threshold,
    label: "In stock",
    isBackorder: false,
    canOrder: true,
    isMadeToOrder: false,
  };
}
