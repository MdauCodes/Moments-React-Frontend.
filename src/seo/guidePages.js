// Guide pages: the three searches the site had no page for (SEO/AEO/GEO plan, Oct 2026):
//   /packaging-suppliers-nairobi/          "packaging suppliers Nairobi", "who sells packaging in CBD"
//   /packaging/eco-friendly-packaging-kenya/  "eco-friendly / biodegradable packaging Kenya"
//   /custom-packaging-nairobi/             "custom / branded / printed packaging Nairobi"
//
// Plain JS for the same reason as seoData.js and landingPages.js: the browser route
// (src/routes/guide.tsx) and the Node prerender (scripts/prerender-seo.mjs) both read it, so a
// crawler and a shopper get the same words for a URL.
//
// Copy rules (confirmed with the owner, 17 Oct 2026):
//  - Only facts the site already states: the Ukwala Road shop and hours, M-Pesa, same-day Nairobi
//    delivery before the cutoff, about three business days countrywide, minimums per product.
//  - Never "manufacturer", never "NEMA-approved", no named delivery towns or print timelines.
//  - Eco: paper/kraft is recyclable, some lines are compostable (bagasse), carrier bags are not the
//    banned polythene kind. Product lists come from the live catalogue, never hand-written.
//  - Custom/branded work starts with a WhatsApp conversation; no MOQs, prices or lead times here.
//
// URLs carry a trailing slash for the same reason product URLs do (see productPath in seoData.js):
// Render serves the prebuilt <path>/index.html for the slash form without a dashboard rule.

import { BUSINESS, displayProductName, formatKes, priceUnitLabel } from "./seoData.js";
import { SHOP_PAGES, shopPageIncludes } from "./landingPages.js";

/** Sitemap lastmod for the guide pages: change it when their copy changes (prices are live). */
export const GUIDE_UPDATED = "2026-10-17";

/** Written by the prerender next to the pages; the browser page reads the same numbers. */
export const GUIDE_DATA_PATH = "/guide-data.json";

export const WHATSAPP_CUSTOM_MESSAGE =
  "Hello Moments Packaging, I'd like packaging with my logo. Product: ... Quantity: ... Needed by: ...";

export function whatsappCustomUrl() {
  return `${BUSINESS.whatsappUrl}?text=${encodeURIComponent(WHATSAPP_CUSTOM_MESSAGE)}`;
}

/**
 * Eco page product groups. A product belongs to the first group whose `include` matches its name
 * (and `exclude` doesn't). Wording per group stays within what the material itself supports.
 */
export const ECO_GROUPS = [
  {
    key: "bagasse",
    heading: "Sugarcane bagasse food boxes",
    blurb:
      "Bagasse is the fibre left after sugarcane is crushed for juice. These boxes are plant fibre, not plastic, and are compostable.",
    include: /bagasse|sugarcane|biodegradable (box|clamshell|2-compartment)|clamshell biodegradable/i,
  },
  {
    key: "wood",
    heading: "Wooden and bamboo cutlery, stirrers, skewers and picks",
    blurb:
      "Natural wood and bamboo in place of plastic spoons, forks, stirrers and picks. Wood and bamboo are biodegradable.",
    include: /wooden|\bwood\b|bamboo/i,
  },
  {
    key: "cornstarch",
    heading: "Cornstarch cutlery",
    blurb: "Cutlery made with plant starch, a plant-based alternative to standard plastic cutlery.",
    include: /cornstarch|corn starch/i,
  },
  {
    key: "paper-bags",
    heading: "Khaki and kraft paper bags",
    blurb:
      "Paper carrier bags for shops and takeaways. Paper is recyclable where it is collected, and these are the kind of shopping bag shops use since the 2017 plastic carrier bag ban.",
    include: /khaki|kraft bag|paper bag|brown bag/i,
    exclude: /cup carrier/i,
  },
  {
    key: "paper-food",
    heading: "Paper and kraft cups, plates, tubs and boxes",
    blurb:
      "Paper-based food and drink packaging. Plain paper and card are recyclable; most paper cups and food tubs have a thin coating to hold liquid, which needs specialist recycling.",
    include: /kraft|paper (cup|plate|tub|bowl|straw|box)|ppr cup|pizza box|cake box/i,
    // Clear (plastic) boxes and kraft ziplock bags are left out: neither is plain paper.
    exclude: /khaki|paper bag|kraft bag|lids?\b|tape|clear|zip ?lock/i,
  },
];

export const GUIDE_PAGES = [
  {
    slug: "packaging-suppliers-nairobi",
    path: "/packaging-suppliers-nairobi/",
    kind: "suppliers",
    title: "Packaging Suppliers in Nairobi | Moments Packaging",
    description:
      "Packaging supplier in Nairobi CBD: bags, boxes, cups and food containers, prices shown. Pay with M-Pesa, same-day Nairobi delivery, or visit our shop.",
    h1: "Packaging suppliers in Nairobi",
    answer: `${BUSINESS.legalName} is a packaging supplier in Nairobi with a shop at ${BUSINESS.streetAddress}, ${BUSINESS.locality}, and an online store. We stock paper bags, food containers, cups and lids, boxes, cutlery and foil, with every price shown. Pay with M-Pesa for same-day delivery within Nairobi, or countrywide in about three business days.`,
    sections: [
      {
        heading: "Visit the shop or order online",
        bullets: [
          `In person: ${BUSINESS.streetAddress}, ${BUSINESS.locality}. Open ${BUSINESS.hoursText}. See the stock and buy over the counter at the same prices as the website.`,
          "Online: add products to the cart and pay with M-Pesa. Orders placed before the daily cutoff are delivered the same day within Nairobi.",
          `Ask first: call or WhatsApp ${BUSINESS.phoneDisplay}, or email ${BUSINESS.email}.`,
        ],
      },
      {
        heading: "Delivery and payment",
        bullets: [
          "Same-day delivery within Nairobi for orders placed before the daily cutoff.",
          "Countrywide delivery, typically within about three business days depending on the location. The delivery fee is shown at checkout before you pay.",
          "Pay with M-Pesa (STK push) or bank transfer. Large enterprise orders may need a 50% deposit.",
        ],
      },
      {
        heading: "Minimum order",
        paras: [
          "It depends on the product. Many items can be bought individually or by the packet, and the minimum is shown on each product page before you add it to the cart. For very large quantities, use the Enterprise Quote form for dedicated pricing.",
        ],
      },
      {
        heading: "How to choose a packaging supplier in Nairobi",
        bullets: [
          "Prices you can see before you call. Every product on this site shows its price and pack size.",
          "Stock you can check: each product shows whether it is in stock, and you can see it in person at the shop.",
          "Delivery that fits your day: same-day within Nairobi matters when you run out mid-week.",
          "One supplier for the whole order: containers, cups, lids, cutlery, bags and foil from one place saves trips and delivery fees.",
        ],
      },
    ],
    faqs: [
      {
        q: "Where can I buy packaging materials in Nairobi?",
        a: `At Moments Packaging: online at momentspackaging.com with M-Pesa and same-day Nairobi delivery, or in person at our shop, ${BUSINESS.streetAddress}, ${BUSINESS.locality}, open ${BUSINESS.hoursText}.`,
      },
      {
        q: "Which shop sells takeaway packaging in Nairobi CBD?",
        a: `Moments Packaging on Ukwala Road, OTC (${BUSINESS.streetAddress}) sells takeaway containers, cups and lids, cutlery, foil, sachets and paper bags over the counter, at the same prices as the website.`,
      },
      {
        q: "Do you deliver packaging outside Nairobi?",
        a: "Yes, countrywide, typically within about three business days depending on your location. The delivery fee is shown at checkout before you pay.",
      },
      {
        q: "How do I pay for a packaging order?",
        a: "With M-Pesa at checkout (an STK push to your phone) or by bank transfer. Large enterprise orders may need a 50% deposit.",
      },
      {
        q: "Is there a minimum order quantity?",
        a: "It depends on the product. Many items are sold individually or by the packet; the minimum is shown on each product page before you add it to the cart.",
      },
      {
        q: "Can I see the packaging before I buy?",
        a: `Yes. Visit the shop at ${BUSINESS.streetAddress}, ${BUSINESS.locality}, ${BUSINESS.hoursText}, and see the stock in person.`,
      },
      {
        q: "Can I get packaging printed with my logo?",
        a: `Yes, on request. Send us a WhatsApp message on ${BUSINESS.phoneDisplay} with your logo, the product and the quantity, and we come back with what is possible and a price.`,
      },
    ],
    links: {
      guides: ["eco-friendly-packaging-kenya", "custom-packaging-nairobi"],
      industries: true,
    },
  },
  {
    slug: "eco-friendly-packaging-kenya",
    path: "/packaging/eco-friendly-packaging-kenya/",
    kind: "eco",
    title: "Eco-Friendly Packaging in Kenya | Moments Packaging",
    description:
      "Eco-friendly packaging in Kenya: kraft paper bags, paper cups and boxes, bagasse food boxes, wooden and bamboo cutlery. M-Pesa checkout, Nairobi delivery.",
    h1: "Eco-friendly packaging in Kenya",
    answer:
      "Moments Packaging sells plastic-free and plant-based packaging in Nairobi: khaki and kraft paper bags, paper cups, plates and boxes, sugarcane bagasse food boxes, and wooden, bamboo and cornstarch cutlery, stirrers and skewers. Each product page says what it is made of. Pay with M-Pesa for same-day Nairobi delivery, or buy at our Nairobi CBD shop.",
    sections: [
      {
        heading: "Kenya's plastic bag ban and your packaging",
        paras: [
          "Since August 2017 Kenya has banned plastic carrier bags and flat bags used for commercial and household packaging. The carrier bags we sell are khaki and kraft paper and non-woven bags, not the banned polythene kind.",
          "Rules change and apply differently to different uses, so check NEMA's current guidance for your own business. This is general information, not legal advice.",
        ],
      },
      {
        heading: "How we describe our packaging",
        paras: [
          "We only call something recyclable, biodegradable or compostable when its material supports it, and we list a product here only when the catalogue actually stocks it. If you need to describe your packaging to your own customers, use the material named on the product page.",
        ],
      },
    ],
    table: {
      caption: "Recyclable, biodegradable or compostable: what each material is",
      head: ["Material", "What it is", "After use"],
      rows: [
        ["Khaki and kraft paper", "Paper", "Recyclable where paper is collected; breaks down naturally"],
        ["Sugarcane bagasse", "Plant fibre from crushed sugarcane", "Compostable"],
        ["Wood and bamboo", "Natural wood", "Biodegradable"],
        ["Cornstarch cutlery", "Made with plant starch", "A plant-based alternative to standard plastic"],
        ["Coated paper cups and tubs", "Paper with a thin liquid-proof coating", "Needs specialist recycling"],
      ],
    },
    faqs: [
      {
        q: "Where can I buy eco-friendly packaging in Kenya?",
        a: `Moments Packaging sells paper bags, paper cups and boxes, bagasse food boxes and wooden and bamboo cutlery online with M-Pesa checkout, delivered the same day in Nairobi or countrywide in about three business days, and at our shop: ${BUSINESS.streetAddress}, ${BUSINESS.locality}.`,
      },
      {
        q: "What is the difference between recyclable, biodegradable and compostable?",
        a: "Recyclable means the material can be reprocessed where it is collected; plain paper and card are widely recovered in Kenya. Biodegradable only means it breaks down eventually, with no set timeframe. Compostable is stricter: it breaks down into compost, often only in industrial composting.",
      },
      {
        q: "Are paper bags allowed under Kenya's plastic bag ban?",
        a: "Paper bags are one of the alternatives shops have used since the 2017 ban on plastic carrier bags. Check NEMA's current guidance for your own use; this is general information, not legal advice.",
      },
      {
        q: "What is bagasse packaging?",
        a: "Bagasse is the fibre left after sugarcane is crushed for juice. It is pressed into food boxes and clamshells that replace plastic and polystyrene takeaway boxes, and it is compostable.",
      },
      {
        q: "Are paper cups recyclable?",
        a: "Most paper cups have a thin coating inside so they hold liquid, which means they need specialist recycling rather than ordinary paper recycling. Plain paper bags and card boxes are easier to recycle.",
      },
      {
        q: "Do you sell plastic-free cutlery?",
        a: "Yes: wooden spoons, forks and knives, bamboo skewers and picks, wooden stirrers and cornstarch cutlery sets. Each product shows its price and pack size.",
      },
    ],
    links: {
      shop: [
        "biodegradable-and-paper-packaging",
        "khaki-and-paper-bags",
        "reusable-shopping-bags",
        "disposable-cutlery",
        "coffee-cups",
      ],
      guides: ["packaging-suppliers-nairobi", "custom-packaging-nairobi"],
      extra: [["/sustainability", "Our sustainability commitments"]],
    },
  },
  {
    slug: "custom-packaging-nairobi",
    path: "/custom-packaging-nairobi/",
    kind: "custom",
    title: "Custom Branded Packaging in Nairobi | Moments Packaging",
    description:
      "Packaging with your logo in Nairobi: send us your logo, product and quantity on WhatsApp and we reply with what is possible, a price and a timeline.",
    h1: "Custom and branded packaging in Nairobi",
    answer: `Want packaging with your logo? Send Moments Packaging a WhatsApp message on ${BUSINESS.phoneDisplay} with your logo, the product you want branded and roughly how many you need. We reply with what is possible, a price and a timeline for your order, and you can also visit our shop on Ukwala Road, Nairobi CBD.`,
    sections: [
      {
        heading: "What to send us",
        bullets: [
          "Your logo or artwork, if you have it (a photo of your current packaging is fine to start).",
          "The product: paper bags, cups, boxes, labels and stickers, or something else.",
          "The size and roughly how many you need.",
          "When you need it, and where it should be delivered.",
        ],
      },
      {
        heading: "What happens next",
        bullets: [
          "We tell you what can be branded and the options for your product.",
          "You get a price and a timeline before anything is made.",
          "Once you confirm, we keep you updated on WhatsApp until delivery.",
        ],
      },
      {
        heading: "Need packaging today?",
        paras: [
          "Plain stock packaging is in the shop and online right now, with prices shown and same-day delivery within Nairobi. Many businesses start with plain packaging and add their logo later.",
        ],
      },
    ],
    faqs: [
      {
        q: "How do I get packaging with my logo in Nairobi?",
        a: `Send a WhatsApp message to ${BUSINESS.phoneDisplay} with your logo, the product and the quantity. We reply with what is possible, a price and a timeline.`,
      },
      {
        q: "How much does custom packaging cost in Kenya?",
        a: "It depends on the product, the size, the quantity and the print. Send us those details on WhatsApp and we give you a price for your order before anything is made.",
      },
      {
        q: "How long does custom packaging take?",
        a: "It depends on the product and the quantity. We give you a timeline with your quote, so you know the delivery date before you confirm.",
      },
      {
        q: "What is the minimum order for custom printed packaging?",
        a: "It varies by product and print. Tell us what you need on WhatsApp and we tell you the minimum along with the price.",
      },
      {
        q: "Can I see a sample before ordering?",
        a: "Ask when you message us. You can also visit the shop on Ukwala Road to see the plain packaging your logo would go on.",
      },
    ],
    links: {
      shop: ["khaki-and-paper-bags", "coffee-cups", "cake-boxes-and-dessert-packaging", "packaging-tapes"],
      guides: ["packaging-suppliers-nairobi", "eco-friendly-packaging-kenya"],
      extra: [["/enterprise-quote", "Enterprise quote for large orders"]],
    },
  },
];

export function findGuidePage(slug) {
  return GUIDE_PAGES.find((p) => p.slug === slug) ?? null;
}

/** Slash-less forms that the prerender guard sends on to the canonical slash form. */
export const GUIDE_SLASHLESS_PATHS = GUIDE_PAGES.map((p) => p.path.replace(/\/$/, ""));

/** Lowest base price among products, as "KES 5 per piece" (null if nothing is priced). */
export function fromPriceText(products) {
  const priced = products.filter((p) => p.basePrice != null && Number(p.basePrice) > 0);
  if (!priced.length) return null;
  const cheapest = priced.reduce((a, b) => (Number(b.basePrice) < Number(a.basePrice) ? b : a));
  return `${formatKes(cheapest.basePrice)} per ${priceUnitLabel(cheapest)}`;
}

/** The trimmed product shape the guide data file carries. */
function card(p) {
  return {
    slug: p.slug,
    name: displayProductName(p.name),
    basePrice: p.basePrice ?? null,
    unit: priceUnitLabel(p),
    image: p.primaryImageUrl || p.imageUrls?.[0] || null,
    stockStatus: p.stockStatus ?? null,
  };
}

function byName(a, b) {
  return displayProductName(a.name).localeCompare(displayProductName(b.name));
}

/**
 * Everything the guide pages show from the catalogue, computed once at build time: a row per
 * /shop/ hub that has products (count and from-price) and the eco groups' product lists.
 */
export function buildGuideData(products) {
  const hubs = SHOP_PAGES.map((page) => {
    const list = products.filter((p) => shopPageIncludes(page, p));
    return { slug: page.slug, name: page.h1, count: list.length, from: fromPriceText(list) };
  }).filter((h) => h.count > 0);

  const taken = new Set();
  const eco = ECO_GROUPS.map((g) => {
    const list = products
      .filter((p) => !taken.has(p.slug))
      .filter((p) => g.include.test(String(p.name ?? "")) && !(g.exclude && g.exclude.test(String(p.name ?? ""))))
      .sort(byName);
    list.forEach((p) => taken.add(p.slug));
    return { key: g.key, products: list.map(card) };
  });

  return { hubs, eco };
}
