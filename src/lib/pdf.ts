// ----------------------------------------------------------------------------
// PDF generation — jsPDF + autoTable
//
// Four document types sharing one design system:
//   1. Customer receipt / tax invoice
//   2. Dispatcher packing & dispatch checklist
//   3. Admin orders report (landscape)
//   4. Customer account statement
//
// Design language: warm off-white paper, brass accent, dark ink — mirrors the
// Moments Packaging storefront. Every document shares the same masthead,
// section grammar, and footer so they read as one stationery set.
// ----------------------------------------------------------------------------

import { jsPDF } from "jspdf";
import autoTable, { type RowInput, type UserOptions } from "jspdf-autotable";
import logoUrl from "@/assets/moments_logo_without_background.png";

// ── Logo — loaded once, converted to a PNG data URL so jsPDF can embed it ──────
interface LogoData {
  dataUrl: string;
  aspect: number; // width / height
}
let logoPromise: Promise<LogoData | null> | null = null;

function loadLogo(): Promise<LogoData | null> {
  if (!logoPromise) {
    logoPromise = new Promise((resolve) => {
      if (typeof window === "undefined" || typeof Image === "undefined") {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve({ dataUrl: canvas.toDataURL("image/png"), aspect: img.naturalWidth / img.naturalHeight });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = logoUrl;
    });
  }
  return logoPromise;
}

// ── Brand constants ───────────────────────────────────────────────────────────
const BRAND = {
  name: "Moments Packaging Kenya",
  tagline: "Premium packaging, crafted in Kenya",
  email: "info@momentspackaging.com",
  phone: "+254 119 556 688",
  whatsapp: "+254 119 556 688",
  site: "momentspackaging.com",
  address: "Nairobi, Kenya",
};

// ── Colour palette ────────────────────────────────────────────────────────────
const INK: [number, number, number] = [18, 18, 20];
const MUTED: [number, number, number] = [100, 100, 106];
const HAIRLINE: [number, number, number] = [220, 217, 210];
const PAPER: [number, number, number] = [250, 248, 243];
const ACCENT: [number, number, number] = [183, 132, 64];
const SUCCESS: [number, number, number] = [40, 120, 55];
const DANGER: [number, number, number] = [180, 40, 40];
const HEAD_BG: [number, number, number] = [24, 36, 24];

// ── Formatters ────────────────────────────────────────────────────────────────
const KES = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 2,
});
const fmt = (n: number | null | undefined) => KES.format(Number(n ?? 0));
const fmtNum = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-KE");
const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtDT = (d: string | Date) =>
  new Date(d).toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// ── Shared chrome helpers ─────────────────────────────────────────────────────

interface MetaRow {
  label: string;
  value: string;
}

interface MastheadOpts {
  docType: string;
  /** Stripe-style label/value rows under the title — used by the invoice/
   *  receipt. Falls back to the old single-line Ref/Issued layout when
   *  omitted, so the other three document types are unaffected. */
  meta?: MetaRow[];
  reference?: string;
  issuedAt?: string | Date;
  kraPin?: string | null;
  logo?: LogoData | null;
}

/** Renders brass band, doc-type title, metadata/wordmark and hairline.
 *  Returns Y immediately after the hairline. */
function masthead(doc: jsPDF, opts: MastheadOpts): number {
  const pw = doc.internal.pageSize.getWidth();

  // Brass top band
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, pw, 5, "F");

  // Logo — top-right, real company mark
  const logoH = 12;
  if (opts.logo) {
    const logoW = logoH * opts.logo.aspect;
    doc.addImage(opts.logo.dataUrl, "PNG", pw - 14 - logoW, 9, logoW, logoH);
  }

  let bottomY: number;

  if (opts.meta) {
    // Bold title top-left, label/value metadata rows beneath it — mirrors a
    // standard invoice layout (title, then Invoice number / Date / etc).
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text(opts.docType, 14, 19);

    let my = 26;
    doc.setFontSize(8.5);
    opts.meta.forEach((row) => {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(row.label, 14, my);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...INK);
      doc.text(row.value, 48, my);
      my += 4.6;
    });
    bottomY = Math.max(my + 1.5, logoH + 13);
  } else {
    // Legacy single-line layout for dispatch/report/statement docs.
    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(BRAND.name.toUpperCase(), 14, 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(BRAND.tagline, 14, 22);
    const contactLine = `${BRAND.address}  ·  ${BRAND.phone}  ·  ${BRAND.email}  ·  ${BRAND.site}`;
    doc.text(opts.kraPin ? `${contactLine}  ·  KRA PIN ${opts.kraPin}` : contactLine, 14, 26.5);

    doc.setTextColor(...INK);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(opts.docType.toUpperCase(), pw - 14, 17, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    if (opts.reference) {
      doc.text(`Ref  ${opts.reference}`, pw - 14, 22, { align: "right" });
    }
    doc.text(`Issued  ${opts.issuedAt ? fmtDT(opts.issuedAt) : fmtDT(new Date())}`, pw - 14, 26.5, { align: "right" });
    bottomY = 33;
  }

  // Hairline
  doc.setDrawColor(...HAIRLINE);
  doc.setLineWidth(0.3);
  doc.line(14, bottomY, pw - 14, bottomY);

  doc.setTextColor(...INK);
  return bottomY + 3;
}

function sectionLabel(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...ACCENT);
  doc.text(text.toUpperCase(), x, y, { charSpace: 0.8 });
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
}

function hline(doc: jsPDF, y: number, color: [number, number, number] = HAIRLINE, lw = 0.3) {
  const pw = doc.internal.pageSize.getWidth();
  doc.setDrawColor(...color);
  doc.setLineWidth(lw);
  doc.line(14, y, pw - 14, y);
}

function kpiCard(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setDrawColor(...HAIRLINE);
  doc.setFillColor(...PAPER);
  doc.roundedRect(x, y, w, h, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...ACCENT);
  doc.text(label.toUpperCase(), x + 4, y + 6.5, { charSpace: 0.6 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(value, x + 4, y + h - 4);
  doc.setFont("helvetica", "normal");
}

function footer(doc: jsPDF, note?: string) {
  const ph = doc.internal.pageSize.getHeight();
  const pw = doc.internal.pageSize.getWidth();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    hline(doc, ph - 15);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(note ?? `${BRAND.name}  ·  ${BRAND.site}  ·  ${BRAND.phone}`, 14, ph - 9);
    doc.text(`Page ${i} of ${total}`, pw - 14, ph - 9, { align: "right" });
  }
}

function save(doc: jsPDF, filename: string, footerNote?: string) {
  footer(doc, footerNote);
  doc.save(filename);
}

// ── Default autoTable style ───────────────────────────────────────────────────
const TABLE_DEFAULTS: Partial<UserOptions> = {
  theme: "plain",
  styles: {
    fontSize: 9,
    cellPadding: { top: 4, bottom: 4, left: 3, right: 3 },
    textColor: INK as [number, number, number],
    lineColor: HAIRLINE as [number, number, number],
    lineWidth: 0.15,
  },
  headStyles: {
    fillColor: HEAD_BG as [number, number, number],
    textColor: [255, 255, 255] as [number, number, number],
    fontStyle: "bold",
    fontSize: 8,
    cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
  },
  alternateRowStyles: { fillColor: PAPER as [number, number, number] },
  margin: { left: 14, right: 14 },
};

// ── 1. Customer receipt / invoice ─────────────────────────────────────────────

export interface ReceiptItem {
  productName: string;
  size?: string | null;
  material?: string | null;
  finish?: string | null;
  sku?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  vatExempt?: boolean;
}

export interface ReceiptOrder {
  reference: string;
  invoiceNumber?: string | null;
  businessKraPin?: string | null;
  /** The customer's own KRA PIN, entered at checkout — printed as a separate line from businessKraPin. */
  buyerKraPin?: string | null;
  createdAt: string;
  paidAt?: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  county?: string | null;
  postalCode?: string | null;
  currency?: string;
  subtotal: number;
  shippingFee: number;
  discount?: number | null;
  vatAmount?: number | null;
  vatRate?: number | null;
  total: number;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReference?: string | null;
  receiptNumber?: string | null;
  fulfillmentType?: string | null;
  courierServiceName?: string | null;
  promoCode?: string | null;
  items: ReceiptItem[];
}

async function buildReceiptDoc(order: ReceiptOrder): Promise<{ doc: jsPDF; filename: string; footerNote: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();

  const paid = ["PAID", "COMPLETED", "SUCCESS"].includes((order.paymentStatus ?? "").toUpperCase());
  const mpesaRef = order.receiptNumber ?? order.paymentReference;
  const docType = paid ? "Receipt" : order.invoiceNumber ? "Tax Invoice" : "Pro-Forma Invoice";

  const meta: MetaRow[] = [{ label: "Invoice number", value: order.invoiceNumber ?? order.reference }];
  if (paid) {
    meta.push({ label: "Receipt number", value: mpesaRef ?? order.reference });
    meta.push({ label: "Date paid", value: fmtDate(order.paidAt ?? order.createdAt) });
  } else {
    meta.push({ label: "Date of issue", value: fmtDate(order.createdAt) });
  }
  if (order.businessKraPin) meta.push({ label: "Seller KRA PIN", value: order.businessKraPin });
  if (order.buyerKraPin) meta.push({ label: "Buyer KRA PIN", value: order.buyerKraPin });

  let y = masthead(doc, { docType, meta, logo });
  y += 3;

  // ── From / Bill to ────────────────────────────────────────────────────────
  sectionLabel(doc, "From", 14, y);
  sectionLabel(doc, "Bill To", pw / 2, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(BRAND.name, 14, y);
  doc.text(order.customerName, pw / 2, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(BRAND.address, 14, y);
  doc.text(order.customerEmail, pw / 2, y);
  y += 5;
  doc.text(BRAND.phone, 14, y);
  doc.text(order.customerPhone, pw / 2, y);
  y += 5;
  doc.text(BRAND.email, 14, y);
  doc.text(order.shippingAddress || "—", pw / 2, y);
  y += 5;
  const shipLocation = [order.city, order.county, order.postalCode, "Kenya"].filter(Boolean).join(", ");
  doc.text(shipLocation, pw / 2, y);
  if (order.fulfillmentType) {
    const label = order.fulfillmentType.replace(/_/g, " ");
    const detail = order.courierServiceName ? ` — ${order.courierServiceName}` : "";
    y += 5;
    doc.text(`Delivery: ${label}${detail}`, pw / 2, y);
  }
  doc.setTextColor(...INK);
  y += 5;

  if (order.promoCode) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Promo code applied: ${order.promoCode}`, 14, y);
    doc.setTextColor(...INK);
    y += 5;
  }

  // ── Amount statement — the headline figure, like a trusted invoice/receipt ──
  y += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...(paid ? SUCCESS : INK));
  const amountLine = paid
    ? `${fmt(order.total)} paid on ${fmtDate(order.paidAt ?? order.createdAt)}`
    : `${fmt(order.total)} due`;
  doc.text(amountLine, 14, y);
  doc.setTextColor(...INK);
  y += 6;

  // ── Items table ───────────────────────────────────────────────────────────
  const vatRate = order.vatRate != null ? Math.round(order.vatRate * 100) : 16;

  const body: RowInput[] = order.items.map((it, i) => {
    const specs = [it.size, it.material, it.finish].filter(Boolean).join(" · ");
    const label = it.productName + (specs ? `\n${specs}` : "") + (it.sku ? `\nSKU: ${it.sku}` : "");
    return [
      String(i + 1).padStart(2, "0"),
      label,
      fmtNum(it.quantity),
      fmt(it.unitPrice),
      it.vatExempt ? "Exempt" : `${vatRate}%`,
      fmt(it.lineTotal),
    ] as RowInput;
  });

  autoTable(doc, {
    ...TABLE_DEFAULTS,
    startY: y + 6,
    head: [["#", "Item / Description", "Qty", "Unit Price", "VAT", "Line Total"]],
    body,
    columnStyles: {
      0: { cellWidth: 10, halign: "center", textColor: MUTED },
      2: { halign: "right", cellWidth: 16 },
      3: { halign: "right", cellWidth: 28 },
      4: { halign: "center", cellWidth: 20 },
      5: { halign: "right", cellWidth: 32, fontStyle: "bold" },
    },
  });

  // ── Totals ────────────────────────────────────────────────────────────────
  const endY = (doc as any).lastAutoTable?.finalY ?? y + 40;
  const lx = pw - 80;
  const rx = pw - 14;
  let ty = endY + 8;

  const totRow = (label: string, value: string, bold = false, color?: [number, number, number]) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10.5 : 9.5);
    doc.setTextColor(...(color ?? (bold ? INK : MUTED)));
    doc.text(label, lx, ty);
    doc.setTextColor(...INK);
    doc.text(value, rx, ty, { align: "right" });
    ty += bold ? 7 : 5.5;
  };

  const subtotalExVat = order.subtotal - (order.vatAmount ?? 0);
  totRow("Subtotal (excl. VAT)", fmt(subtotalExVat));
  if ((order.vatAmount ?? 0) > 0) {
    totRow(`VAT (${vatRate}%)`, fmt(order.vatAmount));
  }
  if ((order.discount ?? 0) > 0) {
    totRow("Discount", `-${fmt(order.discount)}`, false, DANGER);
  }
  const isCourier = (order.fulfillmentType ?? "") === "OWN_COURIER";
  totRow("Delivery", isCourier ? "To be confirmed" : order.shippingFee === 0 ? "Free" : fmt(order.shippingFee));

  ty += 1.5;
  hline(doc, ty, INK, 0.4);
  ty += 5;
  totRow(`TOTAL  (${order.currency ?? "KES"})`, fmt(order.total), true);

  // ── Payment history ───────────────────────────────────────────────────────
  ty += 6;
  if (paid) {
    sectionLabel(doc, "Payment History", 14, ty);
    autoTable(doc, {
      ...TABLE_DEFAULTS,
      startY: ty + 3,
      head: [["Payment method", "Date", "Amount paid", "Receipt number"]],
      body: [
        [
          (order.paymentMethod ?? "—").replace(/_/g, " "),
          fmtDate(order.paidAt ?? order.createdAt),
          fmt(order.total),
          mpesaRef ?? "—",
        ],
      ] as RowInput[],
      columnStyles: {
        2: { halign: "right" },
        3: { halign: "right" },
      },
    });
    ty = (doc as any).lastAutoTable?.finalY ?? ty + 18;
  } else {
    doc.setDrawColor(...HAIRLINE);
    doc.setFillColor(...PAPER);
    doc.roundedRect(14, ty, pw - 28, 20, 2, 2, "FD");
    sectionLabel(doc, "Payment Details", 18, ty + 6.5);
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(`Method:  ${(order.paymentMethod ?? "—").replace(/_/g, " ")}`, 18, ty + 13);
    doc.text("Status:  ", pw / 2, ty + 13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DANGER);
    doc.text(order.paymentStatus ?? "Pending", pw / 2 + 12, ty + 13);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    ty += 28;
  }

  // ── Thank-you ─────────────────────────────────────────────────────────────
  ty += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("Thank you for choosing Moments Packaging Kenya.", 14, ty);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  ty += 6;
  doc.text(`Questions? Reach us at ${BRAND.email} or WhatsApp ${BRAND.whatsapp} quoting ${order.reference}.`, 14, ty, {
    maxWidth: pw - 28,
  });
  ty += 7;
  doc.text(
    `This is a computer-generated ${docType.toLowerCase()} valid without a signature. ` +
      "Retain for warranty claims, exchanges and returns within 14 days of delivery.",
    14,
    ty,
    { maxWidth: pw - 28 },
  );
  ty += 7;
  doc.text(
    "This document is issued directly by Moments Packaging. It is not yet transmitted through KRA's " +
      "eTIMS system. Please retain your order confirmation and payment receipt for your records.",
    14,
    ty,
    { maxWidth: pw - 28 },
  );

  const filePrefix = docType === "Receipt" ? "receipt" : "invoice";
  return {
    doc,
    filename: `${filePrefix}-${order.reference}.pdf`,
    footerNote: `${BRAND.name}  ·  ${docType} ${order.reference}  ·  ${BRAND.site}`,
  };
}

export async function downloadReceiptPdf(order: ReceiptOrder) {
  const { doc, filename, footerNote } = await buildReceiptDoc(order);
  save(doc, filename, footerNote);
}

/**
 * Same renderer as downloadReceiptPdf, but returns the PDF as a Blob instead of triggering a
 * browser download — used to upload the customer's tax invoice to Cloudinary right after
 * checkout (see checkout.tsx) so the self-serve download and the emailed copy are always the
 * exact same document, not two independently-maintained layouts.
 */
export async function buildReceiptPdfBlob(order: ReceiptOrder): Promise<Blob> {
  const { doc, footerNote } = await buildReceiptDoc(order);
  footer(doc, footerNote);
  return doc.output("blob");
}

// ── 2. Dispatch packing checklist ─────────────────────────────────────────────

export interface DispatchItem {
  name: string;
  size?: string | null;
  material?: string | null;
  qty: number;
  lineTotal?: number | null;
  sku?: string | null;
}

export interface DispatchOrderLike {
  reference: string;
  customerName: string;
  customerPhone?: string | null;
  city?: string | null;
  county?: string | null;
  shippingAddress?: string | null;
  trackingNumber?: string | null;
  fulfillmentType?: string | null;
  courierService?: string | null;
  staffNotes?: string | null;
  items: DispatchItem[];
}

export async function downloadDispatchChecklistPdf(order: DispatchOrderLike) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();

  let y = masthead(doc, {
    docType: "Dispatch Checklist",
    reference: order.reference,
    logo,
  });
  y += 4;

  // ── Recipient / route ─────────────────────────────────────────────────────
  sectionLabel(doc, "Recipient", 14, y);
  sectionLabel(doc, "Route / Delivery", pw / 2, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(order.customerName, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text([order.city, order.county].filter(Boolean).join(", ") || "—", pw / 2, y);

  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(order.customerPhone ?? "—", 14, y);
  const fulfillLabel = order.fulfillmentType ? order.fulfillmentType.replace(/_/g, " ") : "Zone Delivery";
  doc.text(order.trackingNumber ? `${fulfillLabel}  ·  Tracking: ${order.trackingNumber}` : fulfillLabel, pw / 2, y);

  y += 5;
  doc.text(order.shippingAddress ?? "—", 14, y, { maxWidth: pw / 2 - 18 });
  if (order.courierService) {
    doc.text(`Courier: ${order.courierService}`, pw / 2, y);
  }
  doc.setTextColor(...INK);

  if (order.staffNotes) {
    y += 7;
    doc.setFontSize(8.5);
    doc.setTextColor(...DANGER);
    doc.text(`⚠ Staff notes: ${order.staffNotes}`, 14, y, {
      maxWidth: pw - 28,
    });
    doc.setTextColor(...INK);
  }

  // ── Items checklist ───────────────────────────────────────────────────────
  const totalUnits = order.items.reduce((s, it) => s + Number(it.qty ?? 0), 0);

  autoTable(doc, {
    ...TABLE_DEFAULTS,
    startY: y + 9,
    head: [["☐", "#", "Product / Description", "Spec", "SKU", "Qty"]],
    body: order.items.map((it, i) => [
      "",
      String(i + 1).padStart(2, "0"),
      it.name,
      [it.size, it.material].filter(Boolean).join(" · ") || "—",
      it.sku ?? "—",
      String(it.qty),
    ]) as RowInput[],
    styles: {
      ...(TABLE_DEFAULTS.styles as object),
      fontSize: 10.5,
      cellPadding: 5,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: 10, textColor: MUTED },
      3: { textColor: MUTED, fontSize: 9.5 },
      4: { textColor: MUTED, fontSize: 9 },
      5: { halign: "right", cellWidth: 16, fontStyle: "bold" },
    },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 0) {
        const sz = 5.5;
        const cx = data.cell.x + (data.cell.width - sz) / 2;
        const cy = data.cell.y + (data.cell.height - sz) / 2;
        doc.setDrawColor(...INK);
        doc.setLineWidth(0.5);
        doc.rect(cx, cy, sz, sz);
      }
    },
  });

  const endY = (doc as any).lastAutoTable?.finalY ?? y + 40;

  // ── Quality gate ──────────────────────────────────────────────────────────
  let qy = endY + 8;
  doc.setDrawColor(...HAIRLINE);
  doc.setFillColor(...PAPER);
  doc.roundedRect(14, qy, pw - 28, 36, 2, 2, "FD");
  sectionLabel(doc, "Quality Gate — Tick Before Sealing", 18, qy + 7);

  const gates = [
    "Correct items, sizes and quantities",
    "Branding / artwork matches order brief",
    "Inserts, freebies, thank-you card included",
    "Outer carton clean, undamaged, taped shut",
    "Address label & phone visible on parcel",
    "Tracking number logged in system",
  ];
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  gates.forEach((g, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const gx = 20 + col * ((pw - 40) / 2);
    const gy = qy + 14 + row * 7;
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.5);
    doc.rect(gx, gy - 3.5, 4, 4);
    doc.text(g, gx + 6, gy);
  });

  // ── Sign-off ──────────────────────────────────────────────────────────────
  let sy = qy + 44;
  sectionLabel(doc, "Sign-Off", 14, sy);
  sy += 12;

  const sigCols = ["Packed by", "Checked by", "Dispatched on"];
  const colW = (pw - 28 - 16) / 3;
  sigCols.forEach((label, i) => {
    const sx = 14 + i * (colW + 8);
    doc.setDrawColor(...INK);
    doc.setLineWidth(0.3);
    doc.line(sx, sy, sx + colW, sy);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, sx, sy + 4.5);
    doc.setTextColor(...INK);
  });

  sy += 14;
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(
    `${order.items.length} line${order.items.length !== 1 ? "s" : ""}  ·  ` +
      `${fmtNum(totalUnits)} unit${totalUnits !== 1 ? "s" : ""}  ·  ` +
      `Retain this slip with dispatch records for 30 days.  ·  ${fmtDT(new Date())}`,
    14,
    sy,
    { maxWidth: pw - 28 },
  );

  save(doc, `dispatch-${order.reference}.pdf`);
}

// ── 3. Admin orders report ────────────────────────────────────────────────────

export interface OrdersListRow {
  reference: string;
  customerName: string;
  city?: string | null;
  county?: string | null;
  status: string;
  paymentStatus: string;
  total: number;
  createdAt: string;
  items: { qty: number }[];
  promoCode?: string | null;
}

export async function downloadOrdersListPdf(
  rows: OrdersListRow[],
  meta: { filterLabel?: string; dateRange?: string } = {},
) {
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    orientation: "landscape",
  });
  const pw = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();

  let y = masthead(doc, { docType: "Orders Report", logo });
  y += 3;

  // Filter label
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  const filterLabel = [meta.filterLabel, meta.dateRange].filter(Boolean).join("  ·  ");
  doc.text(`Filter: ${filterLabel || "All orders"}`, 14, y);
  y += 5;

  // ── KPI strip ─────────────────────────────────────────────────────────────
  const revenue = rows.reduce((s, o) => s + Number(o.total ?? 0), 0);
  const units = rows.reduce((s, o) => s + o.items.reduce((u, it) => u + Number(it.qty ?? 0), 0), 0);
  const aov = rows.length ? revenue / rows.length : 0;
  const paidCt = rows.filter((o) => ["PAID", "COMPLETED"].includes((o.paymentStatus ?? "").toUpperCase())).length;
  const cw = (pw - 28 - 18) / 4;

  kpiCard(doc, 14, y, cw, 20, "Orders", String(rows.length));
  kpiCard(doc, 14 + (cw + 6), y, cw, 20, "Units", fmtNum(units));
  kpiCard(doc, 14 + (cw + 6) * 2, y, cw, 20, "Revenue", fmt(revenue));
  kpiCard(doc, 14 + (cw + 6) * 3, y, cw, 20, "Avg Order", fmt(aov));
  y += 26;

  autoTable(doc, {
    ...TABLE_DEFAULTS,
    startY: y,
    head: [["Reference", "Customer", "Location", "Units", "Status", "Payment", "Promo", "Total", "Placed"]],
    body: rows.map((o) => [
      o.reference,
      o.customerName,
      [o.city, o.county].filter(Boolean).join(", ") || "—",
      String(o.items.reduce((s, it) => s + Number(it.qty ?? 0), 0)),
      o.status.replace(/_/g, " "),
      o.paymentStatus,
      o.promoCode ?? "—",
      fmt(o.total),
      fmtDate(o.createdAt),
    ]) as RowInput[],
    columnStyles: {
      3: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
    },
  });

  save(
    doc,
    `orders-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    `${BRAND.name}  ·  Orders Report  ·  ${rows.length} orders  ·  ` + `${fmt(revenue)} revenue  ·  ${paidCt} paid`,
  );
}

// ── 4. Customer statement ─────────────────────────────────────────────────────

export interface StatementCustomer {
  name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  lifetimeValue?: number | null;
  ordersCount?: number | null;
  averageOrderValue?: number | null;
  firstOrderAt?: string | null;
  lastOrderAt?: string | null;
}

export async function downloadCustomerStatementPdf(customer: StatementCustomer, orders: OrdersListRow[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pw = doc.internal.pageSize.getWidth();
  const logo = await loadLogo();

  let y = masthead(doc, { docType: "Customer Statement", logo });
  y += 4;

  // ── Identity ──────────────────────────────────────────────────────────────
  sectionLabel(doc, "Account", 14, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(customer.name, 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text([customer.email, customer.phone, customer.city].filter(Boolean).join("  ·  "), 14, y);

  // Period
  const first = customer.firstOrderAt
    ? fmtDate(customer.firstOrderAt)
    : orders.length
      ? fmtDate(orders[orders.length - 1].createdAt)
      : "—";
  const last = customer.lastOrderAt
    ? fmtDate(customer.lastOrderAt)
    : orders.length
      ? fmtDate(orders[0].createdAt)
      : "—";
  doc.text(`Statement period:  ${first} → ${last}`, pw - 14, y, {
    align: "right",
  });
  doc.setTextColor(...INK);
  y += 6;

  // ── KPI strip ─────────────────────────────────────────────────────────────
  const cw = (pw - 28 - 12) / 3;
  kpiCard(doc, 14, y, cw, 24, "Lifetime Value", fmt(customer.lifetimeValue ?? 0));
  kpiCard(doc, 14 + cw + 6, y, cw, 24, "Total Orders", String(customer.ordersCount ?? orders.length));
  kpiCard(doc, 14 + (cw + 6) * 2, y, cw, 24, "Average Order", fmt(customer.averageOrderValue ?? 0));
  y += 32;

  // ── Orders table ──────────────────────────────────────────────────────────
  const total = orders.reduce((s, o) => s + Number(o.total ?? 0), 0);

  autoTable(doc, {
    ...TABLE_DEFAULTS,
    startY: y,
    head: [["#", "Reference", "Placed", "Location", "Units", "Status", "Payment", "Total"]],
    body: orders.map((o, i) => [
      String(i + 1).padStart(2, "0"),
      o.reference,
      fmtDate(o.createdAt),
      [o.city, o.county].filter(Boolean).join(", ") || "—",
      String(o.items.reduce((s, it) => s + Number(it.qty ?? 0), 0)),
      o.status.replace(/_/g, " "),
      o.paymentStatus,
      fmt(o.total),
    ]) as RowInput[],
    columnStyles: {
      0: { cellWidth: 10, halign: "center", textColor: MUTED },
      4: { halign: "right" },
      7: { halign: "right", fontStyle: "bold" },
    },
  });

  // ── Statement total ───────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 60;
  let ty = finalY + 8;
  hline(doc, ty - 1, INK, 0.4);
  ty += 3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Statement Total", pw - 90, ty);
  doc.text(fmt(total), pw - 14, ty, { align: "right" });

  // Footnote
  ty += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Generated on ${fmtDT(new Date())}. Figures include VAT at 16% where applicable. ` +
      `For queries email ${BRAND.email} quoting this account name.`,
    14,
    ty,
    { maxWidth: pw - 28 },
  );

  save(
    doc,
    `statement-${customer.name.replace(/\s+/g, "-").toLowerCase()}.pdf`,
    `${BRAND.name}  ·  Statement for ${customer.name}  ·  ${BRAND.site}`,
  );
}
