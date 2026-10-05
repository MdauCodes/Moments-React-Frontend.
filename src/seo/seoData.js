// Single source of truth for per-URL SEO copy — imported by BOTH the browser app (via
// seoData.d.ts, see RouteSeo.tsx / products.$slug.tsx) and the Node post-build prerender script
// (scripts/prerender-seo.mjs). Plain JS on purpose: a Node build script can't import a .ts file
// without an extra toolchain step, and the raw HTML a crawler receives must say exactly what the
// hydrated page says, or search engines see two conflicting titles for one URL.
//
// Every fact here is one the live site already states elsewhere (src/data/products.ts,
// contact.tsx, public/llms.txt) — keep it that way. This copy is what Google, Bing and AI
// assistants quote back to shoppers, so nothing aspirational belongs in it.

import { readableSoldPer, unitWord } from "../lib/uomWords.js";

export const SITE_ORIGIN = "https://momentspackaging.com";
export const SITE_NAME = "Moments Packaging Kenya";

/**
 * Official (canonical) URL paths for product and blog detail pages — WITH a trailing slash, on
 * purpose. Render serves /products/<slug>/ straight from the prebuilt dist/products/<slug>/
 * folder, and when no folder exists (a product added after the last deploy, a deleted product, a
 * typo) it falls through to the SPA like any other unknown path. The slash-less form can't be
 * mapped to those folders safely: a Render rewrite returns an empty 200 for a missing folder, and a
 * redirect loops forever (both verified on staging, 2026-09-29). Static pages keep slash-less
 * URLs — their files always exist, so a plain rewrite rule per page is safe.
 */
export function productPath(slug) {
  return `/products/${slug}/`;
}

export function blogPath(slug) {
  return `/blog/${slug}/`;
}

export const BUSINESS = {
  legalName: "Moments Packaging (K) Ltd",
  streetAddress: "Weithaga Building, along Ukwala Road, OTC",
  locality: "Nairobi CBD",
  city: "Nairobi",
  country: "KE",
  phoneDisplay: "0119 556 688",
  phoneIntl: "+254119556688",
  whatsappUrl: "https://wa.me/254119556688",
  email: "info@momentspackaging.com",
  hoursText: "Monday to Friday, 8am to 5pm, and Saturday mornings",
};

export const DEFAULT_SEO = {
  title: "Moments Packaging Kenya — Packaging Supplies & Custom Packaging, Nairobi",
  description:
    "Buy packaging online in Nairobi — bags, boxes, cups, food containers, mailers and labels. Pay with M-Pesa, get same-day Nairobi delivery, or visit our shop on Ukwala Road.",
};

/**
 * Hand-written copy for every indexable static route (the same list the sitemap uses). `intro`
 * is plain sentences rendered into the prerendered HTML body; titles stay under ~65 characters so
 * search results don't truncate them.
 */
export const STATIC_PAGES = {
  "/": {
    title: DEFAULT_SEO.title,
    description: DEFAULT_SEO.description,
    h1: "Packaging supplies and custom packaging in Nairobi",
    intro: [
      "Moments Packaging Kenya sells packaging online and from our shop in Nairobi CBD: paper bags, carrier bags, boxes and cartons, cups and lids, food containers and trays, mailers, wrapping and foil, labels and gifting packaging.",
      "Order on this website and pay with M-Pesa, with same-day delivery within Nairobi and delivery countrywide in about three business days — or come to the shop, see the stock and buy in person.",
      "Need your logo on it? Custom-branded packaging is available on request, with low minimum order quantities.",
    ],
  },
  "/products": {
    title: "Shop Packaging Online in Kenya — All Products | Moments Packaging",
    description:
      "Browse every packaging product with its price and stock: bags, boxes, cups, food containers, wrapping, straws and more. Order online with M-Pesa or buy in store in Nairobi.",
    h1: "All packaging products",
    intro: [
      "Every product below shows its current price. Add to cart and pay with M-Pesa, or buy the same stock in person at our Ukwala Road shop.",
    ],
  },
  "/company-profile": {
    title: "About Moments Packaging (K) Ltd — Company Profile",
    description:
      "Moments Packaging (K) Ltd is a Nairobi packaging supplier and custom packaging maker at Weithaga Building, Ukwala Road. Our story, range and the industries we serve.",
    h1: "Company profile — Moments Packaging (K) Ltd",
    intro: [
      "A trusted packaging partner for Kenyan businesses: packaging supplies in stock, plus custom-branded packaging made to order.",
    ],
  },
  "/industries": {
    title: "Packaging by Industry — Food, Retail, E-commerce | Moments Packaging",
    description:
      "Packaging for food and beverage, agriculture, textile and apparel, e-commerce, gifting and events, beauty and pharma, and industrial businesses in Kenya.",
    h1: "Packaging for every kind of business",
    intro: [
      "We supply packaging for food and beverage, agriculture, textile and apparel, e-commerce, gifting and events, beauty and pharma, and general industrial businesses.",
    ],
  },
  "/sustainability": {
    title: "Sustainable Paper Packaging in Kenya | Moments Packaging",
    description:
      "Our sustainability commitments and the paper-based packaging materials we offer Kenyan businesses.",
    h1: "Packaging with purpose",
    intro: ["Our sustainability commitments and the paper-based packaging materials we offer."],
  },
  "/contact": {
    title: "Contact & Visit Our Packaging Shop in Nairobi | Moments Packaging",
    description:
      "Visit Moments Packaging at Weithaga Building, Ukwala Road, OTC, Nairobi CBD, or call/WhatsApp 0119 556 688. Order online with M-Pesa or buy in store.",
    h1: "Contact us or visit the shop",
    intro: [
      "Ask us anything by phone, WhatsApp or email and we get back to you within one working day.",
    ],
  },
  "/enterprise-quote": {
    title: "Bulk & Wholesale Packaging Quotes in Kenya | Moments Packaging",
    description:
      "Buying packaging in bulk? Request a wholesale or custom-branded packaging quote from Moments Packaging Kenya and get real numbers back.",
    h1: "Bulk and wholesale packaging quotes",
    intro: ["Tell us what you need and in what quantity — we come back to you with real numbers."],
  },
  "/blog": {
    title: "Packaging Guides & Stories | Moments Packaging Blog",
    description:
      "Articles on packaging design, materials and Kenyan brand stories from Moments Packaging.",
    h1: "The Moments blog",
    intro: ["Guides on choosing packaging, materials, and stories from Kenyan brands."],
  },
  "/faq": {
    title: "Packaging Orders, Payment & Delivery FAQ | Moments Packaging",
    description:
      "Answers on ordering packaging online, M-Pesa payment, delivery in Nairobi and countrywide, minimum order quantities and returns.",
    h1: "Frequently asked questions",
    intro: ["Answers on ordering, payment, delivery, minimum quantities and returns."],
  },
  "/how-it-works": {
    title: "How Ordering Works — Online or In Store | Moments Packaging",
    description:
      "How to order packaging from Moments: pick products online, pay with M-Pesa, then get delivery or collect — or buy directly at our Nairobi shop.",
    h1: "How it works",
    intro: ["The ordering and fulfilment process, end to end."],
  },
  "/payment-methods": {
    title: "Payment Methods — M-Pesa & Bank Transfer | Moments Packaging",
    description:
      "Pay for packaging with M-Pesa (STK push) or bank transfer. How checkout and receipts work at Moments Packaging Kenya.",
    h1: "Payment methods",
    intro: [
      "Pay with M-Pesa (STK push) or bank transfer; large enterprise orders may require a deposit.",
    ],
  },
  "/careers": {
    title: "Careers at Moments Packaging Kenya",
    description:
      "Work with Moments Packaging in Nairobi — send us your CV and a short note about what you do.",
    h1: "Work with us",
    intro: ["No open positions right now — send us your CV and we keep it on file."],
  },
  "/become-a-partner": {
    title: "Become a Reseller or Partner | Moments Packaging Kenya",
    description: "Reseller, wholesale and partnership enquiries for Moments Packaging Kenya.",
    h1: "Want to work with us?",
    intro: ["Tell us what kind of business you run and what you have in mind."],
  },
  "/privacy": {
    title: "Privacy Policy | Moments Packaging Kenya",
    description: "How Moments Packaging Kenya collects, uses and protects your personal data.",
    h1: "Privacy policy",
    intro: [],
  },
  "/terms": {
    title: "Terms & Conditions | Moments Packaging Kenya",
    description:
      "Terms and conditions for buying from Moments Packaging Kenya online and in store.",
    h1: "Terms and conditions",
    intro: [],
  },
  "/refunds": {
    title: "Returns & Refunds Policy | Moments Packaging Kenya",
    description:
      "Contact us within 48 hours of delivery with photos of any damaged or incorrect item for a replacement or refund.",
    h1: "Returns and refunds",
    intro: [
      "Contact us within 48 hours of delivery with photos of any damaged or incorrect item for a replacement or refund.",
    ],
  },
  "/accessibility-policy": {
    title: "Accessibility Policy | Moments Packaging Kenya",
    description: "Our commitment to making the Moments Packaging website usable for everyone.",
    h1: "Accessibility policy",
    intro: [],
  },
  "/rewards-terms": {
    title: "Rewards Programme Terms | Moments Packaging Kenya",
    description: "Terms of the Moments Packaging rewards programme.",
    h1: "Rewards terms",
    intro: [],
  },
};

const SMALL_WORDS = new Set(["a", "an", "and", "for", "of", "in", "on", "with", "to", "or", "per"]);

/**
 * Catalogue names come from the POS import in shouting caps ("RASMY 30*300 CLING FILM"). Title
 * case reads better in search results; tokens containing digits ("500ML", "30*300") keep their
 * original form since they're sizes/codes. Names that already have mixed case are left alone.
 */
export function displayProductName(name) {
  const raw = String(name ?? "").trim();
  if (!raw || raw !== raw.toUpperCase()) return raw;
  return raw
    .split(/\s+/)
    .map((word, i) => {
      if (/\d/.test(word)) return word;
      const lower = word.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

/** Mirrors src/lib/utils.ts sanitizeProductDescription — supplier names never go public. */
export function cleanProductDescription(description) {
  if (!description) return "";
  return readableSoldPer(
    String(description)
      .replace(/\s*Supplied by [^.]*\.\s*/gi, " ")
      .replace(/\s{2,}/g, " ")
      .trim(),
  );
}

function clip(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : cut.length).replace(/[\s,.;:—-]+$/, "")}…`;
}

export function formatKes(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  return `KES ${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

/** The unit a product's base price is quoted per, as a customer would say it: "PKT" -> "packet". */
export function priceUnitLabel(product) {
  return unitWord(product?.risellerUomName) ?? "unit";
}

/**
 * Title + meta description for one product — used by the prerendered HTML AND by the product
 * page's own useSeo call, so the raw and hydrated head always agree.
 */
export function productSeo(product) {
  const name = displayProductName(product?.name);
  const suffix = " — Buy Online in Nairobi | Moments";
  const title =
    name.length + suffix.length <= 70
      ? `${name}${suffix}`
      : clip(`${name} | Moments Packaging`, 70);

  const price =
    product?.basePrice != null
      ? `${formatKes(product.basePrice)} per ${priceUnitLabel(product)}. `
      : "";
  let desc = cleanProductDescription(product?.description).replace(
    /\s*Contact us for bulk pricing[^.]*\.?/i,
    "",
  );
  // Imported descriptions usually open by repeating the product name — drop it, the title has it.
  const rawName = String(product?.name ?? "").trim();
  if (rawName && desc.toLowerCase().startsWith(rawName.toLowerCase())) {
    desc = desc.slice(rawName.length).replace(/^[\s.,:;—-]+/, "");
  }
  const tail = "Order online with M-Pesa or buy in store on Ukwala Road, Nairobi.";
  const description = clip(`${name} — ${price}${desc ? `${desc} ` : ""}${tail}`, 158);
  return { title, description, name };
}
