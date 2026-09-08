import type { Product, ProductPricingTierLike } from "@/data/products";
import type { StockInfo } from "@/lib/stock";
import { apiUrl } from "@/config/api";
import { cleanUomLabel, individualUnitLabel } from "@/lib/uomLabel";

export interface QuickAddOption {
  /** Stable key for React lists and the toast dedup id. */
  key: string;
  /** What reaches addItem/the backend — a real tier id, or null for a genuine individual sale. */
  tierId: string | null;
  /** "Carton" for a tier, or the bare unit noun ("packet") for the individual option — render as
   *  `Add {quantity} {label}{quantity !== 1 ? "s" : ""}`, never pre-pluralized here. */
  label: string;
  /** Pieces per pack — 1 for the individual option, so callers can tell "this option has its own
   *  sub-count worth stating" (packQty > 1) from "the label already says everything". */
  packQty: number;
  /** How many packs (or individual units) one tap adds. Always 1 for a tier; product.moq for
   *  individual, since that's the server-enforced minimum. */
  quantity: number;
  /** quantity * packQty — the actual piece count, and what a stock/backorder probe must use. */
  totalUnits: number;
  unitPrice: number;
  lineTotal: number;
  unitNoun: string;
  /** % below the priciest per-unit option among this product's options; 0 when there's nothing
   *  to compare against or no real reduction exists. */
  savingsPct: number;
  isCheapestPerUnit: boolean;
  /** Present only for a tier option — the individual option has no backing tier row. */
  rawTier?: ProductPricingTierLike;
}

/**
 * The one filter every buying-option surface must agree on. Extracted verbatim from
 * ProductCard.tsx's pre-existing logic (the strictest of three copies that used to exist):
 * a tier with no price, a non-positive quantity, or the "Legacy Tier" placeholder name is not
 * a real buying option, regardless of what a looser filter elsewhere might have let through.
 */
export function getQuickAddTiers(p: Pick<Product, "pricingTiers">): ProductPricingTierLike[] {
  return ((p.pricingTiers ?? []) as ProductPricingTierLike[])
    .filter(
      (t) =>
        t &&
        t.enabled !== false &&
        t.collectionName &&
        t.collectionName !== "Legacy Tier" &&
        Number(t.quantity) > 0 &&
        Number(t.collectionPrice ?? 0) > 0,
    )
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * Matches the backend's CartService.isIndividualSaleAvailable exactly — the flag alone isn't
 * enough. A Riseller-created product can have individualSalesEnabled on with no real price yet
 * (Riseller reported 0/blank), and "KES 0/piece" must never be offered as a buyable option.
 */
export function isIndividualBuyable(p: Pick<Product, "individualSalesEnabled" | "basePrice">): boolean {
  return p.individualSalesEnabled === true && Number(p.basePrice) > 0;
}

/**
 * A product qualifies for one-tap quick-add only when the unit of measure is the ONLY real
 * choice on it — no size, no variant, no material. A single button can safely represent exactly
 * one choice; anything more risks silently skipping a choice the customer never made, the exact
 * bug class the 2026-09-08 tier-selection fix closed. variants/materials are checked for
 * forward-compatibility even though neither exists in the live product API today — do not read
 * their presence here as active protection against real data, sizes and tiers are what's
 * load-bearing right now.
 *
 * Widened per an explicit 2026-09-08 client decision: eligibility does not require a real
 * multi-tier choice — a tier-less, individually-sold product qualifies too, since it already has
 * exactly one buying option (buyOptionsCount === 1) and nothing to hide.
 */
export function isQuickAddEligible(p: Product, stock: StockInfo): boolean {
  return (
    (p.sizes?.length ?? 0) === 0 &&
    (p.variants?.length ?? 0) <= 1 &&
    (p.materials?.length ?? 0) <= 1 &&
    (getQuickAddTiers(p).length > 0 || isIndividualBuyable(p)) &&
    stock.canOrder
  );
}

/** Every buyable option for a product, tiers first (in their sort order) then the individual
 *  option last, if enabled — the same order the existing tier grids already render in. */
export function getQuickAddOptions(p: Product): QuickAddOption[] {
  const tiers = getQuickAddTiers(p);

  const options: QuickAddOption[] = tiers.map((t) => {
    const packQty = Number(t.quantity) || 0;
    const lineTotal = Number(t.collectionPrice ?? Number(t.pricePerUnit) * packQty) || 0;
    return {
      key: String(t.id ?? t.collectionName),
      tierId: t.id ?? null,
      label: cleanUomLabel(t.uomName ?? t.collectionName, packQty),
      packQty,
      quantity: 1,
      totalUnits: packQty,
      unitPrice: Number(t.pricePerUnit) || 0,
      lineTotal,
      unitNoun: individualUnitLabel(p.risellerUomName),
      savingsPct: 0,
      isCheapestPerUnit: false,
      rawTier: t,
    };
  });

  if (isIndividualBuyable(p)) {
    const unitPrice = Number(p.basePrice) || 0;
    const quantity = p.moq || 1;
    options.push({
      key: "individual",
      tierId: null,
      label: individualUnitLabel(p.risellerUomName),
      packQty: 1,
      quantity,
      totalUnits: quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
      unitNoun: individualUnitLabel(p.risellerUomName),
      savingsPct: 0,
      isCheapestPerUnit: false,
      rawTier: undefined,
    });
  }

  // Savings vs. the priciest per-unit option — mirrors ProductCard's existing tierSavingsPct,
  // generalised across tiers AND the individual option instead of just tiers against each other.
  if (options.length > 1) {
    const perUnit = options.map((o) => (o.totalUnits > 0 ? o.lineTotal / o.totalUnits : 0));
    const dearest = Math.max(...perUnit);
    let cheapestIdx = 0;
    perUnit.forEach((u, i) => {
      if (u > 0 && u < perUnit[cheapestIdx]) cheapestIdx = i;
      if (dearest > 0 && u > 0 && u < dearest) {
        options[i].savingsPct = Math.round(((dearest - u) / dearest) * 100);
      }
    });
    if (perUnit[cheapestIdx] > 0) options[cheapestIdx].isCheapestPerUnit = true;
  }

  return options;
}

/** Relocated from ProductCard.tsx so quick-add taps (which never navigate) can fire it too —
 *  it used to only fire on the card's own <Link> navigation, silently under-counting the
 *  products that convert best. */
export function trackProductClick(id: string) {
  fetch(apiUrl(`/api/v1/public/products/${encodeURIComponent(id)}/click`), {
    method: "POST",
  }).catch(() => {
    /* fire-and-forget */
  });
}
