import { useState } from "react";
import { toast } from "sonner";

import type { Product } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { getStockInfo } from "@/lib/stock";
import { getQuickAddOptions, trackProductClick, type QuickAddOption } from "@/lib/quickAdd";

export interface QuickAddUomButtonsProps {
  product: Product;
  /** "card" = compact stacked pills for the catalogue/listing card. "detail" = the larger grid
   *  cards used on the PDP's "Choose how to buy" section and inside ConfiguratorModal. */
  layout: "card" | "detail";
  /** Options shown before overflow. No live product exceeds this today (max 2 real options),
   *  but the overflow path is wired for when one does. */
  maxVisible?: number;
  /** Overflow escape hatch — opens the full configurator with nothing pre-selected, so
   *  tierTouched stays false there and its own gate still applies. Omit to hide the control
   *  entirely (e.g. the PDP has nowhere further to send someone; it already IS the configurator). */
  onMoreOptions?: () => void;
  /** Mirrors the tap into the host's own tier state, so a "detail" host (PDP or modal) can show
   *  its demoted "order more than one" panel pre-set to what was just added. */
  onTierChosen?: (tierId: string | null) => void;
  /** Suppress native anchor navigation — needed only when this renders inside ProductCard's own
   *  <Link>, for the same reason documented at ProductCard.tsx's handlePillClick: stopPropagation
   *  alone leaves the browser's native anchor navigation to fire unimpeded. Defaults to true for
   *  layout="card" (always inside a Link today) and false for "detail" (never is). */
  guardAnchorNavigation?: boolean;
}

export function QuickAddUomButtons({
  product,
  layout,
  maxVisible = 3,
  onMoreOptions,
  onTierChosen,
  guardAnchorNavigation = layout === "card",
}: QuickAddUomButtonsProps) {
  const { addItem } = useCart();
  // Briefly disables the just-tapped button after a tap: a double-tap on a one-tap control is
  // far more likely to be a fumble than a deliberate "add two", and the disabled state itself is
  // the clearest possible "yes, that registered" feedback alongside the toast.
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const options = getQuickAddOptions(product);
  const visible = options.slice(0, maxVisible);
  const overflow = options.length > maxVisible;

  if (visible.length === 0) return null;

  const handleTap = (e: React.MouseEvent, opt: QuickAddOption) => {
    if (guardAnchorNavigation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (justAdded === opt.key) return;

    // Total pieces, not packs — the same probe totalUnits exists for, so quick-add doesn't
    // inherit the PDP's pre-existing pack-vs-piece backorder mismatch (noted, not fixed, in the
    // 2026-09-08 scoping doc).
    const stock = getStockInfo(product, null, opt.totalUnits);
    if (!stock.canOrder) return;

    addItem({
      productId: product.id,
      productName: product.name,
      primaryImageUrl: product.primaryImageUrl ?? "",
      size: "", // the eligibility gate guarantees this product has no size options
      material: product.material || "Standard",
      finish: product.finish || "Standard",
      quantity: opt.quantity,
      unitPrice: opt.unitPrice,
      sku: product.sku,
      isBackorder: stock.isBackorder,
      tierId: opt.tierId,
      collectionName: opt.tierId ? opt.rawTier?.collectionName : undefined,
      collectionQuantity: opt.tierId ? opt.packQty : undefined,
      totalUnits: opt.totalUnits,
    });

    trackProductClick(product.id);
    onTierChosen?.(opt.tierId);

    const qtyLabel = `${opt.quantity.toLocaleString()} ${opt.label}${opt.quantity !== 1 ? "s" : ""}`;
    toast.success(
      stock.isBackorder
        ? "Added — backorder (extended lead time)"
        : `Added · ${qtyLabel}${opt.packQty > 1 ? ` (${opt.packQty.toLocaleString()} ${opt.unitNoun}s)` : ""}`,
      { duration: 2400, id: `qa-${product.id}-${opt.key}` },
    );

    setJustAdded(opt.key);
    window.setTimeout(() => setJustAdded((k) => (k === opt.key ? null : k)), 400);
  };

  const handleMoreOptions = (e: React.MouseEvent) => {
    if (guardAnchorNavigation) {
      e.preventDefault();
      e.stopPropagation();
    }
    onMoreOptions?.();
  };

  if (layout === "card") {
    return (
      <div className="flex flex-col gap-1.5">
        {visible.map((opt, i) => (
          <button
            key={opt.key}
            type="button"
            disabled={justAdded === opt.key}
            onClick={(e) => handleTap(e, opt)}
            className={`w-full rounded-full px-3 py-1.5 text-center text-[11px] font-semibold leading-tight transition-opacity disabled:opacity-60 sm:text-xs ${
              i === 0
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "border border-border bg-card text-foreground hover:border-foreground/40"
            }`}
          >
            <span>
              Add {opt.quantity.toLocaleString()} {opt.label}
              {opt.quantity !== 1 ? "s" : ""}
              {opt.isCheapestPerUnit && opt.savingsPct > 0 && (
                <span className="ml-1.5 rounded-full bg-forest/15 px-1.5 py-px text-[9px] font-semibold text-forest">
                  Save {opt.savingsPct}%
                </span>
              )}
            </span>
            <small className="mt-0.5 block font-normal opacity-80">
              {opt.packQty > 1 ? `${opt.packQty.toLocaleString()} ${opt.unitNoun}s · ` : ""}
              KES {opt.lineTotal.toLocaleString()}
            </small>
          </button>
        ))}
        {overflow && onMoreOptions && (
          <button
            type="button"
            onClick={handleMoreOptions}
            className="w-full rounded-full border border-border bg-card px-3 py-1.5 text-center text-[11px] font-medium text-muted-foreground hover:border-foreground/40 sm:text-xs"
          >
            More options
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {visible.map((opt) => (
        <button
          key={opt.key}
          type="button"
          disabled={justAdded === opt.key}
          onClick={(e) => handleTap(e, opt)}
          className="flex flex-col items-start rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-foreground/40 disabled:opacity-60"
        >
          <span className="font-display text-base text-foreground">
            Add {opt.quantity.toLocaleString()} {opt.label}
            {opt.quantity !== 1 ? "s" : ""}
          </span>
          {opt.packQty > 1 && (
            <span className="mt-0.5 text-xs text-muted-foreground">
              {opt.packQty.toLocaleString()} {opt.unitNoun}s
            </span>
          )}
          <span className="mt-2 text-sm font-semibold text-foreground">KES {opt.lineTotal.toLocaleString()}</span>
          {opt.isCheapestPerUnit && opt.savingsPct > 0 && (
            <span className="mt-1 rounded-full bg-forest/15 px-1.5 py-px text-[10px] font-semibold text-forest">
              Save {opt.savingsPct}%
            </span>
          )}
        </button>
      ))}
      {overflow && onMoreOptions && (
        <button
          type="button"
          onClick={handleMoreOptions}
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm font-medium text-muted-foreground hover:border-foreground/40"
        >
          More options
        </button>
      )}
    </div>
  );
}
