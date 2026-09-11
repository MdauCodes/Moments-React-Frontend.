import { useState } from "react";
import { Minus, Plus } from "lucide-react";

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

  // Per-option × N multiplier — card layout only (the detail/PDP layout has its own surrounding
  // quantity UI already). Keyed by option so "Carton" and "Packet" on the same product each keep
  // their own count. Resets to 1 after a successful add, same reasoning as justAdded: the next tap
  // is far more likely to be a fresh decision than "add 3 more of what I just added".
  const [multipliers, setMultipliers] = useState<Record<string, number>>({});
  const getMultiplier = (key: string) => multipliers[key] ?? 1;
  const adjustMultiplier = (key: string, delta: number) =>
    setMultipliers((prev) => ({ ...prev, [key]: Math.min(99, Math.max(1, (prev[key] ?? 1) + delta)) }));

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

    const mult = getMultiplier(opt.key);
    const effectiveQuantity = opt.quantity * mult;
    const effectiveTotalUnits = opt.totalUnits * mult;
    const effectiveLineTotal = opt.lineTotal * mult;

    // Total pieces, not packs — the same probe totalUnits exists for, so quick-add doesn't
    // inherit the PDP's pre-existing pack-vs-piece backorder mismatch (noted, not fixed, in the
    // 2026-09-08 scoping doc).
    const stock = getStockInfo(product, null, effectiveTotalUnits);
    if (!stock.canOrder) return;

    addItem({
      productId: product.id,
      productName: product.name,
      primaryImageUrl: product.primaryImageUrl ?? "",
      size: "", // the eligibility gate guarantees this product has no size options
      material: product.material || "Standard",
      finish: product.finish || "Standard",
      quantity: effectiveQuantity,
      unitPrice: opt.unitPrice,
      sku: product.sku,
      isBackorder: stock.isBackorder,
      tierId: opt.tierId,
      collectionName: opt.tierId ? opt.rawTier?.collectionName : undefined,
      collectionQuantity: opt.tierId ? opt.packQty : undefined,
      totalUnits: effectiveTotalUnits,
    });

    trackProductClick(product.id);
    onTierChosen?.(opt.tierId);

    // Feedback now lives in CartAddedSheet (the global mini-cart, mounted once in SiteLayout/the
    // homepage) rather than a per-tap toast — it reacts to CartContext's lastAdded, so every
    // add-to-cart surface (this, the configurator, the PDP) gets the same obvious "here's what
    // happened, here's how close you are to a reward, here's checkout" surface instead of each
    // needing its own toast call.
    setJustAdded(opt.key);
    setMultipliers((prev) => ({ ...prev, [opt.key]: 1 }));
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
    const stepperTap = (e: React.MouseEvent, key: string, delta: number) => {
      if (guardAnchorNavigation) {
        e.preventDefault();
        e.stopPropagation();
      }
      adjustMultiplier(key, delta);
    };

    return (
      <div className="flex flex-col gap-1.5">
        {visible.map((opt, i) => {
          const mult = getMultiplier(opt.key);
          const effQuantity = opt.quantity * mult;
          const effLineTotal = opt.lineTotal * mult;
          const effPackQty = opt.packQty * mult;
          return (
            <div key={opt.key} className="flex items-stretch gap-1">
              {/* × N stepper — lets "3 cartons" happen in this one card interaction instead of
                  needing the full configurator just to bump quantity. Own state per option so
                  Carton/Packet on the same product don't share a count. */}
              <div className="flex shrink-0 items-center overflow-hidden rounded-full border border-border bg-card">
                <button
                  type="button"
                  aria-label={`Decrease quantity of ${opt.label}`}
                  onClick={(e) => stepperTap(e, opt.key, -1)}
                  disabled={mult <= 1}
                  className="grid h-full w-6 place-items-center text-foreground/60 transition-colors hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Minus className="h-2.5 w-2.5" />
                </button>
                <span className="min-w-[1.1rem] text-center text-[11px] font-semibold tabular-nums sm:text-xs">
                  {mult}
                </span>
                <button
                  type="button"
                  aria-label={`Increase quantity of ${opt.label}`}
                  onClick={(e) => stepperTap(e, opt.key, 1)}
                  className="grid h-full w-6 place-items-center text-foreground/60 transition-colors hover:bg-secondary"
                >
                  <Plus className="h-2.5 w-2.5" />
                </button>
              </div>

              <button
                type="button"
                disabled={justAdded === opt.key}
                onClick={(e) => handleTap(e, opt)}
                className={`min-w-0 flex-1 rounded-full px-3 py-1.5 text-center text-[11px] font-semibold leading-tight transition-opacity disabled:opacity-60 sm:text-xs ${
                  i === 0
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-border bg-card text-foreground hover:border-foreground/40"
                }`}
              >
                <span>
                  Add {effQuantity.toLocaleString()} {opt.label}
                  {effQuantity !== 1 ? "s" : ""}
                  {opt.isCheapestPerUnit && opt.savingsPct > 0 && (
                    <span className="ml-1.5 rounded-full bg-forest/15 px-1.5 py-px text-[9px] font-semibold text-forest">
                      Save {opt.savingsPct}%
                    </span>
                  )}
                </span>
                <small className="mt-0.5 block font-normal opacity-80">
                  {effPackQty > 1 ? `${effPackQty.toLocaleString()} ${opt.unitNoun}s · ` : ""}
                  KES {effLineTotal.toLocaleString()}
                </small>
              </button>
            </div>
          );
        })}
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
