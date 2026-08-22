import bagsImg from "@/assets/cat-bags.jpg";
import cupsImg from "@/assets/cat-cups.jpg";
import boxesImg from "@/assets/cat-boxes.jpg";
import labelsImg from "@/assets/cat-labels.jpg";
import giftingImg from "@/assets/cat-gifting.jpg";
import mailersImg from "@/assets/cat-mailers.jpg";
import foodTakeawaySetImg from "@/assets/prod-food-takeaway-set.jpg";
import foodCakeWindowBoxImg from "@/assets/prod-food-cake-window-box.jpg";
import agriSeedPouchImg from "@/assets/prod-agri-seed-pouch.jpg";
import agriProduceCrateSleeveImg from "@/assets/prod-agri-produce-crate-sleeve.jpg";
import textileGarmentMailerImg from "@/assets/prod-textile-garment-mailer.jpg";
import textileFabricSleeveImg from "@/assets/prod-textile-fabric-sleeve.jpg";
import ecommerceCourierBoxImg from "@/assets/prod-ecommerce-courier-box.jpg";
import ecommerceReturnMailerImg from "@/assets/prod-ecommerce-return-mailer.jpg";
import giftingHamperTrayImg from "@/assets/prod-gifting-hamper-tray.jpg";
import giftingFavourBoxImg from "@/assets/prod-gifting-favour-box.jpg";
import beautySkincareCartonImg from "@/assets/prod-beauty-skincare-carton.jpg";
import beautySoapWrapImg from "@/assets/prod-beauty-soap-wrap.jpg";
import pharmaTamperLabelsImg from "@/assets/prod-pharma-tamper-labels.jpg";
import pharmaSupplementCartonImg from "@/assets/prod-pharma-supplement-carton.jpg";
import industrialPartsCartonImg from "@/assets/prod-industrial-parts-carton.jpg";
import industrialHardwareSachetImg from "@/assets/prod-industrial-hardware-sachet.jpg";
import indFoodBevImg from "@/assets/industries/food-beverage.jpg";
import indAgricultureImg from "@/assets/industries/agriculture.jpg";
import indTextileImg from "@/assets/industries/textile-apparel.jpg";
import indEcommerceImg from "@/assets/industries/ecommerce-mailers.jpg";
import indGiftingImg from "@/assets/industries/gifting-events.jpg";
import indBeautyImg from "@/assets/industries/beauty-personal-care.jpg";
import indPharmaImg from "@/assets/industries/pharma-health.jpg";
import indIndustrialImg from "@/assets/industries/industrial-hardware.jpg";
import {
  UtensilsCrossed,
  Wheat,
  Shirt,
  Package,
  Gift,
  Sparkles,
  Zap,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const WHATSAPP_NUMBER = "254119556688";
export const WHATSAPP_NUMBER_ALT = "254119556699";
export const COMPANY_EMAIL = "info@momentspackaging.com";
export const COMPANY_PHONE = "0119-55-66-88";
export const COMPANY_PHONE_ALT = "0119-55-66-99";
export const COMPANY_PHONE_INTL = "+254 119 556 688";
export const COMPANY_PHONE_ALT_INTL = "+254 119 556 699";
export const COMPANY_ADDRESS = "Weithaga Building, along Ukwala Road, OTC, Nairobi CBD";
export const INSTAGRAM_URL = "https://instagram.com/moments_packaging";
export const INSTAGRAM_HANDLE = "@moments_packaging";
export const TIKTOK_URL = "https://tiktok.com/@momentspackaging";
export const TIKTOK_HANDLE = "moments Packaging";
export const FACEBOOK_URL = "https://facebook.com/momentspackaging";
export const FACEBOOK_HANDLE = "moments Packaging";

// Industries hidden from customer-facing browsing UI (frontend-only — the
// backend record and any tagged products are untouched). To bring an
// industry back, just remove its slug from this list.
export const HIDDEN_INDUSTRY_SLUGS: readonly string[] = ["electronics"];

export function filterVisibleIndustries<T extends { slug: string }>(list: T[]): T[] {
  return list.filter((i) => !HIDDEN_INDUSTRY_SLUGS.includes(i.slug));
}

export type ProductTag = "Trending" | "New" | "Discounted" | "Featured";

export interface Industry {
  id: string;
  name: string;
  slug: string;
  /** Lucide icon component rendered in chips/lists. */
  icon: LucideIcon;
  description: string;
  /** Short tagline used on the home strip + /industries hero card. */
  tagline?: string;
  /** Synonyms / colloquialisms to broaden search recall. */
  keywords?: string[];
  /** Editorial photo used on /industries cards and the home Industries strip. */
  image?: string;
}

/**
 * Canonical taxonomy of markets we serve.
 * Keep IDs stable — they're referenced by `Product.industryIds`.
 *
 * Backend mapping: `industries` table (id/name/slug/description) +
 * `industry_keywords` text[] for search recall. See backendSpec.md §3.3.
 */
const ALL_INDUSTRIES: Industry[] = [
  {
    id: "1",
    name: "Food & Beverage",
    slug: "food-and-beverage",
    icon: UtensilsCrossed,
    description: "Packaging solutions for restaurants, cafés, cloud kitchens, food manufacturers and beverage brands.",
    tagline: "From the first sip to the last bite.",
    keywords: ["restaurant", "cafe", "coffee", "takeaway", "delivery", "fnb", "kitchen", "bakery", "juice", "drinks"],
    image: indFoodBevImg,
  },
  {
    id: "2",
    name: "Agriculture",
    slug: "agriculture",
    icon: Wheat,
    description: "Durable packaging for grains, fresh produce, seeds, farm inputs and agro-processed goods.",
    tagline: "Field to shelf — packed to last.",
    keywords: ["farm", "agro", "produce", "seeds", "grain", "tea", "coffee beans", "horticulture", "export"],
    image: indAgricultureImg,
  },
  {
    id: "3",
    name: "Fashion & Apparel",
    slug: "fashion-and-apparel",
    icon: Shirt,
    description: "Stylish packaging for clothing brands, boutiques, tailors, shoes and fashion retail.",
    tagline: "Packaging your customers want to keep.",
    keywords: ["fashion", "clothing", "garments", "boutique", "tailor", "fabric", "apparel", "designer"],
    image: indTextileImg,
  },
  {
    id: "4",
    name: "Retail & E-Commerce",
    slug: "retail-and-ecommerce",
    icon: Package,
    description: "Custom packaging for retail shops, online sellers, D2C brands and courier-ready businesses.",
    tagline: "Built for the unboxing moment.",
    keywords: ["online store", "d2c", "shipping", "courier", "instagram shop", "tiktok shop", "retail", "shop"],
    image: indEcommerceImg,
  },
  {
    id: "5",
    name: "Hospitality",
    slug: "hospitality",
    icon: Gift,
    description: "Branded packaging for hotels, restaurants, events, banquets and catering businesses.",
    tagline: "Make every occasion memorable.",
    keywords: ["hotel", "wedding", "events", "catering", "conference", "hospitality", "banquet", "venue", "restaurant"],
    image: indGiftingImg,
  },
  {
    id: "6",
    name: "Health & Beauty",
    slug: "health-and-beauty",
    icon: Sparkles,
    description: "Premium packaging for cosmetics, skincare, pharmaceuticals, clinics and personal care products.",
    tagline: "Shelf-ready packaging that sells itself.",
    keywords: ["skincare", "cosmetics", "haircare", "candles", "soap", "spa", "wellness", "beauty", "pharmacy", "medical"],
    image: indBeautyImg,
  },
  {
    id: "7",
    name: "Electronics",
    slug: "electronics",
    icon: Zap,
    description: "Protective and branded packaging for electronic devices, gadgets and accessories.",
    tagline: "Safe, shock-proof and retail-ready.",
    keywords: ["electronics", "gadgets", "tech", "hardware", "phone accessories", "cables", "devices"],
    image: indPharmaImg,
  },
  {
    id: "8",
    name: "Manufacturing",
    slug: "manufacturing",
    icon: Wrench,
    description: "Industrial packaging solutions for manufactured goods, components and B2B wholesalers.",
    tagline: "Heavy-duty packs that survive the warehouse.",
    keywords: ["industrial", "hardware", "manufacturing", "tools", "spares", "b2b", "wholesale", "factory"],
    image: indIndustrialImg,
  },
];

export const industries: Industry[] = filterVisibleIndustries(ALL_INDUSTRIES);

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  moq: number;
  sizes: string[];
  tags: ProductTag[];
  image: string;
  images: string[];
  isDiscount: boolean;
  discountPercent?: number;
  isNewArrival: boolean;
  isFastMoving: boolean;
  industryIds: string[];
  totalClicks: number;
  monthlyClicks: number;
  totalEnquiries: number;
  monthlyEnquiries: number;
  /**
   * Optional searchable enrichments (admin-editable, all backend-bound).
   * Kept optional so existing fixtures keep working.
   */
  material?: string; // e.g. "Kraft 120gsm", "PE-lined paper"
  finish?: string;   // e.g. "Matte", "Gloss", "Soft-touch"
  keywords?: string[]; // free-form synonyms / sheng / common misspellings
  /** Backend-only enrichments (Phase C). UI must handle absence gracefully. */
  basePrice?: number;
  compareAtPrice?: number;
  /** Strike-through original price — only present when product is on sale. */
  originalBasePrice?: number;
  sku?: string;
  stock?: number;
  lowStockThreshold?: number;
  trackInventory?: boolean;
  stockStatus?: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "MADE_TO_ORDER";
  variants?: Array<{ id?: string; label: string; sku?: string; price?: number; stock?: number }>;
  materials?: string[];
  primaryImageUrl?: string;
  imageUrls?: string[];
  industries?: Array<{ id?: string | number; displayId?: string | number; name?: string; slug?: string }>;
  /** Real Segment/Category/Subcategory classification — absent until the product is classified. */
  subcategoryId?: string | null;
  subcategoryName?: string | null;
  categoryName?: string | null;
  segmentName?: string | null;
  /** Backend collection-based pricing tiers. Hydrated by API mapper. */
  pricingTiers?: ProductPricingTierLike[];
  /** Whether the product can be purchased as individual units (default true if undefined). */
  individualSalesEnabled?: boolean;
};

/** Strict pricing tier shape returned by the backend (and used by all UI). */
export interface PricingTier {
  id: string;
  collectionName: string;
  quantity: number;
  pricePerUnit: number;
  collectionPrice: number;
  sortOrder: number;
  /** UOM linkage (new) */
  uomId?: string;
  uomCode?: string;
  uomName?: string;
  uomDescription?: string;
  enabled?: boolean;
}

/**
 * Loose tier shape stored on Product.pricingTiers — covers both the strict
 * backend `PricingTier` and the legacy quantity-bracket mock shape
 * (`minQty`/`maxQty`/`pricePerUnit`). UI code should normalize via the API
 * mapper before consuming.
 */
export type ProductPricingTierLike = {
  id?: string;
  collectionName?: string;
  quantity?: number;
  pricePerUnit: number;
  collectionPrice?: number;
  /** Strike-through compare-at prices — only present when on sale. */
  originalPricePerUnit?: number;
  originalCollectionPrice?: number;
  sortOrder?: number;
  /** UOM linkage (new) */
  uomId?: string;
  uomCode?: string;
  uomName?: string;
  uomDescription?: string;
  enabled?: boolean;
  /** Legacy mock-data fields — never sent to backend. */
  minQty?: number;
  maxQty?: number;
};

export const categories = [
  { slug: "bags", name: "Paper Bags", image: bagsImg, blurb: "Twisted-handle, flat-handle & SOS kraft bags." },
  { slug: "cups", name: "Cups & Lids", image: cupsImg, blurb: "Single & double-wall hot cups, cold cups, lids." },
  { slug: "boxes", name: "Food Boxes", image: boxesImg, blurb: "Burger, salad, noodle, hexagonal & meal boxes." },
  { slug: "mailers", name: "Mailers & Shipping", image: mailersImg, blurb: "E-commerce kraft mailers and shipping cartons." },
  { slug: "labels", name: "Labels & Stickers", image: labelsImg, blurb: "Branded product labels & seals." },
  { slug: "gifting", name: "Gifting & Retail", image: giftingImg, blurb: "Rigid boxes, tissue, ribbons & gift sets." },
];

export const products: Product[] = [
  {
    id: "p-food-1",
    slug: "restaurant-takeaway-meal-set",
    name: "Restaurant Takeaway Meal Set",
    category: "boxes",
    description: "Coordinated kraft meal box, cup carrier and napkin band for restaurants, cafés and cloud kitchens handling delivery orders.",
    moq: 500,
    sizes: ["Small combo", "Regular combo", "Family combo"],
    tags: ["Trending", "Featured"],
    image: foodTakeawaySetImg,
    images: [foodTakeawaySetImg],
    isDiscount: false,
    isNewArrival: true,
    isFastMoving: true,
    industryIds: ["1"],
    material: "Food-grade kraft board + PE liner",
    finish: "Natural matte",
    keywords: ["takeaway", "restaurant packaging", "delivery meal box", "cloud kitchen", "food combo"],
    totalClicks: 1240,
    monthlyClicks: 312,
    totalEnquiries: 86,
    monthlyEnquiries: 19,
    basePrice: 38,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 44 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 38 },
      { minQty: 2000, pricePerUnit: 34 },
    ],
    stock: 4200,
    lowStockThreshold: 800,
    trackInventory: true,
    variants: [
      { id: "p-food-1-smc", label: "Small combo", sku: "SMC", price: 32, stock: 1800 },
      { id: "p-food-1-rgc", label: "Regular combo", sku: "RGC", price: 38, stock: 1500 },
      { id: "p-food-1-fmc", label: "Family combo", sku: "FMC", price: 46, stock: 900 },
    ],
  },
  {
    id: "p-food-2",
    slug: "bakery-window-cake-box",
    name: "Bakery Window Cake Box",
    category: "boxes",
    description: "Windowed pastry and cake cartons that keep baked goods visible, protected and ready for café counters or delivery riders.",
    moq: 500,
    sizes: ["Cupcake 2-pack", "Slice box", "Half-kilo cake"],
    tags: ["New"],
    image: foodCakeWindowBoxImg,
    images: [foodCakeWindowBoxImg],
    isDiscount: false,
    isNewArrival: true,
    isFastMoving: false,
    industryIds: ["1"],
    material: "SBS board + PET window",
    finish: "Matte with clear window",
    keywords: ["bakery", "cake box", "pastry box", "cookie box", "window carton"],
    totalClicks: 980,
    monthlyClicks: 244,
    totalEnquiries: 71,
    monthlyEnquiries: 16,
    basePrice: 28,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 32 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 28 },
      { minQty: 2000, pricePerUnit: 25 },
    ],
    stock: 0,
    lowStockThreshold: 500,
    trackInventory: true,
    variants: [
      { id: "p-food-2-cc2", label: "Cupcake 2-pack", sku: "CC2", price: 22, stock: 0 },
      { id: "p-food-2-slb", label: "Slice box", sku: "SLB", price: 26, stock: 0 },
      { id: "p-food-2-hkc", label: "Half-kilo cake", sku: "HKC", price: 38, stock: 0 },
    ],
  },
  {
    id: "p-agri-1",
    slug: "resealable-seed-pouch",
    name: "Resealable Seed Pouch",
    category: "labels",
    description: "Stand-up zipper pouch for seeds, grains and agro inputs with printable panels for batch details and planting instructions.",
    moq: 1000,
    sizes: ["100g", "250g", "500g", "1kg"],
    tags: ["Featured"],
    image: agriSeedPouchImg,
    images: [agriSeedPouchImg],
    isDiscount: false,
    isNewArrival: false,
    isFastMoving: true,
    industryIds: ["2"],
    material: "Kraft laminate + food-safe inner liner",
    finish: "Natural matte",
    keywords: ["seed pouch", "grain pouch", "agro packaging", "farm inputs", "zip pouch"],
    totalClicks: 734,
    monthlyClicks: 178,
    totalEnquiries: 49,
    monthlyEnquiries: 12,
    basePrice: 14,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 16 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 14 },
      { minQty: 2000, pricePerUnit: 13 },
    ],
    stock: 9800,
    lowStockThreshold: 1500,
    trackInventory: true,
  },
  {
    id: "p-agri-2",
    slug: "fresh-produce-crate-sleeve",
    name: "Fresh Produce Crate Sleeve",
    category: "boxes",
    description: "Corrugated crate sleeves and inserts for vegetables, fruits and export produce moving from farm gate to retail shelf.",
    moq: 500,
    sizes: ["5kg crate", "10kg crate", "Export carton"],
    tags: ["Trending"],
    image: agriProduceCrateSleeveImg,
    images: [agriProduceCrateSleeveImg],
    isDiscount: false,
    isNewArrival: false,
    isFastMoving: false,
    industryIds: ["2"],
    material: "E-flute corrugated board",
    finish: "Water-based print",
    keywords: ["produce box", "farm crate", "horticulture", "vegetable packaging", "export carton"],
    totalClicks: 689,
    monthlyClicks: 162,
    totalEnquiries: 47,
    monthlyEnquiries: 10,
    basePrice: 95,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 109 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 95 },
      { minQty: 2000, pricePerUnit: 86 },
    ],
    stock: 320,
    lowStockThreshold: 400,
    trackInventory: true,
  },
  {
    id: "p-textile-1",
    slug: "boutique-garment-mailer",
    name: "Boutique Garment Mailer",
    category: "mailers",
    description: "Recyclable garment mailer for fashion brands shipping shirts, dresses and accessories with a polished unboxing feel.",
    moq: 250,
    sizes: ["A5", "A4", "A3"],
    tags: ["Trending"],
    image: textileGarmentMailerImg,
    images: [textileGarmentMailerImg],
    isDiscount: true,
    discountPercent: 10,
    isNewArrival: false,
    isFastMoving: true,
    industryIds: ["3"],
    material: "Kraft 250gsm",
    finish: "Natural matte",
    keywords: ["fashion mailer", "garment bag", "clothing packaging", "boutique shipping", "apparel"],
    totalClicks: 845,
    monthlyClicks: 201,
    totalEnquiries: 58,
    monthlyEnquiries: 14,
    basePrice: 42,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 48 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 42 },
      { minQty: 2000, pricePerUnit: 38 },
    ],
    stock: 6700,
    lowStockThreshold: 1000,
    trackInventory: true,
    variants: [
      { id: "p-textile-1-gma5", label: "A5", sku: "GMA5", price: 38, stock: 2800 },
      { id: "p-textile-1-gma4", label: "A4", sku: "GMA4", price: 42, stock: 2400 },
      { id: "p-textile-1-gma3", label: "A3", sku: "GMA3", price: 54, stock: 1500 },
    ],
  },
  {
    id: "p-textile-2",
    slug: "fabric-belly-band-sleeve",
    name: "Fabric Belly Band Sleeve",
    category: "labels",
    description: "Printed paper bands and sleeves for folded fabric, uniforms and apparel sets sold in boutiques or exported in bulk.",
    moq: 1000,
    sizes: ["40mm band", "60mm band", "Custom sleeve"],
    tags: ["New"],
    image: textileFabricSleeveImg,
    images: [textileFabricSleeveImg],
    isDiscount: false,
    isNewArrival: true,
    isFastMoving: false,
    industryIds: ["3"],
    material: "Kraft paper / art paper",
    finish: "Matte or soft-touch",
    keywords: ["fabric sleeve", "belly band", "clothing label", "uniform packaging", "textile wrap"],
    totalClicks: 612,
    monthlyClicks: 138,
    totalEnquiries: 42,
    monthlyEnquiries: 9,
    basePrice: 9,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 10 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 9 },
      { minQty: 2000, pricePerUnit: 8 },
    ],
    stock: 12500,
    lowStockThreshold: 2000,
    trackInventory: true,
  },
  {
    id: "p-ecom-1",
    slug: "courier-ready-shipping-box",
    name: "Courier-Ready Shipping Box",
    category: "mailers",
    description: "Sturdy corrugated shipping box with tear-strip opening and clean label zones for online sellers and D2C brands.",
    moq: 250,
    sizes: ["Small parcel", "Medium parcel", "Large parcel"],
    tags: ["Featured"],
    image: ecommerceCourierBoxImg,
    images: [ecommerceCourierBoxImg],
    isDiscount: false,
    isNewArrival: false,
    isFastMoving: true,
    industryIds: ["4"],
    material: "B-flute corrugated kraft",
    finish: "Natural / single-colour print",
    keywords: ["shipping box", "courier box", "ecommerce packaging", "parcel box", "online shop"],
    totalClicks: 1180,
    monthlyClicks: 286,
    totalEnquiries: 77,
    monthlyEnquiries: 18,
    basePrice: 78,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 90 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 78 },
      { minQty: 2000, pricePerUnit: 70 },
    ],
    stock: 5400,
    lowStockThreshold: 1200,
    trackInventory: true,
    variants: [
      { id: "p-ecom-1-shp-s", label: "Small parcel", sku: "SHP-S", price: 68, stock: 2200 },
      { id: "p-ecom-1-shp-m", label: "Medium parcel", sku: "SHP-M", price: 78, stock: 2000 },
      { id: "p-ecom-1-shp-l", label: "Large parcel", sku: "SHP-L", price: 96, stock: 1200 },
    ],
  },
  {
    id: "p-ecom-2",
    slug: "double-strip-return-mailer",
    name: "Double-Strip Return Mailer",
    category: "mailers",
    description: "Kraft mailer with dual adhesive strips so customers can reseal returns without extra tape or packaging waste.",
    moq: 500,
    sizes: ["A5", "A4", "A3", "XL"],
    tags: ["Discounted"],
    image: ecommerceReturnMailerImg,
    images: [ecommerceReturnMailerImg],
    isDiscount: true,
    discountPercent: 15,
    isNewArrival: false,
    isFastMoving: false,
    industryIds: ["4"],
    material: "Kraft 200gsm",
    finish: "Natural matte",
    keywords: ["return mailer", "reusable mailer", "courier envelope", "instagram shop", "d2c"],
    totalClicks: 734,
    monthlyClicks: 178,
    totalEnquiries: 49,
    monthlyEnquiries: 12,
    basePrice: 36,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 41 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 36 },
      { minQty: 2000, pricePerUnit: 32 },
    ],
    stock: 180,
    lowStockThreshold: 500,
    trackInventory: true,
  },
  {
    id: "p-gift-1",
    slug: "corporate-hamper-tray",
    name: "Corporate Hamper Tray",
    category: "gifting",
    description: "Rigid hamper tray with dividers and sleeve options for corporate gifting, festive packs and premium event giveaways.",
    moq: 100,
    sizes: ["Small", "Medium", "Executive"],
    tags: ["Featured"],
    image: giftingHamperTrayImg,
    images: [giftingHamperTrayImg],
    isDiscount: false,
    isNewArrival: false,
    isFastMoving: true,
    industryIds: ["5"],
    material: "Greyboard 1200gsm + art paper wrap",
    finish: "Soft-touch",
    keywords: ["hamper box", "corporate gift", "gift tray", "event swag", "premium gifting"],
    totalClicks: 567,
    monthlyClicks: 134,
    totalEnquiries: 39,
    monthlyEnquiries: 11,
    basePrice: 320,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 368 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 320 },
      { minQty: 2000, pricePerUnit: 288 },
    ],
    stock: 480,
    lowStockThreshold: 100,
    trackInventory: true,
  },
  {
    id: "p-gift-2",
    slug: "event-favour-box",
    name: "Event Favour Box",
    category: "gifting",
    description: "Small ribbon-ready favour boxes for weddings, birthdays, launches and branded table gifts.",
    moq: 300,
    sizes: ["Mini cube", "Tall favour", "Custom die-cut"],
    tags: ["New"],
    image: giftingFavourBoxImg,
    images: [giftingFavourBoxImg],
    isDiscount: false,
    isNewArrival: true,
    isFastMoving: false,
    industryIds: ["5"],
    material: "Ivory board / kraft board",
    finish: "Matte with ribbon closure",
    keywords: ["wedding favour", "event box", "birthday gift", "table gift", "swag box"],
    totalClicks: 423,
    monthlyClicks: 96,
    totalEnquiries: 28,
    monthlyEnquiries: 6,
    basePrice: 65,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 75 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 65 },
      { minQty: 2000, pricePerUnit: 59 },
    ],
    stock: 2100,
    lowStockThreshold: 400,
    trackInventory: true,
  },
  {
    id: "p-beauty-1",
    slug: "skincare-carton-and-label-set",
    name: "Skincare Carton & Label Set",
    category: "labels",
    description: "Premium cartons and matching labels for serums, creams and haircare products that need a clean retail shelf presence.",
    moq: 1000,
    sizes: ["30ml serum", "50ml jar", "100ml bottle"],
    tags: ["Featured", "New"],
    image: beautySkincareCartonImg,
    images: [beautySkincareCartonImg],
    isDiscount: false,
    isNewArrival: true,
    isFastMoving: true,
    industryIds: ["6"],
    material: "SBS board + adhesive label stock",
    finish: "Matte / foil-ready",
    keywords: ["skincare packaging", "cosmetic carton", "serum label", "haircare", "beauty brand"],
    totalClicks: 980,
    monthlyClicks: 244,
    totalEnquiries: 71,
    monthlyEnquiries: 16,
    basePrice: 58,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 67 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 58 },
      { minQty: 2000, pricePerUnit: 52 },
    ],
    stock: 7200,
    lowStockThreshold: 1500,
    trackInventory: true,
  },
  {
    id: "p-beauty-2",
    slug: "soap-candle-wrap-kit",
    name: "Soap & Candle Wrap Kit",
    category: "labels",
    description: "Paper wraps, seals and small boxes for handmade soap, candles and wellness products sold online or in boutiques.",
    moq: 1000,
    sizes: ["Soap wrap", "Candle label", "Mini carton"],
    tags: ["Trending"],
    image: beautySoapWrapImg,
    images: [beautySoapWrapImg],
    isDiscount: false,
    isNewArrival: false,
    isFastMoving: false,
    industryIds: ["6"],
    material: "Kraft paper + adhesive paper labels",
    finish: "Natural / gloss label option",
    keywords: ["soap wrap", "candle label", "wellness packaging", "spa", "natural beauty"],
    totalClicks: 689,
    monthlyClicks: 162,
    totalEnquiries: 47,
    monthlyEnquiries: 10,
    basePrice: 12,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 14 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 12 },
      { minQty: 2000, pricePerUnit: 11 },
    ],
    stock: 9400,
    lowStockThreshold: 2000,
    trackInventory: true,
  },
  {
    id: "p-pharma-1",
    slug: "tamper-evident-pharmacy-labels",
    name: "Tamper-Evident Pharmacy Labels",
    category: "labels",
    description: "Security seals, bottle labels and barcode stickers for pharmacies, clinics and health product distributors.",
    moq: 1000,
    sizes: ["20mm seal", "40mm bottle label", "Custom die-cut"],
    tags: ["Featured"],
    image: pharmaTamperLabelsImg,
    images: [pharmaTamperLabelsImg],
    isDiscount: false,
    isNewArrival: false,
    isFastMoving: true,
    industryIds: ["7"],
    material: "Tamper-evident vinyl / paper label stock",
    finish: "Matte / barcode-ready",
    keywords: ["pharmacy label", "security seal", "medicine label", "barcode sticker", "clinic"],
    totalClicks: 612,
    monthlyClicks: 138,
    totalEnquiries: 42,
    monthlyEnquiries: 9,
    basePrice: 4,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 5 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 4 },
      { minQty: 2000, pricePerUnit: 4 },
    ],
    stock: 18000,
    lowStockThreshold: 3000,
    trackInventory: true,
  },
  {
    id: "p-pharma-2",
    slug: "supplement-folding-carton",
    name: "Supplement Folding Carton",
    category: "boxes",
    description: "Clean folding cartons and blister-card sleeves for vitamins, supplements and clinic retail products.",
    moq: 500,
    sizes: ["30-count", "60-count", "Blister sleeve"],
    tags: ["New"],
    image: pharmaSupplementCartonImg,
    images: [pharmaSupplementCartonImg],
    isDiscount: false,
    isNewArrival: true,
    isFastMoving: false,
    industryIds: ["7"],
    material: "SBS board 350gsm",
    finish: "Clinical matte",
    keywords: ["supplement box", "vitamin carton", "blister sleeve", "health packaging", "medical supplies"],
    totalClicks: 423,
    monthlyClicks: 96,
    totalEnquiries: 28,
    monthlyEnquiries: 6,
    basePrice: 22,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 25 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 22 },
      { minQty: 2000, pricePerUnit: 20 },
    ],
    stock: 3600,
    lowStockThreshold: 700,
    trackInventory: true,
  },
  {
    id: "p-industrial-1",
    slug: "reinforced-parts-carton",
    name: "Reinforced Parts Carton",
    category: "boxes",
    description: "Heavy-duty corrugated cartons for spare parts, tools and warehouse stock that needs strong stacking protection.",
    moq: 250,
    sizes: ["Small parts", "Medium parts", "Bulk carton"],
    tags: ["Trending"],
    image: industrialPartsCartonImg,
    images: [industrialPartsCartonImg],
    isDiscount: false,
    isNewArrival: false,
    isFastMoving: true,
    industryIds: ["8"],
    material: "Double-wall corrugated board",
    finish: "Natural / barcode label area",
    keywords: ["parts carton", "hardware packaging", "warehouse box", "spare parts", "industrial carton"],
    totalClicks: 845,
    monthlyClicks: 201,
    totalEnquiries: 58,
    monthlyEnquiries: 14,
    basePrice: 145,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 167 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 145 },
      { minQty: 2000, pricePerUnit: 131 },
    ],
    stock: 1100,
    lowStockThreshold: 250,
    trackInventory: true,
  },
  {
    id: "p-industrial-2",
    slug: "hardware-sachet-header-card",
    name: "Hardware Sachet Header Card",
    category: "labels",
    description: "Header cards, sachets and labels for screws, fasteners, fittings and small hardware sold on pegboards or counters.",
    moq: 1000,
    sizes: ["Mini sachet", "Pegboard card", "Counter pack"],
    tags: ["Discounted"],
    image: industrialHardwareSachetImg,
    images: [industrialHardwareSachetImg],
    isDiscount: true,
    discountPercent: 12,
    isNewArrival: false,
    isFastMoving: false,
    industryIds: ["8"],
    material: "Kraft card + clear sachet film",
    finish: "Matte print",
    keywords: ["fastener pack", "screws packaging", "header card", "hardware label", "tools"],
    totalClicks: 567,
    monthlyClicks: 134,
    totalEnquiries: 39,
    monthlyEnquiries: 11,
    basePrice: 6,
    pricingTiers: [
      { minQty: 100, pricePerUnit: 7 },
      { minQty: 500, maxQty: 1999, pricePerUnit: 6 },
      { minQty: 2000, pricePerUnit: 5 },
    ],
    stock: 0,
    lowStockThreshold: 1500,
    trackInventory: true,
  },
];

export function whatsappLink(message: string) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/**
 * Picks between the two business WhatsApp lines shown in the footer, fresh
 * on every call — used at the highest-traffic entry points (the floating
 * WhatsApp button and the Contact page) so enquiries don't all pile onto
 * one line. Not used site-wide: other WhatsApp links intentionally stay on
 * the single primary number.
 */
export function randomWhatsAppNumber(): string {
  return Math.random() < 0.5 ? WHATSAPP_NUMBER : WHATSAPP_NUMBER_ALT;
}

export function randomWhatsAppLink(message: string): string {
  return `https://wa.me/${randomWhatsAppNumber()}?text=${encodeURIComponent(message)}`;
}

export function productOrderMessage(p: Product, size?: string, qty?: number) {
  return `Hi Moments Packaging, I'd like to order:\n\n• Product: ${p.name}\n• Size: ${size ?? p.sizes[0]}\n• Quantity: ${qty ?? p.moq}\n\nPlease send me a quote.`;
}
