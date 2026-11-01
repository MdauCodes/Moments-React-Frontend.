// Photos for the backend Segments (the shop's top-level categories), shared by the home page's
// category circles and the full home page's "Shop by category" grid (/discover).
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

// ── Category image grid — dedicated photo per backend Segment, keyed by exact
// segment name. Falls back to the old generic pool only for a segment the
// backend adds later that doesn't have a named photo yet. ──
const SEGMENT_IMAGES: Record<string, string> = {
  "food packaging": segFoodPackagingImg,
  "disposable tableware": segDisposableTablewareImg,
  cutlery: segCutleryImg,
  "drinks packaging": segDrinksPackagingImg,
  "kitchen and table accessories": segKitchenTableImg,
  "wooden accessories": segWoodenAccessoriesImg,
  "hygiene essentials": segHygieneImg,
  "bags and sacks": segBagsSacksImg,
  "general supplies and stationeries": segGeneralSuppliesImg,
  "custom branding": segCustomBrandingImg,
  cosmetics: segCosmeticsImg,
  agriculture: segAgricultureImg,
  dairy: segDairyImg,
  pharmacy: segPharmacyImg,
};

const SEGMENT_IMAGE_FALLBACK_POOL = [
  catPaperBagsImg,
  catBoxesCartonsImg,
  catCupsSleevesImg,
  catMailersPouchesImg,
  catLabelsStickersImg,
  catFoodContainersImg,
  catGiftEventImg,
  catBeautyPharmaImg,
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
  cutlery: "Wooden, clear plastic and CPLA spoons, forks and knives, some standing in kraft cups",
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
  cosmetics:
    "Amber and frosted glass dropper bottles, pump and spray bottles, cream jars and squeeze tubes",
  agriculture:
    "Moulded pulp egg trays, clear egg cartons, black nursery planting bags and seedling propagation trays",
  dairy:
    "Clear PET bottles in a range of sizes, including handled jerrycan-style bottles, all with white caps",
  pharmacy:
    "Clear tablet jars with white lids, kraft stand-up pouches and kraft dispensing envelopes holding capsules and tablets",
};

export function imageForSegment(name: string, fallbackIndex: number): string {
  const match = SEGMENT_IMAGES[name.trim().toLowerCase()];
  if (match) return match;
  return SEGMENT_IMAGE_FALLBACK_POOL[fallbackIndex % SEGMENT_IMAGE_FALLBACK_POOL.length];
}

/** Alt text for a segment tile's photo. A segment the backend adds later has no named photo and
 *  therefore falls back to a generic stock shot from the pool — there is nothing truthful to say
 *  about what that particular picture shows, and the tile's own caption already names the
 *  category, so the honest answer is the empty string: mark it decorative and let the caption be
 *  the link's accessible name, rather than inventing a description or repeating the caption. */
export function altForSegment(name: string): string {
  return SEGMENT_IMAGE_ALTS[name.trim().toLowerCase()] ?? "";
}
