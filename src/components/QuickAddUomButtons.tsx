import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

import type { Product } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { getStockInfo } from "@/lib/stock";
import { getQuickAddOptions, trackProductClick, type QuickAddOption } from "@/lib/quickAdd";
import { pluralUnit } from "@/lib/uomWords";

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
  /** layout="card" only. Drops the × N stepper, leaving just the add button. For hosts too narrow
   *  to give the stepper and the button room side by side — the homepage promo carousel's compact
   *  cards, where the stepper would squeeze the button down to an unreadable sliver. Everything
   *  else (the handler, the justAdded feedback, the CartAddedSheet hand-off) is unchanged, so a
   *  compact host is still the same one-tap add as the catalogue card, not a second interaction
   *  model. Someone who wants three cartons taps through to the product page, which is where a
   *  compact teaser card should be sending them anyway. */
  showMultiplier?: boolean;
}

export function QuickAddUomButtons({
  product,
  layout,
  maxVisible = 3,
  onMoreOptions,
  onTierChosen,
  guardAnchorNavigation = layout === "card",
  showMultiplier = true,
}: QuickAddUomButtonsProps) {
  const { addItem } = useCart();
  // Briefly disables the just-tapped button after a tap: a double-tap on a one-tap control is
  // far more likely to be a fumble than a deliberate "add two", and the disabled state itself is
  // the clearest possible "yes, that registered" feedback alongside the toast.
  const [justAdded, setJustAdded] = useState<string | null>(null);

  // Per-option × N multiplier, used by both layouts (the product page used to rely on a separate
  // quantity panel that only appeared after the first add). Keyed by option so "Carton" and "Packet" on the same product each keep
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

    // Total pieces, not packs — the same probe totalUnits exists for, so this checks the real
    // piece-level stock cap regardless of which UOM was tapped.
    const stock = getStockInfo(product, null, effectiveTotalUnits);
    if (!stock.canOrder) return;
    if (stock.exceedsAvailable) {
      // No count to the customer: point them at a bulk quote on the product page instead.
      toast.message("We'll supply this full quantity on request — open the product and tap “Request full quantity”.");
      return;
    }

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
                  Carton/Packet on the same product don't share a count. Suppressed by
                  showMultiplier={false} in hosts too narrow to fit it — see the prop's comment. */}
              {showMultiplier && (
              <div className="flex shrink-0 items-center overflow-hidden rounded-full border border-border bg-card">
                <button
                  type="button"
                  aria-label={`Decrease quantity of ${opt.label}`}
                  onClick={(e) => stepperTap(e, opt.key, -1)}
                  disabled={mult <= 1}
                  className="grid h-full min-h-[40px] w-8 place-items-center text-foreground transition-colors hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[1.1rem] text-center text-[11px] font-semibold tabular-nums sm:text-xs">
                  {mult}
                </span>
                <button
                  type="button"
                  aria-label={`Increase quantity of ${opt.label}`}
                  onClick={(e) => stepperTap(e, opt.key, 1)}
                  className="grid h-full min-h-[40px] w-8 place-items-center text-foreground transition-colors hover:bg-secondary"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              )}

              <button
                type="button"
                disabled={justAdded === opt.key}
                onClick={(e) => handleTap(e, opt)}
                className={`min-h-[40px] min-w-0 flex-1 rounded-full px-3 py-1.5 text-center text-[11px] font-semibold leading-tight transition-opacity disabled:opacity-60 sm:text-xs ${
                  i === 0
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-border bg-card text-foreground hover:border-foreground/40"
                }`}
              >
                <span>
                  Add {effQuantity.toLocaleString()} {pluralUnit(opt.label, effQuantity)}
                  {opt.isCheapestPerUnit && opt.savingsPct > 0 && (
                    <span className="ml-1.5 rounded-full bg-forest/15 px-1.5 py-px text-[9px] font-semibold text-forest">
                      Save {opt.savingsPct}%
                    </span>
                  )}
                </span>
                <small className="mt-0.5 block font-normal opacity-80">
                  {effPackQty > 1 ? `${effPackQty.toLocaleString()} ${pluralUnit(opt.unitNoun, effPackQty)} · ` : ""}
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

  // Detail (product page) layout: one full-width block per option, all built the same way — name
  // and price on top, a − n + stepper and a wide Add button underneath — so the options line up
  // instead of sitting in uneven half-width cards (owner, 2026-11-27).
  return (
    <div className="flex flex-col gap-2">
      {visible.map((opt) => {
        const mult = getMultiplier(opt.key);
        const effQuantity = opt.quantity * mult;
        const effLineTotal = opt.lineTotal * mult;
        const effPackQty = opt.packQty * mult;
        return (
          <div
            key={opt.key}
            className={`flex flex-col gap-3 rounded-xl border-2 px-4 py-3 ${
              opt.isCheapestPerUnit && visible.length > 1 ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-base text-foreground">
                  {cleanOptionTitle(opt.label)}
                  {opt.isCheapestPerUnit && opt.savingsPct > 0 && (
                    <span className="rounded-full bg-forest/15 px-1.5 py-px font-sans text-[10px] font-semibold text-forest">
                      Save {opt.savingsPct}%
                    </span>
                  )}
                </p>
                {opt.packQty > 1 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {opt.packQty.toLocaleString()} {pluralUnit(opt.unitNoun, opt.packQty)}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-right">
                <span className="block text-sm font-semibold text-foreground">KES {opt.lineTotal.toLocaleString()}</span>
                <span className="block text-[11px] text-muted-foreground">per {opt.label.toLowerCase()}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-11 items-center overflow-hidden rounded-full border border-border bg-background">
                <button
                  type="button"
                  aria-label={`Fewer ${opt.label}`}
                  onClick={() => adjustMultiplier(opt.key, -1)}
                  disabled={mult <= 1}
                  className="grid h-full w-10 place-items-center text-foreground transition-colors hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-[1.75rem] text-center text-sm font-semibold tabular-nums" aria-live="polite">
                  {mult}
                </span>
                <button
                  type="button"
                  aria-label={`More ${opt.label}`}
                  onClick={() => adjustMultiplier(opt.key, 1)}
                  className="grid h-full w-10 place-items-center text-foreground transition-colors hover:bg-secondary"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                disabled={justAdded === opt.key}
                onClick={(e) => handleTap(e, opt)}
                className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add · KES {effLineTotal.toLocaleString()}
                <span className="sr-only">
                  {" "}for {effQuantity.toLocaleString()} {pluralUnit(opt.label, effQuantity)}
                  {effPackQty > 1 ? ` (${effPackQty.toLocaleString()} ${pluralUnit(opt.unitNoun, effPackQty)})` : ""}
                </span>
              </button>
            </div>
          </div>
        );
      })}
      {overflow && onMoreOptions && (
        <button
          type="button"
          onClick={handleMoreOptions}
          className="rounded-xl border border-dashed border-border px-4 py-3 text-center text-sm font-medium text-muted-foreground hover:border-foreground/40"
        >
          More options
        </button>
      )}
    </div>
  );
}

/** "Carton" → "Carton", "packet" → "Packet": option names read as titles in the detail rows. */
function cleanOptionTitle(label: string): string {
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}
