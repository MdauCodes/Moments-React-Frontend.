// Buyer-intent landing pages — /shop/<slug>/ (a kind of product) and /industries/<slug>/ (a kind
// of business). Plain JS for the same reason as seoData.js: the browser route AND the Node
// prerender script (scripts/prerender-seo.mjs) both read this file, so a crawler and a shopper
// always get the same copy and the same product list for a URL.
//
// Why these exist (SEO audit, 2026-10-12): 20 searches written the way real buyers search
// ("takeaway food containers wholesale Nairobi", "cake boxes Nairobi where to buy", "party supplies
// disposable plates cups Nairobi") returned Moments zero times. The only listing URLs were
// /products?category=..., which aren't indexable pages, and the catalogue's own names are supplier
// codes nobody types ("ADIX 82/250 CLR CUP"). Each page here is named the way buyers search.
//
// Rules for the copy: only facts the site already states (M-Pesa, same-day Nairobi delivery before
// the cutoff, ~3 business days countrywide, the Ukwala Road shop, minimums per product, branding on
// request). Prices are never written here — they're computed from the live catalogue at build time
// and in the browser. Only list a kind of product here once the catalogue actually stocks it.

import { BUSINESS } from "./seoData.js";

/**
 * `include`/`exclude` are the final word for BOTH the prerender and the browser: a product belongs
 * on the page if its name matches `include` and not `exclude`. Names only, on purpose — the legacy
 * Product.category values are too mixed to trust ("Cups & Lids" holds ice-cream sticks, "Hygiene &
 * PPE" holds masking tape). `category` (optional) and `terms` are just how the browser page gathers
 * candidates from the API (category filter + /products/search) before applying that same rule.
 */
export const SHOP_PAGES = [
  {
    slug: "takeaway-food-containers",
    category: "Containers & Trays",
    terms: ["container", "clamshell", "tub", "sandwich box", "deli box"],
    include: /container|\bcont\b|clamshell|\btub\b|sandwich box|deli box|meal box|compartment/i,
    exclude: /cake|tiramisu|dessert|honey|sauce/i,
    title: "Takeaway Food Containers in Nairobi — Prices & Delivery | Moments",
    description:
      "Takeaway food containers, tubs, clamshells and trays in Nairobi with prices shown. Pay with M-Pesa, same-day Nairobi delivery, or buy at our Ukwala Road shop.",
    h1: "Takeaway food containers in Nairobi",
    intro: [
      "Food containers, tubs, clamshells, sandwich and deli boxes and trays for restaurants, cafés, cloud kitchens, caterers and home cooks — plastic, paper, aluminium and biodegradable options.",
      "Every product shows its price and pack size. Order online and pay with M-Pesa for same-day delivery within Nairobi (orders before the daily cutoff), countrywide in about three business days, or buy in person at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [
      {
        q: "Do your takeaway containers come with lids?",
        a: "Some do and some are sold without — each product page says which. Where a container's lid is sold separately, the product page and cart suggest the matching lid so you can add it in one tap.",
      },
    ],
    related: [
      "aluminium-foil-and-cling-film",
      "disposable-cutlery",
      "sauce-sachets-and-condiments",
    ],
  },
  {
    slug: "disposable-cups-and-lids",
    category: "Cups & Lids",
    terms: ["cup", "lid", "tumbler"],
    include: /\bcups?\b|\blids?\b|tumbler/i,
    exclude: /cupcake|honey|container|\bcont\b|\bbox\b|\bjars?\b|stick/i,
    title: "Disposable Cups & Lids in Kenya — Paper, PET, Ice Cream | Moments",
    description:
      "Disposable cups and lids in Nairobi: paper coffee cups, clear PET cups, ice cream and dessert cups, tumblers. Prices shown, M-Pesa checkout, same-day Nairobi delivery.",
    h1: "Disposable cups and lids",
    intro: [
      "Paper coffee cups, ripple cups, clear PET cups for juice and smoothies, ice cream and dessert cups, tumblers — and the lids that fit them.",
      "Buy by the piece or by the packet. Pay with M-Pesa for same-day delivery within Nairobi, delivery countrywide in about three business days, or pick them up from our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [
      {
        q: "How do I know which lid fits my cup?",
        a: "Cup and lid sizes are in the product names (for example 8oz, 12oz or a rim size like 90mm). When you add a cup, the product page and cart suggest the lids that match it.",
      },
    ],
    related: ["coffee-cups", "straws-and-stirrers", "cake-boxes-and-dessert-packaging"],
  },
  {
    slug: "coffee-cups",
    terms: ["coffee cup", "ripple", "single wall", "double wall", "paper cup"],
    include:
      /coffee cup|ripple|single wall|double wall|paper cup|ppr cup|\d+\s?oz .*(paper|printed).*cup/i,
    exclude: /ice cream|lids?\b/i,
    title: "Disposable Coffee Cups in Kenya — Single Wall & Ripple | Moments",
    description:
      "Paper coffee cups for cafés in Kenya — single wall, ripple and printed cups in 8oz and 12oz, with prices shown. M-Pesa checkout, same-day Nairobi delivery.",
    h1: "Disposable coffee cups for cafés",
    intro: [
      "Single wall, ripple and printed paper coffee cups for cafés, kiosks, offices and events, in the common 8oz and 12oz sizes.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy over the counter at our Ukwala Road shop in Nairobi CBD. Want your logo on the cup? Custom branding is available on request.",
    ],
    faqs: [
      {
        q: "Can I get coffee cups printed with my logo?",
        a: "Yes — custom branding is available on request. Send your logo and the quantity through the Enterprise Quote form or on WhatsApp and we come back to you with a quote.",
      },
    ],
    related: ["disposable-cups-and-lids", "straws-and-stirrers"],
  },
  {
    slug: "cake-boxes-and-dessert-packaging",
    terms: ["cake", "cupcake", "dessert", "tiramisu", "bento"],
    include: /cake|dessert|tiramisu|bento|pastry|ice cream cup/i,
    title: "Cake Boxes & Dessert Packaging in Nairobi | Moments Packaging",
    description:
      "Cake boxes, cupcake cases, bento cake boxes, dessert cups and tiramisu containers in Nairobi with prices shown. M-Pesa checkout, same-day delivery, Ukwala Road shop.",
    h1: "Cake boxes and dessert packaging",
    intro: [
      "Cake boxes, bento cake boxes, cupcake cases, dessert cups and clear tiramisu containers for bakeries, home bakers and dessert shops.",
      "Prices and pack sizes are on every product. Pay with M-Pesa for same-day delivery within Nairobi, delivery countrywide in about three business days, or come and see the boxes at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [
      {
        q: "Can I buy just a few cake boxes?",
        a: "Many products can be bought individually or by the packet — the minimum order is shown on each product page before you add it to the cart.",
      },
    ],
    related: ["pizza-boxes", "disposable-cups-and-lids", "paper-plates-and-party-supplies"],
  },
  {
    slug: "pizza-boxes",
    terms: ["pizza box"],
    include: /pizza box/i,
    title: "Pizza Boxes in Nairobi — Small, Medium, Large | Moments Packaging",
    description:
      "Pizza boxes in Nairobi in small, medium, large and 15-inch sizes with prices shown. Order with M-Pesa for same-day Nairobi delivery or buy at our Ukwala Road shop.",
    h1: "Pizza boxes",
    intro: [
      "Plain pizza boxes in small, medium, large and 15-inch sizes for pizzerias, restaurants and home bakers.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [],
    related: ["takeaway-food-containers", "cake-boxes-and-dessert-packaging"],
  },
  {
    slug: "paper-plates-and-party-supplies",
    category: "Cutlery",
    terms: ["plate", "serviette", "napkin", "spoon", "fork", "straw", "tumbler", "skewer"],
    include: /plate|serviette|napkin|spoon|fork|knife|cutlery|tumbler|umbrella straw|skewer/i,
    exclude: /tiramisu|container|\bcont\b|\btin\b/i,
    title: "Party Supplies Nairobi — Paper Plates, Cups, Serviettes | Moments",
    description:
      "Party and event supplies in Nairobi: paper and plastic plates, printed party plates, cups, tumblers, serviettes and cutlery. Prices shown, M-Pesa, same-day delivery.",
    h1: "Paper plates and party supplies",
    intro: [
      "Everything disposable for birthdays, weddings, church events, office parties and home gatherings: plain and printed paper plates, divided plates, cups and tumblers, serviettes, cutlery, straws and skewers.",
      "Order online with M-Pesa for same-day delivery within Nairobi — handy the day before an event — or delivery countrywide in about three business days. You can also buy in person at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [
      {
        q: "Can I get party supplies delivered the same day in Nairobi?",
        a: "Yes — orders placed before the daily cutoff are delivered the same day within Nairobi. The delivery estimate is shown at checkout before you pay.",
      },
    ],
    related: ["disposable-cups-and-lids", "disposable-cutlery", "cake-boxes-and-dessert-packaging"],
  },
  {
    slug: "khaki-and-paper-bags",
    terms: ["khaki", "paper bag", "kraft bag", "brown bag"],
    include: /khaki|paper bag|kraft bag|brown bag|carrier bag/i,
    exclude: /cup carrier/i,
    title: "Khaki & Paper Bags in Nairobi — Prices Shown | Moments Packaging",
    description:
      "Khaki and brown paper bags in Nairobi in every size, with prices per bag or packet. Pay with M-Pesa for same-day Nairobi delivery, or buy at our Ukwala Road shop.",
    h1: "Khaki and paper bags",
    intro: [
      "Brown khaki and kraft paper bags for shops, butcheries, bakeries, chemists and market traders — the go-to plastic-bag alternative in Kenya, in the full range of numbered sizes.",
      "Every bag shows its price per piece or packet. Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD. Branded bags with your logo are available on request.",
    ],
    faqs: [
      {
        q: "Are paper bags allowed under Kenya's plastic bag ban?",
        a: "Paper bags are one of the alternatives NEMA lists for shops since the 2017 ban on plastic carrier bags. Check NEMA's current guidance for your own use — this is general information, not legal advice.",
      },
    ],
    related: ["reusable-shopping-bags", "ziplock-bags"],
  },
  {
    slug: "reusable-shopping-bags",
    terms: ["non woven", "smart bag", "woven"],
    include: /non.?woven|smart ?bag|\bwoven\b/i,
    title: "Non-Woven & Reusable Shopping Bags in Nairobi | Moments Packaging",
    description:
      "Non-woven and reusable smart bags for shops in Nairobi, with prices shown. M-Pesa checkout, same-day Nairobi delivery, or buy at our Ukwala Road shop.",
    h1: "Non-woven and reusable shopping bags",
    intro: [
      "Non-woven and reusable smart bags for supermarkets, boutiques, pharmacies and events — sturdy enough for repeat use and a common alternative to plastic carrier bags.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD. Printing your logo on bags is available on request.",
    ],
    faqs: [],
    related: ["khaki-and-paper-bags", "ziplock-bags"],
  },
  {
    slug: "ziplock-bags",
    terms: ["ziplock", "zipper"],
    include: /zip ?lock|zipper|zip bag/i,
    title: "Ziplock Bags in Nairobi — Clear & Coloured | Moments Packaging",
    description:
      "Ziplock and zipper bags in Nairobi in clear and coloured sizes, priced per piece or packet. M-Pesa checkout, same-day Nairobi delivery, Ukwala Road shop.",
    h1: "Ziplock bags",
    intro: [
      "Resealable ziplock bags in clear and coloured sizes for spices, snacks, jewellery, small parts and home storage.",
      "Pay with M-Pesa for same-day delivery within Nairobi, delivery countrywide in about three business days, or buy in person at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [],
    related: ["khaki-and-paper-bags", "aluminium-foil-and-cling-film"],
  },
  {
    slug: "aluminium-foil-and-cling-film",
    category: "Wrapping & Foil",
    terms: ["foil", "cling"],
    include: /foil|cling|greaseproof|baking paper/i,
    title: "Aluminium Foil, Foil Containers & Cling Film in Kenya | Moments",
    description:
      "Aluminium foil rolls, foil containers and trays, and cling film for kitchens and caterers in Nairobi. Prices shown, M-Pesa checkout, same-day Nairobi delivery.",
    h1: "Aluminium foil, foil containers and cling film",
    intro: [
      "Aluminium foil rolls, foil containers and trays with lids, gold foil tins, cling film and greaseproof sheets for restaurants, caterers, bakers and home kitchens.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [],
    related: ["takeaway-food-containers", "ziplock-bags"],
  },
  {
    slug: "disposable-cutlery",
    category: "Cutlery",
    terms: ["spoon", "fork", "knife", "cutlery"],
    include: /spoon|fork|knife|cutlery/i,
    exclude: /tiramisu|container|\bcont\b|\btin\b/i,
    title: "Disposable Cutlery Wholesale in Kenya — Spoons, Forks | Moments",
    description:
      "Disposable spoons, forks, knives and cutlery sets for caterers and events in Kenya — plastic, wooden and cornstarch. Prices shown, M-Pesa, same-day Nairobi delivery.",
    h1: "Disposable cutlery",
    intro: [
      "Plastic, wooden and cornstarch spoons, forks and knives for caterers, restaurants, events and takeaway orders.",
      "Pay with M-Pesa for same-day delivery within Nairobi, delivery countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [],
    related: ["paper-plates-and-party-supplies", "takeaway-food-containers"],
  },
  {
    slug: "straws-and-stirrers",
    category: "Straws & Stirrers",
    terms: ["straw", "stirrer"],
    include: /\bstraws?\b|stirrer/i,
    title: "Drinking Straws & Stirrers in Nairobi | Moments Packaging",
    description:
      "Drinking straws, umbrella straws and coffee stirrers for cafés, juice bars and events in Nairobi. Prices shown, M-Pesa checkout, same-day Nairobi delivery.",
    h1: "Straws and stirrers",
    intro: [
      "Clear and coloured drinking straws, umbrella straws and coffee stirrers for cafés, juice bars, bars and events.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [],
    related: ["disposable-cups-and-lids", "coffee-cups"],
  },
  {
    slug: "honey-jars-and-bottles",
    category: "Jars & Bottles",
    terms: ["jar", "bottle"],
    include: /\bjars?\b|bottle/i,
    exclude: /toothpick/i,
    title: "Honey Jars, Bottles & Caps in Kenya | Moments Packaging",
    description:
      "Clear honey jars, bottles and caps in Kenya for honey, sauces and food producers, with prices shown. M-Pesa checkout, same-day Nairobi delivery.",
    h1: "Honey jars, bottles and caps",
    intro: [
      "Clear plastic honey jars in several sizes, bottles and matching caps for honey producers, sauce makers, dairies and small food brands.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD. Labels with your brand are available on request.",
    ],
    faqs: [],
    related: ["fruit-punnets", "takeaway-food-containers"],
  },
  {
    slug: "fruit-punnets",
    terms: ["punnet"],
    include: /punnet/i,
    title: "Fruit & Vegetable Punnets in Kenya — Clear PET | Moments",
    description:
      "Clear PET punnets for fruit, vegetables, berries and fish in Kenya, with prices shown. M-Pesa checkout, same-day Nairobi delivery, Ukwala Road shop.",
    h1: "Fruit and vegetable punnets",
    intro: [
      "Clear and black punnets with and without lids for fruit, berries, vegetables, salads and fish — for farmers, grocers and fresh-produce sellers.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [],
    related: ["honey-jars-and-bottles", "takeaway-food-containers"],
  },
  {
    slug: "disposable-gloves-and-hygiene",
    category: "Hygiene & PPE",
    terms: ["glove", "hairnet", "apron"],
    include: /glove|hair ?net|apron|face mask/i,
    title: "Disposable Gloves & Kitchen Hygiene Supplies in Nairobi | Moments",
    description:
      "Nitrile and clear disposable gloves and food-safety hygiene supplies for kitchens and salons in Nairobi. Prices shown, M-Pesa, same-day Nairobi delivery.",
    h1: "Disposable gloves and hygiene supplies",
    intro: [
      "Nitrile and clear disposable gloves and other food-safety and hygiene supplies for kitchens, food handlers, salons and clinics.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [],
    related: ["aluminium-foil-and-cling-film", "takeaway-food-containers"],
  },
  {
    slug: "sauce-sachets-and-condiments",
    category: "Food & Condiments",
    terms: ["sachet", "seasoning"],
    include: /sachet|seasoning|ketchup|tomato sauce|chilli sauce/i,
    exclude: /\bcup\b/i,
    title: "Sauce, Sugar & Salt Sachets for Restaurants in Kenya | Moments",
    description:
      "Tomato sauce, sugar, salt and pepper sachets and seasonings for restaurants and takeaways in Kenya. Prices shown, M-Pesa checkout, same-day Nairobi delivery.",
    h1: "Sauce sachets and condiments",
    intro: [
      "Tomato sauce, sugar, salt and pepper sachets and seasonings for restaurants, takeaways, hotels and office kitchens.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [],
    related: ["takeaway-food-containers", "disposable-cutlery"],
  },
  {
    slug: "packaging-tapes",
    category: "Tapes",
    terms: ["tape"],
    include: /\btapes?\b/i,
    title: "Packaging Tape in Nairobi — Clear, Brown & Printed | Moments",
    description:
      "Packaging and sealing tapes in Nairobi for shops, warehouses and online sellers, with prices shown. M-Pesa checkout, same-day Nairobi delivery.",
    h1: "Packaging tapes",
    intro: [
      "Sealing and packaging tapes for shops, warehouses, movers and online sellers.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [],
    related: ["khaki-and-paper-bags", "ziplock-bags"],
  },
  {
    slug: "biodegradable-and-paper-packaging",
    terms: ["biodegradable", "compostable", "kraft", "paper"],
    include: /biodegrad|compostable|bagasse|kraft|khaki|paper (cup|plate|bag|tub|straw)/i,
    title: "Biodegradable & Paper Food Packaging in Kenya | Moments Packaging",
    description:
      "Paper, kraft and biodegradable-labelled food packaging in Kenya: kraft tubs, paper cups and plates, biodegradable boxes. Prices shown, M-Pesa, same-day Nairobi delivery.",
    h1: "Paper, kraft and biodegradable packaging",
    intro: [
      "Kraft paper tubs and bowls, paper cups and plates, khaki bags and biodegradable-labelled boxes for businesses moving away from plastic.",
      "Each product page says what the item is made of, so you can describe your packaging accurately to customers. Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    faqs: [
      {
        q: "What's the difference between recyclable, biodegradable and compostable?",
        a: "Recyclable means the material can be reprocessed where collection exists — plain paper and card are widely recovered in Kenya. Biodegradable only means it eventually breaks down, with no set timeframe. Compostable is stricter and usually needs industrial composting. Our blog post on eco-friendly packaging labels explains this in more detail.",
      },
    ],
    related: ["khaki-and-paper-bags", "takeaway-food-containers", "coffee-cups"],
  },
];

/**
 * Industry hubs — /industries/<slug>/, keyed by the backend industry slug (GET
 * /api/v1/public/industries). They link to the SHOP_PAGES that business actually buys from rather
 * than listing products themselves; the full filterable list stays at /products?industry=<slug>.
 */
export const INDUSTRY_PAGES = [
  {
    slug: "food-and-beverage",
    title: "Restaurant & Café Packaging Supplies in Nairobi | Moments",
    description:
      "Packaging for restaurants, cafés, cloud kitchens and caterers in Nairobi: takeaway containers, coffee cups, cutlery, foil, sachets. M-Pesa, same-day delivery.",
    h1: "Packaging for restaurants, cafés and caterers",
    intro: [
      "One supplier for the whole takeaway counter: food containers and clamshells, coffee and cold-drink cups with lids, cutlery, straws, foil and cling film, sauce sachets and serviettes.",
      "Order online with M-Pesa for same-day delivery within Nairobi (orders before the daily cutoff), countrywide in about three business days, or restock in person at our shop on Ukwala Road, Nairobi CBD. Branded cups and bags are available on request.",
    ],
    shop: [
      "takeaway-food-containers",
      "coffee-cups",
      "disposable-cups-and-lids",
      "disposable-cutlery",
      "aluminium-foil-and-cling-film",
      "sauce-sachets-and-condiments",
      "straws-and-stirrers",
      "pizza-boxes",
    ],
  },
  {
    slug: "baking",
    title: "Bakery Packaging Supplies in Nairobi — Cake Boxes & More | Moments",
    description:
      "Packaging for bakeries and home bakers in Nairobi: cake boxes, cupcake cases, dessert cups, pizza boxes, foil trays. Prices shown, M-Pesa, same-day delivery.",
    h1: "Packaging for bakeries and home bakers",
    intro: [
      "Cake boxes, bento cake boxes, cupcake cases, dessert cups, foil trays, pizza boxes and paper bags for bakeries, cake shops and home bakers.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or come and see the stock at our shop on Ukwala Road, Nairobi CBD.",
    ],
    shop: [
      "cake-boxes-and-dessert-packaging",
      "pizza-boxes",
      "aluminium-foil-and-cling-film",
      "khaki-and-paper-bags",
      "disposable-cups-and-lids",
    ],
  },
  {
    slug: "e-commerce-and-retail",
    title: "Packaging for Shops & Retailers in Nairobi | Moments Packaging",
    description:
      "Packaging for shops, boutiques and online sellers in Nairobi: khaki and paper bags, non-woven bags, ziplock bags, tapes. M-Pesa checkout, same-day delivery.",
    h1: "Packaging for shops and retailers",
    intro: [
      "Khaki and paper bags, non-woven and reusable bags, ziplock bags and packaging tape for supermarkets, boutiques, pharmacies, market traders and online sellers.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD. Bags printed with your logo are available on request.",
    ],
    shop: ["khaki-and-paper-bags", "reusable-shopping-bags", "ziplock-bags", "packaging-tapes"],
  },
  {
    slug: "agricultural-and-dairy",
    title: "Packaging for Farms, Honey & Dairy Producers in Kenya | Moments",
    description:
      "Packaging for farmers, honey and dairy producers in Kenya: punnets, honey jars and bottles, khaki bags. Prices shown, M-Pesa, countrywide delivery.",
    h1: "Packaging for farms, honey and dairy producers",
    intro: [
      "Fruit and vegetable punnets, honey jars, bottles and caps, and paper bags for farmers, beekeepers, dairies and fresh-produce sellers.",
      "Order online with M-Pesa — same-day delivery within Nairobi and delivery countrywide in about three business days — or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    shop: ["fruit-punnets", "honey-jars-and-bottles", "khaki-and-paper-bags"],
  },
  {
    slug: "beauty-and-personal-care",
    title: "Packaging for Beauty & Personal Care Brands in Kenya | Moments",
    description:
      "Packaging and supplies for beauty brands and salons in Kenya: jars, bottles, ziplock bags, gloves and paper bags. M-Pesa checkout, same-day Nairobi delivery.",
    h1: "Packaging for beauty and personal care",
    intro: [
      "Jars, bottles, ziplock bags, disposable gloves and paper bags for skincare makers, salons and personal-care shops.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD. Branded labels and bags are available on request.",
    ],
    shop: [
      "honey-jars-and-bottles",
      "ziplock-bags",
      "disposable-gloves-and-hygiene",
      "khaki-and-paper-bags",
    ],
  },
  {
    slug: "pharmaceutical",
    title: "Packaging for Pharmacies & Clinics in Kenya | Moments Packaging",
    description:
      "Packaging for pharmacies and clinics in Kenya: ziplock bags, paper bags, gloves and hygiene supplies. M-Pesa checkout, same-day Nairobi delivery.",
    h1: "Packaging for pharmacies and clinics",
    intro: [
      "Ziplock bags for dispensing, paper bags, disposable gloves and hygiene supplies for pharmacies, chemists and clinics.",
      "Order online with M-Pesa for same-day delivery within Nairobi, countrywide in about three business days, or buy at our shop on Ukwala Road, Nairobi CBD.",
    ],
    shop: ["ziplock-bags", "khaki-and-paper-bags", "disposable-gloves-and-hygiene"],
  },
];

export function shopPath(slug) {
  return `/shop/${slug}/`;
}

export function industryPath(slug) {
  return `/industries/${slug}/`;
}

export function findShopPage(slug) {
  return SHOP_PAGES.find((p) => p.slug === slug) ?? null;
}

export function findIndustryPage(slug) {
  return INDUSTRY_PAGES.find((p) => p.slug === slug) ?? null;
}

/** The single membership rule both the prerender and the browser page use. */
export function shopPageIncludes(page, product) {
  const name = String(product?.name ?? "");
  return page.include.test(name) && !(page.exclude && page.exclude.test(name));
}

/** Shop pages a product belongs to — used to link each product page back up to its hubs. */
export function shopPagesForProduct(product) {
  return SHOP_PAGES.filter((page) => shopPageIncludes(page, product));
}

/**
 * The questions every buyer-intent page answers, with that page's own live "from" price — phrased
 * the way people type them into a search box or ask an assistant. Shared by the prerender and the
 * browser page so the visible answers and the FAQPage schema never disagree. `fromPrice` is a
 * ready-made "KES 5 per piece" string computed from the live catalogue (null if nothing is priced).
 */
export function landingFaqs(page, fromPrice) {
  // "Takeaway food containers in Nairobi" -> "takeaway food containers": the questions add their
  // own place name.
  const base = page.h1.replace(/\s+in (Nairobi|Kenya)$/i, "");
  const noun = base.charAt(0).toLowerCase() + base.slice(1);
  return [
    ...(fromPrice
      ? [
          {
            q: `How much do ${noun} cost in Kenya?`,
            a: `At Moments Packaging, ${noun} start from ${fromPrice}. Every product on this page shows its current price and pack size, and it's the same price online and in our Nairobi shop.`,
          },
        ]
      : []),
    {
      q: `Where can I buy ${noun} in Nairobi?`,
      a: `Order on momentspackaging.com and pay with M-Pesa for same-day delivery within Nairobi (orders before the daily cutoff), or buy in person at our shop: ${BUSINESS.streetAddress}, ${BUSINESS.locality}, open ${BUSINESS.hoursText}.`,
    },
    {
      q: "Do you deliver outside Nairobi?",
      a: "Yes — countrywide, typically within about three business days depending on your location. The delivery fee is shown at checkout before you pay.",
    },
    {
      q: "Is there a minimum order?",
      a: "It depends on the product — many items can be bought individually or by the packet. The minimum is shown on each product page before you add it to the cart.",
    },
    ...page.faqs,
  ];
}
