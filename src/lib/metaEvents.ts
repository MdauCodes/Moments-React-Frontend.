// The standard Meta events the storefront reports (docs/META_ADS_ATTRIBUTION_PLAN.md, Phase 2).
// One helper per event so call sites stay one line. Rules that hold for all of them:
// - `content_ids` are the product UUIDs (`id`), never SKUs — the public API has no SKU, and the
//   server-side Purchase and the catalogue feed use the same ids, so Meta can match them up.
// - `value` is in KES. For Purchase it is what the customer paid for the products, excluding
//   delivery (decision D4): total − shippingFee.
import { trackMeta } from "@/lib/metaPixel";

const CURRENCY = "KES";

interface Line {
  productId: string;
  quantity: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function contents(lines: Line[]) {
  return lines.map((l) => ({ id: l.productId, quantity: l.quantity }));
}

/** A product page was viewed. */
export function metaViewContent(p: {
  id: string;
  name: string;
  category?: string;
  price?: number | null;
}) {
  trackMeta("ViewContent", {
    content_type: "product",
    content_ids: [p.id],
    content_name: p.name,
    ...(p.category ? { content_category: p.category } : {}),
    ...(p.price != null ? { value: round2(p.price), currency: CURRENCY } : {}),
  });
}

/** Anything went into the cart, from any entry point (CartContext.addItem is the single hook). */
export function metaAddToCart(line: {
  productId: string;
  name: string;
  units: number;
  value: number;
}) {
  trackMeta("AddToCart", {
    content_type: "product",
    content_ids: [line.productId],
    content_name: line.name,
    contents: [{ id: line.productId, quantity: line.units }],
    value: round2(line.value),
    currency: CURRENCY,
  });
}

/** The checkout page opened with items in the cart. */
export function metaInitiateCheckout(lines: Line[], value: number) {
  if (lines.length === 0) return;
  trackMeta("InitiateCheckout", {
    content_type: "product",
    content_ids: lines.map((l) => l.productId),
    contents: contents(lines),
    num_items: lines.reduce((n, l) => n + l.quantity, 0),
    value: round2(value),
    currency: CURRENCY,
  });
}

const PURCHASED_KEY = "mpk_meta_purchased_v1";

/** Same id the server-side Conversions API event uses, so Meta counts the order once. */
export const purchaseEventId = (orderReference: string) => `purchase-${orderReference}`;

/**
 * Payment was confirmed in the browser. Sent at most once per order reference (remembered in
 * localStorage) so polling, refreshes and revisits can't double-report — and Meta also
 * de-duplicates on the event id. Orders confirmed later by staff (bank transfer, cash on
 * delivery) never pass through here; those are reported by the server instead.
 */
export function metaPurchase(order: { reference: string; value: number; lines: Line[] }) {
  try {
    const done: string[] = JSON.parse(window.localStorage.getItem(PURCHASED_KEY) ?? "[]");
    if (done.includes(order.reference)) return;
    window.localStorage.setItem(
      PURCHASED_KEY,
      JSON.stringify([...done, order.reference].slice(-30)),
    );
  } catch {
    /* storage unavailable — Meta's own de-duplication on the event id still applies */
  }
  trackMeta(
    "Purchase",
    {
      content_type: "product",
      content_ids: order.lines.map((l) => l.productId),
      contents: contents(order.lines),
      num_items: order.lines.reduce((n, l) => n + l.quantity, 0),
      value: round2(order.value),
      currency: CURRENCY,
      order_id: order.reference,
    },
    purchaseEventId(order.reference),
  );
}

/** An enquiry, quote request or contact form was submitted successfully. */
export function metaLead(formName: string) {
  trackMeta("Lead", { content_name: formName });
}

/** The visitor tapped a WhatsApp / call link. */
export function metaContact(channel: "whatsapp" | "phone") {
  trackMeta("Contact", { content_name: channel });
}
