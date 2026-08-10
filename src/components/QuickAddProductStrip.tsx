import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

import type { Product } from "@/data/products";
import { api } from "@/services/api";
import { useCart } from "@/contexts/CartContext";
import { useRewardDeliveryGap } from "@/hooks/useRewardDeliveryGap";
import { ProductCard } from "@/components/ProductCard";
import { ConfiguratorModal } from "@/components/ConfiguratorModal";

const CANDIDATE_POOL_SIZE = 90;
const STRIP_LENGTH = 12;

function productPrice(p: Product): number | null {
  if (p.individualSalesEnabled && p.basePrice) return p.basePrice;
  const tiers = (p.pricingTiers ?? []).filter(
    (t: any) => t && t.enabled !== false && t.collectionName && Number(t.quantity) > 0 && Number(t.collectionPrice ?? 0) > 0,
  ) as any[];
  if (tiers.length === 0) return null;
  return Math.min(...tiers.map((t) => Number(t.collectionPrice ?? 0)));
}

function isPurchasable(p: Product): boolean {
  if (p.stockStatus === "OUT_OF_STOCK") return false;
  return productPrice(p) !== null;
}

/**
 * Ranks candidates by two signals: how often the cart already contains
 * products from the same category/subcategory (affinity), and how closely
 * a candidate's price closes the nearest reward-tier or free-delivery gap
 * (price-fit) — so the strip surfaces items that both match what the
 * customer is already buying and meaningfully move them toward a threshold
 * they can already see in RewardDeliveryBanners.
 */
function rankCandidates(pool: Product[], cartProductIds: Set<string>, cartCategoryCounts: Map<string, number>, gapTarget: number | null): Product[] {
  const scored = pool
    .filter((p) => !cartProductIds.has(p.id) && isPurchasable(p))
    .map((p) => {
      const categoryKey = p.subcategoryName ?? p.categoryName ?? p.category;
      const affinity = categoryKey ? (cartCategoryCounts.get(categoryKey) ?? 0) : 0;

      const price = productPrice(p) ?? 0;
      let priceFit = 0;
      if (gapTarget && gapTarget > 0 && price > 0) {
        priceFit = 1 / (1 + Math.abs(price - gapTarget) / gapTarget);
      }

      const popularityBonus = (p.isFastMoving ? 0.15 : 0) + (p.isNewArrival ? 0.05 : 0);
      const score = affinity * 2 + priceFit + popularityBonus;
      return { product: p, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, STRIP_LENGTH).map((s) => s.product);
}

export function QuickAddProductStrip({
  cardWidthClassName = "w-44 sm:w-56",
  wrap = false,
}: {
  cardWidthClassName?: string;
  /** Wraps cards into a filling grid instead of a horizontally-scrolling strip — for containers
   *  wide enough that a fixed-height single row would leave a lot of dead space (e.g. the
   *  full-bleed checkout placement). Cart/dashboard placements keep the default scroll strip. */
  wrap?: boolean;
}) {
  const navigate = useNavigate();
  const { items } = useCart();
  const { kesToNextTier, kesToFreeDelivery } = useRewardDeliveryGap();
  const [pool, setPool] = useState<Product[] | null>(null);
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [preTier, setPreTier] = useState<string | undefined>(undefined);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .getProducts({ size: CANDIDATE_POOL_SIZE, sort: "createdAt,desc" })
      .then((products) => {
        if (!cancelled) setPool(products);
      })
      .catch(() => {
        if (!cancelled) setPool([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ranked = useMemo(() => {
    if (!pool || pool.length === 0) return [];

    const cartProductIds = new Set(items.map((it) => it.productId));
    const cartCategoryCounts = new Map<string, number>();
    for (const it of items) {
      const match = pool.find((p) => p.id === it.productId);
      const categoryKey = match ? (match.subcategoryName ?? match.categoryName ?? match.category) : null;
      if (categoryKey) cartCategoryCounts.set(categoryKey, (cartCategoryCounts.get(categoryKey) ?? 0) + 1);
    }

    // Prefer whichever gap is smaller and still open — closes the more
    // immediately reachable threshold first.
    const openGaps = [kesToFreeDelivery, kesToNextTier].filter((g): g is number => g != null && g > 0);
    const gapTarget = openGaps.length > 0 ? Math.min(...openGaps) : null;

    return rankCandidates(pool, cartProductIds, cartCategoryCounts, gapTarget);
  }, [pool, items, kesToNextTier, kesToFreeDelivery]);

  const searched = useMemo(() => {
    if (!pool || !query.trim()) return null;
    const q = query.trim().toLowerCase();
    return pool.filter((p) => isPurchasable(p) && p.name.toLowerCase().includes(q)).slice(0, STRIP_LENGTH);
  }, [pool, query]);

  const displayed = searched ?? ranked;

  function handleConfigure(product: Product, preSelectedTierId?: string) {
    setConfiguring(product);
    setPreTier(preSelectedTierId);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) navigate(`/products?q=${encodeURIComponent(query.trim())}`);
  }

  if (pool === null || ranked.length === 0) return null;

  return (
    <div className="rounded-2xl border border-kraft/25 bg-kraft/[0.05] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Add a little more to your order</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Picked to match what's already in your cart — tap to add.
          </p>
        </div>
        <form onSubmit={submitSearch} className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            className="w-40 rounded-full border border-border bg-background py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent/50 sm:w-52"
          />
        </form>
      </div>

      {searched && searched.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No matches in this preview —{" "}
          <button type="button" onClick={submitSearch} className="font-medium text-accent hover:underline">
            search the full catalogue
          </button>
          .
        </p>
      ) : (
        <div
          className={
            wrap
              ? "mt-3 flex flex-wrap items-stretch gap-3"
              : "mt-3 flex items-stretch gap-3 overflow-x-auto pb-1"
          }
        >
          {displayed.map((p) => (
            <div key={p.id} className={`${cardWidthClassName} ${wrap ? "" : "shrink-0"}`}>
              <ProductCard product={p} onConfigure={handleConfigure} />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate(query.trim() ? `/products?q=${encodeURIComponent(query.trim())}` : "/products")}
        className="mt-2 text-xs font-medium text-accent hover:underline"
      >
        Browse full catalogue →
      </button>

      <ConfiguratorModal product={configuring} preSelectedTierId={preTier} onClose={() => setConfiguring(null)} />
    </div>
  );
}
