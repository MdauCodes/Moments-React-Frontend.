import { Link, useNavigate } from "react-router-dom";

import { ArrowRight, MessageCircle, Trash2, ShoppingBag } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { RewardDeliveryBanners } from "@/components/RewardDeliveryBanners";
import { QuickAddProductStrip } from "@/components/QuickAddProductStrip";
import { useCart } from "@/contexts/CartContext";
import { WHATSAPP_NUMBER } from "@/data/products";



function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function CartPage() {
  const { items, updateQuantity, removeItem, cartTotal, cartLoading } = useCart();
  const navigate = useNavigate();

  function handleWhatsApp() {
    const lines = items.map((it, i) =>
      `${i + 1}. ${it.productName} — Qty ${it.quantity}, Size ${it.size}, Material ${it.material}, Finish ${it.finish}`,
    ).join("\n");
    const message = `Hi Moments Packaging, I'd like to enquire about a custom quote:\n\n${lines}\n\nSubtotal: ${fmt(cartTotal)} (shipping calculated at checkout)\n\nCould you confirm pricing and lead time?`;
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, "_blank");
  }

  if (cartLoading) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
          <div className="shimmer h-9 w-48 rounded-md" />
          <div className="shimmer mt-2 h-4 w-64 rounded-md" />
          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="shimmer h-28 w-full rounded-2xl" />
              ))}
            </div>
            <div className="shimmer h-72 w-full rounded-2xl lg:col-span-1" />
          </div>
        </section>
      </SiteLayout>
    );
  }

  if (items.length === 0) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-3xl px-5 py-20 text-center lg:px-8 lg:py-28">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-6 font-display text-4xl">Your cart is empty</h1>
          <p className="mt-3 text-muted-foreground">
            Add packaging from the catalogue, then come back to check out.
          </p>
          <Link
            to="/products"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Browse catalogue <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        <h1 className="font-display text-3xl sm:text-4xl">Your cart</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} item{items.length !== 1 ? "s" : ""} · review and proceed to checkout.
        </p>

        <div className="mt-5">
          <RewardDeliveryBanners />
        </div>

        <div className="mt-5">
          <QuickAddProductStrip />
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          {/* Items */}
          <div className="lg:col-span-2">
            <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
              {items.map((it) => (
                <li key={it.id} className="flex gap-4 p-4 sm:p-5">
                  <img
                    src={it.primaryImageUrl}
                    alt={it.productName}
                    className="h-20 w-20 flex-shrink-0 rounded-lg object-cover sm:h-24 sm:w-24"
                  />
                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display text-base text-foreground">{it.productName}</h3>
                        {it.collectionName && (
                          <p className="mt-0.5 text-xs font-semibold text-accent">
                            {it.collectionName}
                            {it.collectionQuantity ? ` of ${it.collectionQuantity} units` : ""}
                          </p>
                        )}
                        {(() => {
                          const descriptors = Array.from(
                            new Set(
                              [it.variantLabel, it.size, it.material, it.finish]
                                .filter((v): v is string => !!v && v.trim().length > 0)
                                .map((v) => v.trim()),
                            ),
                          );
                          if (descriptors.length === 0 && !it.sku) return null;
                          return (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {descriptors.join(" · ")}
                              {it.sku && (
                                <span className={descriptors.length ? "ml-2 text-foreground/40" : "text-foreground/40"}>
                                  SKU {it.sku}
                                </span>
                              )}
                            </p>
                          );
                        })()}
                        {it.isBackorder && (
                          <p className="mt-1 inline-flex rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                            Backorder · ~21 days
                          </p>
                        )}
                        {/* Clear price breakdown */}
                        <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                          <p>
                            <span className="text-foreground">{fmt(it.unitPrice)}</span> per unit
                            {it.collectionName && it.collectionQuantity ? (
                              <>
                                {" "}·{" "}
                                <span className="text-foreground">
                                  {fmt(it.unitPrice * it.collectionQuantity)}
                                </span>{" "}
                                per {it.collectionName.toLowerCase()}
                              </>
                            ) : null}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        className="rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        aria-label={`Remove ${it.productName}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          {it.collectionName ? `${it.collectionName}s` : "Qty"}
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={it.quantity}
                            onChange={(e) => {
                              const v = Math.max(1, Number(e.target.value) || 1);
                              updateQuantity(it.id, v);
                            }}
                            onBlur={(e) => {
                              const v = Math.max(1, Number(e.target.value) || 1);
                              if (v !== it.quantity) updateQuantity(it.id, v);
                            }}
                            className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                        </label>
                        {it.collectionName && it.collectionQuantity ? (
                          <p className="text-[11px] text-muted-foreground">
                            = {(it.totalUnits ?? it.quantity * it.collectionQuantity).toLocaleString()} units total
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">Minimum order: 1 unit</p>
                        )}
                      </div>
                      <p className="font-display text-base">{fmt(it.lineTotal)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>


            <Link to="/products" className="mt-4 inline-flex items-center gap-1 text-sm text-accent hover:underline">
              ← Continue shopping
            </Link>
          </div>

          {/* Summary */}
          <aside className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="font-display text-xl">Order summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{fmt(cartTotal)}</dd></div>
                <p className="text-xs text-muted-foreground">
                  Shipping calculated at checkout based on your delivery zone.
                </p>
              </dl>
              <button
                type="button"
                onClick={() => navigate("/checkout")}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90"
              >
                Proceed to checkout <ArrowRight className="h-4 w-4" />
              </button>

              <div className="mt-5 rounded-xl border border-dashed border-border bg-background/50 p-3">
                <p className="text-xs text-muted-foreground">
                  Need a custom price or longer lead time? Send this list to us first:
                </p>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-xs font-medium text-foreground hover:bg-secondary"
                >
                  <MessageCircle className="h-4 w-4" /> Enquire on WhatsApp first
                </button>
              </div>

              <p className="mt-4 text-[11px] text-muted-foreground">
                Pay securely with M-Pesa STK push. Card and bank options coming soon.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </SiteLayout>
  );
}

export default CartPage;
