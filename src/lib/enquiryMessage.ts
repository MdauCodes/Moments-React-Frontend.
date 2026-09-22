/**
 * One place that decides what an enquiry actually *says* when it lands in the CRM and in the
 * sales inbox, plus the Kenyan phone-number handling every enquiry form shares.
 *
 * ── Why the exact wording of these lines matters ─────────────────────────────────────────────
 * The Core CRM does not guess what a website enquiry is about: EnquiryReplyPlanService reads
 * plain "Label: value" lines back off the top of the message and uses them to pick the reply
 * template, the button label and the WhatsApp opener. It recognises exactly these labels:
 *
 *     Topic:                    -> matched against the ENQUIRY_TOPICS labels, verbatim
 *     Product:                  -> shown next to the topic on the lead page
 *     Preferred contact:        -> "Customer prefers: ..." (also accepts the older
 *                                  "Preferred contact method:")
 *     Page:                     -> stripped from the quoted text, not displayed
 *     Products:                 -> stripped
 *     Estimated monthly volume: -> stripped
 *     Required timeline:        -> stripped
 *     Artwork mentioned...:     -> stripped
 *
 * Anything it recognises is removed from the "customer's own words" quote it shows staff and
 * feeds to the AI drafter. So: keep these labels spelled exactly as they are, keep the topic
 * labels identical to ENQUIRY_TOPICS, and add new labels sparingly — a label the CRM does not
 * know about still reads fine, but it shows up inside that quote. The extra lines below are
 * therefore only emitted when the visitor actually filled them in, which in practice means bulk
 * and printing enquiries, where that detail is worth having in the quote anyway.
 *
 * Everything is plain text. The sales notification email HTML-escapes the message and turns
 * newlines into <br>, so one fact per line renders correctly there; never send HTML or rely on
 * runs of spaces for alignment.
 */

import { ENQUIRY_TOPICS, type EnquiryTopic } from "@/contexts/EnquiryContext";

/** How the visitor asked us to get back to them. The CRM shows this verbatim. */
export type ReplyVia = "whatsapp" | "call" | "email";

export const REPLY_OPTIONS: { code: ReplyVia; label: string }[] = [
  { code: "whatsapp", label: "WhatsApp" },
  { code: "call", label: "Call me" },
  { code: "email", label: "Email" },
];

export function replyViaLabel(code: ReplyVia): string {
  return REPLY_OPTIONS.find((r) => r.code === code)?.label ?? code;
}

export function topicLabel(code: EnquiryTopic): string {
  return ENQUIRY_TOPICS.find((t) => t.code === code)?.label ?? code;
}

// ── Kenyan phone numbers ────────────────────────────────────────────────────────────────────

/**
 * Accepts how people here actually type a number — 0712 345 678, 0112345678, 712345678,
 * 254712345678, +254 712 345 678 — and returns a single canonical +254 7XX XXX XXX form.
 * Returns null when it is not a number we recognise, so the caller can leave the visitor's own
 * text alone rather than mangling a legitimate foreign number.
 *
 * The result must stay inside the backend's own rule: ^[+0-9()\s-]{7,30}$ and 30 chars max.
 * "+254 712 345 678" is 16.
 */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  let local: string | null = null;

  if (/^\+?254\d{9}$/.test(digits)) {
    local = digits.slice(digits.length - 9);
  } else if (/^0\d{9}$/.test(digits)) {
    local = digits.slice(1);
  } else if (/^[17]\d{8}$/.test(digits)) {
    local = digits;
  }

  // Kenyan mobile numbers are 9 digits after the country code and start 7 (Safaricom/Airtel) or
  // 1 (the newer 01xx range). Anything else is left for the caller to treat as "not Kenyan".
  if (!local || !/^[17]\d{8}$/.test(local)) return null;
  return `+254 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/**
 * True when we can reach this number. A normalised Kenyan number always passes; so does a
 * plausible international one, because we sell to people outside Kenya too and should not
 * reject a number just because it is not local.
 */
export function phoneLooksReachable(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (normalizeKenyanPhone(trimmed)) return true;
  if (!/^[+0-9()\s-]{7,30}$/.test(trimmed)) return false;
  return (trimmed.match(/\d/g) ?? []).length >= 9;
}

/** The value we send: canonical when we recognise it, otherwise exactly what they typed. */
export function phoneForSubmission(input: string): string {
  return normalizeKenyanPhone(input) ?? input.trim();
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailLooksReal(input: string): boolean {
  return EMAIL_PATTERN.test(input.trim());
}

/**
 * What to tell someone when a submission did not go through. A rate limit is a "wait a moment",
 * a 4xx is "check what you typed", and anything else is "not your fault, here is another way" —
 * three different actions that all used to read as one vague apology.
 */
export function submitErrorMessage(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 429) {
    return "We have had a lot of messages from this connection in the last few minutes. Please wait a minute and send it again.";
  }
  if (status === 400 || status === 422) {
    return "Some of those details were not accepted. Please check your phone number and email, then try again.";
  }
  return "That did not go through — nothing you typed has been lost, so please try again.";
}

// ── The message itself ──────────────────────────────────────────────────────────────────────

export interface EnquiryProductRef {
  name: string;
  slug?: string;
  quantity?: number;
  size?: string;
}

export interface ComposeArgs {
  topic: EnquiryTopic;
  replyVia: ReplyVia;
  /** The page the enquiry started from, e.g. "/products/kraft-bags-medium". */
  pagePath?: string;
  /** A single product the enquiry is about (product page, product card). */
  product?: EnquiryProductRef;
  /** Several products (a basket carried into the form). */
  products?: EnquiryProductRef[];
  /** Optional structured detail — only emitted when the visitor filled it in. */
  quantity?: string;
  neededBy?: string;
  deliverTo?: string;
  company?: string;
  heardFrom?: string;
  /** What the visitor typed in their own words. */
  text: string;
}

function productLine(p: EnquiryProductRef): string {
  const bits = [p.name];
  if (p.size) bits.push(`(${p.size})`);
  if (p.quantity) bits.push(`x${p.quantity}`);
  return bits.join(" ");
}

function absoluteUrl(slug: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/products/${slug}`;
}

/**
 * Builds the labelled, scannable block staff read first, followed by the visitor's own words.
 * Blank values are skipped entirely so a two-line enquiry stays a two-line enquiry.
 */
export function composeEnquiryMessage(args: ComposeArgs): string {
  const lines: string[] = [`Topic: ${topicLabel(args.topic)}`];

  if (args.product) {
    const url = args.product.slug ? ` (${absoluteUrl(args.product.slug)})` : "";
    lines.push(`Product: ${productLine(args.product)}${url}`);
  }
  if (args.products?.length) {
    lines.push(`Products: ${args.products.map(productLine).join(", ")}`);
  }

  lines.push(`Preferred contact: ${replyViaLabel(args.replyVia)}`);

  // Only emitted when actually filled in — see the note at the top of this file about labels the
  // CRM does not yet strip from its quoted text.
  const optional: [string, string | undefined][] = [
    ["Quantity", args.quantity],
    ["Needed by", args.neededBy],
    ["Deliver to", args.deliverTo],
    ["Company", args.company],
    ["Heard about us via", args.heardFrom],
  ];
  for (const [label, value] of optional) {
    const v = value?.trim();
    if (v) lines.push(`${label}: ${v}`);
  }

  if (args.pagePath) lines.push(`Page: ${args.pagePath}`);

  const body = args.text.trim();
  if (body) lines.push("", body);

  return lines.join("\n");
}

/**
 * The `source` column (varchar(100)) doubles as the CRM's primary topic signal: it keys on the
 * `quick-enquiry:` prefix and the topic code that follows. Keep both intact.
 */
export function enquirySource(topic: EnquiryTopic): string {
  return `quick-enquiry:${topic}`;
}
