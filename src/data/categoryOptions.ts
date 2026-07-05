/**
 * Canonical legacy `Product.category` values, normalized server-side by
 * ProductCategoryNormalizationSeeder. Shared between the public storefront's
 * category filter and the admin Products list so both stay backed by the
 * same real data instead of drifting into two different lists.
 */
export const CATEGORY_OPTIONS = [
  { value: "Bags", label: "Bags" },
  { value: "Food & Condiments", label: "Food & Condiments" },
  { value: "Thermal Rolls", label: "Thermal Rolls" },
  { value: "Cups & Lids", label: "Cups & Lids" },
  { value: "Wrapping & Foil", label: "Wrapping & Foil" },
  { value: "Containers & Trays", label: "Containers & Trays" },
  { value: "Tableware & Hygiene", label: "Tableware & Hygiene" },
  { value: "Cutlery", label: "Cutlery" },
  { value: "Straws & Stirrers", label: "Straws & Stirrers" },
  { value: "Jars & Bottles", label: "Jars & Bottles" },
  { value: "Hygiene & PPE", label: "Hygiene & PPE" },
  { value: "Tapes", label: "Tapes" },
  { value: "General", label: "General" },
  { value: "Miscellaneous", label: "Miscellaneous" },
  { value: "Boards", label: "Boards" },
  { value: "Gifting & Retail", label: "Gifting & Retail" },
  { value: "Mailers & Shipping", label: "Mailers & Shipping" },
];
