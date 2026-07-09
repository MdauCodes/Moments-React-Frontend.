import { Link } from "react-router-dom";

import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { PageProgressBar } from "@/components/PageProgressBar";
import { EmailInsiderPrompt } from "@/components/EmailInsiderPrompt";
import { AppSplash } from "@/components/AppSplash";
import { BottomNav } from "@/components/BottomNav";
import { AddToHomeScreenPrompt } from "@/components/AddToHomeScreenPrompt";
import { GuaranteeBand } from "@/components/GuaranteeBand";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { LatestBlogsStrip } from "@/components/blog/LatestBlogsStrip";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { ProductCard } from "@/components/ProductCard";
import { ConfiguratorModal } from "@/components/ConfiguratorModal";
import catPaperBagsImg from "@/assets/categories/cat-paper-bags.jpg";
import catBoxesCartonsImg from "@/assets/categories/cat-boxes-cartons.jpg";
import catCupsSleevesImg from "@/assets/categories/cat-cups-sleeves.jpg";
import catMailersPouchesImg from "@/assets/categories/cat-mailers-pouches.jpg";
import catLabelsStickersImg from "@/assets/categories/cat-labels-stickers.jpg";
import catFoodContainersImg from "@/assets/categories/cat-food-containers.jpg";
import catGiftEventImg from "@/assets/categories/cat-gift-event.jpg";
import catBeautyPharmaImg from "@/assets/categories/cat-beauty-pharma.jpg";
import { ArrowRight, Search, ShoppingBag, Tag, Briefcase, Coffee, Package, Gift, ChevronRight, UtensilsCrossed, ShoppingCart, Sprout, Gem, PencilLine, CookingPot } from "lucide-react";
import { Check } from "lucide-react";
import { DotGrid, PaperTexture, ArcStroke, CornerLines, SignatureDivider } from "@/components/BrandDecor";
import { api } from "@/services/api";
import type { Product } from "@/data/products";
import cloudV3 from "@/assets/packaging-cloud-hero-v3.png";
import cloudKraft from "@/assets/packaging-cloud-hero.png";
import ecoCluster from "@/assets/company-profile/eco-packaging-cluster.png";
import logoUrl from "@/assets/moments-logo.png";

const SPLASH_KEY = "moments_splash_shown";

const siteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Moments Packaging (K) Limited",
  url: "https://momentspackaging.com",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://momentspackaging.com/products?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};



const ANNOUNCE_ITEMS = [
  "Order online 24/7",
  "M-Pesa accepted",
  "Same day — Nairobi",
  "Up to 3 days countrywide",
  "Branding available on order",
];

const TRUST_STATS = [
  { num: "500+", label: "Kenyan businesses served" },
  { num: "Same day", label: "Nairobi delivery" },
  { num: "No min.", label: "Order any quantity" },
  { num: "24/7", label: "Order anytime" },
  { num: "M-Pesa", label: "Accepted at checkout", desktopOnly: true },
];

// Each card links to a real, working /products filter — either a live
// Industry slug or an exact CATEGORY_OPTIONS value (src/data/categoryOptions.ts).
// Previously these carried a `search` object that was computed but never
// actually applied to the Link, so every card landed on an unfiltered page.
const CATEGORIES = [
  { name: "Café & restaurant", desc: "Cups, boxes, sleeves", Icon: Coffee, to: "/products?industry=food-and-beverage" },
  { name: "Retail & e-commerce", desc: "Mailers, carrier bags", Icon: Package, to: "/products?industry=retail-and-ecommerce" },
  { name: "Events & gifting", desc: "Gift boxes, wrapping", Icon: Gift, to: "/products?industry=hospitality" },
  { name: "Agriculture", desc: "Sacks, liners, kraft", Icon: Sprout, to: "/products?industry=agriculture" },
  { name: "Cosmetics", desc: "Boxes, pouches, labels", Icon: Gem, to: "/products?industry=health-and-beauty" },
  { name: "Stationery & General", desc: "Mailers, wraps", Icon: PencilLine, to: `/products?category=${encodeURIComponent("General")}` },
  { name: "Kitchen Essentials", desc: "Food-safe containers", Icon: CookingPot, to: `/products?category=${encodeURIComponent("Containers & Trays")}` },
  { name: "Enterprise", desc: "10,000+ unit runs", Icon: Briefcase, to: "/enterprise-quote" },
];

// Global industry chips — mirrors the company-profile "industries" list
const HERO_INDUSTRIES = [
  { Icon: UtensilsCrossed, label: "Food & Beverage", to: "/products?industry=food-and-beverage" },
  { Icon: ShoppingCart, label: "Wholesale & E-commerce", to: "/products?industry=retail-and-ecommerce" },
  { Icon: Sprout, label: "Agriculture", to: "/products?industry=agriculture" },
  { Icon: Gem, label: "Cosmetics", to: "/products?industry=health-and-beauty" },
  { Icon: PencilLine, label: "Stationery & General", to: `/products?category=${encodeURIComponent("General")}` },
  { Icon: CookingPot, label: "Kitchen Essentials", to: `/products?category=${encodeURIComponent("Containers & Trays")}` },
];

// ── First-visit splash ──
function FirstVisitSplash() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SPLASH_KEY)) return;
    sessionStorage.setItem(SPLASH_KEY, "1");
    setShow(true);
  }, []);
  if (!show) return null;
  return <AppSplash />;
}

// ── Hero ──
function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--forest) 82%, black) 0%, var(--forest) 55%, color-mix(in oklab, var(--forest) 70%, black) 100%)",
        minHeight: "520px",
      }}
    >
      <style>{`
        @keyframes mpk-hero-a { 0%, 28% { opacity: 1; } 33%, 94% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes mpk-hero-b { 0%, 28% { opacity: 0; } 33%, 61% { opacity: 1; } 66%, 100% { opacity: 0; } }
        @keyframes mpk-hero-c { 0%, 61% { opacity: 0; } 66%, 94% { opacity: 1; } 100%, 100% { opacity: 0; } }
        .mpk-hero-img-a { animation: mpk-hero-a 21s ease-in-out infinite; }
        .mpk-hero-img-b { animation: mpk-hero-b 21s ease-in-out infinite; }
        .mpk-hero-img-c { animation: mpk-hero-c 21s ease-in-out infinite; }
        @keyframes mpk-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .mpk-marquee-track { animation: mpk-marquee 18s linear infinite; }
        @media (max-width: 767px) { .mpk-hero-section { min-height: 760px !important; } }
        @media (min-width: 768px) { .mpk-hero-section { min-height: 680px !important; } }

        /* ── Hero image positioning ── */
        .mpk-hero-img-a,
        .mpk-hero-img-b,
        .mpk-hero-img-c {
          /* Mobile: fixed to viewport-relative right side via the section's coordinate space */
          right: -8vw;
          top: 50%;
          bottom: auto;
          transform: translateY(-44%);
          width: 92vw;
          max-height: none;
          object-fit: contain;
        }
        @media (min-width: 768px) {
          .mpk-hero-img-a,
          .mpk-hero-img-b,
          .mpk-hero-img-c {
            right: 2%;
            top: calc(50% + 30px);
            bottom: auto;
            transform: translateY(-50%);
            width: 46%;
            max-height: 86%;
          }
        }
        @media (min-width: 1024px) {
          .mpk-hero-img-a,
          .mpk-hero-img-b,
          .mpk-hero-img-c {
            right: 4%;
            width: 44%;
          }
        }
        @media (min-width: 1280px) {
          .mpk-hero-img-a,
          .mpk-hero-img-b,
          .mpk-hero-img-c {
            right: 6%;
            width: 42%;
          }
        }
      `}</style>

      <div className="mpk-hero-section relative" style={{ minHeight: "560px" }}>
        {/* Hero images — positioned relative to the full section, not the padded container */}
        <img
          src={cloudV3}
          alt="A diverse cluster of branded paper packaging — bags, boxes, cups and more"
          width={1600}
          height={1000}
          fetchPriority="high"
          decoding="async"
          className="mpk-hero-img-a absolute pointer-events-none select-none"
          style={{
            zIndex: 1,
            transition: "opacity 1.5s ease-in-out",
            filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.5))",
            opacity: 1,
          }}
        />
        <img
          src={cloudKraft}
          alt="A cluster of kraft paper packaging — bags, boxes, cups"
          className="mpk-hero-img-b absolute pointer-events-none select-none"
          style={{
            zIndex: 1,
            transition: "opacity 1.5s ease-in-out",
            filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.5))",
            opacity: 0,
          }}
        />
        <img
          src={ecoCluster}
          alt="Eco-friendly food packaging — kraft bags, containers, cups and bagasse plates"
          className="mpk-hero-img-c absolute pointer-events-none select-none"
          style={{
            zIndex: 1,
            transition: "opacity 1.5s ease-in-out",
            filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.5))",
            opacity: 0,
          }}
        />

        {/*
          MOBILE scrim: gradient from top-left (opaque forest = text readable)
          fading to transparent at bottom-right (image shows through).
          No more full-coverage overlay that kills the image.
        */}
        {/* Mobile scrim: diagonal — top-left is opaque (text), bottom-right is open (image).
            Single layer, no stacking, so the image is never double-darkened. */}
        <div
          className="absolute inset-0 md:hidden"
          style={{
            zIndex: 3,
            background:
              "linear-gradient(125deg, color-mix(in oklab, var(--forest) 96%, black) 0%, color-mix(in oklab, var(--forest) 90%, black) 30%, color-mix(in oklab, var(--forest) 55%, black) 52%, color-mix(in oklab, var(--forest) 18%, transparent) 72%, transparent 100%)",
          }}
        />

        {/* DESKTOP scrim — unchanged */}
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            zIndex: 3,
            background:
              "linear-gradient(100deg, color-mix(in oklab, var(--forest) 75%, black) 0%, color-mix(in oklab, var(--forest) 60%, black) 32%, color-mix(in oklab, var(--forest) 30%, transparent) 58%, transparent 74%)",
          }}
        />

        {/* Navigation */}
        <nav
          className="absolute left-0 right-0 top-0"
          style={{
            zIndex: 30,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)",
          }}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
            <Link to="/" aria-label="Moments Packaging (K) Limited — Home" className="flex items-center gap-2 sm:gap-3">
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: "112px",
                  height: "26px",
                  background: "#a8e0a0",
                  WebkitMaskImage: `url(${logoUrl})`,
                  maskImage: `url(${logoUrl})`,
                  WebkitMaskSize: "contain",
                  maskSize: "contain",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskPosition: "left center",
                  maskPosition: "left center",
                }}
                className="sm:!w-[128px] sm:!h-[30px]"
              />
              <span
                className="inline-block"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.85)",
                  borderLeft: "1px solid rgba(255,255,255,0.35)",
                  paddingLeft: "10px",
                  lineHeight: 1.15,
                  fontWeight: 600,
                }}
              >
                Packaging
                <br />
                (K) Limited
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white">
              <Link to="/products" className="hover:opacity-80">
                Shop
              </Link>
              <Link to="/company-profile" className="hover:opacity-80">
                Company
              </Link>
              <Link to="/sustainability" className="hover:opacity-80">
                Sustainability
              </Link>
              <Link to="/orders/track" className="hover:opacity-80">
                Track Order
              </Link>
              <Link to="/products?deals=true"
                style={{ color: "#e8c878" }}
                className="hover:opacity-80"
              >
                Deals
              </Link>
            </div>
            <div className="flex items-center gap-4 text-white">
              <Link to="/products" aria-label="Search products" className="hover:opacity-80">
                <Search className="h-5 w-5" />
              </Link>
              <Link to="/cart" aria-label="Cart" className="relative hover:opacity-80">
                <ShoppingBag className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full" style={{ background: "#e8c878" }} />
              </Link>
              <Link to="/login" className="hidden md:inline text-sm hover:opacity-80">
                Sign in
              </Link>
            </div>
          </div>
        </nav>

        {/* Announcement bar */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: "62px",
            zIndex: 20,
            background:
              "linear-gradient(90deg, color-mix(in oklab, var(--forest) 96%, black) 0%, var(--forest) 50%, color-mix(in oklab, var(--forest) 92%, black) 100%)",
            borderTop: "1px solid color-mix(in oklab, var(--forest) 70%, white 6%)",
            borderBottom: "1px solid rgba(0,0,0,0.18)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 14px rgba(0,0,0,0.18)",
          }}
        >
          {/* Desktop */}
          <div
            className="hidden md:flex items-center justify-center overflow-hidden whitespace-nowrap"
            style={{ gap: "28px", padding: "8px 40px" }}
          >
            {ANNOUNCE_ITEMS.map((item, i) => (
              <span key={item} className="flex items-center" style={{ gap: "28px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    letterSpacing: "0.04em",
                    color: "rgba(255,255,255,0.94)",
                    fontWeight: 500,
                  }}
                >
                  {item}
                </span>
                {i < ANNOUNCE_ITEMS.length - 1 && (
                  <span
                    className="inline-block rounded-full"
                    style={{ width: "3px", height: "3px", background: "var(--accent)", opacity: 0.85 }}
                  />
                )}
              </span>
            ))}
          </div>
          {/* Mobile marquee */}
          <div className="md:hidden overflow-hidden" style={{ padding: "8px 0" }}>
            <div className="mpk-marquee-track flex" style={{ gap: "22px", width: "max-content", whiteSpace: "nowrap" }}>
              {[...ANNOUNCE_ITEMS, ...ANNOUNCE_ITEMS].map((item, idx) => (
                <span key={`${item}-${idx}`} className="flex items-center" style={{ gap: "22px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      letterSpacing: "0.04em",
                      color: "rgba(255,255,255,0.94)",
                      fontWeight: 500,
                    }}
                  >
                    {item}
                  </span>
                  <span
                    className="inline-block rounded-full"
                    style={{ width: "3px", height: "3px", background: "var(--accent)", opacity: 0.85 }}
                  />
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Hero text content */}
        {/* On mobile: relative flow so section grows to fit all content.
            On desktop: absolute centered left column. */}
        <div className="relative md:absolute md:inset-0 mx-auto max-w-7xl px-5 lg:px-8" style={{ zIndex: 4 }}>
          <div
            className="md:absolute md:top-1/2 md:-translate-y-1/2 md:left-8 lg:left-12 md:w-[50%] lg:w-[48%]"
            style={{ paddingTop: "150px", paddingBottom: "60px" }}
          >
            <p
              className="uppercase font-medium"
              style={{
                fontSize: "10px",
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.55)",
                marginBottom: "18px",
              }}
            >
              QUALITY PACKAGING · NAIROBI, KENYA
            </p>
            <h1
              className="font-display"
              style={{
                fontSize: "clamp(32px, 4.6vw, 50px)",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                color: "white",
                fontWeight: 500,
              }}
            >
              Packaging for
              <br />
              Kenyan brands —<br />
              <em className="italic" style={{ color: "#e8c878" }}>
                unforgettable. Utafurahia
              </em>
            </h1>
            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.72)",
                maxWidth: "400px",
                margin: "22px 0 30px",
              }}
            >
              Bags, boxes, cups and more — order online, pay with M-Pesa. Delivered same day within Nairobi, up to 3
              days countrywide.
            </p>
            <div className="flex flex-col md:flex-row gap-3 max-w-sm md:max-w-none">
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 font-semibold"
                style={{
                  background: "#e8c878",
                  color: "#0d3320",
                  borderRadius: "10px",
                  padding: "13px 26px",
                  fontSize: "14px",
                }}
              >
                Browse all packaging <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/enterprise-quote"
                className="inline-flex items-center justify-center text-white font-medium"
                style={{
                  background: "rgba(255,255,255,0.09)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "10px",
                  padding: "13px 26px",
                  fontSize: "14px",
                }}
              >
                Enterprise quote
              </Link>
            </div>

            {/* Secondary CTA row */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/company-profile"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/8 px-4 py-2.5 text-[13px] font-medium text-white/90 backdrop-blur transition-colors hover:border-accent/60 hover:bg-white/12 hover:text-white active:scale-95"
                style={{ minHeight: "40px" }}
              >
                View our company profile <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <div
                className="inline-flex items-center"
                style={{
                  gap: "8px",
                  background: "rgba(255,255,255,0.09)",
                  border: "1px solid rgba(141,201,106,0.28)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "8px",
                  padding: "8px 14px",
                  minHeight: "40px",
                }}
              >
                <span
                  className="inline-block rounded-full"
                  style={{ width: "6px", height: "6px", background: "#00A651" }}
                />
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.82)" }}>M-Pesa accepted at checkout</span>
              </div>
            </div>

            {/* Global industries chip strip */}
            <div
              className="mt-6 flex flex-wrap gap-2"
              style={{ maxWidth: "560px" }}
            >
              {HERO_INDUSTRIES.map((ind) => (
                <Link
                  key={ind.label}
                  to={ind.to}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-medium text-white/85 backdrop-blur-sm transition-colors hover:border-accent/50 hover:bg-white/12 hover:text-white"
                >
                  <ind.Icon className="h-3.5 w-3.5" style={{ color: "#e8c878" }} strokeWidth={1.8} />
                  {ind.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Wave SVG */}
        <svg
          viewBox="0 0 1440 60"
          preserveAspectRatio="none"
          className="absolute left-0 right-0 pointer-events-none"
          style={{ bottom: "-1px", zIndex: 5, width: "100%", height: "60px" }}
          aria-hidden
        >
          <path d="M0 60 L0 35 Q360 5 720 30 Q1080 55 1440 22 L1440 60 Z" fill="var(--ink)" />
        </svg>
      </div>
    </section>
  );
}

// ── Trust bar ──
function TrustBar() {
  return (
    <section style={{ background: "var(--ink)" }}>
      <div
        className="hidden md:flex max-w-7xl mx-auto"
        style={{ justifyContent: "space-around", padding: "20px 40px" }}
      >
        {TRUST_STATS.map((s, i) => (
          <div
            key={s.num + s.label}
            className="text-center flex-1"
            style={{ borderRight: i < TRUST_STATS.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none" }}
          >
            <div className="font-display" style={{ fontSize: "22px", color: "var(--accent)" }}>
              {s.num}
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", marginTop: "4px" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="md:hidden grid grid-cols-2">
        {TRUST_STATS.filter((s) => !s.desktopOnly).map((s, i, arr) => (
          <div
            key={s.num + s.label}
            className="text-center"
            style={{
              padding: "16px 8px",
              borderRight: i % 2 === 0 ? "1px solid rgba(255,255,255,0.06)" : "none",
              borderBottom: i < arr.length - 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <div className="font-display" style={{ fontSize: "17px", color: "var(--accent)" }}>
              {s.num}
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.45)", marginTop: "4px" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Category row ──
function CategoryRow() {
  return (
    <section style={{ background: "var(--cream)" }}>
      <div className="max-w-7xl mx-auto md:grid md:grid-cols-4 flex flex-col">
        {CATEGORIES.map((c, i) => (
          <Link
            key={c.name}
            to={c.to}
            className="flex items-center"
            style={{
              padding: "14px 20px",
              gap: "12px",
              borderRight:
                i < CATEGORIES.length - 1 ? "1px solid color-mix(in oklab, var(--ink) 8%, transparent)" : "none",
              borderBottom:
                i < CATEGORIES.length - 1 ? "1px solid color-mix(in oklab, var(--ink) 8%, transparent)" : "none",
            }}
          >
            <span
              className="grid place-items-center"
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "9px",
                background: "color-mix(in oklab, var(--accent) 10%, transparent)",
              }}
            >
              <c.Icon style={{ color: "var(--accent)" }} strokeWidth={1.7} className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block" style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink)" }}>
                {c.name}
              </span>
              <span
                className="block"
                style={{ fontSize: "10.5px", color: "color-mix(in oklab, var(--ink) 55%, transparent)" }}
              >
                {c.desc}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 ml-auto" style={{ color: "var(--accent)" }} />
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Featured products ──
type ProductRowProps = {
  eyebrow: string;
  title: string;
  seeAllHref?: string;
  fetcher: () => Promise<Product[]>;
  bg?: "background" | "cream";
};

/** A horizontally-scannable row of products — the homepage can stack several of these,
 * matching the multi-row catalogue feel of Kilimall/Jumia-style marketplaces. */
function ProductRow({ eyebrow, title, seeAllHref = "/products", fetcher, bg = "background" }: ProductRowProps) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [configuring, setConfiguring] = useState<Product | null>(null);
  const [preTier, setPreTier] = useState<string | null>(null);
  const handleConfigure = (p: Product, tierId?: string) => {
    setPreTier(tierId ?? null);
    setConfiguring(p);
  };

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) setProducts(data.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (products !== null && products.length === 0) return null;

  return (
    <section className={bg === "cream" ? "bg-cream" : "bg-background"}>
      <div className="mx-auto max-w-7xl px-5 py-10 sm:py-14 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent">{eyebrow}</p>
            <h2 className="mt-2 font-display text-2xl font-medium text-foreground sm:text-3xl">{title}</h2>
          </div>
          <Link
            to={seeAllHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent"
          >
            See all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {/* Horizontal scroll on mobile (app-style rail), grid from sm+ */}
        <div className="mt-6 -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 md:grid-cols-4 lg:gap-6">
          {products === null
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="grid w-[45vw] shrink-0 sm:w-auto">
                  <ProductCardSkeleton />
                </div>
              ))
            : products.map((p) => (
                <div key={p.id} className="grid w-[45vw] shrink-0 sm:w-auto">
                  <ProductCard product={p} onConfigure={handleConfigure} />
                </div>
              ))}
        </div>
        <ConfiguratorModal product={configuring} preSelectedTierId={preTier} onClose={() => setConfiguring(null)} />
      </div>
    </section>
  );
}

// ── Category image grid ──
type CategoryTile = { label: string; image: string; to: string };
const categoryTiles: CategoryTile[] = [
  { label: "Paper bags", image: catPaperBagsImg, to: `/products?category=${encodeURIComponent("Bags")}` },
  { label: "Boxes & cartons", image: catBoxesCartonsImg, to: `/products?category=${encodeURIComponent("Containers & Trays")}` },
  { label: "Cups & sleeves", image: catCupsSleevesImg, to: `/products?category=${encodeURIComponent("Cups & Lids")}` },
  { label: "Mailers & pouches", image: catMailersPouchesImg, to: `/products?category=${encodeURIComponent("Mailers & Shipping")}` },
  { label: "Labels & stickers", image: catLabelsStickersImg, to: `/products?category=${encodeURIComponent("Miscellaneous")}` },
  { label: "Food containers", image: catFoodContainersImg, to: `/products?category=${encodeURIComponent("Containers & Trays")}` },
  { label: "Gift & event", image: catGiftEventImg, to: `/products?category=${encodeURIComponent("Gifting & Retail")}` },
  { label: "Beauty & pharma", image: catBeautyPharmaImg, to: "/products?industry=health-and-beauty" },
];

function CategoryGrid() {
  return (
    <section className="relative overflow-hidden bg-cream">
      <PaperTexture opacity={0.06} />
      <CornerLines className="left-4 top-4" opacity={0.1} />
      <CornerLines className="bottom-4 right-4 rotate-180" opacity={0.1} />
      <div className="relative mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:px-8">
        <SignatureDivider className="mb-10" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Browse</p>
            <h2 className="mt-2 font-display text-3xl font-medium text-foreground sm:text-4xl">Shop by category</h2>
          </div>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent"
          >
            See everything <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 md:grid-cols-4">
          {categoryTiles.map((tile) => (
            <Link
              key={tile.label}
              to={tile.to}
              className="group relative overflow-hidden rounded-2xl aspect-square sm:aspect-[4/3] block"
            >
              <img
                src={tile.image}
                alt={tile.label}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 font-display text-sm font-semibold text-white sm:text-base">
                {tile.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Audiences we serve ──
const audienceColumns = [
  {
    Icon: Gift,
    role: "Individuals",
    blurb: "Weddings, birthdays, anniversaries and personal gifting — order what you need, no minimums.",
    examples: ["Wedding favours", "Birthday gift boxes", "One-off event packs"],
  },
  {
    Icon: ShoppingBag,
    role: "Small businesses & shops",
    blurb: "Cafés, restaurants, retail and online sellers — quality packaging on a turnaround that fits your week.",
    examples: ["Takeaway cups & boxes", "Branded carrier bags", "E-commerce mailers"],
  },
  {
    Icon: Package,
    role: "Companies & enterprise",
    blurb: "Volume orders, contracts and procurement — formal quotes and a dedicated contact for every rollout.",
    examples: ["10,000+ unit runs", "National brand rollouts", "Scheduled deliveries"],
  },
];

function AudiencesWeServe() {
  return (
    <section className="relative overflow-hidden bg-cream">
      <DotGrid opacity={0.04} size={14} />
      <ArcStroke className="-right-32 top-1/2 h-80 w-80 -translate-y-1/2" color="kraft" opacity={0.06} />
      <div className="relative mx-auto max-w-6xl px-5 py-14 sm:py-20 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent">Who we pack for</p>
          <h2 className="mt-2 font-display text-3xl font-medium text-foreground sm:text-4xl">
            Whether you&apos;re an individual, a small business, or a large enterprise — we serve all of you.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            One catalogue, one production line, three kinds of customers. Same quality, same craft — scaled to whatever
            you&apos;re ordering.
          </p>
        </div>
        <div className="mt-10 grid gap-8 border-t border-border pt-10 sm:grid-cols-3 sm:gap-6">
          {audienceColumns.map((col) => (
            <div key={col.role} className="flex flex-col">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <col.Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{col.role}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{col.blurb}</p>
              <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-4">
                {col.examples.map((ex) => (
                  <li key={ex} className="flex items-start gap-2 text-xs text-foreground/75">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
                    <span>{ex}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Page ──
function HomePage() {
  return (
    <>
      <FirstVisitSplash />
      <PageProgressBar />
      <div className="flex min-h-screen flex-col" style={{ background: "var(--background)" }}>
        <AddToHomeScreenPrompt />
        <main className="flex-1 pb-16 md:pb-0">
          <Hero />
          <CategoryRow />
          <GuaranteeBand />
          <ProductRow
            eyebrow="Featured products"
            title="Popular this week"
            fetcher={api.getRecommended}
            bg="background"
          />
          <ProductRow
            eyebrow="Just in"
            title="New arrivals"
            seeAllHref="/products?newArrivals=true"
            fetcher={() => api.getProducts({ isNewArrival: true, size: 8 })}
            bg="cream"
          />
          <ProductRow
            eyebrow="Customer favourites"
            title="Best sellers"
            seeAllHref="/products?fastMoving=true"
            fetcher={() => api.getProducts({ isFastMoving: true, size: 8 })}
            bg="background"
          />
          <CategoryGrid />
          <TestimonialsSection />
          <AudiencesWeServe />
          <LatestBlogsStrip />
        </main>
        <SiteFooter />
        <WhatsAppFloat />
        <EmailInsiderPrompt />
        <BottomNav />
      </div>
    </>
  );
}

export default HomePage;
