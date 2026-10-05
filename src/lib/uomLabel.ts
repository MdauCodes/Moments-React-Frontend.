/**
 * Strip redundant quantity suffix from a UOM/collection name.
 * "Packet of 50" + qty 50 → "Packet"
 * "Carton of 2500" + qty 2500 → "Carton"
 * "Packet" + qty 50 → "Packet" (unchanged)
 * "Pack of 12" + qty 50 → "Pack of 12" (quantity mismatch, leave as-is)
 */
import { countUnits, pluralUnit, unitWord } from "@/lib/uomWords";

/**
 * Human label for a product's single-unit buy option, preferring Riseller's own UOM
 * (when the product is Riseller-linked) over the generic "piece" fallback. The code-to-word map
 * lives in uomWords.js so the prerendered SEO pages name units identically.
 */
export function individualUnitLabel(risellerUomName: string | null | undefined): string {
  return unitWord(risellerUomName) ?? "piece";
}

/**
 * "25 packets", "1 packet", "3 kg" — a count in the unit this product is actually sold in.
 * Every place that used to say "pieces", "pcs" or "units" regardless of the product goes through
 * this: for the half of the catalogue Riseller sells by the packet (or kg, roll, bale...), "pieces"
 * is simply wrong.
 */
export function unitCount(count: number | null | undefined, risellerUomName: string | null | undefined): string {
  return countUnits(count ?? 0, individualUnitLabel(risellerUomName));
}

/** The plural of the product's unit on its own: "packets", "kg", "pieces". */
export function unitPlural(risellerUomName: string | null | undefined): string {
  return pluralUnit(individualUnitLabel(risellerUomName), 2);
}

const BULK_CONTAINER_UNITS = new Set(["CTN", "CARTON", "CASE", "BALE", "BOX"]);

/**
 * Mirrors the backend's RisellerNameMatcher.isBulkContainerUnit exactly — must stay in sync.
 * Used by quickAdd.ts's isIndividualBuyable to skip the individual-buy option for these units:
 * since 2026-09-27 the backend derives a real pricing tier for the base unit itself (Carton,
 * Case, ...) for these, so the individual-buy option would otherwise offer "Add 1 Carton" a
 * second time, identical to that tier.
 */
export function isBulkContainerUomName(risellerUomName: string | null | undefined): boolean {
  if (!risellerUomName) return false;
  return BULK_CONTAINER_UNITS.has(risellerUomName.trim().toUpperCase());
}

export function cleanUomLabel(name: string | null | undefined, quantity: number | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";
  const qty = Number(quantity) || 0;
  if (!qty) return raw;
  // Match trailing " of <number>" where number == qty (allow commas/spaces)
  const m = raw.match(/^(.*?)[\s]+of[\s]+([\d,\s]+)$/i);
  if (!m) return raw;
  const trailingNum = Number(m[2].replace(/[,\s]/g, ""));
  if (trailingNum === qty) return m[1].trim();
  return raw;
}
