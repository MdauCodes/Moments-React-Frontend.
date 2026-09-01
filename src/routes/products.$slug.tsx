import { Link, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductDetailSkeleton } from "@/components/ProductDetailSkeleton";
import { ProductGallery } from "@/components/ProductGallery";
import { ProductCard } from "@/components/ProductCard";
import { ConfiguratorModal } from "@/components/ConfiguratorModal";
import { ProductReviews } from "@/components/ProductReviews";
import type { Product } from "@/data/products";
import { api } from "@/services/api";
import { apiUrl } from "@/config/api";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { getStockInfo } from "@/lib/stock";
import { reviewStore } from "@/services/reviewStore";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const wishlist = useWishlist();

  // ── loading state ───────────────────────────────────────────────────────
  const [product, setProduct] = useState<Product | null>(null);
  const [reviewSummary, setReviewSummary] = useState<{ count: number; average: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // ── product-dependent UI state (safe defaults) ──────────────────────────
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const [size, setSize] = useState("");
  const [material, setMaterial] = useState("");
  const [finish, setFinish] = useState("Standard");
  const [qty, setQty] = useState(1);
  const [qtyError, setQtyError] = useState<string | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [preTier, setPreTier] = useState<string | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string | null>(null);

  // ── fetch product ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    api.getProductBySlug(slug).then((p) => {
      if (!p) { navigate("/products", { replace: true }); return; }
      const variants = p.variants ?? [];
      const tiers = p.pricingTiers ?? [];
      const collTiers = (tiers as any[])
        .filter((t) => t && t.enabled !== false && t.collectionName && t.quantity)
        .sort((a, b) => (a.sortOrder ?? a.quantity) - (b.sortOrder ?? b.quantity));
      setProduct(p);
      setVariantId(variants[0]?.id ?? variants[0]?.label);
      setSize(p.sizes?.[0] ?? "");
      setMaterial((p as any).materials?.[0] ?? p.material ?? "");
      setFinish(p.finish ?? "Standard");
      setQty(p.moq);
      setSelectedTierId(collTiers.length > 0 ? ((collTiers[0] as any).id ?? "tier-0") : null);
      setLoading(false);
      reviewStore.listForProduct(p.slug).then(({ summary }) => {
        if (summary.count > 0) setReviewSummary({ count: summary.count, average: summary.average });
      }).catch(() => {});
    });
  }, [slug, navigate]);

  // ── derived state (all memos called unconditionally) ───────────────────
  const variants = product?.variants ?? [];
  const tiers = product?.pricingTiers ?? [];

  const allImages = useMemo(() => {
    if (!product) return [];
    return Array.from(new Set([product.primaryImageUrl, ...(product.imageUrls ?? [])].filter(Boolean) as string[]));
  }, [product]);

  const collectionTiers = useMemo(
    () => (tiers as any[])
      .filter((t) => t && t.enabled !== false && t.collectionName && t.quantity)
      .sort((a, b) => (a.sortOrder ?? a.quantity) - (b.sortOrder ?? b.quantity)),
    [tiers],
  );
  const hasCollections = collectionTiers.length > 0;
  const individualEnabled = product?.individualSalesEnabled === true;

  const activeVariant = useMemo(
    () => variants.find((v: any) => (v.id ?? v.label) === variantId) ?? (variants.length > 0 ? variants[0] : undefined),
    [variants, variantId],
  );

  const selectedTier = hasCollections && selectedTierId
    ? (collectionTiers.find((t: any) => (t.id ?? `tier-${collectionTiers.indexOf(t)}`) === selectedTierId) as any)
    : null;

  const legacyTier = useMemo(
    () => !hasCollections
      ? ((tiers as any[]).find((t) => qty >= (t.minQty ?? 0) && (t.maxQty === undefined || qty <= t.maxQty)) ?? tiers[tiers.length - 1])
      : null,
    [tiers, qty, hasCollections],
  );

  const unitPrice = selectedTier
    ? Number(selectedTier.pricePerUnit) || 0
    : (activeVariant?.price ?? (legacyTier as any)?.pricePerUnit ?? product?.basePrice ?? 0);
  const collectionQty = selectedTier ? Number(selectedTier.quantity) || 0 : 0;
  const collectionPrice = selectedTier ? Number(selectedTier.collectionPrice ?? unitPrice * collectionQty) || 0 : 0;
  const lineTotal = selectedTier ? qty * collectionPrice : qty * unitPrice;

  const stock = useMemo(
    () => product ? getStockInfo(product, activeVariant, qty) : { state: "untracked" as const, label: "", available: 0, isBackorder: false },
    [product, activeVariant, qty],
  );

  const enterprise = (product?.moq ?? 0) >= 10000;
  const saved = wishlist.has(product?.id ?? "");
  const productIndustries = product?.industries ?? [];
  const minQty = selectedTier ? 1 : (product?.moq ?? 1);

  // click tracking
  useEffect(() => {
    if (!product?.id) return;
    fetch(apiUrl(`/api/v1/public/products/${encodeURIComponent(product.id)}/click`), { method: "POST" }).catch(() => {});
  }, [product?.id]);

  // related products
  useEffect(() => {
    if (!product?.id) return;
    let cancelled = false;
    api.getRecommended().then((data) => {
      if (cancelled) return;
      setRelated(data.filter((p) => p.id !== product!.id).slice(0, 4));
    }).catch(() => setRelated([]));
    return () => { cancelled = true; };
  }, [product?.id]);

  // ── handlers ────────────────────────────────────────────────────────────
  const handleConfigure = (p: Product, tierId?: string) => { setPreTier(tierId ?? null); setConfiguring(p); };

  const handleQty = (v: string) => {
    const n = Number(v);
    if (Number.isNaN(n)) return;
    setQty(n);
    setQtyError(n < minQty ? `Minimum: ${minQty.toLocaleString()}` : null);
  };

  const handleSelectTier = (tierKey: string | null) => {
    setSelectedTierId(tierKey);
    setQty(tierKey ? 1 : (product?.moq ?? 1));
    setQtyError(null);
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (enterprise) { navigate("/enterprise-quote"); return; }
    if (qty < minQty) { setQtyError(`Minimum: ${minQty.toLocaleString()}`); return; }
    addItem({
      productId: product.id,
      productName: product.name,
      primaryImageUrl: product.primaryImageUrl ?? "",
      size: size || "Standard",
      material: material || "Standard",
      finish: finish || "Standard",
      quantity: qty,
      unitPrice: selectedTier ? Number(selectedTier.pricePerUnit) : unitPrice,
      variantId: activeVariant?.id ?? activeVariant?.label,
      variantLabel: activeVariant?.label,
      sku: activeVariant?.sku ?? product.sku,
      isBackorder: stock.isBackorder,
      tierId: selectedTier ? selectedTierId : null,
      collectionName: selectedTier?.collectionName,
      collectionQuantity: selectedTier ? collectionQty : undefined,
      totalUnits: selectedTier ? qty * collectionQty : qty,
    });
    toast.success(stock.isBackorder ? "Added — backorder (extended lead time)" : "Added to cart", { duration: 2400 });
  };

  const handleWishlist = async () => {
    if (!product) return;
    const nowSaved = await wishlist.toggle(product.id);
    toast.success(nowSaved ? "Saved to wishlist" : "Removed from wishlist");
  };

  const handleShare = async () => {
    if (!product) return;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: product.name, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    }
  };

  // ── early return AFTER all hooks ─────────────────────────────────────────
  if (loading || !product) return <SiteLayout><ProductDetailSkeleton /></SiteLayout>;

  return (
    <SiteLayout>
      <div className="bg-gradient-to-b from-cream/70 via-cream/20 to-transparent">
      <div className="mx-auto max-w-7xl px-5 pt-5 lg:px-8">
        <Link to="/products" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to catalogue
        </Link>
      </div>

      <nav className="mx-auto max-w-7xl px-5 pt-3 text-xs text-muted-foreground lg:px-8">
        <Link to="/" className="hover:text-foreground">Home</Link>
        <span className="mx-1.5">/</span>
        <Link to="/products" className="hover:text-foreground">Products</Link>
        <span className="mx-1.5">/</span>
        {product.subcategoryName ? (
          <>
            <span className="text-foreground/80">{product.segmentName}</span>
            <span className="mx-1.5">/</span>
            <span className="text-foreground/80">{product.categoryName}</span>
            <span className="mx-1.5">/</span>
            <span className="text-foreground/80">{product.subcategoryName}</span>
          </>
        ) : (
          <span className="text-foreground/80">{product.category}</span>
        )}
        <span className="mx-1.5">/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:gap-8 sm:py-8 lg:grid-cols-5 lg:gap-10 lg:px-8 lg:py-10">
        {/* LEFT — gallery */}
        <div className="lg:col-span-3">
          <ProductGallery
            images={allImages}
            productName={product.name}
            badges={
              <>
                {product.isNewArrival && <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">New</span>}
                {product.isDiscount && <span className="rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground">-{product.discountPercent ?? 10}%</span>}
                {product.isFastMoving && <span className="rounded-full bg-kraft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-kraft-foreground">Hot</span>}
              </>
            }
          />
        </div>

        {/* RIGHT — info + configurator */}
        <div className="lg:col-span-2">
          {productIndustries.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {productIndustries.map((ind: any) => (
                <span key={String(ind.id ?? ind.slug)} className="rounded-full border border-kraft/30 bg-kraft/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-kraft">
                  {ind.name}
                </span>
              ))}
            </div>
          )}
          <h1 className="font-display text-2xl font-medium text-foreground sm:text-3xl lg:text-[2rem]">{product.name}</h1>
          <div className="mt-3">
            <p className={`text-sm text-muted-foreground sm:text-base ${descExpanded ? "" : "line-clamp-3"}`}>{product.description}</p>
            {product.description && product.description.length > 160 && (
              <button type="button" onClick={() => setDescExpanded((v) => !v)} className="mt-1 text-xs font-medium text-accent hover:underline">
                {descExpanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>

          {/* Pricing */}
          <div className="mt-5">
            {hasCollections ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Choose how to buy</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {collectionTiers.map((t: any, i: number) => {
                    const key = t.id ?? `tier-${i}`;
                    const active = key === selectedTierId;
                    const cPrice = Number(t.collectionPrice ?? Number(t.pricePerUnit) * Number(t.quantity)) || 0;
                    return (
                      <button key={key} type="button" onClick={() => handleSelectTier(key)}
                        className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors ${active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card hover:border-foreground/40"}`}>
                        <span className="font-display text-base text-foreground">{t.uomName ?? t.collectionName}</span>
                        <span className="mt-0.5 text-xs text-muted-foreground">{Number(t.quantity).toLocaleString()} pieces each</span>
                        {t.uomDescription && <span className="mt-0.5 text-[11px] italic text-muted-foreground">{t.uomDescription}</span>}
                        <span className="mt-2 text-sm font-semibold text-foreground">KES {cPrice.toLocaleString()}</span>
                        <span className="text-[11px] text-muted-foreground">KES {Number(t.pricePerUnit).toLocaleString()}/piece</span>
                      </button>
                    );
                  })}
                  {individualEnabled && (
                    <button type="button" onClick={() => handleSelectTier(null)}
                      className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors ${selectedTierId === null ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border bg-card hover:border-foreground/40"}`}>
                      <span className="font-display text-base text-foreground">Individual pieces</span>
                      <span className="mt-0.5 text-xs text-muted-foreground">Buy any quantity</span>
                      <span className="mt-2 text-sm font-semibold text-foreground">KES {(product.basePrice ?? 0).toLocaleString()}/piece</span>
                    </button>
                  )}
                </div>
              </div>
            ) : tiers.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="grid grid-cols-2 bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                  <span>Quantity</span><span className="text-right">Price per unit</span>
                </div>
                {(tiers as any[]).map((t) => {
                  const isActive = t === legacyTier;
                  return (
                    <div key={`${t.minQty}-${t.maxQty ?? "max"}`} className={`grid grid-cols-2 px-4 py-2 text-sm ${isActive ? "bg-cream font-semibold text-foreground" : "text-foreground/80"}`}>
                      <span>{Number(t.minQty).toLocaleString()}{t.maxQty ? `–${Number(t.maxQty).toLocaleString()}` : "+"}</span>
                      <span className="text-right">KES {Number(t.pricePerUnit).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            ) : product.basePrice ? (
              <p className="font-display text-2xl text-foreground">
                KES {product.basePrice.toLocaleString()}
                <span className="ml-2 text-sm font-normal text-muted-foreground">per unit</span>
              </p>
            ) : (
              <p className="font-display text-2xl text-foreground">Price on request</p>
            )}
          </div>

          {/* Configurator */}
          <div className="mt-5 space-y-4 rounded-2xl border border-kraft/20 bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <StockBadge state={stock.state} label={stock.label} />
              {stock.state !== "untracked" && stock.state !== "out_of_stock" && Number.isFinite(stock.available) && stock.available > 0 && (
                <span className="text-xs text-muted-foreground/70">{stock.available.toLocaleString()} units available</span>
              )}
            </div>

            {variants.length > 0 && (
              <ConfigField label="Variant" note="(price & stock per variant)">
                <div className="flex flex-wrap gap-2">
                  {variants.map((v: any) => {
                    const key = v.id ?? v.label;
                    const active = key === variantId;
                    const vStock = getStockInfo(product, v, 0);
                    return (
                      <button key={key} type="button" onClick={() => setVariantId(key)}
                        className={`flex flex-col items-start rounded-xl border px-3.5 py-2 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-foreground/20 bg-cream hover:border-foreground/40"}`}>
                        <span className="text-xs font-semibold text-foreground">{v.label}</span>
                        <span className="mt-0.5 text-[11px] text-muted-foreground">
                          {v.price ? `KES ${v.price.toLocaleString()}` : "—"}{" · "}
                          <span className={vStock.state === "out_of_stock" ? "text-destructive" : vStock.state === "low_stock" ? "text-accent" : "text-foreground/70"}>
                            {vStock.state === "out_of_stock" ? "Backorder" : vStock.state === "low_stock" ? `${vStock.available} left` : "In stock"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ConfigField>
            )}

            {product.sizes && product.sizes.length > 0 && (
              <ConfigField label="Size"><PillGroup options={product.sizes} value={size} onChange={setSize} /></ConfigField>
            )}
            {((product as any).materials?.length ?? 0) > 0 && (
              <ConfigField label="Material"><PillGroup options={(product as any).materials!} value={material} onChange={setMaterial} /></ConfigField>
            )}
            {finish && (
              <ConfigField label="Finish"><PillGroup options={[finish]} value={finish} onChange={setFinish} /></ConfigField>
            )}

            <ConfigField
              label={selectedTier ? `Number of ${selectedTier.uomName ?? selectedTier.collectionName}s` : "Quantity"}
              note={selectedTier ? `(× ${collectionQty} pieces each)` : `(Min. ${product.moq.toLocaleString()} pieces)`}>
              <input type="number" min={minQty} step={1} value={qty}
                onChange={(e) => handleQty(e.target.value)}
                onBlur={() => { if (qty < minQty) setQty(minQty); setQtyError(null); }}
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              {qtyError && <p className="mt-1.5 text-xs text-accent">{qtyError}</p>}
            </ConfigField>

            <div className="rounded-xl bg-primary px-5 py-4 text-primary-foreground">
              {selectedTier ? (
                <p className="text-sm">
                  {qty.toLocaleString()} × {selectedTier.uomName ?? selectedTier.collectionName} (× {collectionQty} pieces each) ={" "}
                  <span className="font-display text-lg font-semibold">KES {lineTotal.toLocaleString()}</span>
                  <span className="ml-2 text-xs opacity-80">· {(qty * collectionQty).toLocaleString()} total pieces</span>
                </p>
              ) : unitPrice > 0 ? (
                <p className="text-sm">
                  {qty.toLocaleString()} × KES {unitPrice.toLocaleString()} ={" "}
                  <span className="font-display text-lg font-semibold">KES {lineTotal.toLocaleString()}</span>
                </p>
              ) : (
                <p className="text-sm">Price calculated on order — our team will confirm.</p>
              )}
            </div>

            {stock.isBackorder && !enterprise && (
              <div className="flex items-start gap-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-3 text-xs text-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" />
                {stock.state === "out_of_stock" ? (
                  <p><strong>Place your order</strong> — we'll fulfil from available or incoming stock. Same day within Nairobi, 2–3 days countrywide.</p>
                ) : (
                  <p><strong>Backorder:</strong> requested quantity may exceed current stock. Contact us to confirm availability.</p>
                )}
              </div>
            )}

            {enterprise ? (
              <button type="button" onClick={() => navigate("/enterprise-quote")}
                className="h-[52px] w-full rounded-full border border-primary text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground">
                Request enterprise quote →
              </button>
            ) : (
              <button type="button" onClick={handleAddToCart}
                className="h-[52px] w-full rounded-full bg-accent text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90">
                {stock.isBackorder ? "Add to cart (backorder)" : "Add to cart"}
              </button>
            )}

            <div className="flex items-center justify-center gap-6 pt-1 text-sm text-muted-foreground">
              <button type="button" onClick={handleWishlist} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Heart className={`h-4 w-4 ${saved ? "fill-accent text-accent" : ""}`} /> Save
              </button>
              <button type="button" onClick={handleShare} className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Share2 className="h-4 w-4" /> Share
              </button>
            </div>
          </div>

          <ul className="mt-5 flex flex-wrap gap-2 text-xs text-foreground/70">
            <li className="rounded-full border border-border bg-cream px-3 py-1">✓ Secure M-Pesa checkout</li>
            <li className="rounded-full border border-border bg-cream px-3 py-1">✓ Same day Nairobi / 2–3 days countrywide</li>
            <li className="rounded-full border border-border bg-cream px-3 py-1">✓ Custom branding included</li>
          </ul>
        </div>
      </section>
      </div>

      {/* Tabs */}
      <section className="mx-auto max-w-7xl px-5 pb-10 lg:px-8">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="bg-cream">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="sizes">Sizes & Specs</TabsTrigger>
            <TabsTrigger value="reviews">Reviews{reviewSummary ? ` (${reviewSummary.count})` : ""}</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              {product.material && <DetailRow label="Material" value={product.material} />}
              {product.finish && <DetailRow label="Finish" value={product.finish} />}
              {product.tags && product.tags.length > 0 && <DetailRow label="Tags" value={product.tags.join(", ")} />}
              {product.keywords && product.keywords.length > 0 && <DetailRow label="Keywords" value={product.keywords.join(", ")} />}
            </dl>
          </TabsContent>
          <TabsContent value="sizes" className="mt-6">
            {product.sizes && product.sizes.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="grid grid-cols-2 bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
                  <span>Size</span><span>Description</span>
                </div>
                {product.sizes.map((s: string) => (
                  <div key={s} className="grid grid-cols-2 border-t border-border px-4 py-2 text-sm">
                    <span className="font-medium text-foreground">{s}</span>
                    <span className="text-muted-foreground">Standard {product.category}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sizes available on request.</p>
            )}
          </TabsContent>
          <TabsContent value="reviews" className="mt-6">
            <ProductReviews productId={product.id} productSlug={product.slug} productName={product.name} />
          </TabsContent>
        </Tabs>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-14 sm:pb-16 lg:px-8">
          <h2 className="font-display text-2xl text-foreground sm:text-3xl">You might also like</h2>
          <div className="mt-5 grid gap-5 sm:mt-6 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {related.map((p) => <ProductCard key={p.id} product={p} onConfigure={handleConfigure} />)}
          </div>
        </section>
      )}

      <ConfiguratorModal product={configuring} preSelectedTierId={preTier} onClose={() => setConfiguring(null)} />
    </SiteLayout>
  );
}

function ConfigField({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}{note && <span className="ml-1 font-normal normal-case tracking-normal text-foreground/60">{note}</span>}
      </p>
      {children}
    </div>
  );
}

function PillGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(opt)}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${opt === value ? "border-primary bg-primary text-primary-foreground" : "border-foreground/20 bg-cream text-foreground hover:border-foreground/40"}`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

function StockBadge({ state, label }: { state: string; label: string }) {
  if (state === "untracked") return null;
  const styles = state === "out_of_stock" ? "bg-red-50 text-red-700 border-red-300"
    : state === "low_stock" ? "bg-amber-50 text-amber-700 border-amber-300"
    : "bg-green-50 text-green-700 border-green-300";
  const displayLabel = state === "out_of_stock" ? "Out of stock" : state === "low_stock" ? "Low stock" : "In stock";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${styles}`} title={label}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" /> {displayLabel}
    </span>
  );
}
