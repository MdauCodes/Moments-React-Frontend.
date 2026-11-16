// The restaurant's catalogue booklet as a PDF, drawn in the browser (handover doc 15 §15, §22),
// following Trendysh's src/lib/cataloguePdf.ts: jsPDF and the QR maker load only when someone
// downloads. Prices are the restaurant's own (VAT included), as the store returns them from
// GET /restaurant/me/catalogue. No stock, no promotions, no shop prices. The quote form is the
// store's own PDF (GET /restaurant/me/price-requests/{id}/quote.pdf), so there is one version.
import logoUrl from "@/assets/moments_logo_without_background.png";
import {
  COMPANY_ADDRESS,
  COMPANY_EMAIL,
  COMPANY_PHONE_INTL,
  WHATSAPP_NUMBER,
} from "@/data/products";
import { groupByCategory, shortDate } from "@/lib/restaurantPortal";
import {
  BODY_TOP,
  CARD_H,
  CARD_W,
  GAP,
  MARGIN,
  PAGE_H,
  PAGE_W,
  SECTION_HEAD_H,
  flowLayout,
  pdfKes,
  pdfText,
} from "@/lib/restaurantPdfLayout";
import type { MyCatalogue } from "@/services/restaurantApi";

// Moments' colours: deep green (the site's --primary), kraft, gold, the portal's green.
const DEEP = "#1F3B2D";
const KRAFT = "#AE794C";
const GOLD = "#F2C14E";
const GREEN = "#1F6B45";
const INK = "#17241C";
const MUTED = "#56615A";
const PAPER = "#FAF7F0";
const LINE = "#E6E0D4";
const IMAGE_PX = 300;

function siteOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "https://momentspackaging.com";
}

async function loadImage(url: string, square: boolean): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      try {
        const w = square ? IMAGE_PX : img.naturalWidth;
        const h = square ? IMAGE_PX : img.naturalHeight;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        if (square) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
          const dw = img.naturalWidth * scale;
          const dh = img.naturalHeight * scale;
          ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } else {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        }
      } catch {
        resolve(null); // a photo host that won't share its pixels: the card says so instead
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** A small, padded JPEG copy from Cloudinary (the store's photos live there); other hosts as they are. */
function photoFor(url: string): string {
  const marker = "/image/upload/";
  const at = url.indexOf(marker);
  if (!url.includes("res.cloudinary.com") || at < 0) return url;
  return `${url.slice(0, at + marker.length)}w_${IMAGE_PX},h_${IMAGE_PX},c_pad,b_white,q_80,f_jpg/${url.slice(at + marker.length)}`;
}

async function mapLimited<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>) {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

const longDate = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Nairobi",
      });
};

type Doc = import("jspdf").jsPDF;

/** Footer shared by both documents: Moments, the version or reference, the approval date, page numbers. */
function footer(doc: Doc, logo: string | null, left: string, pageNo: number, pageCount: number) {
  const fy = PAGE_H - MARGIN + 2;
  doc.setDrawColor(LINE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, fy - 6, PAGE_W - MARGIN, fy - 6);
  if (logo) doc.addImage(logo, "PNG", MARGIN, fy - 4.6, 6, 6);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(INK);
  doc.text("Moments Packaging", MARGIN + 8, fy - 0.4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(MUTED);
  doc.text(pdfText(left), MARGIN + 42, fy - 0.4, { maxWidth: 110 });
  doc.text(`${pageNo} / ${pageCount}`, PAGE_W - MARGIN, fy - 0.4, { align: "right" });
}

function approvalLine(cat: MyCatalogue): string {
  const when = longDate(cat.approvedAt ?? cat.effectiveFrom);
  if (!when) return "";
  return cat.approvedBy
    ? `Approved by ${cat.approvedBy} for Moments Packaging on ${when}`
    : `Approved by Moments Packaging on ${when}`;
}

/** The illustrated catalogue booklet: cover, contents and how to order, product cards, order page. */
export async function buildCataloguePdf(
  cat: MyCatalogue,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const [{ jsPDF }, qrModule] = await Promise.all([import("jspdf"), import("qrcode")]);
  const QR = qrModule.default;
  const sections = groupByCategory(cat.lines);
  const ordered = sections.flatMap((s) => s.lines);
  const total = ordered.length + 1;
  let done = 0;
  const tick = () => onProgress?.(++done, total);

  const logo = await loadImage(logoUrl, false);
  tick();
  const photos = new Map<string, string | null>();
  await mapLimited(ordered, 6, async (l) => {
    photos.set(l.productId, l.imageUrl ? await loadImage(photoFor(l.imageUrl), true) : null);
    tick();
  });
  const portalLink = `${siteOrigin()}/restaurant/catalogue`;
  const portalQr = await QR.toDataURL(portalLink, { margin: 0, width: 360, color: { dark: DEEP } });

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const version = cat.version ?? "";
  const restaurant = pdfText(cat.restaurantName);
  doc.setProperties({
    title: pdfText(`${cat.restaurantName} catalogue ${version}`),
    author: "Moments Packaging",
    subject: "Restaurant catalogue",
  });
  const { pages, startPage } = flowLayout(sections.map((s) => s.lines.length));
  const productPageStart = 3;
  const pageCount = 2 + pages.length + 1;
  const footLeft = `Catalogue ${version}  ·  approved ${longDate(cat.approvedAt ?? cat.effectiveFrom)}`;

  // ---- cover ----
  doc.setFillColor(DEEP);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
  doc.setFillColor(KRAFT);
  doc.circle(PAGE_W + 12, -12, 90, "F");
  doc.setFillColor(GOLD);
  doc.circle(-28, PAGE_H + 20, 58, "F");
  if (logo) {
    doc.setFillColor("#ffffff");
    doc.roundedRect(PAGE_W / 2 - 26, 40, 52, 52, 8, 8, "F");
    doc.addImage(logo, "PNG", PAGE_W / 2 - 22, 44, 44, 44);
  }
  doc.setTextColor("#E9E2D0");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("MOMENTS PACKAGING  ·  NAIROBI", PAGE_W / 2, 106, { align: "center", charSpace: 0.6 });
  doc.setFont("times", "bold");
  doc.setFontSize(36);
  doc.setTextColor("#ffffff");
  doc.text("Your Catalogue", PAGE_W / 2, 128, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const prepared = `Prepared for ${restaurant}`;
  const pillW = Math.min(176, doc.getTextWidth(prepared) + 18);
  doc.setFillColor(GOLD);
  doc.roundedRect(PAGE_W / 2 - pillW / 2, 138, pillW, 11, 5.5, 5.5, "F");
  doc.setTextColor(DEEP);
  doc.text(prepared, PAGE_W / 2, 145.4, { align: "center", maxWidth: 168 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor("#E9E2D0");
  doc.text(
    `Catalogue ${version}  ·  ${ordered.length} product${ordered.length === 1 ? "" : "s"}  ·  prices include VAT`,
    PAGE_W / 2,
    160,
    { align: "center" },
  );
  const approval = approvalLine(cat);
  if (approval) {
    doc.setFont("helvetica", "italic");
    doc.text(pdfText(approval), PAGE_W / 2, 168, { align: "center", maxWidth: 176 });
  }
  const coverPhotos = ordered
    .map((l) => photos.get(l.productId))
    .filter((p): p is string => !!p)
    .slice(0, 4);
  if (coverPhotos.length) {
    const size = 34;
    const gap = 6;
    const rowW = coverPhotos.length * size + (coverPhotos.length - 1) * gap;
    coverPhotos.forEach((photo, i) => {
      const px = PAGE_W / 2 - rowW / 2 + i * (size + gap);
      doc.setFillColor("#ffffff");
      doc.roundedRect(px - 1.5, 180 - 1.5, size + 3, size + 3, 3, 3, "F");
      doc.addImage(photo, "JPEG", px, 180, size, size, undefined, "FAST");
    });
  }
  doc.setDrawColor(KRAFT);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 10, 236, PAGE_W - MARGIN - 10, 236);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor("#E9E2D0");
  doc.text(pdfText(COMPANY_ADDRESS), MARGIN + 10, 246, { maxWidth: 130 });
  doc.text(`${COMPANY_PHONE_INTL}  ·  ${COMPANY_EMAIL}`, MARGIN + 10, 253);

  // ---- contents and how to order ----
  doc.addPage();
  doc.setFillColor(GREEN);
  doc.rect(0, 0, PAGE_W, 2.2, "F");
  footer(doc, logo, footLeft, 2, pageCount);
  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.setTextColor(INK);
  doc.text("Inside this catalogue", MARGIN, BODY_TOP + 12);
  let y = BODY_TOP + 25;
  doc.setFontSize(11);
  sections.forEach((s, i) => {
    const page = productPageStart + (startPage[i] ?? 0);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(INK);
    doc.textWithLink(pdfText(s.category), MARGIN, y, { pageNumber: page });
    doc.setFont("helvetica", "normal");
    doc.setTextColor(MUTED);
    doc.text(`${s.lines.length} product${s.lines.length === 1 ? "" : "s"}`, MARGIN + 110, y);
    doc.setTextColor(GREEN);
    doc.text(String(page), PAGE_W - MARGIN, y, { align: "right" });
    doc.setDrawColor(LINE);
    doc.setLineDashPattern([0.6, 1.2], 0);
    doc.line(MARGIN, y + 2.5, PAGE_W - MARGIN, y + 2.5);
    doc.setLineDashPattern([], 0);
    y += 9;
  });
  const boxY = y + 8;
  doc.setFillColor(PAPER);
  doc.roundedRect(MARGIN, boxY, PAGE_W - MARGIN * 2, 78, 4, 4, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK);
  doc.text("How to order", MARGIN + 7, boxY + 11);
  const steps = [
    `Sign in to ${restaurant}'s page on the Moments website (the last page has the link and a code to scan).`,
    "Choose from your catalogue: every order is placed at the prices in this catalogue.",
    "Your heads sign the purchase order: download it, sign, scan and upload it. Moments then prepares your order.",
    "Need something that isn't here? Browse the products and add them to a quote request; Moments prices them for you.",
    "Prices stay until Moments changes them, and you are told at least 14 days before a change starts.",
  ];
  let sy = boxY + 20;
  steps.forEach((step, i) => {
    doc.setFillColor(GREEN);
    doc.circle(MARGIN + 10, sy - 1.3, 2.6, "F");
    doc.setTextColor("#ffffff");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(String(i + 1), MARGIN + 10, sy - 0.2, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    const lines = doc.splitTextToSize(pdfText(step), PAGE_W - MARGIN * 2 - 26) as string[];
    doc.text(lines, MARGIN + 16, sy);
    sy += lines.length * 4.6 + 3.4;
  });

  // ---- products ----
  pages.forEach((items, i) => {
    doc.addPage();
    const pageNo = productPageStart + i;
    doc.setFillColor(GREEN);
    doc.rect(0, 0, PAGE_W, 2.2, "F");
    footer(doc, logo, footLeft, pageNo, pageCount);
    for (const item of items) {
      const section = sections[item.section];
      if (item.kind === "card") {
        drawCard(section.lines[item.index], MARGIN + item.col * (CARD_W + GAP), item.y);
        continue;
      }
      doc.setFillColor(DEEP);
      doc.roundedRect(MARGIN, item.y, PAGE_W - MARGIN * 2, SECTION_HEAD_H - 6, 3, 3, "F");
      doc.setFont("times", "bold");
      doc.setFontSize(16);
      doc.setTextColor("#ffffff");
      doc.text(pdfText(section.category), MARGIN + 7, item.y + 10.5);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor("#E9E2D0");
      doc.text(
        `${section.lines.length} product${section.lines.length === 1 ? "" : "s"}`,
        PAGE_W - MARGIN - 7,
        item.y + 10.5,
        { align: "right" },
      );
      doc.outline.add(null, pdfText(section.category), { pageNumber: pageNo });
    }
  });

  // ---- order from your catalogue ----
  doc.addPage();
  doc.setFillColor(GREEN);
  doc.rect(0, 0, PAGE_W, 2.2, "F");
  footer(doc, logo, footLeft, pageCount, pageCount);
  doc.setFillColor(DEEP);
  doc.roundedRect(MARGIN, BODY_TOP, PAGE_W - MARGIN * 2, 118, 5, 5, "F");
  doc.setFont("times", "bold");
  doc.setFontSize(24);
  doc.setTextColor("#ffffff");
  doc.text("Order from your catalogue", PAGE_W / 2, BODY_TOP + 20, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#E9E2D0");
  doc.text(
    doc.splitTextToSize(
      pdfText(
        `Open ${restaurant}'s catalogue on the Moments website: sign in, choose, and your order goes at these prices.`,
      ),
      150,
    ) as string[],
    PAGE_W / 2,
    BODY_TOP + 30,
    { align: "center" },
  );
  const btnW = 100;
  doc.setFillColor(GOLD);
  doc.roundedRect(PAGE_W / 2 - btnW / 2, BODY_TOP + 44, btnW, 14, 7, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(DEEP);
  doc.text("Open my catalogue", PAGE_W / 2, BODY_TOP + 52.8, { align: "center" });
  doc.link(PAGE_W / 2 - btnW / 2, BODY_TOP + 44, btnW, 14, { url: portalLink });
  doc.setFillColor("#ffffff");
  doc.roundedRect(PAGE_W / 2 - 23, BODY_TOP + 64, 46, 46, 3, 3, "F");
  doc.addImage(portalQr, "PNG", PAGE_W / 2 - 20, BODY_TOP + 67, 40, 40);
  doc.link(PAGE_W / 2 - 20, BODY_TOP + 67, 40, 40, { url: portalLink });
  doc.setFont("times", "bold");
  doc.setFontSize(16);
  doc.setTextColor(INK);
  doc.text("Questions?", MARGIN, BODY_TOP + 138);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.textWithLink(`WhatsApp ${COMPANY_PHONE_INTL}`, MARGIN, BODY_TOP + 148, {
    url: `https://wa.me/${WHATSAPP_NUMBER}`,
  });
  doc.text(`${COMPANY_EMAIL}  ·  ${pdfText(COMPANY_ADDRESS)}`, MARGIN, BODY_TOP + 155, {
    maxWidth: PAGE_W - MARGIN * 2,
  });
  doc.setTextColor(MUTED);
  doc.setFontSize(8);
  doc.text(
    pdfText(
      `Prices are ${restaurant}'s own, VAT (16%) included, as approved in catalogue ${version}. They stay until Moments changes them, with at least 14 days' notice; an order keeps the price it was placed at.`,
    ),
    MARGIN,
    BODY_TOP + 166,
    { maxWidth: PAGE_W - MARGIN * 2 },
  );

  return doc.output("blob");

  function drawCard(line: MyCatalogue["lines"][number], x: number, cy: number) {
    doc.setFillColor("#ffffff");
    doc.setDrawColor(LINE);
    doc.setLineWidth(0.35);
    doc.roundedRect(x, cy, CARD_W, CARD_H, 3, 3, "FD");
    const imgSize = CARD_H - 7;
    const photo = photos.get(line.productId);
    if (photo) {
      doc.addImage(photo, "JPEG", x + 3.5, cy + 3.5, imgSize, imgSize, undefined, "FAST");
    } else {
      doc.setFillColor(PAPER);
      doc.roundedRect(x + 3.5, cy + 3.5, imgSize, imgSize, 2, 2, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(MUTED);
      doc.text("No photo", x + 3.5 + imgSize / 2, cy + 3.5 + imgSize / 2, { align: "center" });
    }
    const tx = x + imgSize + 7;
    const tw = CARD_W - imgSize - 10;
    let ty = cy + 7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(KRAFT);
    doc.text(pdfText((line.category || "Other").toUpperCase()), tx, ty, {
      maxWidth: tw,
      charSpace: 0.2,
    });
    ty += 4.6;
    doc.setFontSize(9.5);
    doc.setTextColor(INK);
    const nameLines = (doc.splitTextToSize(pdfText(line.productName), tw) as string[]).slice(0, 3);
    // No links to the shop's product pages: they show shop prices, not the restaurant's.
    doc.text(nameLines, tx, ty);
    ty += nameLines.length * 4.1 + 0.5;
    if (line.unit) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(MUTED);
      doc.text(pdfText(`Per ${line.unit}`), tx, ty, { maxWidth: tw });
      ty += 4;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(GREEN);
    doc.text(pdfKes(Number(line.price)), tx, cy + CARD_H - 6);
    if (line.priceSince) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(MUTED);
      doc.text(`since ${shortDate(line.priceSince)}`, x + CARD_W - 3.5, cy + CARD_H - 6, {
        align: "right",
      });
    }
  }
}

/** Saves a built PDF on the phone or computer. */
export function savePdf(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
