import { Link } from "react-router-dom";

import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { PageProgressBar } from "@/components/PageProgressBar";
import { EmailInsiderPrompt } from "@/components/EmailInsiderPrompt";
import { WelcomeStarterModal } from "@/components/WelcomeStarterModal";
import { CookieConsent } from "@/components/CookieConsent";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { SearchCommand } from "@/components/SearchCommand";
import { AppSplash } from "@/components/AppSplash";
import { BottomNav } from "@/components/BottomNav";
import { AddToHomeScreenPrompt } from "@/components/AddToHomeScreenPrompt";
import { GuaranteeBand } from "@/components/GuaranteeBand";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { LatestBlogsStrip } from "@/components/blog/LatestBlogsStrip";
import { ProductCardSkeleton } from "@/components/ProductCardSkeleton";
import { ProductCard } from "@/components/ProductCard";
import { ConfiguratorModal } from "@/components/ConfiguratorModal";
import catPaperBagsImg from "@/assets/categories/cat-paper-bags.webp";
import catBoxesCartonsImg from "@/assets/categories/cat-boxes-cartons.webp";
import catCupsSleevesImg from "@/assets/categories/cat-cups-sleeves.webp";
import catMailersPouchesImg from "@/assets/categories/cat-mailers-pouches.webp";
import catLabelsStickersImg from "@/assets/categories/cat-labels-stickers.webp";
import catFoodContainersImg from "@/assets/categories/cat-food-containers.webp";
import catGiftEventImg from "@/assets/categories/cat-gift-event.webp";
import catBeautyPharmaImg from "@/assets/categories/cat-beauty-pharma.webp";
// Segment photos — filenames match backend Segment.name exactly (see SEGMENT_IMAGES below).
import segFoodPackagingImg from "@/assets/categories/food packaging segment photo.webp";
import segDisposableTablewareImg from "@/assets/categories/disposable tablesware.webp";
import segCutleryImg from "@/assets/categories/cutlery.webp";
import segDrinksPackagingImg from "@/assets/categories/drinks packaging.webp";
import segKitchenTableImg from "@/assets/categories/kitchen and table.webp";
import segWoodenAccessoriesImg from "@/assets/categories/wooden accessories.webp";
import segHygieneImg from "@/assets/categories/hygiene.webp";
import segBagsSacksImg from "@/assets/categories/bags and sacks.webp";
import segGeneralSuppliesImg from "@/assets/categories/general supplies.webp";
import segCustomBrandingImg from "@/assets/categories/stickers and labels.webp";
import segCosmeticsImg from "@/assets/categories/cosmetics.webp";
import segAgricultureImg from "@/assets/categories/agriculture.webp";
import segDairyImg from "@/assets/categories/Dairy.webp";
import segPharmacyImg from "@/assets/categories/Pharmacy.webp";
import { ArrowRight, Search, ShoppingBag, ChevronRight, Briefcase, Gift } from "lucide-react";
import { PaperTexture, CornerLines, SignatureDivider } from "@/components/BrandDecor";
import { api, type Segment } from "@/services/api";
import type { Product, Industry } from "@/data/products";
import { filterVisibleIndustries } from "@/data/products";
import cloudV3 from "@/assets/packaging-cloud-hero-v3.webp";
import cloudKraft from "@/assets/packaging-cloud-hero.webp";
import ecoCluster from "@/assets/company-profile/eco-packaging-cluster.webp";
import logoUrl from "@/assets/moments_logo_without_background.png";

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
  "1,000 Reward Coupons free on signup",
  "Redeem coupons for a discount at checkout",
  "5% welcome code for new Business Accounts",
  "Earn coupons on every order",
  "Referral rewards — you and your friend both earn",
];

const TRUST_STATS = [
  { num: "500+", label: "Kenyan businesses served" },
  { num: "Same day", label: "Nairobi delivery" },
  { num: "No min.", label: "Order any quantity" },
  { num: "24/7", label: "Order anytime" },
  { num: "M-Pesa", label: "Accepted at checkout", desktopOnly: true },
];

// CategoryRow (the "who we serve" strip right under the hero) is driven by
// real backend Industries — see CategoryRow below — not a hardcoded list.

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

// ── Home nav — a real sticky top-level element (not absolutely overlaid
// inside the hero) so it stays visible for the whole page scroll, matching
// SiteHeader's behaviour on every other page. Logo is 2x the size used
// elsewhere per request, so it needs its own solid background rather than
// the hero's old transparent-over-image treatment. ──
function HomeNav() {
  const { openLogin } = useAuthModal();
  const { itemCount } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  return (
    <nav
      className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-md"
      style={{ background: "color-mix(in oklab, var(--forest) 94%, black)" }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">
        <Link to="/" aria-label="Moments Packaging Kenya — Home" className="flex shrink-0 items-center">
          <img
            src={logoUrl}
            alt="Moments Packaging Kenya logo"
            width={160}
            height={40}
            className="h-9 w-auto sm:h-10 lg:h-11"
          />
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white">
          <Link to="/company-profile" className="hover:opacity-80">
            About Us
          </Link>
          <Link to="/privacy" className="hover:opacity-80">
            Privacy Policy
          </Link>
          <Link to="/sustainability" className="hover:opacity-80">
            Our Sustainability Pledge
          </Link>
          <Link to="/products" className="hover:opacity-80">
            Shop
          </Link>
          <Link to="/orders/track" className="hover:opacity-80">
            Track Order
          </Link>
          <Link to="/deals" style={{ color: "#e8c878" }} className="hover:opacity-80">
            Deals
          </Link>
        </div>
        <div className="flex items-center gap-1 text-white">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search products"
            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-white/10"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link
            to="/cart"
            aria-label="Cart"
            className="relative grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-white/10"
          >
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 && (
              <span
                className="absolute right-0.5 top-0.5 grid min-w-[16px] h-[16px] place-items-center rounded-full px-1 text-[9px] font-semibold text-forest"
                style={{ background: "#e8c878" }}
              >
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => openLogin()}
            className="ml-2 hidden md:inline text-sm hover:opacity-80"
          >
            Sign in
          </button>
        </div>
      </div>
      <SearchCommand open={searchOpen} onClose={() => setSearchOpen(false)} />
    </nav>
  );
}

// ── Hero ──
function Hero() {
  const { openRegister } = useAuthModal();
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
          loading="lazy"
          decoding="async"
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
          loading="lazy"
          decoding="async"
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

        {/* Announcement bar — nav used to overlay here too (absolute, top:0)
            but it's now HomeNav, a real sticky element rendered above this
            whole section so it persists for the entire page scroll, not
            just while the hero is in view. This bar is now the top-most
            absolutely-positioned layer within the hero itself. */}
        <div
          className="absolute left-0 right-0"
          style={{
            top: 0,
            zIndex: 20,
            background:
              "linear-gradient(90deg, color-mix(in oklab, var(--forest) 96%, black) 0%, var(--forest) 50%, color-mix(in oklab, var(--forest) 92%, black) 100%)",
            borderTop: "1px solid color-mix(in oklab, var(--forest) 70%, white 6%)",
            borderBottom: "1px solid rgba(0,0,0,0.18)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset, 0 4px 14px rgba(0,0,0,0.18)",
          }}
        >
          {/* Marquee at every breakpoint — a static centered row on desktop used to just get
              clipped at both edges once the reward-focused copy got longer than the old
              short delivery-info items, since it never had anywhere to scroll to. */}
          <div className="overflow-hidden" style={{ padding: "8px 0" }}>
            <div className="mpk-marquee-track flex" style={{ gap: "22px", width: "max-content", whiteSpace: "nowrap" }}>
              {[...ANNOUNCE_ITEMS, ...ANNOUNCE_ITEMS].map((item, idx) => (
                <span key={`${item}-${idx}`} className="flex items-center" style={{ gap: "22px" }}>
                  <span
                    style={{
                      fontSize: "calc(11px * var(--a11y-font-scale))",
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
            /* paddingTop was 150px to clear the nav that used to overlay the
               top of this section (absolute) — nav is now HomeNav, sticky
               and external, so the hero starts right below it in normal
               flow. Only the announcement bar (still overlaid, ~40px) needs
               clearing now. Re-tune if the vertical balance looks off. */
            style={{ paddingTop: "56px", paddingBottom: "48px" }}
          >
            <p
              className="uppercase font-medium"
              style={{
                fontSize: "calc(10px * var(--a11y-font-scale))",
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.8)",
                marginBottom: "18px",
              }}
            >
              QUALITY PACKAGING · NAIROBI, KENYA
            </p>
            <h1
              className="font-display"
              style={{
                fontSize: "calc(clamp(28px, 3.8vw, 42px) * var(--a11y-font-scale))",
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                color: "white",
                fontWeight: 500,
              }}
            >
              Packaging Solutions for
              <br />
              Kenyan Businesses —<br />
              <em className="italic" style={{ color: "#e8c878" }}>
                Quality You'll Love. Utafurahia
              </em>
            </h1>
            <p
              style={{
                fontSize: "calc(14px * var(--a11y-font-scale))",
                lineHeight: 1.7,
                color: "rgba(255,255,255,0.88)",
                maxWidth: "400px",
                margin: "22px 0 30px",
              }}
            >
              Cups, containers, bags, and more — order online and pay via M-Pesa. Enjoy same-day delivery within
              Nairobi and delivery within 3 days countrywide.
            </p>
            <div className="flex flex-col md:flex-row gap-3 max-w-sm md:max-w-none">
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2 font-bold shadow-lg transition-transform hover:-translate-y-0.5 hover:shadow-xl"
                style={{
                  background: "#e8c878",
                  color: "#0d3320",
                  borderRadius: "10px",
                  padding: "15px 30px",
                  fontSize: "calc(15px * var(--a11y-font-scale))",
                }}
              >
                Browse all packaging <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Account-type promo — deliberately secondary to "Browse all packaging" above:
                translucent/outline treatment (same family as the "company profile" pill below),
                not a competing solid-gold fill, so there's one clear primary action. */}
            <div className="mt-4 grid max-w-sm grid-cols-1 gap-2.5 sm:grid-cols-2 md:max-w-[560px]">
              <button
                type="button"
                onClick={() => openRegister({ accountType: "INDIVIDUAL_SHOPPER" })}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-white/25 bg-white/8 text-left backdrop-blur transition-colors hover:border-white/40 hover:bg-white/12"
                style={{ padding: "12px 14px" }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10">
                    <Gift className="h-4 w-4 text-white/85" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-white/90">Individual Shopper Account</p>
                    <p className="text-[11px] font-medium text-white/60">Welcome bonus + rewards</p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/60" />
              </button>
              <button
                type="button"
                onClick={() => openRegister({ accountType: "BUSINESS" })}
                className="flex items-center justify-between gap-2.5 rounded-xl border border-white/25 bg-white/8 text-left backdrop-blur transition-colors hover:border-white/40 hover:bg-white/12"
                style={{ padding: "12px 14px" }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10">
                    <Briefcase className="h-4 w-4 text-white/85" />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-white/90">Business Account</p>
                    <p className="text-[11px] font-medium text-white/60">Welcome bonus + order history</p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/60" />
              </button>
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
                <span style={{ fontSize: "calc(11px * var(--a11y-font-scale))", color: "rgba(255,255,255,0.92)" }}>M-Pesa accepted at checkout</span>
              </div>
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
            <div className="font-display" style={{ fontSize: "calc(27px * var(--a11y-font-scale))", color: "var(--accent)" }}>
              {s.num}
            </div>
            <div style={{ fontSize: "calc(13px * var(--a11y-font-scale))", color: "rgba(255,255,255,0.82)", marginTop: "4px" }}>{s.label}</div>
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
            <div className="font-display" style={{ fontSize: "calc(20px * var(--a11y-font-scale))", color: "var(--accent)" }}>
              {s.num}
            </div>
            <div style={{ fontSize: "calc(12px * var(--a11y-font-scale))", color: "rgba(255,255,255,0.82)", marginTop: "4px" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Category row — real backend Industries, not a hardcoded list ──
function CategoryRow() {
  const [industries, setIndustries] = useState<Industry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.getIndustries().then((data) => {
      if (!cancelled) setIndustries(filterVisibleIndustries(data));
    });
    return () => { cancelled = true; };
  }, []);

  if (industries.length === 0) return null;

  return (
    <section style={{ background: "var(--cream)" }}>
      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        {/* Independent bordered cards with a gap, not shared row/column
            borders — shared-border index math breaks across responsive
            column-count changes and row wraps. min-w-0 + truncate on the
            text column is what actually stops long descriptions from
            overflowing into the neighbouring card. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {industries.map((ind) => (
            <Link
              key={ind.id}
              to={`/products?industry=${ind.slug}`}
              className="flex items-center gap-3 rounded-xl border p-3.5 transition-colors hover:border-accent/40"
              style={{ borderColor: "color-mix(in oklab, var(--ink) 10%, transparent)" }}
            >
              <span
                className="grid shrink-0 place-items-center"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "9px",
                  background: "color-mix(in oklab, var(--accent) 10%, transparent)",
                }}
              >
                <ind.icon style={{ color: "var(--accent)" }} strokeWidth={1.7} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontSize: "calc(13px * var(--a11y-font-scale))", fontWeight: 500, color: "var(--ink)" }}>
                  {ind.name}
                </span>
                <span
                  className="block truncate"
                  style={{ fontSize: "calc(10.5px * var(--a11y-font-scale))", color: "color-mix(in oklab, var(--ink) 55%, transparent)" }}
                >
                  {ind.description}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--accent)" }} />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Featured products ──
type ProductRowProps = {
  eyebrow: string;
  title: string;
  desc?: string;
  seeAllHref?: string;
  fetcher: () => Promise<Product[]>;
  bg?: "background" | "cream";
  /** Deals row only — see ProductCard's own doc comment for why this is opt-in. */
  emphasizeDeal?: boolean;
};

/** A horizontally-scannable row of products — the homepage can stack several of these,
 * matching the multi-row catalogue feel of Kilimall/Jumia-style marketplaces. */
function ProductRow({ eyebrow, title, desc, seeAllHref = "/products", fetcher, bg = "background", emphasizeDeal }: ProductRowProps) {
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
            {desc && <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">{desc}</p>}
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
                  <ProductCard product={p} onConfigure={handleConfigure} emphasizeDeal={emphasizeDeal} />
                </div>
              ))}
        </div>
        <ConfiguratorModal product={configuring} preSelectedTierId={preTier} onClose={() => setConfiguring(null)} />
      </div>
    </section>
  );
}

// ── Category image grid — dedicated photo per backend Segment, keyed by exact
// segment name. Falls back to the old generic pool only for a segment the
// backend adds later that doesn't have a named photo yet. ──
const SEGMENT_IMAGES: Record<string, string> = {
  "food packaging": segFoodPackagingImg,
  "disposable tableware": segDisposableTablewareImg,
  "cutlery": segCutleryImg,
  "drinks packaging": segDrinksPackagingImg,
  "kitchen and table accessories": segKitchenTableImg,
  "wooden accessories": segWoodenAccessoriesImg,
  "hygiene essentials": segHygieneImg,
  "bags and sacks": segBagsSacksImg,
  "general supplies and stationeries": segGeneralSuppliesImg,
  "custom branding": segCustomBrandingImg,
  "cosmetics": segCosmeticsImg,
  "agriculture": segAgricultureImg,
  "dairy": segDairyImg,
  "pharmacy": segPharmacyImg,
};

const SEGMENT_IMAGE_FALLBACK_POOL = [
  catPaperBagsImg, catBoxesCartonsImg, catCupsSleevesImg, catMailersPouchesImg,
  catLabelsStickersImg, catFoodContainersImg, catGiftEventImg, catBeautyPharmaImg,
];

function imageForSegment(name: string, fallbackIndex: number): string {
  const match = SEGMENT_IMAGES[name.trim().toLowerCase()];
  if (match) return match;
  return SEGMENT_IMAGE_FALLBACK_POOL[fallbackIndex % SEGMENT_IMAGE_FALLBACK_POOL.length];
}

function CategoryGrid() {
  const [segments, setSegments] = useState<Segment[]>([]);

  useEffect(() => {
    let cancelled = false;
    void api.getSegments().then((data) => {
      if (!cancelled) setSegments(data);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  if (segments.length === 0) return null;

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
          {segments.map((seg, i) => (
            <Link
              key={seg.id}
              to={`/products?segmentId=${seg.id}`}
              className="group relative overflow-hidden rounded-2xl aspect-square sm:aspect-[4/3] block"
            >
              <img
                src={imageForSegment(seg.name, i)}
                alt={seg.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <span className="absolute bottom-3 left-3 right-3 font-display text-sm font-semibold text-white sm:text-base">
                {seg.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
// ── Promo carousel — auto-advancing billboard-style ad banner, sits right
// below the hero. Full-bleed product photo with a scrim + bold overlay
// copy, like real ad creative — not a product-listing grid — cycling
// through Deals / New Arrivals / Best Sellers every few seconds. ──
const CAROUSEL_TABS = [
  { key: "deals", eyebrow: "Save today", title: "Deals", cta: "Shop the deal", seeAllHref: "/products?deals=true", bg: "linear-gradient(120deg, #7a2f22 0%, #5c2119 100%)", fetcher: () => api.getProducts({ isDiscount: true, size: 8 }) },
  { key: "new", eyebrow: "Just landed", title: "New arrivals", cta: "Shop new arrivals", seeAllHref: "/products?newArrivals=true", bg: "linear-gradient(120deg, #0d3320 0%, #08231a 100%)", fetcher: () => api.getProducts({ isNewArrival: true, size: 8 }) },
  { key: "best", eyebrow: "Customer Favourites", title: "Best Sellers", cta: "Shop Best Sellers", seeAllHref: "/products?fastMoving=true", bg: "linear-gradient(120deg, #6b4a12 0%, #4a3208 100%)", fetcher: () => api.getProducts({ isFastMoving: true, size: 8 }) },
];

function PromoCarousel() {
  const [active, setActive] = useState(0);
  const [productsByTab, setProductsByTab] = useState<Record<number, Product[]>>({});

  useEffect(() => {
    let cancelled = false;
    CAROUSEL_TABS.forEach((tab, i) => {
      tab.fetcher()
        .then((data) => { if (!cancelled) setProductsByTab((prev) => ({ ...prev, [i]: data })); })
        .catch(() => { if (!cancelled) setProductsByTab((prev) => ({ ...prev, [i]: [] })); });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((i) => (i + 1) % CAROUSEL_TABS.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, []);

  // Nothing to promote anywhere — skip the section rather than show three
  // empty tabs (and don't let the auto-skip effect below spin forever).
  const allLoaded = CAROUSEL_TABS.every((_, i) => productsByTab[i] !== undefined);
  const allEmpty = allLoaded && CAROUSEL_TABS.every((_, i) => (productsByTab[i]?.length ?? 0) === 0);

  // If the tab we just landed on turns out to have nothing to advertise,
  // skip straight past it instead of showing an empty banner.
  useEffect(() => {
    if (allEmpty) return;
    const products = productsByTab[active];
    if (products !== undefined && products.length === 0) {
      setActive((i) => (i + 1) % CAROUSEL_TABS.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productsByTab, active, allEmpty]);

  if (allEmpty) return null;

  const tab = CAROUSEL_TABS[active];
  const products = productsByTab[active] ?? [];
  const showcase = products.slice(0, 4);

  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        {/* Elegant promotional module: themed dark panel with bold copy on
            one side and several elevated product cards showcased on the
            other — reads as a proper "deal of the day" promo, not a single
            billboard image or a cramped row of thumbnails. */}
        <div className="relative overflow-hidden rounded-2xl" style={{ background: tab.bg }}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[300px_1fr] lg:items-center lg:gap-12">
            {/* Copy */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/90">{tab.eyebrow}</p>
              <h2 className="mt-2 font-display text-4xl font-medium text-white sm:text-5xl">{tab.title}</h2>
              <p className="mt-3 max-w-xs text-sm text-white/80">
                A handful of picks worth a look, refreshed regularly.
              </p>
              <Link
                to={tab.seeAllHref}
                className="mt-6 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: "#e8c878", color: "#0d3320" }}
              >
                {tab.cta} <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="mt-6 flex gap-1.5">
                {CAROUSEL_TABS.map((t, i) => (
                  <button
                    key={t.key}
                    type="button"
                    aria-label={`Show ${t.title}`}
                    onClick={() => setActive(i)}
                    className="h-1.5 rounded-full transition-all"
                    style={{ width: i === active ? "20px" : "6px", background: i === active ? "#e8c878" : "rgba(255,255,255,0.35)" }}
                  />
                ))}
              </div>
            </div>

            {/* Product showcase — flex, not a 4-column grid, so a tab with fewer
                than 4 products doesn't leave dead empty columns (cards stay a
                fixed width and left-align instead of stretching to fill). */}
            <div className="-mx-6 flex flex-wrap gap-4 overflow-x-auto px-6 pb-1 sm:mx-0 sm:gap-5 sm:overflow-visible sm:px-0">
              {showcase.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="w-36 shrink-0 overflow-hidden rounded-xl bg-white/95 shadow-lg sm:w-40">
                      <div className="shimmer aspect-square w-full" />
                      <div className="p-3">
                        <div className="shimmer h-3 w-4/5 rounded" />
                        <div className="shimmer mt-2 h-2.5 w-1/2 rounded" />
                      </div>
                    </div>
                  ))
                : showcase.map((p) => (
                    <Link
                      key={p.id}
                      to={`/products/${p.slug}`}
                      className="group w-36 shrink-0 overflow-hidden rounded-xl bg-white shadow-lg transition-transform hover:-translate-y-1 sm:w-40"
                    >
                      <div className="aspect-square w-full overflow-hidden bg-secondary">
                        {p.primaryImageUrl && (
                          <img
                            src={p.primaryImageUrl}
                            alt={p.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        )}
                      </div>
                      <div className="p-3">
                        <p className="line-clamp-1 text-xs font-medium text-foreground sm:text-sm">{p.name}</p>
                        {p.basePrice !== undefined && (
                          <p className="mt-0.5 text-xs font-semibold" style={{ color: "#0d3320" }}>
                            KES {p.basePrice.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Account types callout — compact CTA promoting both real account types
// (Individual Shopper + Business), styled like the become-a-partner.tsx CTA box
// rather than a new pattern. Guests are already served by the product grid
// around this section, so this block is only about the two account paths. ──
function AccountTypesCallout() {
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent">For individuals</p>
            <h2 className="mt-2 font-display text-xl font-medium text-foreground sm:text-2xl">
              Open a free Individual Shopper Account.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Earn a welcome bonus, Reward Coupons on every order, and referral rewards — redeemable for
              real discounts at checkout.
            </p>
            <div className="mt-5">
              <Link
                to="/individual-shopper-account"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Learn more <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent">For businesses</p>
            <h2 className="mt-2 font-display text-xl font-medium text-foreground sm:text-2xl">
              Ordering for your business? Open a free Business Account.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Earn a welcome bonus, build your order history, and be first in line when trade
              credit accounts launch.
            </p>
            <div className="mt-5">
              <Link
                to="/business-account"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Learn more <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Page ──
function HomePage() {
  const { isAuthenticated } = useAuth();

  // Signed-in customers with usable order history get a personalized mix (reorder-due + global
  // reorder popularity); everyone else gets the click-popularity feed. Remounting via `key` when
  // auth state resolves re-triggers ProductRow's own fetch (its internal effect only runs once
  // per mount) rather than threading isAuthenticated through ProductRow itself.
  const recommendedFetcher = isAuthenticated
    ? () => api.getRecommendedProductsPersonalized().catch(() => api.getRecommended())
    : api.getRecommended;

  return (
    <>
      <FirstVisitSplash />
      <WelcomeStarterModal />
      <CookieConsent />
      <PageProgressBar />
      <div className="flex min-h-screen flex-col" style={{ background: "var(--background)" }}>
        <AddToHomeScreenPrompt />
        <main className="flex-1 pb-16 md:pb-0">
          <HomeNav />
          <Hero />
          <PromoCarousel />
          <CategoryRow />
          <GuaranteeBand />
          <AccountTypesCallout />
          <ProductRow
            key={isAuthenticated ? "recommended-auth" : "recommended-anon"}
            eyebrow="Featured products"
            title="Popular this week"
            fetcher={recommendedFetcher}
            bg="background"
          />
          <ProductRow
            eyebrow="Deals"
            title="Today's deals"
            desc="A mix of real markdowns and picks we're nudging you toward — every price shown is exactly what you'll pay. Stock-based, not a countdown — once it's gone, it's gone."
            seeAllHref="/deals"
            fetcher={api.getDeals}
            bg="cream"
            emphasizeDeal
          />
          <ProductRow
            eyebrow="Just in"
            title="New arrivals"
            seeAllHref="/products?newArrivals=true"
            fetcher={() => api.getProducts({ isNewArrival: true, size: 8 })}
            bg="cream"
          />
          <ProductRow
            eyebrow="Customer Favourites"
            title="Best Sellers"
            desc="Discover some of our most popular packaging products, carefully selected and refreshed regularly to bring you the products customers love most."
            seeAllHref="/products?fastMoving=true"
            fetcher={() => api.getProducts({ isFastMoving: true, size: 8 })}
            bg="background"
          />
          <CategoryGrid />
          <TestimonialsSection />
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
