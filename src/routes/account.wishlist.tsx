import { Link } from "react-router-dom";

import { Heart, X, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { DashboardPageShell } from "@/components/dashboard/DashboardPageShell";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useWishlist } from "@/contexts/WishlistContext";
import { useCart } from "@/contexts/CartContext";
import { products } from "@/data/products";



function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function WishlistPage() {
  const { ids, remove } = useWishlist();
  const { addItem } = useCart();

  const items = products.filter((p) => ids.has(p.id));

  return (
    <ProtectedRoute>
    <DashboardPageShell>
      <section className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
        <h1 className="font-display text-3xl sm:text-4xl">Wishlist</h1>
        <p className="mt-2 text-sm text-muted-foreground">Saved products. Add to cart anytime.</p>

        {items.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">Your wishlist is empty.</p>
            <Link
              to="/products"
              className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Browse catalogue
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <li key={p.id} className="group relative overflow-hidden rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => {
                    remove(p.id);
                    toast.success("Removed from wishlist");
                  }}
                  className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-background/85 text-foreground/70 backdrop-blur hover:bg-background"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
                <Link to={`/products/${p.slug}`} className="block">
                  {p.primaryImageUrl ? (
                    <img
                      src={p.primaryImageUrl ?? ""}
                      alt={p.name}
                      className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-secondary">
                      <span className="text-xs text-muted-foreground/40">{p.name}</span>
                    </div>
                  )}
                </Link>
                <div className="p-4">
                  <Link
                    to={`/products/${p.slug}`}
                    className="block font-display text-lg leading-tight hover:text-accent"
                  >
                    {p.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.basePrice ? `From ${fmt(p.basePrice)} · ` : ""}MOQ {p.moq.toLocaleString()}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      addItem({
                        productId: p.id,
                        productName: p.name,
                        primaryImageUrl: p.primaryImageUrl ?? "",
                        size: p.sizes?.[0] ?? "Standard",
                        material: p.materials?.[0] ?? p.material ?? "Standard",
                        finish: p.finish ?? "Standard",
                        quantity: p.moq,
                        unitPrice: p.basePrice ?? 0,
                      });
                      toast.success("Added to cart");
                    }}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" /> Add to cart
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DashboardPageShell>
    </ProtectedRoute>
  );
}

export default WishlistPage;
