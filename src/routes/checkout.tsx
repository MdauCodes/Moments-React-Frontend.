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
} from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/contexts/CartContext";
import { useAuth, authFetch } from "@/contexts/AuthContext";
import { orderStore, type FulfillmentType, type CourierType } from "@/services/orderStore";
import { fetchDeliveryZones, type DeliveryZone } from "@/services/deliveryZoneService";
import { businessAccountApi } from "@/services/businessAccountApi";
import { referralStore } from "@/services/referralStore";
import { apiUrl } from "@/config/api";
import { CountySelect } from "@/components/CountySelect";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { RewardDeliveryBanners } from "@/components/RewardDeliveryBanners";
import { QuickAddProductStrip } from "@/components/QuickAddProductStrip";
import { buildReceiptPdfBlob } from "@/lib/pdf";
import type { CustomerOrder } from "@/services/orderStore";

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
      apiUrl(`/api/v1/tax-documents/${encodeURIComponent(order.reference)}/upload-signature?token=${encodeURIComponent(uploadToken)}`),
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



const BRAND = "#1a472a";
const POLL_MS = 3000;
const MAX_POLLS = 20;
const TIMEOUT_MS = POLL_MS * MAX_POLLS;
const RESEND_AFTER_MS = 30_000;

type Step = "contact" | "payment";
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

  // Fulfillment
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("OWN_COURIER");
  const [courierType, setCourierType] = useState<CourierType | "">("");
  const [courierServiceName, setCourierServiceName] = useState("");
  const [courierStageOrOffice, setCourierStageOrOffice] = useState("");

  // Contact / delivery
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [address, setAddress] = useState("");
  const [taxInvoiceRequested, setTaxInvoiceRequested] = useState(false);
  const [taxInvoiceEmail, setTaxInvoiceEmail] = useState("");
  const [taxInvoiceKraPin, setTaxInvoiceKraPin] = useState("");
  const [kraPinPrefilled, setKraPinPrefilled] = useState(false);
  const [paymentGateway, setPaymentGateway] = useState<"PAYHERO" | "MPESA">("MPESA");

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

  useEffect(() => {
    if (!isAuthenticated) return;
    referralStore.getWallet().then((w) => setPointsBalance(w?.balance ?? 0)).catch(() => {});
  }, [isAuthenticated]);

  // A points redemption's discount is computed against the order total at the moment
  // it's applied — if the promo code then changes (applied, removed, or swapped), that
  // discount is stale (computed off a total that no longer applies). Clear it and make
  // the customer re-apply, rather than silently showing a wrong number on screen.
  const prevPromoCodeRef = useRef<string | null>(null);
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

  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
  const [zoneSearch, setZoneSearch] = useState("");
  const [zoneOpen, setZoneOpen] = useState(false);
  const zoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!zoneOpen) return;
    const onClick = (e: MouseEvent) => {
      if (zoneRef.current && !zoneRef.current.contains(e.target as Node)) {
        setZoneOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [zoneOpen]);

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

  useEffect(() => {
    if (items.length === 0 && payState === "idle") {
      navigate("/cart", { replace: true });
    }
  }, [items.length, navigate, payState]);

  useEffect(() => () => clearAllTimers(), []);

  useEffect(() => {
    fetchDeliveryZones()
      .then(setZones)
      .catch(() => {});
  }, []);

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

  function validateContact(): boolean {
    if (!name.trim() || !email.trim()) {
      toast.error("Please fill all required fields");
      return false;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error("Enter a valid email");
      return false;
    }
    if (!isValidKenyanPhone(phone)) {
      toast.error("Enter a valid Safaricom number (07XXXXXXXX or +2547XXXXXXXX) — M-Pesa requires a Safaricom line");
      return false;
    }
    if (fulfillment === "ZONE_DELIVERY") {
      if (!address.trim() || !city.trim() || !county.trim() || !selectedZone) {
        toast.error("Select a delivery zone and fill in the address");
        return false;
      }
    } else if (fulfillment === "OWN_COURIER") {
      if (!address.trim() || !city.trim() || !county.trim()) {
        toast.error("Please provide the pickup/handoff address for the courier");
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
    return true;
  }

  function handleContactSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validateContact()) return;
    if (!consent) {
      toast.error("Please tick the consent box to continue");
      return;
    }
    setStep("payment");
  }

  async function startPayment() {
    setErrorMsg(null);
    setPayState("sending");
    const phoneNormalized = normalizePhone(phone);

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
            address: fulfillment === "PICKUP" ? "" : address.trim(),
            city: fulfillment === "PICKUP" ? "" : city.trim(),
            county: fulfillment === "PICKUP" ? "" : county.trim(),
            postalCode: postalCode.trim() || undefined,
          },
          shippingFee,
          paymentMethod: paymentGateway,
          fulfillmentType: fulfillment,
          idempotencyKey: idempotencyKey.current,
          promoCode: appliedPromo?.code,
          redeemPoints: appliedRedemption?.points,
          taxInvoiceRequested,
          taxInvoiceEmail: taxInvoiceEmail.trim() || undefined,
          taxInvoiceKraPin: taxInvoiceKraPin.trim() || undefined,
          ...(fulfillment === "OWN_COURIER" && courierType
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
        if (taxInvoiceRequested) {
          toast.success(`Your tax invoice will be emailed to ${taxInvoiceEmail.trim() || email} once your order is confirmed.`);
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

  const shippingFee = fulfillment === "ZONE_DELIVERY" && selectedZone ? selectedZone.feeAmount : 0;
  const total = cartTotal + shippingFee - (appliedPromo?.discount ?? 0) - (appliedRedemption?.discount ?? 0);
  const shippingLabel =
    fulfillment === "PICKUP"
      ? "Pickup at shop"
      : fulfillment === "OWN_COURIER"
        ? "Courier — to be confirmed"
        : selectedZone
          ? `Delivery — ${selectedZone.zoneName}`
          : "Delivery";
  const shippingValue =
    fulfillment === "PICKUP"
      ? "Free"
      : fulfillment === "OWN_COURIER"
        ? "To be confirmed"
        : shippingFee === 0
          ? "Free"
          : fmt(shippingFee);

  const brandStyle = { ["--brand-ring" as string]: BRAND } as React.CSSProperties;

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
          <StepDot active={step === "contact"} done={step === "payment"} label="1. Contact & delivery" />
          <span className="h-px w-8 bg-border sm:w-16" />
          <StepDot active={step === "payment"} done={false} label="2. Payment" />
        </div>
      </div>

      {/* Body */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="mb-4">
            <RewardDeliveryBanners stickyTopClassName="top-0" />
          </div>
          {step === "contact" && (
            <>
            <form onSubmit={handleContactSubmit} className="space-y-5">
              <div>
                <h2 className="font-display text-2xl text-foreground">How would you like to receive your order?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isAuthenticated ? (
                    "Choose a fulfillment option, then confirm your details."
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

              {/* Fulfillment selector */}
              <div className="grid gap-3 sm:grid-cols-2">
                <FulfillmentCard
                  active={fulfillment === "OWN_COURIER"}
                  onClick={() => setFulfillment("OWN_COURIER")}
                  icon={<PackageCheck className="h-5 w-5" />}
                  title="Deliver via courier"
                  desc="We hand off to your chosen courier. Transport cost confirmed at dispatch."
                />
                <FulfillmentCard
                  active={fulfillment === "PICKUP"}
                  onClick={() => setFulfillment("PICKUP")}
                  icon={<Store className="h-5 w-5" />}
                  title="Pick up at shop"
                  desc="Collect from our shop. No delivery fee."
                />
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
                <div>
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
                </div>

                <div className="sm:col-span-2 rounded-2xl border border-border bg-secondary/30 p-4">
                  <label className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-border"
                      checked={taxInvoiceRequested}
                      onChange={(e) => setTaxInvoiceRequested(e.target.checked)}
                    />
                    <span>
                      <span className="font-medium">I need a tax invoice / VAT document for this order</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        For your own record-keeping (input VAT claims, expense filing). We'll email it as a PDF once
                        your order is placed — available for 2 weeks from the date sent.
                      </span>
                    </span>
                  </label>
                  {taxInvoiceRequested && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelCls}>Send tax invoice to</label>
                        <input
                          type="email"
                          className={inputCls}
                          value={taxInvoiceEmail}
                          onChange={(e) => setTaxInvoiceEmail(e.target.value)}
                          placeholder={email || "you@example.com"}
                        />
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

                {fulfillment === "OWN_COURIER" && (
                  <div className="sm:col-span-2 space-y-4">
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

                    {/* SECTION 1 — DESTINATION */}
                    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
                      <div className="mb-3 flex items-baseline justify-between gap-2">
                        <h3 className="font-display text-lg text-foreground">1. Where do you need it delivered?</h3>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Your side
                        </span>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
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
                        <div>
                          <label className={labelCls}>
                            County <span className="text-destructive">*</span>
                          </label>
                          <CountySelect value={county} onChange={setCounty} required placeholder="Select county…" />
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
                            The sacco / parcel office on <em>your</em> side where you'll pick up the parcel. Not sure
                            which one? Leave blank — we'll call to confirm with you.
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

                    {/* SECTION 2 — DISPATCH */}
                    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
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
                                onClick={() => setCourierType(c.v)}
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
                        </div>

                        <div>
                          <label className={labelCls}>
                            Sacco / courier service name <span className="text-destructive">*</span>
                          </label>
                          <input
                            className={inputCls}
                            required
                            value={courierServiceName}
                            onChange={(e) => setCourierServiceName(e.target.value)}
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

                {fulfillment === "PICKUP" && (
                  <div className="sm:col-span-2 rounded-2xl border border-border bg-secondary/30 p-4 text-sm text-muted-foreground">
                    No delivery fee — we'll prepare your order and call you when it's ready for pickup at our shop.
                  </div>
                )}
              </div>

              <ConsentCheckbox
                checked={consent}
                onCheckedChange={setConsent}
                purpose="process and deliver your order"
                className="mt-2"
              />

              <button
                type="submit"
                disabled={!consent}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: BRAND }}
              >
                Continue to payment <ArrowRight className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-6">
              <QuickAddProductStrip cardWidthClassName="w-36 sm:w-44" />
            </div>
            </>
          )}

          {step === "payment" && (
            <div className="space-y-6">
              {payState === "idle" && (
                <>
                  <button
                    type="button"
                    onClick={() => setStep("contact")}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition hover:bg-secondary"
                  >
                    <ArrowLeft className="h-4 w-4" /> Edit order details
                  </button>

                  <div>
                    <h2 className="font-display text-2xl text-foreground">Review &amp; pay</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You'll get an M-Pesa prompt on{" "}
                      <span className="font-semibold text-foreground">{normalizePhone(phone)}</span>.
                    </p>
                  </div>

                  {/* Payment method selector */}
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="text-sm font-semibold text-foreground">Payment method</h3>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(
                        [
                          { id: "MPESA", label: "M-Pesa", hint: "Lipa Na M-Pesa — Safaricom Daraja" },
                          { id: "PAYHERO", label: "M-Pesa (alternative)", hint: "Same STK push, alternate route" },
                        ] as const
                      ).map((opt) => {
                        const active = paymentGateway === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPaymentGateway(opt.id)}
                            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-sm transition ${
                              active
                                ? "border-foreground bg-secondary"
                                : "border-border bg-background hover:bg-secondary/50"
                            }`}
                          >
                            <span className="font-semibold text-foreground">{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.hint}</span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Both options send an M-Pesa STK push to your phone for approval.
                    </p>
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
                    onClick={startPayment}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-semibold text-white shadow-lg transition hover:opacity-90"
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
                        setStep("contact");
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
                        setStep("contact");
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

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
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
      <span className={`${active ? "font-semibold" : ""}`}>{label}</span>
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

function FulfillmentCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex h-full flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
        active ? "border-transparent bg-secondary shadow-sm ring-2" : "border-border bg-card hover:border-foreground/30"
      }`}
      style={active ? ({ ["--tw-ring-color" as string]: BRAND, color: "inherit" } as React.CSSProperties) : undefined}
    >
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
      <span className="font-semibold text-foreground">{title}</span>
      <span className="text-xs text-muted-foreground leading-snug">{desc}</span>
    </button>
  );
}

export default CheckoutModal;
