import { Link } from "react-router-dom";

import { useEffect, useState, lazy, Suspense } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";
import { PageProgressBar } from "@/components/PageProgressBar";
import { EmailInsiderPrompt } from "@/components/EmailInsiderPrompt";
// Lazy — its two avatar images (~220KB combined) have no business competing with the hero image
// and fonts during the critical render path for a component that doesn't even show for 2.5s (and
// may never show at all for a logged-in visitor). Moving it into its own chunk keeps the main
// bundle lighter to parse without changing when/whether the modal itself appears.
const WelcomeStarterModal = lazy(() =>
  import("@/components/WelcomeStarterModal").then((m) => ({ default: m.WelcomeStarterModal })),
);
import { CookieConsent } from "@/components/CookieConsent";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useCartBump } from "@/hooks/useCartBump";
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
import { QuickAddUomButtons } from "@/components/QuickAddUomButtons";
import { isQuickAddEligible } from "@/lib/quickAdd";
import { getStockInfo } from "@/lib/stock";
import { ShopMegaMenu } from "@/components/ShopMegaMenu";
import { CartAddedSheet } from "@/components/CartAddedSheet";
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
import { ArrowRight, Search, ShoppingBag, ChevronRight, Briefcase, Gift, Tag, Sparkles, Flame } from "lucide-react";
import { PaperTexture, CornerLines, SignatureDivider } from "@/components/BrandDecor";
import { api, type Segment } from "@/services/api";
import type { Product, Industry } from "@/data/products";
import { filterVisibleIndustries } from "@/data/products";
import { cloudinaryOptimized } from "@/lib/cloudinaryImage";
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
  const cartBump = useCartBump();
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
          <ShopMegaMenu
            triggerClassName="inline-flex items-center gap-1 hover:opacity-80"
            chevronClassName="h-3 w-3"
          />
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
            className={`relative grid h-10 w-10 place-items-center rounded-full transition-transform duration-500 hover:bg-white/10 ${
              cartBump ? "scale-110" : "scale-100"
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-[-14px] rounded-full transition-opacity duration-500 ${
                cartBump ? "opacity-100 ring-4 ring-[#e8c87880]" : "opacity-0 ring-4 ring-transparent"
              }`}
            />
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 && (
              <span
                className="absolute right-0.5 top-0.5 grid min-w-[18px] h-[18px] place-items-center rounded-full px-1 text-[10px] font-bold text-forest"
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

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

// ── Rotating hero tagline ──
// The finishing line fades fully to invisible (clean exit — never a simultaneous crossfade;
// two overlapping strings mid-transition read as broken/flickery, unlike two overlapping
// photos), then the next line types in character by character with a blinking cursor, then
// holds fully readable. Only ever one line on screen, so the typing reveal never collides
// with anything fading out underneath it.
const HERO_TAGLINES = [
  "Quality Packaging that Matters",
  "Anything Packaging, tafuta sisi",
  "Quality You'll Love. Utafurahia",
];
const HERO_TAGLINE_HOLD_MS = 4200;
const HERO_TAGLINE_FADE_OUT_MS = 380;
const HERO_TAGLINE_TYPE_MS = 42;

function RotatingTagline() {
  const [display, setDisplay] = useState(HERO_TAGLINES[0]);
  const [opacity, setOpacity] = useState(1);
  const [typing, setTyping] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return; // stays on the first tagline, fully typed, no animation

    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });

    async function run() {
      let taglineIndex = 0;
      // The first tagline is already shown fully typed (initial state) — hold it, then start
      // the fade-out/type-in cycle from the second tagline onward.
      await wait(HERO_TAGLINE_HOLD_MS);
      while (!cancelled) {
        taglineIndex = (taglineIndex + 1) % HERO_TAGLINES.length;
        const text = HERO_TAGLINES[taglineIndex];

        setOpacity(0);
        await wait(HERO_TAGLINE_FADE_OUT_MS);
        if (cancelled) return;

        setDisplay("");
        setOpacity(1);
        setTyping(true);
        for (let i = 1; i <= text.length; i++) {
          if (cancelled) return;
          setDisplay(text.slice(0, i));
          await wait(HERO_TAGLINE_TYPE_MS);
        }
        setTyping(false);

        await wait(HERO_TAGLINE_HOLD_MS);
      }
    }

    void run();
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [reducedMotion]);

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transition: reducedMotion ? "none" : `opacity ${HERO_TAGLINE_FADE_OUT_MS}ms ease`,
      }}
    >
      {display}
      {typing && !reducedMotion && <span className="mpk-hero-cursor">|</span>}
    </span>
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

        @media (prefers-reduced-motion: reduce) {
          .mpk-hero-img-a, .mpk-hero-img-b, .mpk-hero-img-c { animation: none !important; }
          .mpk-hero-img-a { opacity: 1 !important; }
          .mpk-hero-img-b, .mpk-hero-img-c { opacity: 0 !important; }
        }
        @keyframes mpk-cursor-blink { 0%, 45% { opacity: 1; } 50%, 100% { opacity: 0; } }
        .mpk-hero-cursor { animation: mpk-cursor-blink 1s steps(1) infinite; margin-left: 1px; }
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
                <RotatingTagline />
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
                  /* 68%, not the 55% this used to be: at 55% the composited result over --cream is
                     #7d7368, which is 4.0:1 — under the 4.5:1 WCAG AA minimum for 10.5px text, and
                     one of the elements Lighthouse's contrast audit was flagging. 68% lands at
                     6.2:1 while still reading as clearly secondary next to the full-ink 13px
                     industry name directly above it. */
                  style={{ fontSize: "calc(10.5px * var(--a11y-font-scale))", color: "color-mix(in oklab, var(--ink) 68%, transparent)" }}
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
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent-ink">{eyebrow}</p>
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

// What each segment photo actually shows, keyed the same way as SEGMENT_IMAGES above.
//
// These tiles used to pass `alt={seg.name}` — the exact same string as the caption rendered over
// the photo inside the very same <Link>. Lighthouse flagged that as redundant alt text, and it is:
// a screen reader announced every tile's name twice ("Food Packaging, Food Packaging, link"), and
// the alt carried no information the caption didn't already give. Written from the photos
// themselves, so they describe the real contents rather than restating the category name.
const SEGMENT_IMAGE_ALTS: Record<string, string> = {
  "food packaging":
    "Kraft carrier bags, window pastry boxes, burger clamshells, dessert cups and printed greaseproof wraps",
  "disposable tableware":
    "Bagasse compartment plates and clamshells, foil trays, kraft soup cups, sushi trays and sauce pots",
  "cutlery":
    "Wooden, clear plastic and CPLA spoons, forks and knives, some standing in kraft cups",
  "drinks packaging":
    "Ripple-wall coffee cups, clear cold cups with domed lids, moulded pulp cup carriers, paper straws and wooden stirrers",
  "kitchen and table accessories":
    "Kitchen towel rolls, serviettes, tissue boxes, cleaning cloths and sachets of sugar, salt, ketchup and black pepper",
  "wooden accessories":
    "Bamboo skewers, cocktail picks, coffee stirrers, wooden serving boats and wooden forks",
  "hygiene essentials":
    "Boxed nitrile and vinyl gloves, disposable hair nets, face masks, hand towel rolls and facial tissue boxes",
  "bags and sacks":
    "Woven polypropylene shopping bags, coloured non-woven totes and vest-style carrier bags, some printed with full-colour designs",
  "general supplies and stationeries":
    "Rolls of packing tape, stretch film and thermal receipt paper, balls of twine and coloured mesh net sacks",
  "custom branding":
    "Rolls and sheets of branded stickers and thank-you labels printed with the Moments Packaging logo",
  "cosmetics":
    "Amber and frosted glass dropper bottles, pump and spray bottles, cream jars and squeeze tubes",
  "agriculture":
    "Moulded pulp egg trays, clear egg cartons, black nursery planting bags and seedling propagation trays",
  "dairy":
    "Clear PET bottles in a range of sizes, including handled jerrycan-style bottles, all with white caps",
  "pharmacy":
    "Clear tablet jars with white lids, kraft stand-up pouches and kraft dispensing envelopes holding capsules and tablets",
};

function imageForSegment(name: string, fallbackIndex: number): string {
  const match = SEGMENT_IMAGES[name.trim().toLowerCase()];
  if (match) return match;
  return SEGMENT_IMAGE_FALLBACK_POOL[fallbackIndex % SEGMENT_IMAGE_FALLBACK_POOL.length];
}

/** Alt text for a segment tile's photo. A segment the backend adds later has no named photo and
 *  therefore falls back to a generic stock shot from the pool — there is nothing truthful to say
 *  about what that particular picture shows, and the tile's own caption already names the
 *  category, so the honest answer is the empty string: mark it decorative and let the caption be
 *  the link's accessible name, rather than inventing a description or repeating the caption. */
function altForSegment(name: string): string {
  return SEGMENT_IMAGE_ALTS[name.trim().toLowerCase()] ?? "";
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
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent-ink">Browse</p>
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
                alt={altForSegment(seg.name)}
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
  {
    key: "deals", eyebrow: "Save today", title: "Deals", cta: "Shop the deal",
    seeAllHref: "/deals", bg: "linear-gradient(120deg, #7a2f22 0%, #5c2119 100%)",
    icon: Tag, fetcher: () => api.getProducts({ isDiscount: true, size: 8 }),
  },
  {
    key: "new", eyebrow: "Just landed", title: "New arrivals", cta: "Shop new arrivals",
    seeAllHref: "/products?newArrivals=true", bg: "linear-gradient(120deg, #0d3320 0%, #08231a 100%)",
    icon: Sparkles, fetcher: () => api.getProducts({ isNewArrival: true, size: 8 }),
  },
  {
    key: "best", eyebrow: "Customer Favourites", title: "Best Sellers", cta: "Shop Best Sellers",
    seeAllHref: "/products?fastMoving=true", bg: "linear-gradient(120deg, #6b4a12 0%, #4a3208 100%)",
    icon: Flame, fetcher: () => api.getProducts({ isFastMoving: true, size: 8 }),
  },
];

const CAROUSEL_INTERVAL_MS = 6000;

// The two colours the promo panel already speaks in — the gold used by its CTA button and its
// progress dots, and the deep forest that gold sits on. Reused by the cards below so they read as
// part of this section rather than plain white boxes that happen to be sitting on top of it.
const PROMO_GOLD = "#e8c878";
const PROMO_FOREST = "#0d3320";

/** The one flag chip a promo card shows, derived from the product rather than from which tab is
 *  on screen. The old version only showed a badge when the flag happened to match the active tab
 *  (discount on the Deals tab, new on New Arrivals) and showed nothing at all on Best Sellers —
 *  so a discounted product sitting in the Best Sellers lineup advertised no discount. Priority is
 *  discount > new > fast, i.e. loudest commercial signal first. */
function promoFlag(p: Product): { label: string; bg: string; color: string; ring: string } | null {
  if (p.isDiscount) return { label: `-${p.discountPercent ?? 10}%`, bg: PROMO_GOLD, color: PROMO_FOREST, ring: "rgba(13,51,32,0.3)" };
  if (p.isNewArrival) return { label: "NEW", bg: PROMO_FOREST, color: PROMO_GOLD, ring: "rgba(232,200,120,0.55)" };
  if (p.isFastMoving) return { label: "HOT", bg: "var(--kraft-ink)", color: "var(--kraft-foreground)", ring: "rgba(255,255,255,0.4)" };
  return null;
}

/** A single card in the promo carousel's lineup.
 *
 *  Rebuilt from a passive photo-name-price tile on two counts the site owner raised: it had no
 *  per-product call to action at all (the only actionable thing in the whole section was the one
 *  "Shop the deal" button up top, so a shopper who liked a specific product had to open its full
 *  page just to act), and it read as a flat white box against what is otherwise a rich dark
 *  panel.
 *
 *  The CTA is the same QuickAddUomButtons the catalogue card uses, not a new interaction — same
 *  handler, same one-tap-add semantics, same CartAddedSheet confirmation — just compact
 *  (showMultiplier={false}, maxVisible={1}) because these cards are half the width of a catalogue
 *  card. Products that need real configuration (sizes, materials, variants) aren't quick-addable
 *  and get a clear "View options" affordance instead of a button that would lie about what
 *  happens next. */
function PromoShowcaseCard({ product: p }: { product: Product }) {
  const stock = getStockInfo(p, null, 0);
  const eligible = isQuickAddEligible(p, stock);
  const flag = promoFlag(p);
  const wasPrice =
    p.originalBasePrice !== undefined && p.basePrice !== undefined && p.originalBasePrice > p.basePrice
      ? p.originalBasePrice
      : null;

  return (
    <Link
      to={`/products/${p.slug}`}
      /* One fixed width at every breakpoint rather than growing at sm. The promo panel's card
         column measures 773px on a maxed-out desktop, so with the 20px gap the widest a card can
         be and still leave four in a single row is 178px — anything larger (the old sm:w-48, or
         the sm:w-52 this was first written at) wraps the fourth card onto a row of its own and
         leaves the lineup looking 3-and-a-bit. */
      className="group relative flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-2xl transition-transform duration-300 hover:-translate-y-1"
      style={{
        // Warm gradient rather than flat #fff, a hairline of the section's own gold, and a deep
        // shadow — the card should look lit from above against the dark panel, not pasted on.
        background: "linear-gradient(168deg, #ffffff 0%, var(--cream) 100%)",
        boxShadow: "0 14px 34px -10px rgba(0,0,0,0.55), 0 2px 6px -2px rgba(0,0,0,0.3)",
        outline: `1px solid ${PROMO_GOLD}59`,
        outlineOffset: "-1px",
      }}
    >
      <div className="relative aspect-square w-full overflow-hidden" style={{ background: "var(--secondary)" }}>
        {p.primaryImageUrl && (
          <img
            src={cloudinaryOptimized(p.primaryImageUrl, 300)}
            /* Deliberately empty, not missing: the product name is rendered as text inside this
               same <Link>, so the link already has an accessible name. Repeating it here is the
               exact redundant-alt pattern the category tiles were just fixed for. */
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.07]"
          />
        )}
        {/* Softens the hard photo/card seam so the image sits *in* the card rather than on it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8"
          style={{ background: "linear-gradient(to bottom, transparent, var(--cream))" }}
        />
        {flag && (
          <span
            className="absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-extrabold uppercase leading-none tracking-wider shadow-md sm:text-[11px]"
            style={{ background: flag.bg, color: flag.color, outline: `1px solid ${flag.ring}`, outlineOffset: "-1px" }}
          >
            {flag.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-3 pb-3 pt-1.5">
        {/* min-h of two lines: product names here run from "MUFFIN HOLDER BOXES 6PCS" to
            "890ML-ECO HAPA- ALUMINIUM FOIL CONTAINER & LIDS", and letting the block collapse to
            one line left neighbouring cards in the same row visibly different heights. */}
        <p className="line-clamp-2 min-h-[2.5em] text-xs font-medium leading-snug text-foreground sm:text-[13px]">
          {p.name}
        </p>

        {p.basePrice !== undefined && (
          // Price is the second thing after the photo on a deal card, so it gets real weight
          // instead of the 12px semibold line it used to share with the product name.
          <p className="flex flex-wrap items-baseline gap-x-1.5 leading-none">
            <span className="font-display text-base font-bold sm:text-lg" style={{ color: PROMO_FOREST }}>
              KES {p.basePrice.toLocaleString()}
            </span>
            {/* basePrice is always the smallest-unit price, so say so — without it a "KES 4"
                headline sitting above an "Add 1 Packet · KES 400" button reads as a contradiction
                rather than as unit price vs pack price. Same "/ pc" wording ProductCard uses. */}
            <span className="text-[10px] font-medium text-muted-foreground sm:text-[11px]">/ pc</span>
            {wasPrice && (
              <span className="text-[11px] font-medium text-muted-foreground line-through">
                {wasPrice.toLocaleString()}
              </span>
            )}
          </p>
        )}

        <div className="mt-auto pt-0.5">
          {eligible ? (
            <QuickAddUomButtons product={p} layout="card" maxVisible={1} showMultiplier={false} />
          ) : (
            // A styled <span>, not a <button> — the whole card is already a <Link> to this
            // product, so this is an affordance telling you what the tap does, not a second
            // control. A nested interactive element here would be invalid HTML for no gain.
            <span
              className="flex w-full items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-opacity group-hover:opacity-90 sm:text-xs"
              style={{ background: PROMO_FOREST, color: PROMO_GOLD }}
            >
              View options <ArrowRight className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function PromoCarousel() {
  const [active, setActive] = useState(0);
  const [productsByTab, setProductsByTab] = useState<Record<number, Product[]>>({});

  useEffect(() => {
    let cancelled = false;
    // A tab's own filter (isDiscount/isNewArrival/isFastMoving) can genuinely match fewer than 4
    // products — previously this just rendered a lone small card floating in an otherwise-empty
    // panel. Top up with the site's general popularity feed (deduped) so the showcase always
    // reads as a full, deliberate lineup rather than a half-empty accident.
    Promise.all([api.getRecommended().catch(() => [] as Product[])]).then(([fallback]) => {
      if (cancelled) return;
      CAROUSEL_TABS.forEach((tab, i) => {
        tab.fetcher()
          .then((data) => {
            if (cancelled) return;
            let combined = data;
            if (combined.length < 4) {
              const seen = new Set(combined.map((p) => p.id));
              combined = [...combined, ...fallback.filter((p) => !seen.has(p.id))].slice(0, 4);
            }
            setProductsByTab((prev) => ({ ...prev, [i]: combined }));
          })
          .catch(() => { if (!cancelled) setProductsByTab((prev) => ({ ...prev, [i]: [] })); });
      });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((i) => (i + 1) % CAROUSEL_TABS.length);
    }, CAROUSEL_INTERVAL_MS);
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
  const TabIcon = tab.icon;
  const products = productsByTab[active] ?? [];
  const showcase = products.slice(0, 4);
  const backdropImage = cloudinaryOptimized(showcase.find((p) => p.primaryImageUrl)?.primaryImageUrl, 640);

  return (
    <section className="bg-cream">
      <div className="mx-auto max-w-7xl px-5 py-6 lg:px-8">
        {/* Promotional module: a real product photo as a moody, blurred backdrop (not a flat
            color panel) with bold copy on one side and elevated product cards on the other —
            reads as a proper "deal of the day" promo, refreshed with whichever tab is showcasing. */}
        <div className="relative overflow-hidden rounded-2xl" style={{ background: tab.bg }}>
          {backdropImage && (
            <div
              key={backdropImage}
              aria-hidden
              className="absolute inset-0 animate-in fade-in duration-700"
              style={{
                backgroundImage: `url(${backdropImage})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(18px) saturate(1.1)",
                transform: "scale(1.15)",
                opacity: 0.55,
              }}
            />
          )}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(115deg, rgba(0,0,0,0.55) 20%, rgba(0,0,0,0.15) 75%)" }}
          />
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
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/90">
                <TabIcon className="h-3.5 w-3.5" style={{ color: "#e8c878" }} />
                {tab.eyebrow}
              </p>
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
                    className="relative h-1.5 overflow-hidden rounded-full transition-all"
                    style={{ width: i === active ? "28px" : "6px", background: "rgba(255,255,255,0.3)" }}
                  >
                    {i === active && (
                      <span
                        key={active}
                        className="absolute inset-y-0 left-0 block w-full rounded-full"
                        style={{
                          background: "#e8c878",
                          transformOrigin: "left",
                          animation: `mpk-promo-dot ${CAROUSEL_INTERVAL_MS}ms linear forwards`,
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
              {/* transform, not width — a width keyframe forces layout on every animation frame
                  for the full 6s duration (Lighthouse's "non-composited animation" flag); scaleX
                  is compositor-only and renders identically since the span is left-anchored. */}
              <style>{`
                @keyframes mpk-promo-dot { from { transform: scaleX(0); } to { transform: scaleX(1); } }
              `}</style>
            </div>

            {/* Product showcase — flex, not a 4-column grid, so a tab with fewer
                than 4 products doesn't leave dead empty columns (cards stay a
                fixed width and left-align instead of stretching to fill). */}
            {/* flex-nowrap + snap on mobile, wrapping only from sm up. This row already carried
                `overflow-x-auto`, but paired with `flex-wrap` that never did anything: the cards
                wrapped instead of scrolling, so on a phone the "lineup" was really a tall vertical
                stack — one card per row, four rows deep. Now it's the swipeable strip the
                overflow was always asking for (same snap-x/snap-start pattern FeaturedCarousel
                uses), which also keeps the section compact now that the cards are taller. */}
            <div className="scrollbar-hide -mx-6 flex snap-x snap-mandatory flex-nowrap gap-4 overflow-x-auto px-6 pb-1 sm:mx-0 sm:snap-none sm:flex-wrap sm:gap-5 sm:overflow-visible sm:px-0">
              {showcase.length === 0
                ? // Mirrors PromoShowcaseCard's width, radius and internal rhythm (including the
                  // CTA row) so the lineup doesn't visibly resize when the real products land.
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="w-44 shrink-0 overflow-hidden rounded-2xl bg-white/95 shadow-lg">
                      <div className="shimmer aspect-square w-full" />
                      <div className="flex flex-col gap-2 px-3 pb-3 pt-1.5">
                        <div className="shimmer h-3 w-4/5 rounded" />
                        <div className="shimmer h-4 w-1/2 rounded" />
                        <div className="shimmer h-6 w-full rounded-full" />
                      </div>
                    </div>
                  ))
                : showcase.map((p) => <PromoShowcaseCard key={p.id} product={p} />)}
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
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent-ink">For individuals</p>
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
                See Shopper Account benefits <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent-ink">For businesses</p>
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
                See Business Account benefits <ArrowRight className="h-4 w-4" />
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
      <Suspense fallback={null}>
        <WelcomeStarterModal />
      </Suspense>
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
      <CartAddedSheet />
    </>
  );
}

export default HomePage;
