// Kenya — all 47 counties, with official county codes.
// Used in checkout form county selector, order store, and admin views.

export interface KenyaCounty {
  code: number; // official county code 001–047
  name: string;
}

export const KENYA_COUNTIES: KenyaCounty[] = [
  { code: 1, name: "Mombasa" },
  { code: 2, name: "Kwale" },
  { code: 3, name: "Kilifi" },
  { code: 4, name: "Tana River" },
  { code: 5, name: "Lamu" },
  { code: 6, name: "Taita-Taveta" },
  { code: 7, name: "Garissa" },
  { code: 8, name: "Wajir" },
  { code: 9, name: "Mandera" },
  { code: 10, name: "Marsabit" },
  { code: 11, name: "Isiolo" },
  { code: 12, name: "Meru" },
  { code: 13, name: "Tharaka-Nithi" },
  { code: 14, name: "Embu" },
  { code: 15, name: "Kitui" },
  { code: 16, name: "Machakos" },
  { code: 17, name: "Makueni" },
  { code: 18, name: "Nyandarua" },
  { code: 19, name: "Nyeri" },
  { code: 20, name: "Kirinyaga" },
  { code: 21, name: "Murang'a" },
  { code: 22, name: "Kiambu" },
  { code: 23, name: "Turkana" },
  { code: 24, name: "West Pokot" },
  { code: 25, name: "Samburu" },
  { code: 26, name: "Trans Nzoia" },
  { code: 27, name: "Uasin Gishu" },
  { code: 28, name: "Elgeyo-Marakwet" },
  { code: 29, name: "Nandi" },
  { code: 30, name: "Baringo" },
  { code: 31, name: "Laikipia" },
  { code: 32, name: "Nakuru" },
  { code: 33, name: "Narok" },
  { code: 34, name: "Kajiado" },
  { code: 35, name: "Kericho" },
  { code: 36, name: "Bomet" },
  { code: 37, name: "Kakamega" },
  { code: 38, name: "Vihiga" },
  { code: 39, name: "Bungoma" },
  { code: 40, name: "Busia" },
  { code: 41, name: "Siaya" },
  { code: 42, name: "Kisumu" },
  { code: 43, name: "Homa Bay" },
  { code: 44, name: "Migori" },
  { code: 45, name: "Kisii" },
  { code: 46, name: "Nyamira" },
  { code: 47, name: "Nairobi" },
];

// Alphabetical for general dropdowns.
export const KENYA_COUNTIES_SORTED: KenyaCounty[] = [...KENYA_COUNTIES].sort(
  (a, b) => a.name.localeCompare(b.name),
);

// Nairobi first (most common), then rest alphabetically — best UX for this business.
export const KENYA_COUNTIES_NAIROBI_FIRST: KenyaCounty[] = [
  { code: 47, name: "Nairobi" },
  ...KENYA_COUNTIES.filter((c) => c.code !== 47).sort((a, b) =>
    a.name.localeCompare(b.name),
  ),
];

// Convenience: just the names in the Nairobi-first order.
export const KENYA_COUNTY_NAMES_NAIROBI_FIRST: string[] =
  KENYA_COUNTIES_NAIROBI_FIRST.map((c) => c.name);

// Nairobi pinned at top (most common pick) *and* left in its normal alphabetical slot below —
// picking either one selects the same county, this just saves the common case a scroll.
export const KENYA_COUNTY_NAMES_NAIROBI_PINNED_AND_ALPHABETICAL: string[] = [
  "Nairobi",
  ...KENYA_COUNTIES_SORTED.map((c) => c.name),
];
