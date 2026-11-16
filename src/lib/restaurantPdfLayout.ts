// Pure parts of the restaurant catalogue PDF (handover doc 15 §15, §22): text clean-up for
// jsPDF's fonts, the product pages' flow, file names. No "@/" imports, so `npm test`
// loads it directly. The drawing itself is in restaurantPdf.ts (browser only).

// A4 portrait, millimetres.
export const PAGE_W = 210;
export const PAGE_H = 297;
export const MARGIN = 14;
export const GAP = 5;
export const COLS = 2;
export const CARD_W = (PAGE_W - MARGIN * 2 - GAP) / COLS;
export const CARD_H = 46;
export const BODY_TOP = MARGIN + 4;
export const FOOTER_H = 14;
export const SECTION_HEAD_H = 22;
export const BODY_BOTTOM = PAGE_H - MARGIN - FOOTER_H + 2;

const SINGLE_QUOTES = new RegExp("[‘’]", "g");
const DOUBLE_QUOTES = new RegExp("[“”]", "g");
const NOT_WIN1252 = new RegExp("[^\x20-\x7e -ÿ–—•…€]", "g");

/** jsPDF's built-in fonts write Windows-1252 letters only; anything else would print as gibberish. */
export function pdfText(text: string | null | undefined): string {
  return (text ?? "")
    .normalize("NFKC")
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(NOT_WIN1252, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "KES 1,190" or "KES 47,350.50" (cents only when there are some). */
export function pdfKes(amount: number): string {
  const whole = Math.round(amount * 100) % 100 === 0;
  return `KES ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export type PlacedItem =
  | { kind: "head"; section: number; y: number }
  | { kind: "card"; section: number; index: number; col: number; y: number };

/**
 * The product pages: sections follow one another down the page; a heading moves to a new page when
 * not even one row of cards fits under it. Returns each page's items and the page (counted from
 * the first product page) where each section starts.
 */
export function flowLayout(sectionSizes: readonly number[]): {
  pages: PlacedItem[][];
  startPage: number[];
} {
  const pages: PlacedItem[][] = [[]];
  const startPage: number[] = [];
  let y = BODY_TOP;
  const newPage = () => {
    pages.push([]);
    y = BODY_TOP;
  };
  sectionSizes.forEach((size, section) => {
    const page = pages[pages.length - 1];
    if (page.length > 0 && y + SECTION_HEAD_H + CARD_H > BODY_BOTTOM) newPage();
    startPage.push(pages.length - 1);
    pages[pages.length - 1].push({ kind: "head", section, y });
    y += SECTION_HEAD_H;
    for (let index = 0; index < size; index += COLS) {
      if (y + CARD_H > BODY_BOTTOM) newPage();
      for (let col = 0; col < COLS && index + col < size; col++) {
        pages[pages.length - 1].push({ kind: "card", section, index: index + col, col, y });
      }
      y += CARD_H + GAP;
    }
    y += 3;
  });
  return { pages, startPage };
}

/** A file name a phone and Windows both accept: "Kijani Grill catalogue KG-v3.pdf". */
export function pdfFileName(...parts: (string | null | undefined)[]): string {
  const name = parts
    .filter(Boolean)
    .join(" ")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return `${name || "document"}.pdf`;
}
