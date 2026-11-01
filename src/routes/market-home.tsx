import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Flame,
  Info,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Tag,
  TrendingUp,
  Truck,
  User,
  Wallet,
} from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { PageProgressBar } from "@/components/PageProgressBar";
import { CookieConsent } from "@/components/CookieConsent";
import { AppSplash } from "@/components/AppSplash";
import { BottomNav } from "@/components/BottomNav";
import { AddToHomeScreenPrompt } from "@/components/AddToHomeScreenPrompt";
import { CartAddedSheet } from "@/components/CartAddedSheet";
import { ConfiguratorModal } from "@/components/ConfiguratorModal";
import { SearchCommand } from "@/components/SearchCommand";
import { ShopMegaMenu } from "@/components/ShopMegaMenu";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useCart } from "@/contexts/CartContext";
import { useCartBump } from "@/hooks/useCartBump";
import { api, type Segment, type Subcategory } from "@/services/api";
import type { Product } from "@/data/products";
import { cloudinaryOptimized } from "@/lib/cloudinaryImage";
import { getQuickAddOptions, trackProductClick, type QuickAddOption } from "@/lib/quickAdd";
import { getStockInfo } from "@/lib/stock";
import { imageForSegment, altForSegment } from "@/lib/segmentImages";
import logoUrl from "@/assets/moments_logo_without_background.png";

/*
 * The front page in the manner of a big market (owner, 2026-11-01, after Alibaba): search first,
 * the categories to jump into, then products with their prices — deals, bulk savings, what's
 * trending and an endless "Picked for you" feed. Every call to action of the old page stays, just
 * smaller and closer to the products. The old page, with its story and explanations, lives on at
 * /discover ("Why Moments"). Plan: plans/MARKET_HOME_PLAN_2026-11-01.md.
 *
 * Honesty rules carried over from the Deals page: no invented scarcity, no countdown without a real
 * end date, every price exactly what checkout charges.
 */

const SPLASH_KEY = "moments_splash_shown";
const GOLD = "#e8c878";
const FEED_BATCH = 12;
const FEED_MAX = 96;

/** An icon with its word underneath (owner, 2026-11-01), as in the site header and the bottom bar. */
const LABELLED_ICON =
  "flex h-12 min-w-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-[11px] font-medium leading-none hover:bg-white/10";

const kes = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: n < 10 ? 2 : 0 })}`;

/** One tap opens the configurator for a product; shared by every card on the page. */
type Configure = (p: Product) => void;

// ── Price facts for a card ──

type PriceFacts = {
  /** The lowest price per single unit across the product's buying options. */
  unitPrice: number;
  unitNoun: string;
  /** The same unit's price before a real or display markdown, when there is one. */
  wasUnitPrice?: number;
  /** The best bulk option, when buying more really is cheaper per unit. */
  bulk?: { label: string; savingsPct: number };
};

function perUnit(o: QuickAddOption): number {
  return o.totalUnits > 0 ? o.lineTotal / o.totalUnits : o.unitPrice;
}

function priceFacts(p: Product): PriceFacts | null {
  const options = getQuickAddOptions(p).filter((o) => perUnit(o) > 0);
  if (options.length === 0) return null;
  const cheapest = options.reduce((a, b) => (perUnit(b) < perUnit(a) ? b : a));
  const unitPrice = perUnit(cheapest);

  let wasUnitPrice: number | undefined;
  const wasTier = cheapest.rawTier?.originalCollectionPrice;
  if (wasTier && cheapest.packQty > 0) wasUnitPrice = wasTier / cheapest.packQty;
  else if (!cheapest.rawTier && p.originalBasePrice) wasUnitPrice = p.originalBasePrice;
  if (wasUnitPrice && wasUnitPrice <= unitPrice) wasUnitPrice = undefined;

  const bulk =
    options.length > 1 && cheapest.savingsPct > 0
      ? { label: cheapest.label, savingsPct: cheapest.savingsPct }
      : undefined;

  return { unitPrice, unitNoun: cheapest.unitNoun || "piece", wasUnitPrice, bulk };
}

function discountPct(p: Product, facts: PriceFacts | null): number {
  if (p.discountPercent) return Math.round(p.discountPercent);
  if (facts?.wasUnitPrice) return Math.round((1 - facts.unitPrice / facts.wasUnitPrice) * 100);
  return 0;
}

/** Products a shopper can actually put in the cart right now. */
function buyable(list: Product[]): Product[] {
  return list.filter((p) => getStockInfo(p).canOrder && priceFacts(p) !== null);
}

function useProducts(fetcher: () => Promise<Product[]>, deps: unknown[] = []) {
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => !cancelled && setProducts(buyable(data)))
      .catch(() => !cancelled && setProducts([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return products;
}

// ── First-visit splash (same once-per-session key as the full page) ──

function FirstVisitSplash() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SPLASH_KEY)) return;
      sessionStorage.setItem(SPLASH_KEY, "1");
      setShow(true);
    } catch {
      /* storage blocked: no splash */
    }
  }, []);
  return show ? <AppSplash /> : null;
}

// ── Header: logo, a real search box, cart ──

function MarketHeader() {
  const { openLogin } = useAuthModal();
  const { isAuthenticated } = useAuth();
  const { itemCount } = useCart();
  const cartBump = useCartBump();
  const [searchOpen, setSearchOpen] = useState(false);

  const searchBox = (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      className="flex h-11 w-full min-w-0 items-center gap-2 rounded-full bg-white pl-4 pr-1.5 text-left text-sm text-muted-foreground shadow-sm ring-2 ring-transparent transition focus-visible:ring-[#e8c878]"
      aria-label="Search packaging products"
    >
      <Search className="h-4 w-4 shrink-0 text-forest" />
      <span className="min-w-0 flex-1 truncate">Search bags, boxes, cups, containers…</span>
      <span
        className="hidden shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold text-forest sm:inline"
        style={{ background: GOLD }}
      >
        Search
      </span>
    </button>
  );

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10"
      style={{ background: "color-mix(in oklab, var(--forest) 94%, black)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 lg:gap-6 lg:px-8">
        <Link
          to="/"
          aria-label="Moments Packaging Kenya — Home"
          className="flex shrink-0 items-center"
        >
          <img
            src={logoUrl}
            alt="Moments Packaging Kenya logo"
            width={160}
            height={40}
            className="h-8 w-auto sm:h-9"
          />
        </Link>
        <div className="hidden min-w-0 flex-1 md:block">{searchBox}</div>
        <nav
          aria-label="Main"
          className="ml-auto hidden items-center gap-5 text-sm font-medium text-white lg:flex"
        >
          <ShopMegaMenu
            triggerClassName="inline-flex items-center gap-1 hover:opacity-80"
            chevronClassName="h-3 w-3"
          />
          <Link to="/deals" className="hover:opacity-80" style={{ color: GOLD }}>
            Deals
          </Link>
          <Link to="/discover" className="hover:opacity-80">
            Why Moments
          </Link>
          <Link to="/orders/track" className="hover:opacity-80">
            Track order
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1 text-white lg:ml-0">
          <Link to="/discover" className={`${LABELLED_ICON} lg:hidden`}>
            <Info className="h-5 w-5" />
            Why Moments
          </Link>
          {isAuthenticated ? (
            <Link to="/account/dashboard" className={LABELLED_ICON}>
              <User className="h-5 w-5" />
              Account
            </Link>
          ) : (
            <button type="button" onClick={() => openLogin()} className={LABELLED_ICON}>
              <User className="h-5 w-5" />
              Sign in
            </button>
          )}
          <Link
            to="/cart"
            aria-label={
              itemCount > 0 ? `Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}` : "Cart"
            }
            className={`${LABELLED_ICON} transition-transform duration-500 ${cartBump ? "scale-110" : "scale-100"}`}
          >
            <span className="relative">
              <ShoppingBag className="h-5 w-5" />
              {itemCount > 0 && (
                <span
                  className="absolute -right-3 -top-2 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-forest"
                  style={{ background: GOLD }}
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </span>
            Cart
          </Link>
        </div>
      </div>
      <div className="px-4 pb-3 md:hidden">{searchBox}</div>
      <SearchCommand open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}

// ── Campaign strip: one line, words from live deals only ──

function CampaignStrip({ deals }: { deals: Product[] | null }) {
  const { openRegister } = useAuthModal();
  const best = useMemo(
    () => (deals ?? []).reduce((max, p) => Math.max(max, discountPct(p, priceFacts(p))), 0),
    [deals],
  );
  const base =
    "flex w-full items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold sm:text-sm";

  if (deals && deals.length > 0) {
    return (
      <Link to="/deals" className={base} style={{ background: GOLD, color: "var(--forest)" }}>
        <Flame className="h-4 w-4 shrink-0" />
        <span className="truncate">
          {deals.length} deal{deals.length === 1 ? "" : "s"} on now
          {best > 0 ? ` — up to ${best}% off` : ""}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" })}
      className={base}
      style={{ background: GOLD, color: "var(--forest)" }}
    >
      <Sparkles className="h-4 w-4 shrink-0" />
      <span className="truncate">1,000 reward coupons free when you sign up</span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </button>
  );
}

// ── Category circles ──

function CategoryCircles() {
  const [segments, setSegments] = useState<Segment[]>([]);
  useEffect(() => {
    let cancelled = false;
    api
      .getSegments()
      .then((data) => !cancelled && setSegments(data))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const circle =
    "grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-white shadow-sm sm:h-20 sm:w-20";
  const label =
    "line-clamp-2 w-[76px] text-center text-[11px] font-medium leading-tight text-foreground sm:w-[88px] sm:text-xs";

  return (
    <nav aria-label="Shop by category" className="mx-auto max-w-7xl px-4 pt-4 lg:px-8">
      <ul className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:gap-4 lg:mx-0 lg:gap-5 lg:px-0">
        <li>
          <Link to="/deals" className="flex flex-col items-center gap-1.5">
            <span className={circle} style={{ background: "#7a2f22" }}>
              <Tag className="h-7 w-7" style={{ color: GOLD }} />
            </span>
            <span className={label}>Deals</span>
          </Link>
        </li>
        <li>
          <Link to="/products?newArrivals=true" className="flex flex-col items-center gap-1.5">
            <span className={circle} style={{ background: "var(--forest)" }}>
              <Sparkles className="h-7 w-7" style={{ color: GOLD }} />
            </span>
            <span className={label}>New in</span>
          </Link>
        </li>
        {segments.map((seg, i) => (
          <li key={seg.id}>
            <Link
              to={`/products?segmentId=${seg.id}`}
              className="flex flex-col items-center gap-1.5"
            >
              <span className={circle}>
                <img
                  src={imageForSegment(seg.name, i)}
                  alt={altForSegment(seg.name)}
                  width={80}
                  height={80}
                  loading={i < 6 ? "eager" : "lazy"}
                  className="h-full w-full object-cover"
                />
              </span>
              <span className={label}>{seg.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Compact swipe banner (always looks like a banner, never like a product) ──

type Slide = {
  key: string;
  kicker: string;
  title: string;
  line: string;
  cta: string;
  to?: string;
  onClick?: () => void;
  bg: string;
  image?: string;
};

function BannerCarousel({ deals }: { deals: Product[] | null }) {
  const { openRegister } = useAuthModal();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const slides = useMemo<Slide[]>(() => {
    const list: Slide[] = [];
    const topDeal = (deals ?? []).find((p) => p.primaryImageUrl);
    if (deals && deals.length > 0) {
      const best = deals.reduce((max, p) => Math.max(max, discountPct(p, priceFacts(p))), 0);
      list.push({
        key: "deals",
        kicker: "Deals",
        title: best > 0 ? `Up to ${best}% off packaging` : "Today's packaging deals",
        line: `${deals.length} offer${deals.length === 1 ? "" : "s"} on now. While stock lasts.`,
        cta: "See the offers",
        to: "/deals",
        bg: "linear-gradient(120deg, #7a2f22 0%, #4a1912 100%)",
        image: topDeal?.primaryImageUrl,
      });
    }
    list.push({
      key: "business",
      kicker: "Business accounts",
      title: "5% welcome code for your business",
      line: "Open a free business account for tax invoices and your order history.",
      cta: "Open a business account",
      onClick: () => openRegister({ accountType: "BUSINESS" }),
      bg: "linear-gradient(120deg, var(--forest) 0%, color-mix(in oklab, var(--forest) 70%, black) 100%)",
    });
    list.push({
      key: "bulk",
      kicker: "Bulk orders",
      title: "Ordering 10,000+ units?",
      line: "Get a quote for large and custom-branded orders, with your logo on it.",
      cta: "Get a quote",
      to: "/enterprise-quote",
      bg: "linear-gradient(120deg, #3b3f2c 0%, #1f2218 100%)",
    });
    return list;
  }, [deals, openRegister]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => window.clearInterval(t);
  }, [paused, slides.length]);

  const slide = slides[index % slides.length];
  const ctaClass =
    "mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-forest";

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="relative h-[168px] overflow-hidden rounded-2xl border-2 sm:h-[200px] lg:h-full lg:min-h-[220px]"
      style={{ background: slide.bg, borderColor: GOLD }}
    >
      {slide.image && (
        <img
          src={cloudinaryOptimized(slide.image, 480)}
          alt=""
          aria-hidden="true"
          className="absolute inset-y-0 right-0 h-full w-[45%] object-cover opacity-90 [mask-image:linear-gradient(to_right,transparent,black_45%)]"
        />
      )}
      <div className="relative flex h-full max-w-[75%] flex-col justify-center px-5 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
          {slide.kicker}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold leading-tight text-white sm:text-3xl">
          {slide.title}
        </h2>
        <p className="mt-1 line-clamp-2 text-xs text-white/85 sm:text-sm">{slide.line}</p>
        <div>
          {slide.to ? (
            <Link to={slide.to} className={ctaClass} style={{ background: GOLD }}>
              {slide.cta} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={slide.onClick}
              className={ctaClass}
              style={{ background: GOLD }}
            >
              {slide.cta} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {slides.length > 1 && (
        <div className="absolute bottom-2.5 right-3 flex gap-1.5">
          {slides.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-label={`Show offer ${i + 1}: ${s.kicker}`}
              aria-current={i === index % slides.length}
              onClick={() => setIndex(i)}
              className="grid h-6 w-6 place-items-center"
            >
              <span
                className="block h-1.5 rounded-full transition-all"
                style={{
                  width: i === index % slides.length ? 18 : 6,
                  background: i === index % slides.length ? GOLD : "rgba(255,255,255,0.5)",
                }}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

/** "Frequently searched" tiles beside the banner on a computer (Alibaba's first row). */
function PopularSubcategories() {
  const [subs, setSubs] = useState<Subcategory[]>([]);
  useEffect(() => {
    let cancelled = false;
    api
      .getPopularSubcategories({ limit: 6 })
      .then((data) => !cancelled && setSubs(data.slice(0, 6)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  if (subs.length === 0) return null;
  return (
    <section
      aria-labelledby="popular-title"
      className="hidden rounded-2xl border border-border bg-card p-4 lg:block"
    >
      <h2
        id="popular-title"
        className="flex items-center gap-2 text-sm font-semibold text-foreground"
      >
        <TrendingUp className="h-4 w-4 text-accent" /> Frequently searched
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2">
        {subs.map((s) => (
          <li key={s.id}>
            <Link
              to={`/products?subcategoryId=${s.id}`}
              className="block truncate rounded-lg bg-cream px-3 py-2.5 text-xs font-medium text-foreground hover:bg-accent/10"
            >
              {s.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ── The market product card ──

function MarketCard({
  product: p,
  onConfigure,
  rank,
  showBulk,
}: {
  product: Product;
  onConfigure: Configure;
  rank?: number;
  showBulk?: boolean;
}) {
  const facts = priceFacts(p);
  const stock = getStockInfo(p);
  const pct = discountPct(p, facts);
  const image = cloudinaryOptimized(p.primaryImageUrl, 320);

  return (
    <Link
      to={`/products/${p.slug}/`}
      onClick={() => trackProductClick(p.id)}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-secondary">
        {image ? (
          <img
            src={image}
            alt={p.name}
            loading="lazy"
            width={320}
            height={320}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center px-3 text-center text-[10px] font-medium uppercase text-muted-foreground/80">
            {p.name}
          </span>
        )}
        {rank != null && (
          <span
            className="absolute left-0 top-0 rounded-br-xl px-2.5 py-1 text-sm font-bold text-forest"
            style={{ background: GOLD }}
          >
            #{rank}
          </span>
        )}
        {pct > 0 && (
          <span className="absolute right-1.5 top-1.5 rounded-md bg-[#b3261e] px-1.5 py-0.5 text-[11px] font-bold text-white">
            -{pct}%
          </span>
        )}
        {rank == null && p.isNewArrival && pct === 0 && (
          <span className="absolute left-1.5 top-1.5 rounded-md bg-forest px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
            New
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2.5 sm:p-3">
        <h3 className="line-clamp-2 font-sans min-h-[2.5em] text-xs font-medium leading-tight text-foreground sm:text-sm">
          {p.name}
        </h3>
        {facts && (
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-base font-bold text-foreground sm:text-lg">
              {kes(facts.unitPrice)}
            </span>
            <span className="text-[11px] text-muted-foreground">/{facts.unitNoun}</span>
            {facts.wasUnitPrice && (
              <span className="text-[11px] text-muted-foreground line-through">
                {kes(facts.wasUnitPrice)}
              </span>
            )}
          </p>
        )}
        {showBulk && facts?.bulk ? (
          <p className="text-[11px] font-semibold text-forest-bright">
            Save {facts.bulk.savingsPct}% by the {facts.bulk.label.toLowerCase()}
          </p>
        ) : p.moq > 1 ? (
          <p className="text-[11px] text-muted-foreground">Min. order {p.moq}</p>
        ) : null}
        {stock.state === "low_stock" && (
          <p className="text-[11px] font-semibold text-amber-800">{stock.label}</p>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            trackProductClick(p.id);
            onConfigure(p);
          }}
          className="mt-auto inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-full bg-forest text-xs font-semibold text-white transition hover:opacity-90"
        >
          <ShoppingBag className="h-3.5 w-3.5" /> Add to cart
        </button>
      </div>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="aspect-square w-full animate-pulse bg-secondary" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-4/5 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
        <div className="h-8 w-full animate-pulse rounded-full bg-secondary" />
      </div>
    </div>
  );
}

// ── A titled row of cards: swipe on a phone, grid on a computer ──

function Shelf({
  id,
  icon: Icon,
  title,
  seeAllHref,
  products,
  onConfigure,
  ranked,
  showBulk,
  tone = "plain",
  aside,
}: {
  id: string;
  icon: typeof Flame;
  title: string;
  seeAllHref: string;
  products: Product[] | null;
  onConfigure: Configure;
  ranked?: boolean;
  showBulk?: boolean;
  tone?: "plain" | "deal";
  aside?: React.ReactNode;
}) {
  if (products !== null && products.length === 0) return null;
  const list = products ?? [];
  return (
    <section aria-labelledby={`${id}-title`} className="mx-auto mt-6 max-w-7xl px-4 lg:px-8">
      <div
        className={`rounded-2xl p-3 sm:p-4 ${tone === "deal" ? "border-2" : "border border-border bg-card/60"}`}
        style={
          tone === "deal"
            ? {
                borderColor: "#b3261e",
                background: "color-mix(in oklab, #b3261e 6%, var(--background))",
              }
            : undefined
        }
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id={`${id}-title`}
            className="flex items-center gap-2 font-display text-lg font-semibold text-foreground sm:text-xl"
          >
            <Icon className={`h-5 w-5 ${tone === "deal" ? "text-[#b3261e]" : "text-accent"}`} />{" "}
            {title}
          </h2>
          <Link
            to={seeAllHref}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground hover:text-accent"
          >
            See all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className={aside ? "mt-3 lg:grid lg:grid-cols-[1fr_260px] lg:gap-4" : "mt-3"}>
          <ul className="scrollbar-hide -mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:gap-3 lg:overflow-visible lg:px-0 lg:[&>li:nth-child(n+6)]:hidden">
            {products === null
              ? Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="w-[40vw] max-w-[180px] shrink-0 lg:w-auto lg:max-w-none">
                    <CardSkeleton />
                  </li>
                ))
              : list.slice(0, aside ? 4 : 10).map((p, i) => (
                  <li
                    key={p.id}
                    className="w-[40vw] max-w-[180px] shrink-0 lg:w-auto lg:max-w-none"
                  >
                    <MarketCard
                      product={p}
                      onConfigure={onConfigure}
                      rank={ranked ? i + 1 : undefined}
                      showBulk={showBulk}
                    />
                  </li>
                ))}
          </ul>
          {aside}
        </div>
      </div>
    </section>
  );
}

/** Beside the bulk shelf: the business and big-order paths. */
function BulkAside() {
  const { openRegister } = useAuthModal();
  return (
    <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:mt-0 lg:grid-cols-1">
      <button
        type="button"
        onClick={() => openRegister({ accountType: "BUSINESS" })}
        className="flex items-start gap-3 rounded-xl bg-forest p-4 text-left text-white"
      >
        <Briefcase className="mt-0.5 h-5 w-5 shrink-0" style={{ color: GOLD }} />
        <span>
          <span className="block text-sm font-semibold">Business account</span>
          <span className="block text-xs text-white/80">
            5% welcome code, tax invoices, order history
          </span>
        </span>
      </button>
      <Link
        to="/enterprise-quote"
        className="flex items-start gap-3 rounded-xl border-2 p-4"
        style={{ borderColor: GOLD }}
      >
        <PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <span>
          <span className="block text-sm font-semibold text-foreground">
            10,000+ units or your logo?
          </span>
          <span className="block text-xs text-muted-foreground">
            Get a quote for big or branded orders
          </span>
        </span>
      </Link>
    </div>
  );
}

// ── Picked for you: an endless grid, loaded in batches as the shopper scrolls ──

function PickedForYou({ onConfigure }: { onConfigure: Configure }) {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const seen = useRef(new Set<string>());

  // A signed-in customer's own picks first, then the shop's mixed feed.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    api
      .getRecommendedProductsPersonalized()
      .then((data) => {
        if (cancelled) return;
        const fresh = buyable(data).filter((p) => !seen.current.has(p.id));
        fresh.forEach((p) => seen.current.add(p.id));
        setItems((prev) => [...fresh, ...prev]);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (done || loading) return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        setLoading(true);
        api
          .getDiversifiedProducts({ page, size: FEED_BATCH })
          .then((data) => {
            const fresh = buyable(data).filter((p) => !seen.current.has(p.id));
            fresh.forEach((p) => seen.current.add(p.id));
            setItems((prev) => {
              const next = [...prev, ...fresh];
              if (data.length < FEED_BATCH || next.length >= FEED_MAX) setDone(true);
              return next;
            });
            setPage((n) => n + 1);
          })
          .catch(() => setDone(true))
          .finally(() => setLoading(false));
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [page, done, loading]);

  return (
    <section aria-labelledby="picked-title" className="mx-auto mt-8 max-w-7xl px-4 lg:px-8">
      <h2
        id="picked-title"
        className="flex items-center gap-2 font-display text-lg font-semibold text-foreground sm:text-xl"
      >
        <BadgeCheck className="h-5 w-5 text-accent" /> Picked for you
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-3">
        {items.map((p) => (
          <li key={p.id}>
            <MarketCard product={p} onConfigure={onConfigure} />
          </li>
        ))}
        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <li key={`s${i}`}>
              <CardSkeleton />
            </li>
          ))}
      </ul>
      <div ref={sentinel} aria-hidden="true" className="h-4" />
      {done && (
        <div className="mt-4 text-center">
          <Link
            to="/products"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-forest px-6 text-sm font-semibold text-white"
          >
            Browse all packaging <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
}

// ── Slim trust line and account strip ──

const TRUST = [
  { icon: Wallet, text: "Pay with M-Pesa" },
  { icon: Truck, text: "Same-day Nairobi delivery" },
  { icon: ShieldCheck, text: "KRA tax invoices" },
  { icon: PackageCheck, text: "No minimum order" },
];

function TrustLine() {
  return (
    <ul className="scrollbar-hide mx-auto mt-4 flex max-w-7xl gap-4 overflow-x-auto px-4 text-[11px] font-medium text-muted-foreground sm:justify-center sm:text-xs lg:px-8">
      {TRUST.map(({ icon: Icon, text }) => (
        <li key={text} className="flex shrink-0 items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-accent" /> {text}
        </li>
      ))}
    </ul>
  );
}

function AccountStrip() {
  const { isAuthenticated } = useAuth();
  const { openRegister } = useAuthModal();
  if (isAuthenticated) return null;
  return (
    <section className="mx-auto mt-8 max-w-7xl px-4 lg:px-8">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-forest px-5 py-4 text-center text-white sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm">
          <span className="font-semibold">Better prices with an account.</span>{" "}
          <span className="text-white/80">
            1,000 reward coupons on signup, 5% off for new businesses.
          </span>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => openRegister({ accountType: "BUSINESS" })}
            className="min-h-[40px] rounded-full px-4 text-sm font-semibold text-forest"
            style={{ background: GOLD }}
          >
            Business
          </button>
          <button
            type="button"
            onClick={() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" })}
            className="min-h-[40px] rounded-full border border-white/40 px-4 text-sm font-semibold"
          >
            Individual
          </button>
        </div>
      </div>
    </section>
  );
}

/** A short descriptive paragraph for search engines and first-time visitors; the full story is
 *  one tap away on /discover. */
function AboutBlurb() {
  return (
    <section className="mx-auto mt-10 max-w-7xl px-4 pb-6 lg:px-8">
      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Moments Packaging Kenya sells packaging online and from our shop on Ukwala Road, Nairobi
        CBD: paper bags, carrier bags, boxes and cartons, cups and lids, food containers, mailers,
        wrapping, labels and gifting packaging. Pay with M-Pesa, get same-day delivery in Nairobi
        and countrywide delivery in about three business days, or ask for custom packaging printed
        with your logo.{" "}
        <Link to="/discover" className="font-medium text-foreground underline underline-offset-2">
          Why businesses choose Moments
        </Link>
      </p>
    </section>
  );
}

// ── The page ──

function MarketHomePage() {
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const onConfigure: Configure = (p) => setConfiguring(p);

  const deals = useProducts(api.getDeals);
  const trending = useProducts(api.getRecommended);
  const bulk = useProducts(() =>
    api
      .getProducts({ isFastMoving: true, size: 40 })
      .then((list) => list.filter((p) => priceFacts(p)?.bulk))
      .then((list) =>
        list.length >= 4
          ? list
          : api.getProducts({ size: 40 }).then((all) => all.filter((p) => priceFacts(p)?.bulk)),
      ),
  );

  return (
    <>
      <FirstVisitSplash />
      <CookieConsent />
      <PageProgressBar />
      <div className="flex min-h-screen flex-col bg-background">
        <AddToHomeScreenPrompt />
        <MarketHeader />
        <CampaignStrip deals={deals} />
        <main className="flex-1 pb-20 md:pb-8">
          <h1 className="sr-only">
            Packaging supplies and custom packaging in Nairobi — Moments Packaging Kenya
          </h1>
          <CategoryCircles />
          <div className="mx-auto mt-3 grid max-w-7xl gap-3 px-4 lg:grid-cols-[1fr_320px] lg:px-8">
            <BannerCarousel deals={deals} />
            <PopularSubcategories />
          </div>
          <TrustLine />
          <Shelf
            id="deals"
            icon={Flame}
            title="Deals of the day"
            seeAllHref="/deals"
            products={deals}
            onConfigure={onConfigure}
            tone="deal"
          />
          <Shelf
            id="trending"
            icon={TrendingUp}
            title="Trending now"
            seeAllHref="/products"
            products={trending}
            onConfigure={onConfigure}
            ranked
          />
          <Shelf
            id="bulk"
            icon={PackageCheck}
            title="Buy in bulk, pay less"
            seeAllHref="/products"
            products={bulk}
            onConfigure={onConfigure}
            showBulk
            aside={<BulkAside />}
          />
          <AccountStrip />
          <PickedForYou onConfigure={onConfigure} />
          <AboutBlurb />
        </main>
        <SiteFooter />
        <WhatsAppFloat />
        <BottomNav />
      </div>
      <ConfiguratorModal product={configuring} onClose={() => setConfiguring(null)} />
      <CartAddedSheet />
    </>
  );
}

export default MarketHomePage;
