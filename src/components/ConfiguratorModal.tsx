import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Heart, X } from "lucide-react";
import { toast } from "sonner";

import type { Product } from "@/data/products";
import { whatsappLink } from "@/data/products";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cleanUomLabel, individualUnitLabel } from "@/lib/uomLabel";
import { getStockInfo } from "@/lib/stock";
import { getQuickAddTiers, isQuickAddEligible } from "@/lib/quickAdd";
import { QuickAddUomButtons } from "@/components/QuickAddUomButtons";

interface ConfiguratorModalProps {
  product: Product | null;
  onClose: () => void;
  preSelectedTierId?: string | null;
}

export function ConfiguratorModal({ product, onClose, preSelectedTierId }: ConfiguratorModalProps) {
  const { addItem } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [size, setSize] = useState<string>("");
  const [material, setMaterial] = useState<string>("");
  const [finish, setFinish] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);
  const [tierTouched, setTierTouched] = useState(false);

  const collectionTiers = useMemo(() => {
    if (!product) return [];
    return getQuickAddTiers(product)
      .map((t: any, i: number) => ({
        ...t,
        id: t.id ?? `tier-${i}`,
        collectionName: t.collectionName,
        quantity: Number(t.quantity),
        pricePerUnit: Number(t.pricePerUnit) || 0,
        collectionPrice: Number(t.collectionPrice ?? Number(t.pricePerUnit) * Number(t.quantity)) || 0,
        sortOrder: t.sortOrder ?? i,
      }))
      .slice()
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  }, [product]);

  const hasCollections = collectionTiers.length > 0;
  // STRICT — never infer from absence of tiers. Also requires a real positive basePrice:
  // a Riseller-created product can have the flag on with no price yet (Riseller reported
  // 0/blank), and "KES 0/piece" must never be offered as a buyable option.
  const individualEnabled = product?.individualSalesEnabled === true && Number(product?.basePrice) > 0;

  const stock = useMemo(
    () =>
      product
        ? getStockInfo(product, null, 0)
        : { state: "untracked" as const, available: 0, threshold: 0, label: "", isBackorder: false, canOrder: true, isMadeToOrder: false },
    [product],
  );
  // Quick-add is eligible only when UOM/tier is this product's sole choice — see
  // isQuickAddEligible's own comment for the full reasoning and the 2026-09-08 widening.
  const eligible = product ? isQuickAddEligible(product, stock) : false;
  // The demoted "order more than one" panel only appears once a real choice has been made on
  // an eligible product; an ineligible (multi-dimension) product keeps its full picker visible
  // unconditionally, exactly as before.
  const showQuantityPanel = !eligible || tierTouched;

  const selectedTier = useMemo(
    () =>
      hasCollections && selectedTierId ? (collectionTiers.find((t: any) => t.id === selectedTierId) as any) : null,
    [collectionTiers, hasCollections, selectedTierId],
  );

  useEffect(() => {
    if (!product) return;
    // Never pre-select a size — a customer who never touches this control must not silently
    // "order" size #1. handleAdd blocks Add to Cart until a real choice is made.
    setSize("");
    setMaterial(product.materials?.[0] ?? product.material ?? "");
    setFinish(product.finish ?? "Standard");
    setError(null);
    setSaved(false);
    if (hasCollections) {
      // A pre-selected tier is only honoured when it's a genuine match (e.g. the customer
      // already tapped a tier pill on the product card) — it must never fall back to
      // collectionTiers[0] as a silent guess. Auto-select only when there's exactly one real
      // tier and no individual option, i.e. nothing to actually choose between.
      const match = preSelectedTierId
        ? (collectionTiers as any[]).find((t) => String(t.id) === String(preSelectedTierId))
        : null;
      const onlyOption = collectionTiers.length === 1 && !individualEnabled;
      setSelectedTierId(match ? match.id : onlyOption ? (collectionTiers[0] as any).id : null);
      setTierTouched(Boolean(match) || onlyOption);
      setQuantity(1);
    } else if (individualEnabled) {
      setSelectedTierId(null);
      setTierTouched(false);
      setQuantity(product.moq);
    } else {
      setSelectedTierId(null);
      setTierTouched(false);
      setQuantity(product.moq);
    }
  }, [product, preSelectedTierId]);

  const unitPrice = selectedTier ? Number(selectedTier.pricePerUnit) || 0 : (product?.basePrice ?? 0);
  const collectionQty = selectedTier ? Number(selectedTier.quantity) || 0 : 0;
  const collectionPrice = selectedTier ? Number(selectedTier.collectionPrice ?? unitPrice * collectionQty) || 0 : 0;
  const lineTotal = selectedTier ? quantity * collectionPrice : quantity * unitPrice;
  const minQty = selectedTier ? 1 : (product?.moq ?? 1);

  if (!product) return null;

  const handleSelectTier = (key: string | null) => {
    setSelectedTierId(key);
    setTierTouched(true);
    setQuantity(1);
    setError(null);
  };

  const handleQtyChange = (v: string) => {
    // Pieces are always a whole count — strip everything but digits so a leading zero or a
    // decimal point can never even reach state, rather than parsing then trying to reformat
    // a native number input's own text buffer after the fact.
    const digitsOnly = v.replace(/\D/g, "");
    const n = digitsOnly === "" ? 0 : parseInt(digitsOnly, 10);
    setQuantity(n);
    setError(n < minQty ? `Minimum: ${minQty.toLocaleString()}` : null);
  };

  const hasSizeOptions = (product.sizes?.length ?? 0) > 0;
  const sizeMissing = hasSizeOptions && !size;
  // Same reasoning as products.$slug.tsx: tierTouched (not selectedTierId) tracks whether a
  // real choice was made, since null is legitimately "Individual" once explicitly chosen.
  const buyOptionsCount = collectionTiers.length + (individualEnabled ? 1 : 0);
  const tierMissing = buyOptionsCount > 1 && !tierTouched;

  const handleAdd = () => {
    if (!stock.canOrder) return; // UI already hides this control — guard in case that ever changes
    if (quantity < minQty) {
      setError(`Minimum: ${minQty.toLocaleString()}`);
      return;
    }
    if (sizeMissing) {
      setError("Please choose a size");
      return;
    }
    if (tierMissing) {
      setError("Please choose how you'd like to buy");
      return;
    }
    addItem({
      productId: product.id,
      productName: product.name,

      primaryImageUrl: product.primaryImageUrl ?? "",
      // No "Standard" fallback — a product with real size options must carry the customer's
      // actual choice (sizeMissing already blocks getting here without one); a product with no
      // size options at all sends "", which the backend's validateSizeSelection skips entirely.
      size,
      material: material || "Standard",
      finish: finish || "Standard",
      quantity,
      unitPrice,
      tierId: selectedTier ? selectedTierId : null,
      collectionName: selectedTier?.collectionName,
      collectionQuantity: selectedTier ? collectionQty : undefined,
      totalUnits: selectedTier ? quantity * collectionQty : quantity,
    });
    toast.success("Added to cart", { duration: 2000 });
    onClose();
  };

  const handleWishlist = () => {
    if (!isAuthenticated) {
      navigate("/account/login");
      return;
    }
    setSaved((s) => !s);
    toast.success(saved ? "Removed from wishlist" : "Saved to wishlist");
  };

  return (
    <Sheet open={!!product} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-background p-0 sm:max-w-lg">
        <div className="flex items-start justify-between border-b border-border px-6 py-4">
          <h2 className="font-display text-xl text-foreground">{product.name}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-secondary">
              {product.primaryImageUrl ? (
                <img
                  src={product.primaryImageUrl}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-muted-foreground/25"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-kraft/30 bg-kraft/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-kraft">
                  {product.category}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    !stock.canOrder
                      ? "bg-destructive/10 text-destructive"
                      : hasCollections
                        ? "bg-primary/10 text-primary"
                        : individualEnabled
                          ? "bg-forest/10 text-forest"
                          : "bg-muted text-muted-foreground"
                  }`}
                >
                  {!stock.canOrder
                    ? stock.isMadeToOrder ? "Made to order" : "Out of stock"
                    : hasCollections ? "Collections" : individualEnabled ? "Per-unit order" : "Quote only"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {hasCollections && collectionTiers[0]
                  ? `Min. order: 1 ${cleanUomLabel((collectionTiers[0] as any).uomName ?? (collectionTiers[0] as any).collectionName, Number((collectionTiers[0] as any).quantity))} (${Number((collectionTiers[0] as any).quantity).toLocaleString()} pcs)`
                  : `Min. ${product.moq.toLocaleString()} units`}
              </p>
            </div>
          </div>

          {!stock.canOrder && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <p className="text-sm text-foreground/80">
                {stock.isMadeToOrder
                  ? "This item is made to order and isn't available for direct purchase right now. Send us an enquiry and we'll get back to you with availability and lead time."
                  : "This item is currently out of stock. Send us an enquiry and we'll let you know when it's back, or offer an alternative."}
              </p>
            </div>
          )}

          {/* Quick-add — eligible products only; see isQuickAddEligible. */}
          {stock.canOrder && eligible && (
            <Section label="Choose how to buy" note="Pick a unit of measure">
              <QuickAddUomButtons
                product={product}
                layout="detail"
                onTierChosen={(tierId) => {
                  setSelectedTierId(tierId);
                  setTierTouched(true);
                  setQuantity(1);
                }}
              />
            </Section>
          )}

          {/* Collection tier selection — ineligible products only (a second dimension is also
              in play), or the item can't actually be ordered */}
          {stock.canOrder && !eligible && hasCollections && (
            <Section label="Choose how to buy" note="Pick a unit of measure">
              <div className="grid gap-2 grid-cols-2">
                {collectionTiers.map((t: any, i: number) => {
                  const key = t.id ?? `tier-${i}`;
                  const active = key === selectedTierId;
                  const cPrice = Number(t.collectionPrice ?? Number(t.pricePerUnit) * Number(t.quantity)) || 0;
                  const label = cleanUomLabel(t.uomName ?? t.collectionName, Number(t.quantity));
                  // Top tier = best per-unit price = last in sorted-by-quantity (largest pack)
                  const isTopTier = i === collectionTiers.length - 1 && collectionTiers.length > 1;
                  // Savings vs smallest pack's per-unit price
                  const smallest = collectionTiers[0] as any;
                  const smallestUnit = Number(smallest.collectionPrice) / Number(smallest.quantity);
                  const thisUnit = cPrice / Number(t.quantity);
                  const save =
                    smallestUnit > 0 && thisUnit < smallestUnit
                      ? Math.round(((smallestUnit - thisUnit) / smallestUnit) * 100)
                      : 0;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleSelectTier(key)}
                      className={`relative flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        active
                          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                          : "border-border bg-card hover:border-foreground/40"
                      }`}
                    >
                      {isTopTier && save > 0 && (
                        <span className="absolute right-2 top-2 rounded-full bg-forest px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-forest-foreground">
                          Save {save}%
                        </span>
                      )}
                      <span className="font-display text-sm text-foreground">{label}</span>
                      <span className="mt-0.5 text-[11px] text-muted-foreground">
                        {Number(t.quantity).toLocaleString()} pieces
                      </span>
                      {t.uomDescription && (
                        <span className="mt-0.5 text-[10px] italic text-muted-foreground line-clamp-2">
                          {t.uomDescription}
                        </span>
                      )}
                      <span className="mt-1.5 text-sm font-semibold text-foreground">
                        KES {cPrice.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">per {label.toLowerCase()}</span>
                    </button>
                  );
                })}
                {individualEnabled && (
                  <button
                    type="button"
                    onClick={() => handleSelectTier(null)}
                    className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      selectedTierId === null
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border bg-card hover:border-foreground/40"
                    }`}
                  >
                    <span className="font-display text-sm text-foreground">Individual {individualUnitLabel(product.risellerUomName)}s</span>
                    <span className="mt-0.5 text-[11px] text-muted-foreground">Buy any quantity</span>
                    <span className="mt-1.5 text-sm font-semibold text-foreground">
                      KES {(product.basePrice ?? 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-muted-foreground">per {individualUnitLabel(product.risellerUomName)}</span>
                  </button>
                )}
              </div>
              {tierMissing && <p className="mt-1.5 text-xs font-medium text-accent">Please choose how you'd like to buy</p>}
              {(() => {
                if (!selectedTier || collectionTiers.length < 2) return null;
                const top = collectionTiers[collectionTiers.length - 1] as any;
                if (top.id === selectedTier.id) return null;
                const smallest = collectionTiers[0] as any;
                const smallestUnit = Number(smallest.collectionPrice) / Number(smallest.quantity);
                const topUnit = Number(top.collectionPrice) / Number(top.quantity);
                const save = smallestUnit > 0 ? Math.round(((smallestUnit - topUnit) / smallestUnit) * 100) : 0;
                if (save <= 0) return null;
                return (
                  <p className="mt-2 text-xs font-medium text-forest">
                    Switch to {cleanUomLabel(top.uomName ?? top.collectionName, Number(top.quantity))} and save {save}%
                  </p>
                );
              })()}
            </Section>
          )}

          {/* Per-unit hint when there are no collections — ineligible products only */}
          {stock.canOrder && !eligible && !hasCollections && individualEnabled && (
            <div className="rounded-xl border border-forest/20 bg-forest/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-forest">Per-unit ordering</p>
              <p className="mt-1 text-sm text-foreground/80">
                Order any quantity from {product.moq.toLocaleString()} units upward at{" "}
                <span className="font-semibold">KES {(product.basePrice ?? 0).toLocaleString()}/{individualUnitLabel(product.risellerUomName)}</span>.
              </p>
            </div>
          )}
          {stock.canOrder && !eligible && !hasCollections && !individualEnabled && (
            <div className="rounded-xl border border-border bg-secondary px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quote only</p>
              <p className="mt-1 text-sm text-foreground/80">
                This product is custom-priced. Tell us what you need and we'll send a quote within one business day.
              </p>
            </div>
          )}

          {stock.canOrder && product.sizes && product.sizes.length > 0 && (
            <Section label="Size">
              <PillGroup options={product.sizes} value={size} onChange={setSize} />
              {sizeMissing && (
                <p className="mt-1.5 text-xs font-medium text-accent">Please choose a size</p>
              )}
            </Section>
          )}
          {stock.canOrder && (product.materials?.length ?? 0) > 0 && (
            <Section label="Material">
              <PillGroup options={product.materials!} value={material} onChange={setMaterial} />
            </Section>
          )}
          {stock.canOrder && finish && (
            <Section label="Finish">
              <PillGroup options={[finish]} value={finish} onChange={setFinish} />
            </Section>
          )}

          {stock.canOrder && (hasCollections || individualEnabled) && showQuantityPanel && (
            <Section
              label={
                selectedTier
                  ? `Number of ${cleanUomLabel(selectedTier.uomName ?? selectedTier.collectionName, Number(selectedTier.quantity))}s`
                  : hasCollections
                    ? "Quantity"
                    : "Number of pieces"
              }
              note={selectedTier ? undefined : `(Min. ${minQty.toLocaleString()})`}
            >
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={quantity === 0 ? "" : String(quantity)}
                onChange={(e) => handleQtyChange(e.target.value)}
                onBlur={() => {
                  if (quantity < minQty) {
                    setQuantity(minQty);
                    setError(null);
                  }
                }}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {error && <p className="mt-1.5 text-xs text-accent">{error}</p>}
            </Section>
          )}

          {stock.canOrder && (hasCollections || individualEnabled) && showQuantityPanel && (
            <div className="rounded-xl bg-primary px-5 py-4 text-primary-foreground">
              {selectedTier ? (
                <p className="text-sm">
                  {quantity.toLocaleString()} ×{" "}
                  {cleanUomLabel(selectedTier.uomName ?? selectedTier.collectionName, Number(selectedTier.quantity))} ={" "}
                  <span className="font-display text-lg font-semibold">KES {lineTotal.toLocaleString()}</span>
                </p>
              ) : unitPrice > 0 ? (
                <p className="text-sm">
                  {quantity.toLocaleString()} pieces × KES {unitPrice.toLocaleString()} ={" "}
                  <span className="font-display text-lg font-semibold">KES {lineTotal.toLocaleString()}</span>
                </p>
              ) : null}
            </div>
          )}

          <p className="text-xs text-muted-foreground"></p>

          {!stock.canOrder ? (
            <a
              href={whatsappLink(
                `Hi, I'd like to enquire about ${product.name} — it's currently showing as ${stock.isMadeToOrder ? "made to order" : "out of stock"}. Is it available?`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="block w-full rounded-full bg-accent px-6 py-3.5 text-center text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Enquire on WhatsApp
            </a>
          ) : (hasCollections || individualEnabled) && showQuantityPanel ? (
            <button
              type="button"
              onClick={handleAdd}
              disabled={sizeMissing || tierMissing}
              title={sizeMissing ? "Please choose a size first" : tierMissing ? "Please choose how you'd like to buy first" : undefined}
              className={`w-full rounded-full px-6 py-3.5 text-sm font-semibold shadow-sm transition-opacity ${
                sizeMissing || tierMissing
                  ? "cursor-not-allowed bg-accent/40 text-accent-foreground/60"
                  : "bg-accent text-accent-foreground hover:opacity-90"
              }`}
            >
              {eligible ? `Add ${quantity.toLocaleString()} more` : "Add to cart"}
            </button>
          ) : hasCollections || individualEnabled ? (
            // Eligible but not yet touched — the quick-add buttons above are already the action;
            // nothing to render here until a choice is made.
            null
          ) : (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate("/enterprise-quote");
              }}
              className="w-full rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              Request a quote
            </button>
          )}

          <button
            type="button"
            onClick={handleWishlist}
            className="flex w-full items-center justify-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Heart className={`h-4 w-4 ${saved ? "fill-accent text-accent" : ""}`} />
            {saved ? "Saved to wishlist" : "Save to wishlist"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
        {note && <span className="ml-1 text-foreground/60 normal-case font-normal tracking-normal">{note}</span>}
      </p>
      {children}
    </div>
  );
}

function PillGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-foreground/20 bg-cream text-foreground hover:border-foreground/40"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
