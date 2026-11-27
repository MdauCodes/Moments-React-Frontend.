import { individualUnitLabel } from "@/lib/uomLabel";
import { countUnits } from "@/lib/uomWords";

/**
 * What is physically inside a unit, for customers: "100 pieces" in a packet, "20 packets · 2,000
 * pieces" in a carton or bale. Bulk buyers compare on pieces, and the unit name alone ("1 packet")
 * does not say how many cups that is (owner, 2026-11-27).
 *
 * Source of the pieces-per-unit number, in order:
 *  1. `piecesPerUnit` set by staff on the product (store API field, added 2026-11-27).
 *  2. Otherwise read from the product description, which Riseller-imported products word in a few
 *     fixed ways: "Pack size: 100PCS", "Pack size: 20PKTS*50PCS", "Pack of 50", "Carton of 300".
 *     Only those exact shapes are trusted; anything else shows no piece count rather than a guess.
 */

type PackProduct = {
  piecesPerUnit?: number | null;
  risellerUomName?: string | null;
  description?: string | null;
};

const PACKET_WORDS = new Set(["packet", "pack", "bundle", "roll", "sleeve", "tube"]);
const CONTAINER_WORDS = new Set(["carton", "bale", "case", "box", "sack", "bag"]);

function num(s: string): number {
  return Number(s.replace(/,/g, ""));
}

/** Single pieces in ONE of the product's base unit (e.g. 100 in a packet), or null when unknown
 *  or when the base unit already is a piece. */
export function piecesPerUnit(product: PackProduct): number | null {
  const set = Number(product.piecesPerUnit);
  if (Number.isFinite(set) && set > 0) return Math.round(set);

  const base = individualUnitLabel(product.risellerUomName);
  if (base === "piece") return null;
  const text = product.description ?? "";
  if (!text) return null;

  // "20PKTS*50PCS": packets in a carton × pieces in a packet.
  const nested = text.match(/(\d[\d,]*)\s*(?:PKTS?|PACKS?|PACKETS?)\s*[*x×]\s*(\d[\d,]*)\s*(?:PCS|PIECES?)\b/i);
  if (nested) {
    if (PACKET_WORDS.has(base)) return num(nested[2]) || null;
    if (CONTAINER_WORDS.has(base)) return num(nested[1]) * num(nested[2]) || null;
    return null;
  }

  // "Pack size: 1*320PCS" (no unit on the first number): A lots of B pieces in one base unit.
  const multiplied = text.match(/pack\s*size\s*:?\s*(\d[\d,]*)\s*[*x×]\s*(\d[\d,]*)\s*(?:PCS|PIECES?)\b/i);
  if (multiplied) return num(multiplied[1]) * num(multiplied[2]) || null;

  if (PACKET_WORDS.has(base)) {
    const size = text.match(/pack\s*size\s*:?\s*(\d[\d,]*)\s*(?:PCS|PIECES?)\b/i) ?? text.match(/\bpack(?:et)?\s+of\s+(\d[\d,]*)\b/i);
    if (size) return num(size[1]) || null;
  }
  if (CONTAINER_WORDS.has(base)) {
    const size = text.match(/\b(?:carton|bale|case|box|sack)\s+of\s+(\d[\d,]*)\b/i);
    if (size) return num(size[1]) || null;
  }
  return null;
}

/**
 * Contents of `baseQty` base units, e.g.
 *   baseQty 1, packet with 100 pcs  → "100 pieces"
 *   baseQty 20 (a carton of packets) → "20 packets · 2,000 pieces"
 *   baseQty 20, pieces unknown       → "20 packets"
 * Returns null when there is nothing worth saying (one base unit, pieces unknown).
 */
export function packContents(product: PackProduct, baseQty = 1): string | null {
  const ppu = piecesPerUnit(product);
  const base = individualUnitLabel(product.risellerUomName);
  const parts: string[] = [];
  if (baseQty > 1) parts.push(countUnits(baseQty, base));
  if (ppu) parts.push(countUnits(baseQty * ppu, "piece"));
  return parts.length ? parts.join(" · ") : null;
}

/** "100 pieces per packet", or null when unknown. */
export function piecesPerUnitLine(product: PackProduct): string | null {
  const ppu = piecesPerUnit(product);
  if (!ppu) return null;
  return `${countUnits(ppu, "piece")} per ${individualUnitLabel(product.risellerUomName)}`;
}
