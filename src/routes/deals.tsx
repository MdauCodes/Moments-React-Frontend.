import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { ProductCard } from "@/components/ProductCard";
import { ConfiguratorModal } from "@/components/ConfiguratorModal";
import { api } from "@/services/api";
import type { Product } from "@/data/products";

/**
 * Genuine markdowns (Product.isDiscount) mixed with cosmetic slow-mover picks (dealType COSMETIC
 * from the backend) — api.getDeals() already display-augments the cosmetic ones with a synthetic
 * "was" price for ProductCard to render, so this page just renders the combined list like any
 * other product grid. No filters/search here by design — this is a curated "worth a look" page,
 * not another cut of the full catalogue.
 */
function DealsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [preTier, setPreTier] = useState<string | null>(null);

  useEffect(() => { document.title = "Deals — Moments Packaging Kenya"; }, []);

  useEffect(() => {
    let cancelled = false;
    api.getDeals()
      .then((data) => { if (!cancelled) setProducts(data); })
      .catch(() => { if (!cancelled) setProducts([]); });
    return () => { cancelled = true; };
  }, []);

  const handleConfigure = (p: Product, tierId?: string) => {
    setPreTier(tierId ?? null);
    setConfiguring(p);
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Save today</p>
        <h1 className="mt-2 font-display text-3xl font-medium text-foreground sm:text-4xl">Deals</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          A mix of real markdowns and picks we're nudging you toward — every price shown is
          exactly what you'll pay at checkout.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {products === null ? (
            Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
          ) : products.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-16 text-center">
              <h3 className="font-display text-xl text-foreground">No deals right now</h3>
              <p className="mt-2 text-sm text-muted-foreground">Check back soon — this page refreshes regularly.</p>
            </div>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} onConfigure={handleConfigure} />)
          )}
        </div>
      </div>

      <ConfiguratorModal product={configuring} preSelectedTierId={preTier} onClose={() => setConfiguring(null)} />
    </SiteLayout>
  );
}

export default DealsPage;
