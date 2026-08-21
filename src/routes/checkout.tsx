import { Link, useNavigate } from "react-router-dom";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowLeft,
  X,
  Smartphone,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Loader2,
  Store,
  Truck,
  PackageCheck,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { useAuth, authFetch } from "@/contexts/AuthContext";
import { orderStore, type FulfillmentType, type CourierType } from "@/services/orderStore";
import { businessAccountApi } from "@/services/businessAccountApi";
import { referralStore } from "@/services/referralStore";
import { profileStore } from "@/services/profileStore";
import { apiUrl, apiFetch } from "@/config/api";
import { CountySelect } from "@/components/CountySelect";
import { AddressAutocompleteInput, type ResolvedAddress } from "@/components/AddressAutocompleteInput";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { PRIVACY_POLICY_VERSION } from "@/lib/policyVersion";
import { RewardDeliveryBanners, REWARD_BANNER_SPACER_CLASS } from "@/components/RewardDeliveryBanners";
import { QuickAddProductStrip } from "@/components/QuickAddProductStrip";
import { buildReceiptPdfBlob } from "@/lib/pdf";
import type { CustomerOrder } from "@/services/orderStore";
import { getDeliveryPartner } from "@/data/deliveryPartners";

const tumaBodaPartner = getDeliveryPartner("tumaboda");

/** Business-hours cutoff, hardcoded per the current rule: orders placed past 5pm are prepared
 *  and dispatched the next morning instead of same-day. Checked against Africa/Nairobi time
 *  explicitly (not the browser's local time) so this is correct regardless of where the
 *  customer's device thinks it is. */
function isAfterBusinessHours(): boolean {
  const nairobiHour = Number(
    new Intl.DateTimeFormat("en-KE", { hour: "numeric", hour12: false, timeZone: "Africa/Nairobi" }).format(new Date()),
  );
  return nairobiHour >= 17;
}

/**
 * Generates the tax invoice PDF client-side (same renderer as the self-serve download on the
 * track-orders page) and uploads it straight to Cloudinary while the customer's browser is still
 * here — the backend only ever hands out a short-lived signed upload slot, never sees the file.
 * Fire-and-forget: if anything fails (network drop, tab closed mid-upload), TaxDocumentService's
 * payment-webhook fallback regenerates the PDF server-side instead, so nothing is lost.
 */
async function uploadTaxInvoicePdf(order: CustomerOrder, uploadToken: string, buyerKraPin: string) {
  try {
    const blob = await buildReceiptPdfBlob({
      reference: order.reference,
      invoiceNumber: order.invoiceNumber,
      buyerKraPin: buyerKraPin || undefined,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress,
      city: order.city,
      county: order.county,
      currency: order.currency,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      discount: order.discount,
      taxableAmount: order.taxableAmount,
      grossTaxableAmount: order.grossTaxableAmount,
      vatAmount: order.vatAmount,
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentReference: order.paymentReference,
      receiptNumber: order.receiptNumber,
      fulfillmentType: order.fulfillmentType,
      courierServiceName: order.courierServiceName,
      items: order.items.map((it) => ({
        productName: it.productName,
        size: it.size,
        material: it.material,
        finish: it.finish,
        sku: it.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        lineTotal: it.lineTotal,
      })),
    });

    const sigRes = await fetch(
      apiUrl(`/api/v1/tax-documents/${encodeURIComponent(order.reference)}/upload-signature`),
      { headers: { "X-Upload-Token": uploadToken } },
    );
    if (!sigRes.ok) return;
    const sig = await sigRes.json();

    const form = new FormData();
    form.append("file", blob, `${sig.publicId}.pdf`);
    form.append("api_key", sig.apiKey);
    form.append("timestamp", String(sig.timestamp));
    form.append("signature", sig.signature);
    form.append("folder", sig.folder);
    form.append("public_id", sig.publicId);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/raw/upload`, {
      method: "POST",
      body: form,
    });
    if (!uploadRes.ok) return;
    const uploaded = await uploadRes.json();

    await fetch(apiUrl(`/api/v1/tax-documents/${encodeURIComponent(order.reference)}/complete`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: uploadToken,
        cloudinaryUrl: uploaded.secure_url,
        cloudinaryPublicId: uploaded.public_id,
      }),
    });
  } catch {
    // Silent — the payment-webhook fallback covers this order regardless.
  }
}



/** Only for guests — a logged-in account already gets real prefill from its saved profile
 *  (see the profileStore effect below). A guest who checked out before had nothing remembered
 *  at all; this closes that gap the same low-stakes way (name/email/phone/address only, nothing
 *  payment-related), without requiring an account. */
const GUEST_CHECKOUT_KEY = "mpk_guest_checkout_details_v1";

/** Everything the guest-checkout localStorage blob can carry — the plain contact/address fields
 *  passively prefill blank inputs (existing behavior), while `fulfillment`/`resolvedAddress` are
 *  only ever applied via the explicit "Use my saved details" one-tap shortcut (never silently, so
 *  a returning guest isn't auto-jumped into a delivery mode without choosing to). `resolvedAddress`
 *  is omitted for PICKUP orders (nothing to resolve) and for anything saved before this shortcut
 *  existed — those older blobs still work for the passive prefill, they just won't offer the
 *  one-tap shortcut until the guest's next checkout after this ships. */
type SavedGuestCheckoutDetails = {
  name?: string;
  email?: string;
  phone?: string;
  tumabodaPhone?: string;
  city?: string;
  county?: string;
  address?: string;
  postalCode?: string;
  fulfillment?: FulfillmentType;
  resolvedAddress?: ResolvedAddress | null;
};

const BRAND = "#1a472a";
const POLL_MS = 3000;
const MAX_POLLS = 20;
const TIMEOUT_MS = POLL_MS * MAX_POLLS;
const RESEND_AFTER_MS = 30_000;

type Step = "contact" | "delivery";
type PayState = "idle" | "sending" | "waiting" | "success" | "failed" | "timeout";

function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
}

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `+254${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function isValidKenyanPhone(p: string) {
  const trimmed = p.trim();
  if (/^07\d{8}$/.test(trimmed)) return true;
  const n = normalizePhone(trimmed);
  return /^\+2547\d{8}$/.test(n);
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ring)] focus:border-transparent transition";
const labelCls = "block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5";

/**
 * Scrolls a just-revealed section into view the moment its stage becomes "complete" — used across
 * the delivery step's accordion-style stages (fulfillment choice, address resolution, Manual
 * Delivery's two sections) so the customer lands on what's next instead of having to scroll
 * themselves. Edge-triggered off a ref, not the `complete` boolean directly, so it fires exactly
 * once per completion (not on every re-render while already complete) — and resets when a stage
 * is reopened via its own "Change"/"Edit" control, so completing it again re-scrolls too.
 */
function useScrollIntoViewOnComplete<T extends HTMLElement>(complete: boolean, ref: React.RefObject<T | null>) {
  const wasComplete = useRef(false);
  useEffect(() => {
    if (complete && !wasComplete.current) {
      wasComplete.current = true;
      const timer = setTimeout(() => {
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      return () => clearTimeout(timer);
    }
    if (!complete) wasComplete.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete]);
}

function CheckoutModal() {
  const { items, cartTotal, clearCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("contact");

  // Stable idempotency key for this checkout session — prevents duplicate orders on retry
  const idempotencyKey = useRef<string>(
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36),
  );

  // Fulfillment — null until the customer makes the pickup-vs-delivery choice; for "delivery",
  // it then resolves to TUMABODA_DELIVERY or MANUAL_DELIVERY automatically based on coverage
  // (see the effect below), or MANUAL_DELIVERY explicitly if they can't find their address.
  const [fulfillment, setFulfillment] = useState<FulfillmentType | null>(null);
  // Top-level gate: has the customer chosen "have it delivered" at all yet? Distinct from
  // `fulfillment` because "delivery chosen, but not yet resolved to Manual vs TumaBoda" is a
  // real intermediate state (waiting on county + coverage check).
  const [wantsDelivery, setWantsDelivery] = useState<boolean | null>(null);
  const [courierType, setCourierType] = useState<CourierType | "">("");
  const [courierServiceName, setCourierServiceName] = useState("");
  const [courierStageOrOffice, setCourierStageOrOffice] = useState("");
  // Set once the courier-suggestion autofill below actually fills something in, purely to show
  // the right copy ("based on past orders" vs. a general starting guess) — null otherwise.
  const [courierSuggestionSource, setCourierSuggestionSource] = useState<string | null>(null);

  // Contact / delivery
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Separate, manually-typed number specifically for TumaBoda to SMS/call the rider contact —
  // deliberately never pre-filled from `phone` above. The two can legitimately differ (M-Pesa
  // line vs. the number someone actually wants a rider calling), and having the customer type
  // this one themselves, for this stated purpose, is what makes "they consented to sharing this
  // number with TumaBoda" a real, defensible fact rather than an inferred one.
  const [tumabodaPhone, setTumabodaPhone] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");

  // Precise pin, required once TumaBoda is the resolved fulfillment — feeds dropoffLat/Lng for
  // TumaBoda's real-time quote and delivery creation. Deliberately doesn't try to derive `county`
  // from this: Google's formatted address string doesn't reliably map onto our 47-county list,
  // and a silent mismatch there would quietly break the coverage check. County stays a separate,
  // manual source of truth until the finer coverage-check follow-up (tracked separately) replaces it.
  const [addressText, setAddressText] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<ResolvedAddress | null>(null);
  // "Can't find your address? Pick your county instead" escape hatch — a real flag, not a
  // sentinel value stuffed into `county`, so it can't collide with a real county string.
  const [showCountyFallback, setShowCountyFallback] = useState(false);
  const [locatingMe, setLocatingMe] = useState(false);
  const [courierInfoExpanded, setCourierInfoExpanded] = useState(false);
  // Raw device fix from "Use my current location" — held here for explicit confirmation (GPS can
  // be wrong: indoors, VPN, stale cache) rather than being silently trusted or silently dropped
  // into the search box. Cleared once the customer confirms or rejects it.
  const [gpsFallback, setGpsFallback] = useState<{ description: string; latitude: number; longitude: number; county: string | null } | null>(null);
  // Live delivery-fee preview — debounced call to /api/v1/public/tumaboda/quote whenever the
  // resolved pin changes (see the effect below). Fails closed: an error here drops TumaBoda
  // back to Manual Delivery automatically rather than ever proceeding with a guessed fee.
  const [quotePreview, setQuotePreview] = useState<{
    mode: "UPFRONT" | "POD";
    feeKes: number;
  } | null>(null);
  const [quoteChecking, setQuoteChecking] = useState(false);
  const [quoteUnavailable, setQuoteUnavailable] = useState(false);

  // Gates the two sub-views of the "delivery" step: fulfillment/courier details form, then (once
  // confirmed) the payment screen — kept as its own separate step for clarity (found live:
  // merging it into one long scrolling page read as more cluttered, not more compact).
  const [detailsConfirmed, setDetailsConfirmed] = useState(false);
  const [etrRequested, setEtrRequested] = useState(false);
  const [documentsEmail, setDocumentsEmail] = useState("");
  const [taxInvoiceKraPin, setTaxInvoiceKraPin] = useState("");
  const [kraPinPrefilled, setKraPinPrefilled] = useState(false);
  // PayHero was cosmetic — an identical Daraja call under a different label — and has been
  // removed entirely. M-Pesa (Daraja) is the only gateway now.
  const paymentGateway = "MPESA" as const;

  // Promo code
  const [promoCode, setPromoCode] = useState("");
  const [promoChecking, setPromoChecking] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [autoApplied, setAutoApplied] = useState(false);
  // Business Account welcome code — auto-tried once the cart crosses its
  // minimum, but never overrides a code the customer typed in themselves,
  // and stays fully editable/removable so they can swap in a better one.
  const [welcomeCode, setWelcomeCode] = useState<string | null>(null);
  const welcomeCodeDismissed = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    businessAccountApi
      .getMine()
      .then((acc) => {
        if (acc?.status === "ACTIVE" && acc.welcomeCode) setWelcomeCode(acc.welcomeCode);
        if (acc?.kraPin) {
          setTaxInvoiceKraPin((prev) => prev || acc.kraPin!);
          setKraPinPrefilled(true);
        }
      })
      .catch(() => {});
  }, [isAuthenticated]);

  // Default the documents-delivery email to whatever the customer already typed in the contact
  // step the moment they tick the ETR box — still fully editable. Works for guests too: `email`
  // is collected in step 1 regardless of auth status, so there's no reason to make a guest
  // retype the same address a second time here.
  useEffect(() => {
    if (etrRequested && !documentsEmail && email.trim()) {
      setDocumentsEmail(email.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etrRequested]);

  // Silently (no toast/error) try the welcome code as soon as it qualifies —
  // the backend's own min-order-amount check is the source of truth for
  // "up to Ksh 5,000 or above", so nothing is hardcoded here. Re-checks on
  // every cart change so it also un-applies itself if the cart drops back
  // below the minimum — but never touches a code the customer typed in.
  useEffect(() => {
    if (!welcomeCode || welcomeCodeDismissed.current) return;
    if (appliedPromo && !autoApplied) return; // a manually-applied code wins, leave it alone
    if (promoCode.trim() && !appliedPromo) return; // customer is mid-typing their own code
    void tryApplyPromoCode(welcomeCode, { silent: true }).then((ok) => {
      setAutoApplied(ok);
      if (!ok) setAppliedPromo((prev) => (prev?.code === welcomeCode ? null : prev));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeCode, cartTotal]);

  async function tryApplyPromoCode(code: string, opts: { silent?: boolean } = {}): Promise<boolean> {
    if (!code) return false;
    setPromoChecking(true);
    if (!opts.silent) setPromoError(null);
    try {
      const res = await authFetch(apiUrl("/api/v1/checkout/validate-promo"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal: cartTotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedPromo({ code: data.code ?? code.toUpperCase(), discount: data.discountAmount ?? 0 });
        if (!opts.silent) toast.success("Promo code applied");
        return true;
      }
      if (!opts.silent) {
        setAppliedPromo(null);
        setPromoError(data.message ?? "Invalid promo code");
      }
      return false;
    } catch {
      if (!opts.silent) setPromoError("Couldn't check that code right now — try again");
      return false;
    } finally {
      setPromoChecking(false);
    }
  }

  async function applyPromoCode() {
    setAutoApplied(false);
    await tryApplyPromoCode(promoCode.trim());
  }

  function removePromoCode() {
    setAppliedPromo(null);
    setPromoCode("");
    setPromoError(null);
    setAutoApplied(false);
    welcomeCodeDismissed.current = true;
  }

  // Individual Shopper rewards points redemption
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);
  const [redeemInput, setRedeemInput] = useState("");
  const [appliedRedemption, setAppliedRedemption] = useState<{ points: number; discount: number } | null>(null);
  const [redeemChecking, setRedeemChecking] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  // Live "≈ KES X" hint while the customer is still typing — reuses the same
  // server-side preview the Apply button commits with, so the number they see
  // before applying and after applying is always consistent (real conversion
  // rate + redemption cap, not a duplicated client-side guess).
  const [previewDiscount, setPreviewDiscount] = useState<number | null>(null);
  const [previewCapped, setPreviewCapped] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    referralStore.getWallet().then((w) => setPointsBalance(w?.balance ?? 0)).catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    const points = parseInt(redeemInput, 10);
    if (!points || points <= 0 || appliedRedemption) {
      setPreviewDiscount(null);
      setPreviewCapped(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const preliminaryTotal = cartTotal + shippingFee - (appliedPromo?.discount ?? 0);
        const res = await authFetch(apiUrl("/api/v1/customer/referral/redeem/preview"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points, orderTotal: preliminaryTotal }),
        });
        if (!res.ok) {
          setPreviewDiscount(null);
          return;
        }
        const data = await res.json();
        setPreviewDiscount(data.appliedDiscountKes ?? null);
        setPreviewCapped(!!data.capped);
      } catch {
        setPreviewDiscount(null);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redeemInput, appliedRedemption]);

  // A points redemption's discount is computed against the order total at the moment
  // it's applied — if the promo code then changes (applied, removed, or swapped), that
  // discount is stale (computed off a total that no longer applies). Clear it and make
  // the customer re-apply, rather than silently showing a wrong number on screen.
  const prevPromoCodeRef = useRef<string | null>(null);
  // Tracks the last value the city auto-fill effect itself wrote, so the Manual Delivery
  // "Delivering to — Change" button can safely clear a still-unedited guess without ever
  // touching a value the customer typed or edited themselves.
  const lastCityGuessRef = useRef<string>("");
  // Same idea for the courier-suggestion autofill — lets a "Change" that picks a new address/town
  // clear a still-unedited suggestion (so the new town gets its own fresh lookup instead of being
  // silently blocked by leftover values from the previous one) without ever touching a courier
  // field the customer actually typed themselves.
  const lastCourierSuggestionRef = useRef<{ type: CourierType | ""; service: string; stage: string } | null>(null);

  // Scroll targets for the delivery step's accordion stages — see useScrollIntoViewOnComplete.
  const pickupSectionRef = useRef<HTMLDivElement>(null);
  const deliverySearchSectionRef = useRef<HTMLDivElement>(null);
  const coverageResultSectionRef = useRef<HTMLDivElement>(null);
  const manualSection2Ref = useRef<HTMLElement>(null);
  // Lets "Edit" on the collapsed Manual Delivery Section 1 summary reopen the full field set
  // without clearing the destination town that's already there.
  const [manualSection1ForceOpen, setManualSection1ForceOpen] = useState(false);
  // A returning guest's last checkout, full enough to offer the one-tap "Use my saved details"
  // shortcut — set on mount below, cleared once the shortcut is used or the guest starts
  // choosing manually so the banner doesn't linger after it's no longer relevant.
  const [savedGuestShortcut, setSavedGuestShortcut] = useState<SavedGuestCheckoutDetails | null>(null);
  useEffect(() => {
    const currentCode = appliedPromo?.code ?? null;
    if (prevPromoCodeRef.current !== currentCode && appliedRedemption) {
      setAppliedRedemption(null);
      setRedeemInput("");
      toast.info("Your promo code changed — please re-apply your Reward Coupons redemption.");
    }
    prevPromoCodeRef.current = currentCode;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedPromo?.code]);

  async function applyPointsRedemption() {
    const points = parseInt(redeemInput, 10);
    if (!points || points <= 0) {
      setRedeemError("Enter how many Reward Coupons to redeem");
      return;
    }
    setRedeemChecking(true);
    setRedeemError(null);
    try {
      const preliminaryTotal = cartTotal + shippingFee - (appliedPromo?.discount ?? 0);
      const res = await authFetch(apiUrl("/api/v1/customer/referral/redeem/preview"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points, orderTotal: preliminaryTotal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRedeemError(data.message ?? "Couldn't redeem those Reward Coupons");
        return;
      }
      setAppliedRedemption({ points, discount: data.appliedDiscountKes ?? 0 });
      if (data.capped) {
        toast.info(`Capped at the maximum redeemable for this order: KES ${data.appliedDiscountKes}`);
      } else {
        toast.success("Reward Coupons applied");
      }
    } catch {
      setRedeemError("Couldn't check that right now — try again");
    } finally {
      setRedeemChecking(false);
    }
  }

  function removePointsRedemption() {
    setAppliedRedemption(null);
    setRedeemInput("");
    setRedeemError(null);
  }

  // Destination-driven coverage check — resolves whether real-time-quoted courier delivery is
  // available for the chosen county. Never surfaced to the customer as a named partner, just
  // "Courier Delivery" vs the Manual Delivery fallback. Static-allowlist-backed for now.
  const [covered, setCovered] = useState<boolean | null>(null);
  const [coverageChecking, setCoverageChecking] = useState(false);

  useEffect(() => {
    if (!county.trim()) {
      setCovered(null);
      return;
    }
    let cancelled = false;
    setCoverageChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(apiUrl(`/api/v1/public/delivery-coverage?county=${encodeURIComponent(county.trim())}`));
        if (cancelled) return;
        const data = await res.json();
        setCovered(!!data.covered);
      } catch {
        if (!cancelled) setCovered(null);
      } finally {
        if (!cancelled) setCoverageChecking(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [county]);

  // Once "have it delivered" is chosen, resolve fulfillment automatically from the coverage
  // check: first resolution picks TumaBoda (covered) or Manual (not covered); if the customer
  // then changes county away from a covered area, correct back to Manual so they're never left
  // on an option that just disappeared. Doesn't fight a manual override the other way (e.g. the
  // "can't find your address, switch to Courier" escape hatch below) — that's a deliberate choice,
  // not a resolution artifact, so it's left alone unless the county itself changes.
  useEffect(() => {
    if (wantsDelivery !== true) return;
    if (covered === true && fulfillment === null) setFulfillment("TUMABODA_DELIVERY");
    else if (covered === false && fulfillment === null) setFulfillment("MANUAL_DELIVERY");
    else if (covered === false && fulfillment === "TUMABODA_DELIVERY") setFulfillment("MANUAL_DELIVERY");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [covered, wantsDelivery]);

  // Manual Delivery's own "Destination town" field used to always start blank, even when the
  // customer had already searched and picked a real address up above (just one that wasn't
  // TumaBoda-covered) — forcing them to type the same town a second time. Only fills a still-
  // blank field, same "never overwrite what's typed" rule as every other auto-fill in this file.
  // Also covers the "pick your county instead" escape hatch: a customer who lands there is
  // typically genuinely upcountry (their real town didn't resolve via the Nairobi-biased address
  // search at all), so without this they'd pick e.g. "Nyeri" from the county dropdown and then
  // have to type "Nyeri" again right below as the destination town — the same real duplicate-entry
  // problem this effect already exists to prevent for the resolved-address path.
  useEffect(() => {
    if (fulfillment !== "MANUAL_DELIVERY" || city.trim()) return;
    const guess = resolvedAddress ? resolvedAddress.description.split(",")[0]?.trim() : county.trim();
    if (guess) {
      setCity(guess);
      lastCityGuessRef.current = guess;
    }
  }, [fulfillment, resolvedAddress, county, city]);

  // Courier-autofill "learning system" — once a destination town is known, ask the backend what
  // courier real past orders to that town actually used (falls back to a general seeded route
  // guess if no history exists yet). Only fills fields still blank, same rule as every other
  // autofill here; a value the customer already picked/typed is never touched, and this never
  // re-fires just because those fields later get filled (they're deliberately left out of the
  // dependency array below — only `city`/`fulfillment` changing should trigger a fresh lookup).
  useEffect(() => {
    if (fulfillment !== "MANUAL_DELIVERY" || !city.trim()) return;
    if (courierType || courierServiceName.trim() || courierStageOrOffice.trim()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/v1/public/courier-suggestion?town=${encodeURIComponent(city.trim())}`);
        if (cancelled || res.status === 204 || !res.ok) return;
        const suggestion = await res.json();
        if (cancelled) return;
        setCourierType((prev) => prev || suggestion.courierType || "");
        setCourierServiceName((prev) => prev || suggestion.courierServiceName || "");
        setCourierStageOrOffice((prev) => prev || suggestion.courierStageOrOffice || "");
        setCourierSuggestionSource(suggestion.source ?? null);
        lastCourierSuggestionRef.current = {
          type: suggestion.courierType ?? "",
          service: suggestion.courierServiceName ?? "",
          stage: suggestion.courierStageOrOffice ?? "",
        };
      } catch {
        // Best-effort suggestion — silent failure, customer just fills Section 2 in themselves.
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillment, city]);

  // Accordion-style auto-scroll for the delivery step — see useScrollIntoViewOnComplete's own
  // Javadoc-style comment above. One call per stage; each only fires once per completion.
  useScrollIntoViewOnComplete(fulfillment === "PICKUP", pickupSectionRef);
  useScrollIntoViewOnComplete(wantsDelivery === true, deliverySearchSectionRef);
  useScrollIntoViewOnComplete(Boolean(resolvedAddress) || showCountyFallback, coverageResultSectionRef);
  useScrollIntoViewOnComplete(
    fulfillment === "MANUAL_DELIVERY" && city.trim().length > 0,
    manualSection2Ref,
  );

  // Live delivery-fee preview — fires whenever the resolved pin changes, so the customer sees
  // the real fee before committing rather than only finding out at final checkout. Fails
  // CLOSED on any error: TumaBoda is auto-dropped back to Manual Delivery, never left showing a
  // guessed or stale fee. contactReady is just `name` — the quote request needs no phone number
  // at all (the M-Pesa phone isn't even collected until the later payment screen).
  const contactReady = Boolean(name.trim());
  useEffect(() => {
    // cartTotal drops to 0 the moment a successful order clears the cart (see the payment-success
    // handler below), while this page is still mounted for its 1.2s redirect delay — without this
    // guard, that transient zero total re-fires a quote request TumaBoda correctly rejects
    // (goodsValueKes must be positive), which then flips fulfillment to Manual Delivery and pops
    // an error toast right after the customer just saw a success state.
    if (fulfillment !== "TUMABODA_DELIVERY" || !resolvedAddress || !contactReady || cartTotal <= 0) {
      setQuotePreview(null);
      setQuoteUnavailable(false);
      return;
    }
    let cancelled = false;
    setQuoteChecking(true);
    setQuoteUnavailable(false);
    const t = setTimeout(async () => {
      try {
        // POST body rather than a query string — this carries the customer's name and location,
        // which shouldn't land in access logs, browser history, or Referer headers.
        const res = await fetch(apiUrl(`/api/v1/public/tumaboda/quote`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: resolvedAddress.latitude,
            lng: resolvedAddress.longitude,
            subtotal: cartTotal,
            contactName: name.trim(),
            location: resolvedAddress.description ?? "",
          }),
        });
        if (cancelled) return;
        const data = await res.json();
        if (data.available) {
          setQuotePreview({ mode: data.mode, feeKes: Number(data.customerFacingFeeKes) });
          setQuoteUnavailable(false);
        } else {
          setQuotePreview(null);
          setQuoteUnavailable(true);
          setFulfillment("MANUAL_DELIVERY");
          toast.error(data.message || "TumaBoda delivery isn't available right now — switched to Manual Delivery.");
        }
      } catch {
        if (cancelled) return;
        setQuotePreview(null);
        setQuoteUnavailable(true);
        setFulfillment("MANUAL_DELIVERY");
        toast.error("TumaBoda delivery isn't available right now — switched to Manual Delivery.");
      } finally {
        if (!cancelled) setQuoteChecking(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fulfillment, resolvedAddress, cartTotal, contactReady]);

  // Payment state
  const [payState, setPayState] = useState<PayState>("idle");
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const [consent, setConsent] = useState(false);

  const timersRef = useRef<{
    poll?: ReturnType<typeof setTimeout>;
    timeout?: ReturnType<typeof setTimeout>;
    resend?: ReturnType<typeof setTimeout>;
  }>({});

  useEffect(() => {
    if (user) {
      setName(`${user.firstName} ${user.lastName}`.trim());
      setEmail(user.email);
    }
  }, [user]);

  // Most customers want TumaBoda's rider calling the same number they're paying with — once
  // they've typed it once (for TumaBoda), don't make them retype it again for M-Pesa. Only fills
  // an still-blank phone field, so a customer who wants a different M-Pesa number is never
  // overwritten after typing one.
  useEffect(() => {
    if (fulfillment === "TUMABODA_DELIVERY" && tumabodaPhone.trim() && !phone.trim()) {
      setPhone(tumabodaPhone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tumabodaPhone, fulfillment]);

  // Saved-address reuse — prefill from the account's default address so a returning customer
  // isn't retyping the same details every order. Only fills blank fields, never overwrites
  // something the customer already typed. profileStore's CustomerAddress has no county field
  // today, so county still needs picking manually — a real, known limitation, not an oversight.
  useEffect(() => {
    if (!isAuthenticated) return;
    profileStore
      .get()
      .then(({ profile }) => {
        const defaultAddr = profile.addresses.find((a) => a.isDefault) ?? profile.addresses[0];
        if (!defaultAddr) return;
        setPhone((prev) => prev || defaultAddr.phone || "");
        setTumabodaPhone((prev) => prev || defaultAddr.phone || "");
        setCity((prev) => prev || defaultAddr.city || "");
        setAddress((prev) => prev || defaultAddr.line1 || "");
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Guest counterpart to the profileStore prefill above — same "only fill blank fields" rule,
  // just sourced from this browser's own last checkout instead of an account. See
  // GUEST_CHECKOUT_KEY and the save-on-success effect near payment completion below.
  useEffect(() => {
    if (isAuthenticated) return;
    try {
      const raw = localStorage.getItem(GUEST_CHECKOUT_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedGuestCheckoutDetails;
      setName((prev) => prev || saved.name || "");
      setEmail((prev) => prev || saved.email || "");
      setPhone((prev) => prev || saved.phone || "");
      setTumabodaPhone((prev) => prev || saved.phone || saved.tumabodaPhone || "");
      setCity((prev) => prev || saved.city || "");
      setCounty((prev) => prev || saved.county || "");
      setAddress((prev) => prev || saved.address || "");
      // Only offer the one-tap shortcut when there's actually a full delivery mode to restore —
      // PICKUP needs nothing further, a delivery mode needs its resolved address too (see the
      // type's own comment on why this can be absent for older saved blobs).
      if (saved.fulfillment === "PICKUP" || (saved.fulfillment && saved.resolvedAddress)) {
        setSavedGuestShortcut(saved);
      }
    } catch {
      // Corrupt/blocked storage — just skip prefill, nothing to recover.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (items.length === 0 && payState === "idle") {
      navigate("/cart", { replace: true });
    }
  }, [items.length, navigate, payState]);

  useEffect(() => () => clearAllTimers(), []);

  function clearAllTimers() {
    const t = timersRef.current;
    if (t.poll) clearTimeout(t.poll);
    if (t.timeout) clearTimeout(t.timeout);
    if (t.resend) clearTimeout(t.resend);
    timersRef.current = {};
  }

  function close() {
    clearAllTimers();
    navigate("/cart");
  }

  function validateContactInfo(): boolean {
    if (!name.trim() || !email.trim()) {
      toast.error("Please fill all required fields");
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Enter a valid email");
      return false;
    }
    return true;
  }

  function handleContactSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateContactInfo()) return;
    setStep("delivery");
  }

  function validateDeliveryDetails(): boolean {
    if (!fulfillment) {
      toast.error("Please choose pickup or delivery");
      return false;
    }
    if (fulfillment !== "PICKUP" && !county.trim()) {
      toast.error("Please select where you'd like your order delivered");
      return false;
    }
    // TumaBoda needs real coordinates to book a rider — a county alone isn't enough. Without this
    // gate, an order could be placed and paid as "Fulfilled by TumaBoda" with no way for the
    // backend to actually create the delivery (createTumaBodaDelivery silently skips when
    // deliveryLat/Lng are null), leaving a paid order with no rider ever dispatched.
    if (fulfillment === "TUMABODA_DELIVERY" && !resolvedAddress) {
      toast.error("Please pin your exact delivery address so we can book your TumaBoda rider");
      return false;
    }
    // Fail closed here too, not just in the effect: never let the customer proceed to payment
    // on a still-loading, failed, or stale-from-a-previous-address quote.
    if (fulfillment === "TUMABODA_DELIVERY" && (quoteChecking || !quotePreview)) {
      toast.error("Please wait for the delivery fee to finish calculating.");
      return false;
    }
    if (fulfillment === "MANUAL_DELIVERY") {
      if (!city.trim()) {
        toast.error("Please fill in the destination town");
        return false;
      }
      if (!courierType) {
        toast.error("Please select a courier type (sacco, parcel service, rider, etc.)");
        return false;
      }
      if (!courierServiceName.trim()) {
        toast.error(
          "Please specify the sacco / courier service name (e.g. 2NK, Easy Coach, Tahmeed). If unsure, type 'Not sure — call me'.",
        );
        return false;
      }
    }
    if (etrRequested && !/^\S+@\S+\.\S+$/.test(documentsEmail.trim())) {
      toast.error("Enter a valid email to receive your receipt, tax invoice and ETR");
      return false;
    }
    if (fulfillment === "TUMABODA_DELIVERY" && !isValidKenyanPhone(tumabodaPhone)) {
      toast.error("Please enter the phone number TumaBoda's rider should contact for this delivery");
      return false;
    }
    return true;
  }

  function handleDeliveryDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateDeliveryDetails()) return;
    if (!consent) {
      toast.error("Please tick the consent box to continue");
      return;
    }
    setDetailsConfirmed(true);
  }

  // Clears an untouched courier suggestion so a new address/town gets its own fresh lookup
  // instead of being silently blocked by leftover values from the previous one — same reasoning
  // as the city-guess clearing already done on these same "Change" buttons.
  function clearUntouchedCourierSuggestion() {
    const s = lastCourierSuggestionRef.current;
    if (!s) return;
    if (courierType === s.type && courierServiceName.trim() === s.service && courierStageOrOffice.trim() === s.stage) {
      setCourierType("");
      setCourierServiceName("");
      setCourierStageOrOffice("");
      setCourierSuggestionSource(null);
      lastCourierSuggestionRef.current = null;
    }
  }

  // One-tap "Use my saved details" — restores a returning guest's last checkout in a single
  // action instead of them re-picking Pickup/Delivery and re-searching an address they've already
  // given us before. Deliberately does NOT force the old fulfillment mode back for a delivery
  // order: only the resolved address/county are restored, and the existing coverage-check +
  // auto-resolve effects pick TumaBoda vs Manual fresh from that — coverage can genuinely change
  // between visits, so re-deciding it is more correct than trusting a stale prior choice.
  function applySavedGuestDetails() {
    const saved = savedGuestShortcut;
    if (!saved) return;
    setName((prev) => prev || saved.name || "");
    setEmail((prev) => prev || saved.email || "");
    setPhone((prev) => prev || saved.phone || "");
    setTumabodaPhone((prev) => prev || saved.tumabodaPhone || saved.phone || "");
    if (saved.postalCode) setPostalCode((prev) => prev || saved.postalCode || "");
    if (saved.fulfillment === "PICKUP") {
      setWantsDelivery(false);
      setFulfillment("PICKUP");
    } else if (saved.resolvedAddress) {
      setWantsDelivery(true);
      setResolvedAddress(saved.resolvedAddress);
      setAddressText(saved.resolvedAddress.description);
      if (saved.county) setCounty(saved.county);
      if (saved.city) setCity((prev) => prev || saved.city || "");
      if (saved.address) setAddress((prev) => prev || saved.address || "");
    }
    setSavedGuestShortcut(null);
  }

  async function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Your browser doesn't support location detection — please search your address instead.");
      return;
    }
    setLocatingMe(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let description = "Current location (approximate)";
        let county: string | null = null;
        try {
          const res = await apiFetch(
            `/api/v1/public/tumaboda/maps/reverse-geocode?lat=${latitude}&lng=${longitude}`,
          );
          if (res.ok) {
            const details = await res.json();
            if (details?.formattedAddress) description = details.formattedAddress;
            // The backend already best-effort-matches a county for this pin (nearest seeded
            // area) — carry it through so a GPS-resolved address doesn't need it re-asked,
            // same as a searched address already does via fetchPlaceDetails.
            if (details?.county) county = details.county;
          }
        } catch {
          // Reverse-geocode failed — still proceed with the raw coordinates below.
        }
        // Never lock the raw device fix straight in as the delivery point — GPS can be wrong
        // (indoors, VPN, stale cache). Surface it for the customer to explicitly confirm or reject
        // first; only a "yes" commits it as resolvedAddress.
        setGpsFallback({ description, latitude, longitude, county });
        setLocatingMe(false);
      },
      () => {
        setLocatingMe(false);
        toast.error("Couldn't access your location — please search for your address instead, or select your county below.");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function startPayment() {
    // fulfillment is only null before the customer reaches this point — handleDeliveryDetailsSubmit
    // already validated it's set before detailsConfirmed (and thus the Pay button) is reachable.
    if (!fulfillment) return;
    setErrorMsg(null);
    setPayState("sending");
    const phoneNormalized = normalizePhone(phone);

    const deliveryLocationText =
      fulfillment === "TUMABODA_DELIVERY" ? resolvedAddress?.description ?? "" : address.trim();

    try {
      let id = orderId;
      let ref = orderRef;

      if (!id) {
        const { order } = await orderStore.placeOrder({
          items,
          customer: {
            name: name.trim(),
            email: email.trim(),
            phone: phoneNormalized,
            address: fulfillment === "PICKUP" ? "" : deliveryLocationText,
            city: fulfillment === "PICKUP" ? "" : city.trim(),
            county: fulfillment === "PICKUP" ? "" : county.trim(),
            postalCode: postalCode.trim() || undefined,
          },
          shippingFee,
          paymentMethod: paymentGateway,
          fulfillmentType: fulfillment,
          idempotencyKey: idempotencyKey.current,
          consentPolicyVersion: PRIVACY_POLICY_VERSION,
          promoCode: appliedPromo?.code,
          redeemPoints: appliedRedemption?.points,
          etrRequested,
          documentsEmail: etrRequested ? documentsEmail.trim() : undefined,
          taxInvoiceKraPin: taxInvoiceKraPin.trim() || undefined,
          dropoffLat: fulfillment !== "PICKUP" ? resolvedAddress?.latitude ?? undefined : undefined,
          dropoffLng: fulfillment !== "PICKUP" ? resolvedAddress?.longitude ?? undefined : undefined,
          tumabodaContactPhone:
            fulfillment === "TUMABODA_DELIVERY" ? normalizePhone(tumabodaPhone) : undefined,
          ...(fulfillment === "MANUAL_DELIVERY" && courierType
            ? {
                courierType: courierType as CourierType,
                courierServiceName: courierServiceName.trim() || undefined,
                courierStageOrOffice: courierStageOrOffice.trim() || undefined,
              }
            : {}),
        });
        id = order.id ?? order.reference;
        ref = order.reference;
        setOrderId(id);
        setOrderRef(ref);
        if (etrRequested) {
          toast.success(`Your receipt, tax invoice and ETR will be emailed to ${documentsEmail.trim()} once we've uploaded your ETR.`);
          if (order.taxInvoiceUploadToken) {
            void uploadTaxInvoicePdf(order, order.taxInvoiceUploadToken, taxInvoiceKraPin.trim());
          }
        }
      }

      if (!id) {
        setPayState("failed");
        setErrorMsg("Could not create order — please try again.");
        return;
      }
      const init = await orderStore.startMpesaStk(id, phoneNormalized, paymentGateway);

      if (!init.success) {
        setPayState("failed");
        setErrorMsg(init.message ?? "Could not send the M-Pesa prompt. Please try again.");
        return;
      }

      enterWaiting(id, ref!);
    } catch (err) {
      setPayState("failed");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  function enterWaiting(id: string, ref: string) {
    setPayState("waiting");
    setShowResend(false);
    clearAllTimers();

    timersRef.current.resend = setTimeout(() => setShowResend(true), RESEND_AFTER_MS);
    timersRef.current.timeout = setTimeout(() => {
      clearAllTimers();
      setPayState("timeout");
    }, TIMEOUT_MS);

    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      const res = await orderStore.getPaymentStatus(id);
      if (res.status === "SUCCESS") {
        clearAllTimers();
        setPayState("success");
        clearCart();
        if (!isAuthenticated) {
          try {
            const toSave: SavedGuestCheckoutDetails = {
              name, email, phone, tumabodaPhone, city, county, address, postalCode, fulfillment: fulfillment ?? undefined,
            };
            // Only worth restoring for a delivery mode if there's a real resolved address to go
            // with it — without one (e.g. the "pick your county instead" escape hatch), the
            // one-tap shortcut would have nothing to actually skip past.
            if (fulfillment && fulfillment !== "PICKUP" && resolvedAddress) {
              toSave.resolvedAddress = resolvedAddress;
            }
            localStorage.setItem(GUEST_CHECKOUT_KEY, JSON.stringify(toSave));
          } catch {
            // Storage full/blocked — losing this prefill-for-next-time is harmless, order already succeeded.
          }
        }
        if (isAfterBusinessHours()) {
          toast.info("We're closed for the night", {
            description:
              "Your order will be prepared first thing tomorrow morning — you'll get an email and SMS the moment it's dispatched.",
            duration: 15000,
          });
        }
        setTimeout(() => {
          navigate(`/order-confirmation?ref=${ref}`);
        }, 1200);
        return;
      }
      if (res.status === "FAILED") {
        clearAllTimers();
        setErrorMsg(res.message ?? "Payment was not completed.");
        setPayState("failed");
        return;
      }
      if (attempts >= MAX_POLLS) {
        clearAllTimers();
        setPayState("timeout");
        return;
      }
      timersRef.current.poll = setTimeout(poll, POLL_MS);
    };
    timersRef.current.poll = setTimeout(poll, POLL_MS);
  }

  async function resendPrompt() {
    if (!orderId) return;
    setShowResend(false);
    const phoneNormalized = normalizePhone(phone);
    const init = await orderStore.startMpesaStk(orderId, phoneNormalized, paymentGateway);
    if (!init.success) {
      toast.error(init.message ?? "Could not resend the prompt.");
      setShowResend(true);
      return;
    }
    toast.success("New M-Pesa prompt sent.");
    timersRef.current.resend = setTimeout(() => setShowResend(true), RESEND_AFTER_MS);
  }

  if (items.length === 0 && payState === "idle") return null;

  // UPFRONT TumaBoda: real quote gets added to the charge. POD: rider collects at the door, so
  // Moments never charges it here — deliberately zero regardless of quotePreview, matching the
  // backend's own POD-vs-upfront split (CheckoutService.checkout).
  const shippingFee =
    fulfillment === "TUMABODA_DELIVERY" && quotePreview?.mode === "UPFRONT" ? quotePreview.feeKes : 0;
  const total = cartTotal + shippingFee - (appliedPromo?.discount ?? 0) - (appliedRedemption?.discount ?? 0);
  const shippingLabel =
    fulfillment === "PICKUP"
      ? "Pickup at shop"
      : fulfillment === "TUMABODA_DELIVERY"
        ? "Fulfilled by TumaBoda"
        : "Courier — to be confirmed";
  const shippingValue =
    fulfillment === "PICKUP"
      ? "Free"
      : fulfillment === "TUMABODA_DELIVERY"
        ? quotePreview
          ? quotePreview.mode === "POD"
            ? `${fmt(quotePreview.feeKes)} on delivery`
            : fmt(quotePreview.feeKes)
          : quoteChecking
            ? "Calculating…"
            : "Pending"
        : "To be confirmed";

  const brandStyle = { ["--brand-ring" as string]: BRAND } as React.CSSProperties;
  const deliveryChoiceMade = fulfillment === "PICKUP" || wantsDelivery === true;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-background"
      style={brandStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Checkout"
    >
      {/* Header */}
      <header
        className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-8"
        style={{ backgroundColor: BRAND }}
      >
        <div className="flex items-center gap-3 text-white">
          <ShieldCheck className="h-5 w-5" />
          <span className="font-display text-lg sm:text-xl">Secure checkout</span>
        </div>
        <button
          type="button"
          onClick={close}
          className="rounded-full p-2 text-white/90 transition hover:bg-white/10"
          aria-label="Close checkout"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {/* Step indicator */}
      <div className="border-b border-border bg-card/50">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-3 px-4 py-3 text-xs sm:text-sm">
          <StepDot active={step === "contact"} done={step !== "contact"} label="1. Contact" />
          <span className="h-px w-6 bg-border sm:w-16" />
          <StepDot active={step === "delivery"} done={false} label="2. Delivery & payment" />
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
          <RewardDeliveryBanners topOffsetClassName="top-[104px]" />
          <div className={`mb-4 ${REWARD_BANNER_SPACER_CLASS}`} aria-hidden="true" />
          {step === "contact" && (
            <form onSubmit={handleContactSubmit} className="space-y-5">
              <div>
                <h2 className="font-display text-2xl text-foreground">Let's get your order to you</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isAuthenticated ? (
                    "A few details, then tell us where — we'll show you what's available."
                  ) : (
                    <>
                      Checking out as a guest.{" "}
                      <Link
                        to="/account/login?redirect=/checkout"
                        className="font-semibold underline"
                        style={{ color: BRAND }}
                      >
                        Sign in
                      </Link>{" "}
                      for faster checkout next time.
                    </>
                  )}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Full name</label>
                  <input
                    className={inputCls}
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Wanjiru"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                {/* Phone numbers are collected later — the TumaBoda delivery-contact number (for
                    orders that need one) on the delivery-details step, and the M-Pesa number on
                    its own payment step right after, pre-filled from whichever TumaBoda number
                    was already typed since most customers use the same line for both. See those
                    two steps for both fields. */}
              </div>

              <button
                type="submit"
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90"
                style={{ backgroundColor: BRAND }}
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {step === "delivery" && !detailsConfirmed && payState === "idle" && (
            <>
            <form onSubmit={handleDeliveryDetailsSubmit} className="space-y-5">
              <button
                type="button"
                onClick={() => setStep("contact")}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>

              <div>
                <h2 className="font-display text-2xl text-foreground">How should we get your order to you?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pick one to see what we need from there.</p>
              </div>

              {/* One-tap shortcut for a returning guest — see applySavedGuestDetails. Only shown
                  before anything's been chosen yet, so it can't linger after it's no longer
                  relevant. */}
              {savedGuestShortcut && !deliveryChoiceMade && !resolvedAddress && !showCountyFallback && (
                <div className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm" style={{ borderColor: BRAND, backgroundColor: `${BRAND}0d` }}>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">Use your details from last time?</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {savedGuestShortcut.fulfillment === "PICKUP"
                        ? "Pick up at our shop"
                        : savedGuestShortcut.resolvedAddress?.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={applySavedGuestDetails}
                    className="shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-white"
                    style={{ backgroundColor: BRAND }}
                  >
                    Use these
                  </button>
                </div>
              )}

              {/* Step 1 of this page: pickup vs. delivery, always asked first — everything else
                  below reveals progressively based on this and, for delivery, the destination.
                  Collapses to a one-line summary once chosen, same accordion pattern as the
                  address/Manual-Delivery stages below, so the page doesn't keep showing a
                  decision that's already made. */}
              {deliveryChoiceMade ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      How should we get your order to you?
                    </p>
                    <p className="truncate font-medium text-foreground">
                      {fulfillment === "PICKUP" ? "Pick up at our shop" : "Have it delivered"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWantsDelivery(null);
                      setFulfillment(null);
                      setResolvedAddress(null);
                      setAddressText("");
                      setGpsFallback(null);
                      setCounty("");
                      setShowCountyFallback(false);
                      if (city.trim() && city.trim() === lastCityGuessRef.current) setCity("");
                      clearUntouchedCourierSuggestion();
                    }}
                    className="shrink-0 text-xs font-semibold underline underline-offset-2"
                  >
                    Change
                  </button>
                </div>
              ) : (
                // Reaching this branch already means neither choice is made yet (that's what
                // !deliveryChoiceMade means), so neither card can legitimately be "active" here —
                // the collapsed summary above takes over as soon as one is.
                <div className="grid gap-3 sm:grid-cols-2">
                  <FulfillmentCard
                    active={false}
                    onClick={() => {
                      setWantsDelivery(false);
                      setFulfillment("PICKUP");
                    }}
                    icon={<Store className="h-5 w-5" />}
                    title="Pick Up at Shop"
                    desc="Collect from our shop — no delivery fee."
                  />
                  <FulfillmentCard
                    active={false}
                    onClick={() => {
                      setWantsDelivery(true);
                      setFulfillment(null);
                    }}
                    icon={<Truck className="h-5 w-5" />}
                    title="Have it Delivered"
                    desc="Tell us where — we'll show you what's available there."
                  />
                </div>
              )}

              {wantsDelivery === true && (
                <div ref={deliverySearchSectionRef} className="space-y-4">
                  {/* Location asked ONCE, first — coverage (TumaBoda vs Courier) resolves FROM
                      this, instead of a blind county question deciding it beforehand. Current
                      location is the primary action (fastest path); search is the alternative. */}
                  {!resolvedAddress && !showCountyFallback && (
                    <div>
                      <label className={labelCls}>
                        Where should we deliver? <span className="text-destructive">*</span>
                      </label>
                      <p className="mb-2 mt-1 text-xs text-muted-foreground">
                        Search your address or use your current location — we'll show you what's available there.
                        Tip: a single landmark or area name (e.g. "Yaya Center") often finds it faster than a full
                        address.
                      </p>
                      <button
                        type="button"
                        onClick={useMyLocation}
                        disabled={locatingMe}
                        className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                        style={{ backgroundColor: BRAND }}
                      >
                        <Truck className="h-4 w-4" /> {locatingMe ? "Locating…" : "Use my current location"}
                      </button>
                      {gpsFallback ? (
                        <GpsConfirmPrompt
                          description={gpsFallback.description}
                          onConfirm={() => {
                            setResolvedAddress({
                              description: gpsFallback.description,
                              placeId: null,
                              latitude: gpsFallback.latitude,
                              longitude: gpsFallback.longitude,
                              county: gpsFallback.county,
                            });
                            setGpsFallback(null);
                          }}
                          onReject={() => setGpsFallback(null)}
                        />
                      ) : (
                        <AddressAutocompleteInput
                          value={addressText}
                          onChange={setAddressText}
                          onSelect={(addr) => {
                            setResolvedAddress(addr);
                            if (addr.county) setCounty(addr.county);
                          }}
                          placeholder="Start typing your delivery address…"
                          animatedPlaceholder
                        />
                      )}
                      <div className="mt-3 border-t border-border pt-3">
                        <button
                          type="button"
                          onClick={() => setShowCountyFallback(true)}
                          className="text-xs font-semibold text-foreground underline underline-offset-2"
                        >
                          Can't find your address? Pick your county instead →
                        </button>
                      </div>
                    </div>
                  )}

                  {(resolvedAddress || showCountyFallback) && (
                    <div ref={coverageResultSectionRef} className="space-y-4">
                      {/* County wasn't attached to the resolved address (TumaBoda's live proxy
                          didn't have a close-enough seeded-area match) or the customer skipped
                          straight to the county fallback above — confirm it before checking
                          coverage, rather than guessing. */}
                      {!county.trim() && (
                        <div>
                          <label className={labelCls}>
                            {resolvedAddress ? "Confirm your county" : "County"} <span className="text-destructive">*</span>
                          </label>
                          <CountySelect value={county} onChange={setCounty} placeholder="Select county…" />
                        </div>
                      )}

                      {coverageChecking && (
                        <p className="text-xs text-muted-foreground">Checking delivery options for your area…</p>
                      )}

                      {/* Resolved TumaBoda path — branded per the client's explicit call. Covered
                          areas default here; uncovered areas fall to Manual below instead. */}
                      {covered === true && fulfillment === "TUMABODA_DELIVERY" && (
                        <div className="relative overflow-hidden rounded-2xl border border-border text-sm">
                          {/* Real photo, not a logo/icon — a rider actually delivering reads as trust
                              far better than a mark, per the client's explicit call. Runs full-bleed
                              behind the whole card (not just a header strip) so it reads as the card's
                              background, not a thumbnail — the gradient keeps every line of text and
                              every field beneath it legible regardless of how tall the card grows. */}
                          {tumaBodaPartner && (
                            <img
                              src={tumaBodaPartner.photo}
                              alt={`${tumaBodaPartner.name} rider delivering`}
                              className="absolute inset-0 h-full w-full object-cover object-top"
                            />
                          )}
                          <div
                            className="absolute inset-0"
                            style={
                              tumaBodaPartner
                                ? {
                                    backgroundImage:
                                      "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.12) 14%, transparent 30%, transparent 30%, color-mix(in oklab, var(--background) 70%, transparent) 42%, var(--background) 50%)",
                                  }
                                : { backgroundColor: "hsl(var(--secondary) / 0.3)" }
                            }
                          />
                          <div className="relative">
                          {tumaBodaPartner ? (
                            // Extra top padding, not just the label's own height, so the photo gets a
                            // genuinely clear, unobstructed band before the fade starts (per client
                            // request — "clear at the top... fades as it goes downwards").
                            <div className="flex items-center gap-2 p-4 pb-28 sm:pb-32">
                              <span className="font-semibold text-white drop-shadow-sm">Fulfilled by TumaBoda</span>
                              <span
                                className="rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={{ color: BRAND }}
                              >
                                Doorstep
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-4 pb-0">
                              <Truck className="h-4 w-4" style={{ color: BRAND }} />
                              <span className="font-semibold text-foreground">Fulfilled by TumaBoda</span>
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                                style={{ backgroundColor: `${BRAND}1a`, color: BRAND }}
                              >
                                Doorstep
                              </span>
                            </div>
                          )}
                          <div className="px-4 pb-4">
                          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-3 text-sm">
                            <div className="min-w-0">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivering to</p>
                              <p className="truncate font-medium text-foreground">
                                {resolvedAddress?.description ?? county.trim() ?? ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setResolvedAddress(null);
                                setAddressText("");
                                setGpsFallback(null);
                                setCounty("");
                                setShowCountyFallback(false);
                                // A prior address may have already resolved fulfillment (e.g. to
                                // MANUAL_DELIVERY for an uncovered area) — without resetting this too,
                                // the auto-resolve effect below (gated on fulfillment === null) never
                                // fires again, so a second, covered address silently keeps the first
                                // address's fulfillment instead of re-resolving to TumaBoda.
                                setFulfillment(null);
                              }}
                              className="shrink-0 text-xs font-semibold underline underline-offset-2"
                            >
                              Change
                            </button>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-muted-foreground">Tracked delivery to your doorstep.</p>
                            <button
                              type="button"
                              onClick={() => setCourierInfoExpanded((v) => !v)}
                              className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-foreground underline underline-offset-2"
                            >
                              {courierInfoExpanded ? "Less" : "More"}
                              <ChevronDown
                                className={`h-3 w-3 transition-transform ${courierInfoExpanded ? "rotate-180" : ""}`}
                              />
                            </button>
                          </div>
                          {courierInfoExpanded && (
                            <p className="mt-1 text-muted-foreground">
                              A TumaBoda rider picks up your order and brings it straight to the address you pin
                              below. You'll see the exact delivery fee before you pay — pin your address to
                              calculate it.
                            </p>
                          )}

                          {resolvedAddress ? (
                            <div className="mt-3 space-y-3">
                              {/* Live delivery-fee preview — see the debounced quote effect above.
                                  Mode-specific copy directly answers "when am I charged for this". */}
                              <div className="rounded-xl border border-border bg-background/70 p-3 text-sm">
                                {quoteChecking ? (
                                  <p className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculating delivery fee…
                                  </p>
                                ) : quotePreview ? (
                                  quotePreview.mode === "POD" ? (
                                    <p>
                                      <span className="font-semibold text-foreground">
                                        Pay {fmt(quotePreview.feeKes)} via M-Pesa
                                      </span>{" "}
                                      when your rider arrives — not charged now.
                                    </p>
                                  ) : (
                                    <p>
                                      <span className="font-semibold text-foreground">
                                        {fmt(quotePreview.feeKes)} delivery fee
                                      </span>{" "}
                                      added to your total, paid now with the rest of your order.
                                    </p>
                                  )
                                ) : quoteUnavailable ? (
                                  <p className="text-destructive">
                                    TumaBoda delivery isn't available right now for this address.
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3">
                              <p className="mb-2 text-foreground/90">
                                <span className="font-semibold text-destructive">Required:</span> pin your exact
                                address so a rider can be sent to collect and deliver your order.
                              </p>
                              {gpsFallback ? (
                                <GpsConfirmPrompt
                                  description={gpsFallback.description}
                                  onConfirm={() => {
                                    setResolvedAddress({
                                      description: gpsFallback.description,
                                      placeId: null,
                                      latitude: gpsFallback.latitude,
                                      longitude: gpsFallback.longitude,
                                      county: gpsFallback.county,
                                    });
                                    setGpsFallback(null);
                                  }}
                                  onReject={() => setGpsFallback(null)}
                                />
                              ) : (
                                <>
                                  <AddressAutocompleteInput
                                    value={addressText}
                                    onChange={setAddressText}
                                    onSelect={(addr) => setResolvedAddress(addr)}
                                    placeholder="Start typing your delivery address…"
                                    animatedPlaceholder
                                  />
                                  <button
                                    type="button"
                                    onClick={useMyLocation}
                                    disabled={locatingMe}
                                    className="mt-2 text-xs font-semibold underline underline-offset-2 disabled:opacity-60"
                                    style={{ color: BRAND }}
                                  >
                                    {locatingMe ? "Locating…" : "Use my current location"}
                                  </button>
                                </>
                              )}
                              <div className="mt-3 border-t border-border pt-3">
                                <button
                                  type="button"
                                  onClick={() => setFulfillment("MANUAL_DELIVERY")}
                                  className="text-xs font-semibold text-foreground underline underline-offset-2"
                                >
                                  Can't find your address? Switch to Courier delivery instead →
                                </button>
                              </div>
                            </div>
                          )}
                          </div>
                          </div>
                        </div>
                      )}

                {fulfillment === "MANUAL_DELIVERY" && (
                  <div className="space-y-4">
                    {(resolvedAddress || county.trim()) && (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-3 text-sm">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Delivering to</p>
                          <p className="truncate font-medium text-foreground">
                            {resolvedAddress?.description ?? county.trim()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            // Same reset as the TumaBoda card's own "Change" button — clearing
                            // fulfillment too is what lets the auto-resolve effect above pick a
                            // fresh mode for whatever address/county comes next.
                            setResolvedAddress(null);
                            setAddressText("");
                            setGpsFallback(null);
                            setCounty("");
                            setShowCountyFallback(false);
                            setFulfillment(null);
                            // Only clear an untouched auto-fill guess — a city the customer typed
                            // or edited themselves is left alone even if it happens to still be
                            // the same text.
                            if (city.trim() && city.trim() === lastCityGuessRef.current) {
                              setCity("");
                            }
                            clearUntouchedCourierSuggestion();
                          }}
                          className="shrink-0 text-xs font-semibold underline underline-offset-2"
                        >
                          Change
                        </button>
                      </div>
                    )}
                    <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm leading-relaxed text-foreground/90">
                      <p>
                        <span className="font-semibold">How delivery works:</span> we hand your parcel to a{" "}
                        <span className="font-semibold">sacco or parcel service</span> (e.g. 2NK, 4NTE, Kukena, Easy
                        Coach, Tahmeed, G4S, Pickup Mtaani). They handle the transport to your town, and you collect it
                        from their office there.
                      </p>
                      <p className="mt-2 text-muted-foreground">
                        The two short sections below help us get your parcel to the right place quickly. If you're
                        unsure about anything, just leave it blank — our team will call you to confirm before dispatch.
                      </p>
                    </div>

                    {/* SECTION 1 — DESTINATION. Collapses to a one-line summary once the required
                        field is filled (often already auto-filled from the address searched
                        above) — "Edit" reopens the full field set without clearing anything. */}
                    {city.trim() && !manualSection1ForceOpen ? (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/60 p-3 text-sm">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Destination town</p>
                          <p className="truncate font-medium text-foreground">{city.trim()}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setManualSection1ForceOpen(true)}
                          className="shrink-0 text-xs font-semibold underline underline-offset-2"
                        >
                          Edit
                        </button>
                      </div>
                    ) : (
                      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                        <div className="mb-3 flex items-baseline justify-between gap-2">
                          <h3 className="font-display text-lg text-foreground">1. Where do you need it delivered?</h3>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Your side
                          </span>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="sm:col-span-2">
                            <label className={labelCls}>
                              Destination town <span className="text-destructive">*</span>
                            </label>
                            <input
                              className={inputCls}
                              required
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              placeholder="e.g. Nyeri, Meru, Eldoret"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelCls}>Nearest courier office to you (optional)</label>
                            <input
                              className={inputCls}
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              placeholder="e.g. 2NK Nyeri town office, Easy Coach Eldoret stage"
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                              The sacco / parcel office on <em>your</em> side where you'll pick up the parcel. Not
                              sure which one? Leave blank — we'll call to confirm with you.
                            </p>
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelCls}>Postal code (optional)</label>
                            <input
                              className={inputCls}
                              value={postalCode}
                              onChange={(e) => setPostalCode(e.target.value)}
                              placeholder="00100"
                            />
                          </div>
                        </div>
                      </section>
                    )}

                    {/* SECTION 2 — DISPATCH */}
                    <section ref={manualSection2Ref} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                      <div className="mb-3 flex items-baseline justify-between gap-2">
                        <h3 className="font-display text-lg text-foreground">
                          2. Do you have an idea of which sacco / courier office in Nairobi we should use? (this is
                          helpful to us)
                        </h3>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Our side
                        </span>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <div className={labelCls}>
                            Courier type <span className="text-destructive">*</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {(
                              [
                                { v: "MATATU", label: "Sacco / Matatu / SGR" },
                                { v: "PARCEL_SERVICE", label: "Parcel Service" },
                                { v: "BOLT_SEND", label: "Bolt / Uber" },
                                { v: "RIDER", label: "Boda / Rider" },
                                { v: "OTHER", label: "Other" },
                              ] as { v: CourierType; label: string }[]
                            ).map((c) => (
                              <button
                                key={c.v}
                                type="button"
                                onClick={() => {
                                  setCourierType(c.v);
                                  // An explicit pick means whatever was suggested no longer
                                  // reflects the customer's own choice — drop the "suggested"
                                  // hint so it doesn't misdescribe a manually-made pick.
                                  setCourierSuggestionSource(null);
                                  lastCourierSuggestionRef.current = null;
                                }}
                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                                  courierType === c.v
                                    ? "border-transparent text-white"
                                    : "border-border bg-background text-foreground hover:bg-secondary"
                                }`}
                                style={courierType === c.v ? { backgroundColor: BRAND } : undefined}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                          {courierSuggestionSource && (
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              {courierSuggestionSource === "HISTORY"
                                ? "Suggested from other customers' past orders to this town"
                                : "Suggested based on commonly known routes to this town"}{" "}
                              — feel free to change it.
                            </p>
                          )}
                        </div>

                        <div>
                          <label className={labelCls}>
                            Sacco / courier service name <span className="text-destructive">*</span>
                          </label>
                          <input
                            className={inputCls}
                            required
                            value={courierServiceName}
                            onChange={(e) => {
                              setCourierServiceName(e.target.value);
                              setCourierSuggestionSource(null);
                              lastCourierSuggestionRef.current = null;
                            }}
                            placeholder="e.g. 2NK, 4NTE, Kukena, Easy Coach, Tahmeed, G4S, Pickup Mtaani"
                            list="courier-suggestions"
                          />
                          <datalist id="courier-suggestions">
                            <option value="2NK Sacco" />
                            <option value="4NTE Sacco" />
                            <option value="Kukena Sacco" />
                            <option value="Easy Coach" />
                            <option value="Tahmeed" />
                            <option value="Mash Poa" />
                            <option value="Modern Coast" />
                            <option value="Guardian Coach" />
                            <option value="Climax Coach" />
                            <option value="G4S Courier" />
                            <option value="Pickup Mtaani" />
                            <option value="Wells Fargo Courier" />
                            <option value="Not sure — please call me" />
                          </datalist>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Type any sacco or courier name. If you're not yet sure, type <em>"Not sure — call me"</em>{" "}
                            and our staff will help.
                          </p>
                        </div>

                        <div>
                          <label className={labelCls}>Dispatch stage / office in Nairobi (optional)</label>
                          <input
                            className={inputCls}
                            value={courierStageOrOffice}
                            onChange={(e) => setCourierStageOrOffice(e.target.value)}
                            placeholder="e.g. 2NK Accra Road, Machakos Country Bus stage, Easy Coach River Road"
                          />
                          <p className="mt-1 text-xs text-muted-foreground">
                            The stage / booking office on <em>our</em> side. Leave blank if unsure.
                          </p>
                        </div>

                        <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                          <strong>Transport cost is paid directly to the sacco / courier</strong> on collection (or at
                          dispatch — we'll confirm by phone). It is separate from your product total below.
                        </div>
                      </div>
                    </section>
                  </div>
                )}
                    </div>
                  )}
                </div>
              )}

              {fulfillment === "PICKUP" && (
                <div ref={pickupSectionRef} className="rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                  No delivery fee — we'll prepare your order and call you when it's ready for pickup at our shop.
                  <label className="mt-3 flex cursor-not-allowed items-center gap-2.5 rounded-xl border border-dashed border-border bg-background/50 px-3 py-2.5 opacity-60">
                    <input type="checkbox" disabled className="h-4 w-4 rounded border-border" />
                    <span className="text-xs">
                      <span className="font-medium">Pay in cash at pickup</span>
                      <span className="ml-1.5 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        Coming soon
                      </span>
                    </span>
                  </label>
                </div>
              )}

              {fulfillment && (
                <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                  <label className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                      checked={etrRequested}
                      onChange={(e) => setEtrRequested(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium">Send me my ETR & tax documents</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        You'll automatically receive your ETR (KRA-compliant receipt) along with your tax invoice and
                        receipt, once you check this and enter a reachable email — we email all three together as
                        soon as we've uploaded your ETR. The ETR stays available for re-download/resend for 2
                        months after that.
                      </span>
                    </span>
                  </label>
                  {etrRequested && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelCls}>Send documents to</label>
                        <input
                          type="email"
                          className={inputCls}
                          required
                          value={documentsEmail}
                          onChange={(e) => setDocumentsEmail(e.target.value)}
                          placeholder="you@example.com"
                        />
                        {email.trim() && documentsEmail === email.trim() ? (
                          <p className="mt-1 text-xs text-muted-foreground">Same as your contact email — edit if you'd like documents sent elsewhere.</p>
                        ) : email.trim() && documentsEmail !== email.trim() ? (
                          <button
                            type="button"
                            className="mt-1 text-xs font-medium text-accent underline underline-offset-2"
                            onClick={() => setDocumentsEmail(email.trim())}
                          >
                            Use my email ({email.trim()})
                          </button>
                        ) : null}
                      </div>
                      <div>
                        <label className={labelCls}>Your KRA PIN (optional)</label>
                        <input
                          className={inputCls}
                          value={taxInvoiceKraPin}
                          onChange={(e) => {
                            setKraPinPrefilled(false);
                            setTaxInvoiceKraPin(e.target.value.toUpperCase());
                          }}
                          placeholder="A123456789Z"
                          maxLength={11}
                        />
                        {kraPinPrefilled && taxInvoiceKraPin && (
                          <span className="mt-1 block text-xs text-muted-foreground">
                            Prefilled from your business profile — edit if you'd like to use a different PIN.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {fulfillment === "TUMABODA_DELIVERY" && (
                <div>
                  <label className={labelCls}>Phone number for delivery contact</label>
                  <input
                    className={inputCls}
                    required
                    value={tumabodaPhone}
                    onChange={(e) => setTumabodaPhone(e.target.value)}
                    placeholder="0712 345 678"
                    inputMode="tel"
                  />
                  <p className="mt-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs font-medium text-foreground/90">
                    This number will be given directly to TumaBoda, our delivery partner, so
                    their rider can contact you about this delivery. It's collected separately
                    from your M-Pesa number, which you'll enter at payment. See our{" "}
                    <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
                      Privacy Policy
                    </a>
                    .
                  </p>
                </div>
              )}

              <ConsentCheckbox
                checked={consent}
                onCheckedChange={setConsent}
                purpose="process and deliver my order"
                className="mt-2"
              />

              <button
                type="submit"
                disabled={
                  !consent ||
                  (fulfillment === "TUMABODA_DELIVERY" && !isValidKenyanPhone(tumabodaPhone))
                }
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: BRAND }}
              >
                Continue to payment <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            {/* Full-bleed breakout — the rest of this step is capped at max-w-2xl for readable line
                length, but the horizontally-scrolling product strip benefits from the full modal
                width instead of being squeezed into that same narrow column. */}
            <div className="mt-6 w-screen ml-[calc(50%-50vw)] mr-[calc(50%-50vw)] px-4 sm:px-6">
              <QuickAddProductStrip cardWidthClassName="w-40 sm:w-56 lg:w-64" wrap />
            </div>
            </>
          )}

          {step === "delivery" && (detailsConfirmed || payState !== "idle") && (
            <div className="space-y-6">
              {payState === "idle" && (
                <>
                  <button
                    type="button"
                    onClick={() => setDetailsConfirmed(false)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary"
                  >
                    <ArrowLeft className="h-4 w-4" /> Edit order details
                  </button>

                  <div>
                    <h2 className="font-display text-2xl text-foreground">Review &amp; pay</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Enter the number to receive your M-Pesa payment prompt on.
                    </p>
                  </div>

                  <div>
                    <label className={labelCls}>Phone (M-Pesa)</label>
                    <input
                      className={inputCls}
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0712 345 678"
                      inputMode="tel"
                    />
                    {tumabodaPhone.trim() && phone.trim() === tumabodaPhone.trim() && (
                      <p className="mt-1 text-xs text-muted-foreground">Same as your delivery contact number — edit if you'd like to pay from a different line.</p>
                    )}
                  </div>

                  {/* Order summary */}
                  <div className="overflow-hidden rounded-2xl border border-forest/15 bg-card">
                    <div className="bg-forest px-5 py-3">
                      <h3 className="text-sm font-semibold text-cream">Order summary</h3>
                    </div>
                    <div className="p-5">
                    <ul className="space-y-2 text-sm">
                      {items.map((it) => (
                        <li key={it.id} className="flex justify-between gap-3">
                          <span className="text-foreground/90">
                            {it.productName} <span className="text-muted-foreground">× {it.quantity}</span>
                          </span>
                          <span className="tabular-nums">{fmt(it.lineTotal)}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 border-t border-border pt-3">
                      {appliedPromo ? (
                        <div className="flex items-center justify-between gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs">
                          <span className="font-medium text-accent">
                            {appliedPromo.code} applied{autoApplied ? " automatically" : ""}
                          </span>
                          <button type="button" onClick={removePromoCode} className="text-muted-foreground hover:text-foreground">
                            Use a different code
                          </button>
                        </div>
                      ) : appliedRedemption ? (
                        <p className="rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
                          A promo code can't be combined with Reward Coupons — remove your redeemed coupons above to use one instead.
                        </p>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            placeholder="Promo code"
                            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs uppercase focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ring)]"
                          />
                          <button
                            type="button"
                            onClick={applyPromoCode}
                            disabled={promoChecking || !promoCode.trim()}
                            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                          >
                            {promoChecking ? "…" : "Apply"}
                          </button>
                        </div>
                      )}
                      {promoError && <p className="mt-1.5 text-[11px] text-destructive">{promoError}</p>}
                    </div>

                    {pointsBalance !== null && pointsBalance > 0 && (
                      <div className="mt-3 border-t border-border pt-3">
                        {appliedRedemption ? (
                          <div className="flex items-center justify-between gap-2 rounded-lg bg-accent/10 px-3 py-2 text-xs">
                            <span className="font-medium text-accent">
                              {appliedRedemption.points} Reward Coupons redeemed
                            </span>
                            <button type="button" onClick={removePointsRedemption} className="text-muted-foreground hover:text-foreground">
                              Remove
                            </button>
                          </div>
                        ) : appliedPromo ? (
                          <p className="rounded-lg bg-secondary/60 px-3 py-2 text-[11px] text-muted-foreground">
                            Reward Coupons can't be combined with a promo code — remove {appliedPromo.code} above to redeem coupons instead.
                          </p>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min={1}
                              max={pointsBalance}
                              value={redeemInput}
                              onChange={(e) => setRedeemInput(e.target.value)}
                              placeholder={`Redeem Reward Coupons (balance: ${pointsBalance})`}
                              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ring)]"
                            />
                            <button
                              type="button"
                              onClick={applyPointsRedemption}
                              disabled={redeemChecking || !redeemInput.trim()}
                              className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-60"
                            >
                              {redeemChecking ? "…" : "Apply"}
                            </button>
                          </div>
                        )}
                        {!appliedRedemption && previewDiscount !== null && (
                          <p className="mt-1.5 text-[11px] font-medium text-accent">
                            ≈ {fmt(previewDiscount)} off{previewCapped ? " (capped at the maximum for this order)" : ""}
                          </p>
                        )}
                        {redeemError && <p className="mt-1.5 text-[11px] text-destructive">{redeemError}</p>}
                      </div>
                    )}

                    <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
                      <Row label="Subtotal" value={fmt(cartTotal)} />
                      <Row label={shippingLabel} value={shippingValue} />
                      {appliedPromo && <Row label="Discount" value={`-${fmt(appliedPromo.discount)}`} />}
                      {appliedRedemption && <Row label="Reward Coupons redeemed" value={`-${fmt(appliedRedemption.discount)}`} />}
                      <div className="flex justify-between border-t border-border pt-2.5 font-display text-base">
                        <dt>Total</dt>
                        <dd className="tabular-nums">{fmt(total)}</dd>
                      </div>
                    </dl>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isValidKenyanPhone(phone)) {
                        toast.error("Enter a valid Safaricom number (07XXXXXXXX or +2547XXXXXXXX) — M-Pesa requires a Safaricom line");
                        return;
                      }
                      startPayment();
                    }}
                    disabled={!isValidKenyanPhone(phone)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: BRAND }}
                  >
                    <Smartphone className="h-5 w-5" />
                    Pay {fmt(total)} with M-Pesa
                  </button>

                  <p className="text-center text-[11px] text-muted-foreground">
                    By paying, you agree to our terms. Payment is secured by Safaricom M-Pesa.
                  </p>
                </>
              )}

              {payState === "sending" && (
                <CenteredState
                  icon={<Loader2 className="h-9 w-9 animate-spin" style={{ color: BRAND }} />}
                  title="Sending M-Pesa prompt…"
                  subtitle="Hang on while we contact Safaricom."
                />
              )}

              {payState === "waiting" && (
                <div className="flex flex-col items-center py-6 text-center">
                  <div
                    className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full"
                    style={{ backgroundColor: `${BRAND}15` }}
                  >
                    <span
                      className="absolute inset-0 animate-ping rounded-full"
                      style={{ backgroundColor: `${BRAND}25` }}
                    />
                    <Smartphone className="relative h-11 w-11" style={{ color: BRAND }} />
                  </div>
                  <h2 className="mt-6 font-display text-2xl text-foreground">Check your phone, enter M-Pesa PIN</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    Enter your M-Pesa PIN on{" "}
                    <span className="font-semibold text-foreground">{normalizePhone(phone)}</span> to complete the
                    payment of <span className="font-semibold text-foreground">{fmt(total)}</span>.
                  </p>
                  {orderRef && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Order reference: <span className="font-mono font-semibold text-foreground">{orderRef}</span>
                    </p>
                  )}
                  <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Waiting for confirmation…
                  </div>
                  {showResend && (
                    <button
                      type="button"
                      onClick={resendPrompt}
                      className="mt-5 text-sm font-semibold underline"
                      style={{ color: BRAND }}
                    >
                      Resend prompt
                    </button>
                  )}
                </div>
              )}

              {payState === "success" && (
                <CenteredState
                  icon={<CheckCircle2 className="h-12 w-12 text-emerald-600" />}
                  title="Payment received!"
                  subtitle="Redirecting to your confirmation…"
                />
              )}

              {payState === "failed" && (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
                    <XCircle className="h-10 w-10 text-destructive" />
                  </div>
                  <h2 className="mt-6 font-display text-2xl text-foreground">Payment failed</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {errorMsg ?? "Your M-Pesa payment was not completed."}
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={startPayment}
                      className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
                      style={{ backgroundColor: BRAND }}
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPayState("idle");
                        setDetailsConfirmed(false);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
                    >
                      <ArrowLeft className="h-4 w-4" /> Edit order details
                    </button>
                  </div>
                </div>
              )}

              {payState === "timeout" && (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
                    <Smartphone className="h-9 w-9 text-foreground/70" />
                  </div>
                  <h2 className="mt-6 font-display text-2xl text-foreground">Payment not received</h2>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    We didn't get a confirmation in time. Try again, or contact support if you were charged.
                  </p>
                  {orderRef && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Order reference: <span className="font-mono font-semibold text-foreground">{orderRef}</span>
                    </p>
                  )}
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={startPayment}
                      className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
                      style={{ backgroundColor: BRAND }}
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPayState("idle");
                        setDetailsConfirmed(false);
                      }}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
                    >
                      <ArrowLeft className="h-4 w-4" /> Edit order details
                    </button>
                    <Link
                      to="/contact"
                      className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary"
                    >
                      Contact support
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StepDot({
  active,
  done,
  label,
  shortLabel,
}: {
  active: boolean;
  done: boolean;
  label: string;
  shortLabel?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
        active ? "text-foreground" : done ? "text-foreground/70" : "text-muted-foreground"
      }`}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${active || done ? "" : "bg-border"}`}
        style={active || done ? { backgroundColor: BRAND } : undefined}
      />
      <span className={`whitespace-nowrap ${active ? "font-semibold" : ""}`}>
        {shortLabel ? (
          <>
            <span className="sm:hidden">{shortLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
      </span>
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function CenteredState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      {icon}
      <h2 className="mt-5 font-display text-2xl text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

/** GPS can be wrong (indoors, VPN, stale cache) — asks the customer to explicitly confirm the
 *  reverse-geocoded fix before it's trusted as the delivery point, instead of silently seeding it in. */
function GpsConfirmPrompt({
  description,
  onConfirm,
  onReject,
}: {
  description: string;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3 text-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">We think you're near</p>
      <p className="mt-0.5 font-medium text-foreground">{description}</p>
      <p className="mt-1 text-xs text-muted-foreground">Is this right?</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-full px-4 py-2 text-xs font-semibold text-white"
          style={{ backgroundColor: BRAND }}
        >
          Yes, deliver here
        </button>
        <button
          type="button"
          onClick={onReject}
          className="flex-1 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground hover:border-foreground/40"
        >
          No, let me search
        </button>
      </div>
    </div>
  );
}

function FulfillmentCard({
  active,
  onClick,
  icon,
  title,
  desc,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  badge?: string;
}) {
  // A div, not a button — the whole-card-is-clickable pattern read as confusing (per the
  // client's explicit feedback); a dedicated "Select" button at the bottom is the one thing
  // that actually selects this option.
  return (
    <div
      className={`flex h-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
        active ? "border-transparent bg-secondary shadow-sm ring-2" : "border-border bg-card"
      }`}
      style={active ? ({ ["--tw-ring-color" as string]: BRAND, color: "inherit" } as React.CSSProperties) : undefined}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            backgroundColor: active ? BRAND : "transparent",
            color: active ? "#fff" : undefined,
            border: active ? "none" : "1px solid var(--border)",
          }}
        >
          {icon}
        </span>
        {badge && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${BRAND}1a`, color: BRAND }}
          >
            {badge}
          </span>
        )}
      </div>
      <span className="font-semibold text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground leading-snug">{desc}</span>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={`mt-auto min-h-[44px] w-auto self-start rounded-full px-5 py-2.5 text-xs font-semibold transition ${
          active ? "text-white" : "bg-accent text-accent-foreground hover:bg-accent/90"
        }`}
        style={active ? { backgroundColor: BRAND } : undefined}
      >
        {active ? "Selected ✓" : "Select"}
      </button>
    </div>
  );
}

export default CheckoutModal;
