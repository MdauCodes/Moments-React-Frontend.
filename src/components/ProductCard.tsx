import { useNavigate } from "react-router-dom";
import { useState } from "react";

import type { Product } from "@/data/products";
import { apiUrl } from "@/config/api";
import { getStockInfo } from "@/lib/stock";
import { cleanUomLabel } from "@/lib/uomLabel";

interface ProductCardProps {
  product: Product;
  onConfigure: (product: Product, preSelectedTierId?: string) => void;
  variant?: "default" | "compact";
}

function trackClick(id: string) {
  fetch(apiUrl(`/api/v1/public/products/${encodeURIComponent(id)}/click`), {
    method: "POST",
  }).catch(() => {
    /* fire-and-forget */
  });
}

export function ProductCard({ product: p, onConfigure }: ProductCardProps) {
  const navigate = useNavigate();
  const stock = getStockInfo(p, null, 0);

  const image = p.primaryImageUrl;

  const tiers = ((p.pricingTiers ?? []) as any[])
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
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) as Array<any>;

  const hasTiers = tiers.length > 0;
  const individualEnabled = p.individualSalesEnabled === true;
  const smallestTier = tiers[0];
  const cheapestTier = tiers[tiers.length - 1];
  const tierPrice = (t: any) => Number(t.collectionPrice ?? Number(t.pricePerUnit) * Number(t.quantity)) || 0;
  const tierUnitPrice = (t: any) => {
    const qty = Number(t.quantity) || 0;
    if (!qty) return 0;
    return tierPrice(t) / qty;
  };
  const tierKey = (t: any) => String(t.id ?? t.collectionName);
  const baselineUnit = hasTiers ? Math.max(...tiers.map((t) => tierUnitPrice(t))) : 0;
  const tierSavingsPct = (t: any) => {
    if (!baselineUnit) return 0;
    const u = tierUnitPrice(t);
    if (!u || u >= baselineUnit) return 0;
    return Math.round(((baselineUnit - u) / baselineUnit) * 100);
  };

  const [activeTierId, setActiveTierId] = useState<string | null>(hasTiers ? tierKey(tiers[0]) : null);
  const activeTier = hasTiers ? (tiers.find((t) => tierKey(t) === activeTierId) ?? tiers[0]) : null;

  const handleCardClick = () => {
    trackClick(p.id);
    navigate(`/products/${p.slug}`);
  };

  const handlePillClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActiveTierId(id);
  };

  const handleCTAClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConfigure(p, activeTierId ?? undefined);
  };

  const isTracked = stock.state !== "untracked" && (stock.state as string) !== "made_to_order";

  return (
    <article
      onClick={handleCardClick}
      className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1 hover:shadow-lg sm:rounded-2xl"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-secondary sm:aspect-[4/3] lg:aspect-[16/10]">
        {image ? (
          <img
            src={image}
            alt={p.name}
            loading="lazy"
            style={{ objectPosition: "center" }}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-secondary px-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-10 w-10 text-muted-foreground/25 sm:h-14 sm:w-14"
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
            <span className="text-center text-[9px] font-medium uppercase tracking-wide text-muted-foreground/40 line-clamp-2 sm:text-[10px]">
              {p.name}
            </span>
          </div>
        )}

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 sm:h-14"
          style={{ background: "linear-gradient(to bottom, transparent 0%, var(--card) 95%)" }}
        />

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1 sm:left-3 sm:top-3">
          {isTracked && (
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider sm:px-2.5 sm:py-1 sm:text-[10px] ${
                stock.state === "out_of_stock"
                  ? "bg-secondary text-muted-foreground"
                  : stock.state === "low_stock"
                    ? "bg-amber-500 text-white"
                    : "bg-green-600 text-white"
              }`}
            >
              {stock.state === "out_of_stock" ? "Out of Stock" : stock.state === "low_stock" ? stock.label : "In Stock"}
            </span>
          )}

          {stock.state !== "out_of_stock" &&
            (p.isDiscount ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary-foreground sm:px-2.5 sm:py-1 sm:text-[10px]">
                -{p.discountPercent ?? 10}%
              </span>
            ) : p.isNewArrival ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary-foreground sm:px-2.5 sm:py-1 sm:text-[10px]">
                New
              </span>
            ) : p.isFastMoving ? (
              <span className="rounded-full bg-kraft px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-kraft-foreground sm:px-2.5 sm:py-1 sm:text-[10px]">
                Hot
              </span>
            ) : null)}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-2.5 pt-0 pb-2.5 sm:px-4 sm:pt-0 sm:pb-4">
        <span className="hidden self-start rounded-full border border-kraft/30 bg-kraft/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-kraft sm:inline-block">
          {p.subcategoryName ?? p.category}
        </span>
        <h3 className="font-display text-sm font-semibold leading-snug text-foreground line-clamp-2 sm:mt-2 sm:text-base">
          {p.name}
        </h3>
        {p.description && (
          <p className="mt-1 hidden text-[11px] leading-snug text-muted-foreground line-clamp-2 sm:line-clamp-2 sm:block sm:text-xs">
            {p.description}
          </p>
        )}

        {hasTiers && (
          <div className="mt-1.5 hidden flex-wrap gap-1 sm:mt-2 sm:flex">
            {tiers.map((t: any) => {
              const id = tierKey(t);
              const isActive = id === activeTierId;
              const isTopTier = tierKey(t) === tierKey(cheapestTier) && tiers.length > 1;
              const topSave = tierSavingsPct(cheapestTier);
              const label = cleanUomLabel(t.uomName ?? t.collectionName, Number(t.quantity));
              const qty = Number(t.quantity) || 0;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={(e) => handlePillClick(e, id)}
                  title={t.uomDescription ?? undefined}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                    isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  <span>
                    {label} · {qty.toLocaleString()} pcs
                  </span>
                  {isTopTier && topSave > 0 && (
                    <span className="rounded-full bg-forest/15 px-1.5 py-px text-[9px] font-semibold text-forest">
                      Save {topSave}%
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {hasTiers && activeTier ? (
          <div className="mt-1.5 sm:mt-2">
            <p className="text-[13px] sm:text-sm">
              <span className="font-semibold text-primary">KES {tierPrice(activeTier).toLocaleString()}</span>
              {activeTier.originalCollectionPrice && activeTier.originalCollectionPrice > tierPrice(activeTier) && (
                <span className="ml-1.5 text-[11px] text-muted-foreground line-through">
                  KES {Number(activeTier.originalCollectionPrice).toLocaleString()}
                </span>
              )}
              <span className="ml-1 text-[11px] text-muted-foreground sm:text-xs">
                / {cleanUomLabel(activeTier.uomName ?? activeTier.collectionName, Number(activeTier.quantity))} (
                {(Number(activeTier.quantity) || 0).toLocaleString()} pcs)
              </span>
            </p>
            {activeTier.uomDescription && (
              <p className="mt-0.5 text-[11px] italic text-muted-foreground">{activeTier.uomDescription}</p>
            )}
            {tiers.length > 1 && tierKey(activeTier) !== tierKey(cheapestTier) && tierSavingsPct(cheapestTier) > 0 && (
              <p className="mt-0.5 text-[11px] font-medium text-forest">
                Switch to{" "}
                {cleanUomLabel(cheapestTier.uomName ?? cheapestTier.collectionName, Number(cheapestTier.quantity))} and
                save {tierSavingsPct(cheapestTier)}%
              </p>
            )}
          </div>
        ) : individualEnabled && p.basePrice ? (
          <p className="mt-1.5 text-[13px] font-semibold text-primary sm:mt-2 sm:text-sm">
            KES {p.basePrice.toLocaleString()}
            {p.originalBasePrice && p.originalBasePrice > p.basePrice && (
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground line-through">
                KES {p.originalBasePrice.toLocaleString()}
              </span>
            )}
            <span className="ml-1 font-normal text-muted-foreground">/ unit</span>
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground sm:mt-2 sm:text-sm">Contact for pricing</p>
        )}

        <StockLine state={stock.state} count={stock.available} label={stock.label} />

        <div className="mt-auto flex flex-col gap-1.5 pt-2 sm:gap-2 sm:pt-3">
          <p className="text-[10px] text-muted-foreground sm:text-xs">
            {hasTiers && smallestTier
              ? `Min. order: 1 ${cleanUomLabel(smallestTier.uomName ?? smallestTier.collectionName, Number(smallestTier.quantity))} (${(Number(smallestTier.quantity) || 0).toLocaleString()} pcs)`
              : `Min. ${p.moq.toLocaleString()} units`}
          </p>
          <button
            type="button"
            onClick={handleCTAClick}
            className="w-full rounded-full bg-primary px-2 py-2 text-[11px] font-semibold leading-tight text-primary-foreground transition-opacity hover:opacity-90 sm:px-3 sm:text-xs"
          >
            <span className="sm:hidden">
              {hasTiers || (individualEnabled && p.basePrice) ? "Add to cart" : "Get a quote"}
            </span>
            <span className="hidden sm:inline">
              {hasTiers && activeTier
                ? `Add to cart · ${cleanUomLabel(activeTier.uomName ?? activeTier.collectionName, Number(activeTier.quantity))}`
                : individualEnabled && p.basePrice
                  ? "Add to cart"
                  : "Get a quote"}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}

function StockLine({ state, count, label }: { state: string; count: number; label: string }) {
  if (state === "untracked" || state === "made_to_order" || state === "in_stock") return null;

  if (state === "low_stock") {
    return (
      <div className="mt-1 flex items-center gap-1.5 text-[10px] sm:text-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-px font-medium text-amber-700">
          <span className="h-1 w-1 rounded-full bg-current" />
          {count > 0 ? `Only ${count.toLocaleString()} left` : label}
        </span>
      </div>
    );
  }

  return (
    <p className="mt-1 text-[10px] text-muted-foreground/70 sm:text-[11px]">
      Out of stock — we can still fulfil your order.
    </p>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="shimmer aspect-[16/10] w-full" />
      <div className="flex flex-1 flex-col p-6">
        <div className="shimmer h-5 w-3/4 rounded-md" />
        <div className="shimmer mt-2 h-3 w-full rounded-md" />
        <div className="shimmer mt-1.5 h-3 w-2/3 rounded-md" />
        <div className="mt-5 flex items-end justify-between">
          <div className="space-y-1.5">
            <div className="shimmer h-2.5 w-10 rounded-md" />
            <div className="shimmer h-5 w-16 rounded-md" />
          </div>
          <div className="shimmer h-3 w-12 rounded-md" />
        </div>
        <div className="shimmer mt-4 h-9 w-full rounded-full" />
      </div>
    </div>
  );
}
