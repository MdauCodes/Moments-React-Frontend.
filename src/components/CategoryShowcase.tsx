import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { Flame, Sparkles, Tag, ArrowRight } from "lucide-react";
import { api } from "@/services/api";
import type { Product } from "@/data/products";

type TabKey = "discount" | "new" | "fast";

const TABS: { key: TabKey; label: string; sublabel: string; icon: typeof Tag }[] = [
  { key: "discount", label: "Discounted", sublabel: "Save more on bulk", icon: Tag },
  { key: "new", label: "New arrivals", sublabel: "Hizi zimeingia jana", icon: Sparkles },
  { key: "fast", label: "Trending", sublabel: "People like these", icon: Flame },
];

const tabAccent: Record<TabKey, string> = {
  discount: "text-accent",
  new: "text-primary",
  fast: "text-kraft",
};

/**
 * Self-presenting product showcase. Three tabs (discount / new / fast),
 * each rendering an infinite-loop marquee of product cards. Auto-scrolls
 * via CSS keyframes; pauses on hover (desktop) and on touch (mobile).
 * Falls back gracefully when a tab has no products.
 */
export function CategoryShowcase() {
  const [active, setActive] = useState<TabKey>("discount");
  const [data, setData] = useState<Record<TabKey, Product[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [discount, fresh, fast] = await Promise.all([
        api.getProducts({ isDiscount: true }),
        api.getProducts({ isNewArrival: true }),
        api.getProducts({ isFastMoving: true }),
      ]);
      if (cancelled) return;
      setData({ discount, new: fresh, fast });
      // Default to first tab that actually has items
      const firstWithItems = (["discount", "new", "fast"] as TabKey[]).find(
        (k) => ({ discount, new: fresh, fast })[k].length > 0,
      );
      if (firstWithItems) setActive(firstWithItems);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => ({
      discount: data?.discount.length ?? 0,
      new: data?.new.length ?? 0,
      fast: data?.fast.length ?? 0,
    }),
    [data],
  );

  const totalItems = counts.discount + counts.new + counts.fast;
  if (data === null) return null;
  if (totalItems === 0) return null;

  const items = data[active];

  return (
    <section className="border-t border-border bg-secondary/40">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8 lg:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-accent sm:text-xs">Self-serve discovery</p>
            <h2 className="mt-1.5 font-display text-2xl font-medium text-foreground sm:text-3xl lg:text-4xl">
              Let the products talk.
            </h2>
            <p className="mt-1.5 max-w-md text-xs text-muted-foreground sm:text-sm">
              Tap a category — the rail moves on its own. Hold to pause, tap a card to dive in.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Product categories"
          className="scrollbar-hide mt-5 flex gap-2 overflow-x-auto pb-1 sm:mt-6 sm:gap-3"
        >
          {TABS.map((t) => {
            const isActive = active === t.key;
            const count = counts[t.key];
            const Icon = t.icon;
            const disabled = count === 0;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={disabled}
                onClick={() => setActive(t.key)}
                className={`group inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-left transition-all sm:px-4 sm:py-2.5 ${
                  isActive
                    ? "border-foreground bg-foreground text-background shadow-sm"
                    : disabled
                      ? "cursor-not-allowed border-border bg-background/60 text-muted-foreground/50"
                      : "border-border bg-background text-foreground hover:border-foreground/40"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-background" : disabled ? "" : tabAccent[t.key]}`} />
                <span className="text-xs font-semibold sm:text-sm">{t.label}</span>
                <span
                  className={`hidden text-[10px] font-medium uppercase tracking-wider sm:inline ${
                    isActive ? "text-background/70" : "text-muted-foreground"
                  }`}
                >
                  · {t.sublabel}
                </span>
                <span
                  className={`grid min-w-[20px] place-items-center rounded-full px-1.5 text-[10px] font-bold ${
                    isActive ? "bg-background/15 text-background" : "bg-secondary text-foreground/60"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Marquee rail */}
        <div className="relative mt-5 overflow-hidden sm:mt-6">
          {/* Edge fades */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-secondary/40 to-transparent sm:w-16" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-secondary/40 to-transparent sm:w-16" />

          <MarqueeRail key={active} items={items} flag={active} />
        </div>
      </div>
    </section>
  );
}

interface MarqueeRailProps {
  items: Product[];
  flag: TabKey;
}

function MarqueeRail({ items, flag }: MarqueeRailProps) {
  const [paused, setPaused] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  // Duplicate items so the loop is seamless. Need at least a few to feel alive.
  const looped = useMemo(() => {
    if (items.length === 0) return [];
    // Repeat enough times to overflow viewport on desktop too
    const minCopies = items.length < 4 ? 4 : 2;
    const out: Product[] = [];
    for (let i = 0; i < minCopies; i++) out.push(...items);
    return out;
  }, [items]);

  // Speed scales with item count so smaller sets don't whip across the screen
  const durationSec = Math.max(20, Math.min(60, looped.length * 4));

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet — check the other tabs.</p>;
  }

  return (
    <div
      ref={railRef}
      className="group/rail flex w-max gap-3 py-2 sm:gap-4"
      style={{
        animation: `marquee-x ${durationSec}s linear infinite`,
        animationPlayState: paused ? "paused" : "running",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {looped.map((p, idx) => (
        <ShowcaseCard key={`${p.id}-${idx}`} product={p} flag={flag} />
      ))}
    </div>
  );
}

function ShowcaseCard({ product, flag }: { product: Product; flag: TabKey }) {
  const accent = flag === "discount" ? "text-accent" : flag === "new" ? "text-primary" : "text-kraft";
  const cta =
    flag === "discount"
      ? product.discountPercent
        ? `Get ${product.discountPercent}% off`
        : "Grab the deal"
      : flag === "new"
        ? "Hizi zimeingia jana"
        : "People like these";

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group/card relative flex w-[170px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md sm:w-[200px]"
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        <img
          src={product.primaryImageUrl ?? ""}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
        />
        {flag === "discount" && product.discountPercent ? (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground shadow-sm">
            -{product.discountPercent}%
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3">
        <div>
          <h3 className="truncate font-display text-sm font-medium text-foreground sm:text-base">{product.name}</h3>
          <p className="mt-0.5 text-[10px] text-muted-foreground">MOQ {product.moq.toLocaleString()}</p>
        </div>
        <span className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${accent}`}>
          {cta}
          <ArrowRight className="h-3 w-3 transition-transform group-hover/card:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
