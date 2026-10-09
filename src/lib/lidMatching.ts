// Lids are separate catalogue products, and "no lid" only exists in a container's name (for
// example "Tech 5x7 500ml Clear Punnets No Lid"). There is no stored link between the two, so the
// match is inferred from the names: same shape/volume/diameter first, then colour and brand.

export interface LidProductLike {
  id: string;
  name: string;
  stockStatus?: string;
}

const COLOURS = ["clear", "black", "white", "kraft", "brown", "blue", "red", "green"];

export function isNoLidName(name: string): boolean {
  return /\b(no|without|w\/o)\s*lids?\b/i.test(name);
}

/** A product that is only a lid. Containers sold WITH a lid ("... + Lid", "with lid") are not. */
export function isLidOnlyName(name: string): boolean {
  if (!/\blids?\b/i.test(name)) return false;
  if (isNoLidName(name)) return false;
  if (/(with|\+|&|and)\s*(clr\s+|clear\s+|paper\s+)?lids?\b/i.test(name)) return false;
  return true;
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}

function shapes(name: string): Set<string> {
  const out = new Set<string>();
  for (const m of normalise(name).matchAll(/\b(\d+)\s*x\s*(\d+)(?:\s*x\s*\d+)?\b/g)) {
    out.add(`${m[1]}x${m[2]}`);
  }
  return out;
}

/** Volumes and diameters such as 500ml, 12oz, 94mm — expands "120/250ml" into both values. */
function dimensions(name: string): Set<string> {
  const out = new Set<string>();
  const text = normalise(name);
  for (const m of text.matchAll(/\b(\d+(?:\s*\/\s*\d+)*)\s*(ml|oz|mm|cc|l)\b/g)) {
    const unit = m[2];
    for (const n of m[1].split("/")) out.add(`${n.trim()}${unit}`);
  }
  return out;
}

function colours(name: string): Set<string> {
  const text = normalise(name).replace(/\btransparent\b/g, "clear").replace(/\bclr\b/g, "clear");
  return new Set(COLOURS.filter((c) => new RegExp(`\\b${c}\\b`).test(text)));
}

function brand(name: string): string {
  return normalise(name).split(" ")[0] ?? "";
}

function sharesAny<T>(a: Set<T>, b: Set<T>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

/** Score how well a lid fits a no-lid container. 0 means "do not suggest". */
export function lidFitScore(containerName: string, lidName: string): number {
  const cShapes = shapes(containerName);
  const lShapes = shapes(lidName);
  const cDims = dimensions(containerName);
  const lDims = dimensions(lidName);

  let score = 0;
  let fit = false;

  // A rectangular container (5x7) only takes a lid made for that shape; a lid that names no shape
  // (a round "500ML/750ML" lid) or a different one will not sit on it, whatever the volume says.
  if (cShapes.size > 0 || lShapes.size > 0) {
    if (!sharesAny(cShapes, lShapes)) return 0;
    score += 6;
    fit = true;
  }
  if (cDims.size > 0 && lDims.size > 0) {
    if (sharesAny(cDims, lDims)) {
      score += 4;
      fit = true;
    } else if (!fit) {
      return 0;
    } else {
      score -= 2;
    }
  }
  if (!fit) return 0;

  const cCol = colours(containerName);
  const lCol = colours(lidName);
  if (cCol.size > 0 && lCol.size > 0) score += sharesAny(cCol, lCol) ? 2 : -1;
  if (brand(containerName) === brand(lidName)) score += 2;
  return score;
}

const MIN_SCORE = 6;

export function findMatchingLids<T extends LidProductLike>(
  containerName: string,
  candidates: T[],
  max = 3,
): T[] {
  if (!isNoLidName(containerName)) return [];
  return candidates
    .filter((p) => isLidOnlyName(p.name))
    .filter((p) => p.stockStatus !== "OUT_OF_STOCK" && p.stockStatus !== "MADE_TO_ORDER")
    .map((p) => ({ p, score: lidFitScore(containerName, p.name) }))
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.p);
}

/** The reverse lookup: which no-lid containers does this lid fit? */
export function findMatchingContainers<T extends LidProductLike>(
  lidName: string,
  candidates: T[],
  max = 3,
): T[] {
  if (!isLidOnlyName(lidName)) return [];
  return candidates
    .filter((p) => isNoLidName(p.name))
    .filter((p) => p.stockStatus !== "OUT_OF_STOCK" && p.stockStatus !== "MADE_TO_ORDER")
    .map((p) => ({ p, score: lidFitScore(p.name, lidName) }))
    .filter((x) => x.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.p);
}
