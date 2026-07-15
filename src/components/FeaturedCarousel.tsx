import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowRight, ChevronLeft, ChevronRight, Flame, Sparkles, Tag } from "lucide-react";
import { api } from "@/services/api";
import type { Product } from "@/data/products";

type Flag = "discount" | "new" | "fast";

interface FlaggedProduct extends Product {
  flag: Flag;
}

const flagMeta: Record<Flag, { label: string; icon: typeof Tag; tone: string; ctaTone: string }> = {
  discount: {
    label: "Deal",
    icon: Tag,
    tone: "bg-accent/15 text-accent",
    ctaTone: "text-accent",
  },
  new: {
    label: "Mpya",
    icon: Sparkles,
    tone: "bg-primary/10 text-primary",
    ctaTone: "text-primary",
  },
  fast: {
    label: "Hot",
    icon: Flame,
    tone: "bg-kraft/15 text-kraft",
    ctaTone: "text-kraft",
  },
};

function getCardCopy(p: FlaggedProduct): { hook: string; cta: string } {
  switch (p.flag) {
    case "discount":
      return {
        hook: p.discountPercent ? `Save ${p.discountPercent}% on bulk orders` : "Limited-time bulk deal",
        cta: p.discountPercent ? `Get ${p.discountPercent}% off` : "Grab the deal",
      };
    case "fast":
      return {
        hook: "Restocked weekly — brands keep reordering",
        cta: "People like these",
      };
    case "new":
      return {
        hook: "Fresh in the warehouse this week",
        cta: "Hizi zimeingia jana",
      };
  }
}

export function FeaturedCarousel() {
  const [items, setItems] = useState<FlaggedProduct[] | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [discount, fresh, fast] = await Promise.all([
        api.getProducts({ isDiscount: true }),
        api.getProducts({ isNewArrival: true }),
        api.getProducts({ isFastMoving: true }),
      ]);
      const merged = new Map<string, FlaggedProduct>();
      discount.forEach((p) => merged.set(p.id, { ...p, flag: "discount" }));
      fresh.forEach((p) => {
        if (!merged.has(p.id)) merged.set(p.id, { ...p, flag: "new" });
      });
      fast.forEach((p) => {
        if (!merged.has(p.id)) merged.set(p.id, { ...p, flag: "fast" });
      });
      if (!cancelled) setItems(Array.from(merged.values()));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    if (!items || items.length === 0) return;
    updateScrollState();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [items]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-carousel-card]");
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  };

  const heading = useMemo(() => "Picks of the moment", []);

  if (items === null) return null;
  const isEmpty = items.length === 0;

  return (
    <section className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:py-10 lg:px-8 lg:py-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-accent sm:text-xs">Curated highlights</p>
            <h2 className="mt-1.5 font-display text-xl font-medium text-foreground sm:text-2xl lg:text-3xl">
              {heading}
            </h2>
          </div>
          {!isEmpty && (
            <div className="hidden items-center gap-1.5 sm:flex">
              <button
                type="button"
                onClick={() => scrollBy(-1)}
                disabled={!canPrev}
                aria-label="Scroll left"
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-foreground/70 transition-all hover:bg-secondary disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(1)}
                disabled={!canNext}
                aria-label="Scroll right"
                className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background text-foreground/70 transition-all hover:bg-secondary disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {isEmpty ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing featured right now — check back soon.</p>
        ) : (
          <div
            ref={scrollerRef}
            className="scrollbar-hide mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4"
          >
            {items.map((p) => {
              const meta = flagMeta[p.flag];
              const Icon = meta.icon;
              const copy = getCardCopy(p);
              return (
                <Link
                  key={p.id}
                  to={`/products/${p.slug}`}
                  data-carousel-card
                  className="group flex w-[72%] shrink-0 snap-start gap-3 rounded-xl border border-border bg-card p-2.5 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md sm:w-[300px] sm:p-3"
                >
                  <div className="relative aspect-square h-[88px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-secondary sm:h-24 sm:w-24">
                    {p.primaryImageUrl ? (
                      <img
                        src={p.primaryImageUrl}
                        alt={p.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-secondary" />
                    )}
                    {p.flag === "discount" && p.discountPercent ? (
                      <span className="absolute left-1 top-1 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground shadow-sm">
                        -{p.discountPercent}%
                      </span>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                    <div className="min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${meta.tone}`}
                      >
                        <Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                      <h3 className="mt-1 truncate font-display text-sm font-medium text-foreground sm:text-base">
                        {p.name}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{copy.hook}</p>
                    </div>
                    <span className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold ${meta.ctaTone}`}>
                      {copy.cta}
                      <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
