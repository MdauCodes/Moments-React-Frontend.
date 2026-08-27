import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

import {
  Download,
  ArrowRight,
  Sparkles,
  Leaf,
  ShieldCheck,
  Users,
  Award,
  Phone,
  Mail,
  MapPin,
  Globe,
  MessageCircle,
  Instagram,
  Facebook,
} from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { TikTokIcon } from "@/components/icons/TikTokIcon";
import { LogoLeafIcon } from "@/components/icons/LogoLeafIcon";
import logoUrl from "@/assets/moments_logo_without_background.png";
import { api } from "@/services/api";
import { filterVisibleIndustries, type Industry } from "@/data/products";
import pdfAsset from "@/assets/company-profile/moments-company-profile.pdf";
import coverImg from "@/assets/company-profile/cover.jpg";
import visionImg from "@/assets/company-profile/vision-cups.jpg";
import cupsBeverageImg from "@/assets/company-profile/cups-beverage.jpg";
import woodenImg from "@/assets/company-profile/wooden-products.jpg";
import dessertImg from "@/assets/company-profile/dessert-cups.jpg";
import bagsImg from "@/assets/company-profile/bags-sacks.jpg";
import {
  COMPANY_EMAIL,
  COMPANY_PHONE,
  COMPANY_PHONE_ALT,
  COMPANY_ADDRESS,
  WHATSAPP_NUMBER,
  INSTAGRAM_URL,
  INSTAGRAM_HANDLE,
  TIKTOK_URL,
  TIKTOK_HANDLE,
  FACEBOOK_URL,
  FACEBOOK_HANDLE,
} from "@/data/products";



const FOREST = "#0d3320";
const FOREST_DEEP = "#08231a";
const GOLD = "#c9a44c";
const GOLD_SOFT = "#e8c878";

const VALUES = [
  { Icon: Award, title: "Excellence", body: "Highest standards in every customer interaction." },
  { Icon: Sparkles, title: "Innovation", body: "New ideas, technologies and packaging trends for superior solutions." },
  { Icon: ShieldCheck, title: "Integrity", body: "Business done with honesty, transparency and professionalism." },
  { Icon: Leaf, title: "Sustainability", body: "Environmentally responsible packaging for a greener future." },
  { Icon: Users, title: "Customer Success", body: "We measure success by the growth of our clients." },
];

// NOTE: asset file names don't match their visual contents —
//   vision-cups.jpg  → actually the Kraft Packaging Solutions poster grid
//   kraft-solutions.jpg → actually the "Why Choose Us?" / dessert cups graphic
// Images are assigned below to match what each file actually shows.
const CORE = [
  {
    title: "Kraft Packaging Solutions",
    blurb:
      "Sustainable, durable, eco-friendly kraft food packaging — boats, sandwich boxes, carry bags, lunch boxes, window pouches, food containers, paper cups and trays.",
    image: visionImg, // vision-cups.jpg = Kraft poster grid
    href: "/products" as const,
    search: { category: "boxes" } as Record<string, string>,
  },
  {
    title: "Cups, Tumblers & Beverage Range",
    blurb:
      "Single-wall, double-wall and ripple paper cups, PET cold cups, dome and flat lids, branded tumblers and bubble-tea cups.",
    image: cupsBeverageImg, // generated cups/tumblers/beverage photo
    href: "/products" as const,
    search: { category: "cups" } as Record<string, string>,
  },
  {
    title: "Dessert Cups & Display Glassware",
    blurb:
      "Trapeze, sundae, flower, oval, square, twisted, eye-lid, slanted and shooter cups for cafés, bakeries and caterers.",
    image: dessertImg,
    href: "/products" as const,
    search: { category: "cups" } as Record<string, string>,
  },
  {
    title: "Wooden & Bamboo Disposables",
    blurb:
      "Wooden cones, cutlery, teaspoons, skewers, stirrers, chopsticks, ice-cream sticks, cocktail picks and bamboo accessories.",
    image: woodenImg,
    href: "/products" as const,
    search: {} as Record<string, string>,
  },
  {
    title: "Bags & Sacks",
    blurb:
      "Woven and non-woven branded bags — V-series handle sacks, smart bags, 3D bags, vest bags, D-cut bags and bulk sacks.",
    image: bagsImg,
    href: "/products" as const,
    search: { category: "bags" } as Record<string, string>,
  },
];

const WHY_CHOOSE = [
  {
    title: "Innovative Solutions",
    body: "Creative packaging concepts that help brands stand out in competitive markets.",
  },
  {
    title: "Customization Excellence",
    body: "Solutions tailored to the unique needs of each client, ensuring their brand message is communicated effectively.",
  },
  {
    title: "Competitive Pricing",
    body: "Exceptional value through cost-effective solutions without compromising on quality.",
  },
  {
    title: "Reliable Delivery",
    body: "Committed to delivering goods on time within agreed timelines — order conveniently and track deliveries online.",
  },
  {
    title: "Customer-Centric Approach",
    body: "Clients are at the heart of everything we do. We work closely with you to co-design solutions that achieve outstanding results.",
  },
];

const DISPLAY_PHONE = "0119-55-66-88";
const DISPLAY_PHONE_ALT = "0119-55-66-99";
const DISPLAY_ADDRESS = "Weithaga Building, along Ukwala Road, OTC, Nairobi CBD";

function CompanyProfilePage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  useEffect(() => {
    let cancelled = false;
    void api.getIndustries().then((data) => {
      if (!cancelled) setIndustries(filterVisibleIndustries(data));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SiteLayout>
      {/* ─── HERO ─── */}
      <section
        className="relative flex items-center overflow-hidden"
        style={{
          minHeight: "85dvh",
          background: `radial-gradient(ellipse at 100% 0%, ${FOREST} 0%, ${FOREST_DEEP} 60%, #061a13 100%)`,
        }}
      >
        <div
          className="absolute inset-0 lg:hidden"
          style={{
            backgroundImage: `url(${coverImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center right",
            backgroundRepeat: "no-repeat",
            opacity: 0.22,
          }}
          aria-hidden
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: `radial-gradient(circle, ${GOLD} 0%, transparent 70%)` }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-10 bottom-0 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ background: `radial-gradient(circle, ${GOLD_SOFT} 0%, transparent 70%)` }}
        />

        <div className="relative grid w-full items-center gap-8 py-14 pl-8 pr-8 sm:py-16 lg:py-20 lg:pl-48 lg:pr-16">
          <div className="max-w-3xl">
            <h1 className="font-display text-4xl font-medium leading-[1.02] text-white sm:text-5xl lg:text-6xl">
              Company
              <br />
              <span style={{ color: "#ffffff" }}>Profile</span>
            </h1>
            <div className="mt-5 h-px w-16" style={{ background: GOLD }} />
            <p
              className="mt-5 max-w-md font-display text-lg font-light italic leading-snug sm:text-xl"
              style={{ color: GOLD_SOFT }}
            >
              Quality packaging <span className="text-white/90">for every moment.</span>
            </p>
            <p className="mt-5 max-w-lg text-justify text-base leading-relaxed text-white/85">
              We help Kenyan brands present, protect and promote their products through innovative, high-quality and
              cost-effective packaging — delivered countrywide.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold shadow-lg transition-transform hover:-translate-y-0.5"
                style={{ background: GOLD, color: FOREST_DEEP }}
              >
                Browse our products <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={pdfAsset}
                download="Moments-Packaging-Company-Profile.pdf"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-medium text-white backdrop-blur transition-colors hover:bg-white/10"
                style={{ borderColor: `${GOLD}66` }}
              >
                <Download className="h-4 w-4" /> Download PDF
              </a>
            </div>

            <div className="mt-10 grid max-w-md grid-cols-3 gap-5 border-t pt-7" style={{ borderColor: `${GOLD}33` }}>
              {[
                { Icon: Leaf, label: "Quality\nPackaging" },
                { Icon: ShieldCheck, label: "Sustainable\nSolutions" },
                { Icon: Users, label: "For Every\nMoment" },
              ].map((b) => (
                <div key={b.label} className="flex items-start gap-2">
                  <span
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border"
                    style={{ borderColor: `${GOLD}80`, color: GOLD }}
                  >
                    <b.Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <span className="whitespace-pre-line text-[10px] font-semibold uppercase tracking-[0.15em] text-white/88">
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── ABOUT US ─── */}
      <section className="relative" style={{ background: FOREST_DEEP }}>
        <div className="mx-auto max-w-4xl px-5 py-16 lg:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
            About Us
          </p>
          <h2 className="mt-3 font-display text-3xl font-medium text-white sm:text-4xl lg:text-5xl">
            A trusted packaging partner for Kenyan businesses.
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <span className="block h-px w-12" style={{ background: GOLD }} />
            <Leaf className="h-4 w-4" style={{ color: GOLD }} />
            <span className="block h-px w-12" style={{ background: GOLD }} />
          </div>
          <p className="mt-5 text-justify text-base leading-relaxed text-white/85">
            <img
              src={logoUrl}
              alt="Moments Packaging (K) Ltd"
              className="mr-1.5 inline-block align-text-bottom"
              style={{ height: "1.9em", width: "auto" }}
            />{" "}
            is a customer-focused packaging solutions company based in Nairobi. We offer a wide range of supplies
            designed for everyday business needs across food, beverages, cosmetics, retail and more. With a focus on
            reliability, convenience and excellent customer service, we deliver innovative packaging countrywide while
            helping brands create memorable moments through great presentation.
          </p>
          <p className="mt-4 text-justify text-base leading-relaxed text-white/85">
            <span className="font-semibold" style={{ color: GOLD_SOFT }}>
              The meaning behind our logo:
            </span>{" "}
            our logo reflects our environmental commitment through two powerful symbols. The{" "}
            <span className="font-semibold" style={{ color: GOLD_SOFT }}>
              <LogoLeafIcon size={14} className="mr-1 inline-block align-text-bottom" />
              sprouting leaf
            </span>{" "}
            represents growth, renewal and our dedication to building a greener future through responsible innovation
            and environmentally conscious business practices. The{" "}
            <span className="font-semibold" style={{ color: GOLD_SOFT }}>
              recycling symbol ♻️
            </span>{" "}
            embodies our belief in the circular economy, encouraging the reduction of waste through recycling, reuse
            and responsible disposal of packaging materials. Together, these elements symbolize our promise to provide
            packaging solutions that respect both people and the planet.
          </p>
          <p className="mt-4 text-justify text-base leading-relaxed text-white/85">
            Packaging is more than a container — it is a powerful marketing tool that creates lasting first impressions,
            enhances brand visibility and influences purchasing decisions.
          </p>
        </div>
      </section>

      {/* ─── VISION / MISSION / COMMITMENT ─── */}
      <section className="relative" style={{ background: FOREST }}>
        <div className="mx-auto max-w-4xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="grid gap-8">
            {[
              {
                tag: "Vision",
                body: "To redefine packaging across Africa and beyond through innovation, excellence and sustainable solutions that inspire business growth and memorable customer experiences.",
              },
              {
                tag: "Mission",
                body: "To empower businesses through reliable, cost-effective and customised packaging solutions that enhance brand value, meet industry standards and drive sustainable growth.",
              },
              {
                tag: "Our Commitment",
                body: "Every package tells a story. We create solutions that protect products, strengthen brands, improve customer experience and drive business growth.",
              },
            ].map((c) => (
              <div key={c.tag}>
                <div className="flex items-center gap-3">
                  <span className="inline-block h-2 w-2 rotate-45" style={{ background: GOLD }} />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
                    {c.tag}
                  </p>
                </div>
                <p className="mt-3 text-justify text-sm leading-relaxed text-white/85">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── VALUES ─── */}
      <section className="relative" style={{ background: FOREST_DEEP }}>
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
              Our Values
            </p>
            <h2 className="mt-3 font-display text-3xl font-medium text-white sm:text-4xl lg:text-5xl">What we stand for.</h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="block h-px w-12" style={{ background: GOLD }} />
              <Leaf className="h-4 w-4" style={{ color: GOLD }} />
              <span className="block h-px w-12" style={{ background: GOLD }} />
            </div>
          </div>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {VALUES.map((v) => (
              <div key={v.title} className="flex flex-col items-start text-left">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
                  style={{ borderColor: `${GOLD}80`, color: GOLD }}
                >
                  <v.Icon className="h-4.5 w-4.5" strokeWidth={1.6} />
                </span>
                <h3 className="mt-4 font-display text-base font-semibold text-white">{v.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-white/82">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INDUSTRIES WE SERVE ─── */}
      <section className="relative" style={{ background: FOREST }}>
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
              Industries We Serve
            </p>
            <h2 className="mt-3 font-display text-3xl font-medium text-white sm:text-4xl lg:text-5xl">
              No matter your field, we package for it.
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <span className="block h-px w-12" style={{ background: GOLD }} />
              <Leaf className="h-4 w-4" style={{ color: GOLD }} />
              <span className="block h-px w-12" style={{ background: GOLD }} />
            </div>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {industries.map((ind) => (
              <div
                key={ind.id}
                className="flex items-center gap-4 rounded-2xl border p-5"
                style={{ borderColor: `${GOLD}33`, background: FOREST_DEEP }}
              >
                <span
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                  style={{ borderColor: `${GOLD}80`, color: GOLD }}
                >
                  <ind.icon className="h-4.5 w-4.5" strokeWidth={1.6} />
                </span>
                <h3 className="font-display text-sm font-semibold text-white">{ind.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHY CHOOSE US ─── */}
      <section className="relative" style={{ background: FOREST_DEEP }}>
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-3xl">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
                Why Choose Us
              </p>
              <h2 className="mt-3 font-display text-3xl font-medium text-white sm:text-4xl lg:text-5xl">
                Innovation. Quality. Partnership.
              </h2>
              <div className="mt-4 h-px w-12" style={{ background: GOLD }} />
              <div className="mt-7 space-y-5">
                {WHY_CHOOSE.map((pt) => (
                  <div key={pt.title} className="flex gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rotate-45" style={{ background: GOLD }} />
                    <div>
                      <p className="text-sm font-semibold text-white">{pt.title}</p>
                      <p className="mt-0.5 text-justify text-xs leading-relaxed text-white/82">{pt.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CORE PRODUCTS — "The Moments Range" ─── */}
      <section className="relative" style={{ background: FOREST }}>
        <div className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
              Core Products &amp; Services
            </p>
            <h2 className="mt-3 font-display text-3xl font-medium uppercase text-white sm:text-4xl lg:text-5xl">
              The Moments Range
            </h2>
            <div className="mx-auto mt-4 flex w-fit items-center gap-3">
              <span className="block h-px w-12" style={{ background: GOLD }} />
              <Leaf className="h-4 w-4" style={{ color: GOLD }} />
              <span className="block h-px w-12" style={{ background: GOLD }} />
            </div>
          </div>

          <div className="mt-12 space-y-16">
            {CORE.map((c, i) => (
              <div
                key={c.title}
                className={`grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12 ${
                  i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                {/* Image */}
                <img src={c.image} alt={c.title} className="w-full" />

                {/* Text */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
                    0{i + 1} · Range
                  </p>
                  <h3 className="mt-3 font-display text-2xl font-semibold text-white sm:text-3xl">{c.title}</h3>
                  <div className="mt-3 h-px w-12" style={{ background: GOLD }} />
                  <p className="mt-4 text-justify text-sm leading-relaxed text-white/85">{c.blurb}</p>
                  <Link
                    to={c.href}
                    className="mt-5 inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/5"
                    style={{ borderColor: GOLD, color: GOLD }}
                  >
                    Explore the range <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CONTACT ─── */}
      <section className="relative" style={{ background: FOREST }}>
        <div className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em]" style={{ color: GOLD }}>
              Get in touch
            </p>
            <h2 className="mt-3 font-display text-3xl font-medium text-white sm:text-4xl lg:text-5xl">Contact Us</h2>
            <div className="mt-5 h-px w-16" style={{ background: GOLD }} />

            <div className="mt-8 space-y-5">
              <ContactRow Icon={MapPin} label="Address">
                <p className="flex items-center gap-1.5 font-semibold text-base" style={{ color: GOLD_SOFT }}>
                  <LogoLeafIcon size={14} />
                  Moments Packaging (K) Ltd
                </p>
                <p className="text-base">{DISPLAY_ADDRESS}</p>
              </ContactRow>
              <ContactRow Icon={Phone} label="Phone">
                <p className="text-lg font-semibold tracking-wide">
                  <a href="tel:+254119556688" className="hover:underline">
                    {DISPLAY_PHONE}
                  </a>
                  <span className="text-white/60"> / </span>
                  <a href="tel:+254119556699" className="hover:underline">
                    {DISPLAY_PHONE_ALT}
                  </a>
                </p>
              </ContactRow>
              <ContactRow Icon={MessageCircle} label="WhatsApp">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-base hover:underline"
                >
                  Chat on WhatsApp ({DISPLAY_PHONE})
                </a>
              </ContactRow>
              <ContactRow Icon={Mail} label="Email">
                <a href={`mailto:${COMPANY_EMAIL}`} className="text-base break-all hover:underline">
                  {COMPANY_EMAIL}
                </a>
              </ContactRow>
              <ContactRow Icon={Instagram} label="Instagram">
                <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="text-base hover:underline">
                  {INSTAGRAM_HANDLE}
                </a>
              </ContactRow>
              <ContactRow Icon={Facebook} label="Facebook">
                <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className="text-base hover:underline">
                  {FACEBOOK_HANDLE}
                </a>
              </ContactRow>
              <ContactRow Icon={TikTokIcon} label="TikTok">
                <a href={TIKTOK_URL} target="_blank" rel="noopener noreferrer" className="text-base hover:underline">
                  {TIKTOK_HANDLE}
                </a>
              </ContactRow>
              <ContactRow Icon={Globe} label="Online">
                <span className="text-base">www.momentspackaging.com</span>
              </ContactRow>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/enterprise-quote"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5"
                style={{ background: GOLD, color: FOREST_DEEP }}
              >
                Request a quote <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={pdfAsset}
                download="Moments-Packaging-Company-Profile.pdf"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-medium text-white hover:bg-white/5"
                style={{ borderColor: `${GOLD}80` }}
              >
                <Download className="h-4 w-4" /> Download PDF
              </a>
            </div>
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-32 w-1/2"
          style={{
            background: `linear-gradient(135deg, transparent 50%, ${GOLD}33 50%, ${GOLD}22 70%, transparent 100%)`,
          }}
        />
      </section>

      {/* ─── Closing strip ─── */}
      <section className="relative" style={{ background: FOREST_DEEP }}>
        <div className="mx-auto max-w-5xl px-5 py-12 text-center lg:px-8">
          <p className="flex items-center justify-center gap-2 font-display text-xl font-light italic" style={{ color: GOLD_SOFT }}>
            <LogoLeafIcon size={18} />
            Quality packaging <span className="text-white">for every moment.</span>
          </p>
          <div className="mx-auto mt-4 flex w-fit items-center gap-3">
            <span className="block h-px w-12" style={{ background: GOLD }} />
            <Leaf className="h-4 w-4" style={{ color: GOLD }} />
            <span className="block h-px w-12" style={{ background: GOLD }} />
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function ContactRow({
  Icon,
  label,
  children,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: `${GOLD}80`, color: GOLD }}
      >
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
          {label}
        </p>
        <div className="mt-1 text-sm leading-relaxed text-white/90">{children}</div>
      </div>
    </div>
  );
}

export default CompanyProfilePage;
