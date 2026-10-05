// Plain JS (with uomWords.d.ts) because the SEO prerender runs it under Node, outside the bundler,
// and the storefront must name a unit exactly as the prerendered page does.

/** Riseller's raw unit codes -> the word a customer would use for one of them. */
const UNIT_WORDS = {
  PCS: "piece", PC: "piece", PIECE: "piece", PIECES: "piece",
  PKT: "packet", PKTS: "packet", PACKET: "packet", PACKETS: "packet",
  CTN: "carton", CTNS: "carton", CARTON: "carton", CARTONS: "carton",
  BALE: "bale", BALES: "bale",
  BAG: "bag", BAGS: "bag",
  ROLL: "roll", ROLLS: "roll",
  DOZEN: "dozen", DOZ: "dozen",
  KGS: "kg", KG: "kg",
  GRMS: "gram", GM: "gram", GMS: "gram", GRAM: "gram", GRAMS: "gram",
  LITRES: "litre", LITRE: "litre", LTR: "litre", LTRS: "litre",
  ML: "ml",
  MTRS: "metre", MTR: "metre", METRE: "metre", METRES: "metre",
};

/** Units that keep the same word in the plural: "3 kg", "500 ml", "2 dozen". */
const SAME_PLURAL = new Set(["kg", "ml", "dozen"]);

/** The singular word for a Riseller unit code, or null when the product has no unit recorded. */
export function unitWord(code) {
  const raw = String(code ?? "").trim();
  if (!raw) return null;
  return UNIT_WORDS[raw.toUpperCase()] ?? raw.toLowerCase();
}

/** "packet" -> "packets" (and "box" -> "boxes"); units like kg stay as they are. */
export function pluralUnit(word, count) {
  if (count === 1 || SAME_PLURAL.has(String(word).toLowerCase())) return word;
  return /(s|x|z|ch|sh)$/i.test(word) ? `${word}es` : `${word}s`;
}

/**
 * Descriptions generated from Riseller say "Sold per pkt." / "Sold per pcs."; show the unit as a
 * customer would say it ("Sold per packet.") without touching the stored text.
 */
export function readableSoldPer(text) {
  return String(text ?? "").replace(/\bSold per ([A-Za-z]+)\b/gi, (whole, code) => `Sold per ${unitWord(code) ?? code}`);
}

/** "25 packets", "1 packet", "3 kg". */
export function countUnits(count, word) {
  const n = Number(count) || 0;
  return `${n.toLocaleString("en-KE", { maximumFractionDigits: 2 })} ${pluralUnit(word, n)}`;
}
