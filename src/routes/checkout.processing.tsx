import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useEffect, useRef, useState } from "react";
import { Smartphone, CheckCircle2, XCircle, Clock } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { Spinner } from "@/components/Spinner";
import { orderStore } from "@/services/orderStore";
import { useCart } from "@/contexts/CartContext";

const searchSchema = z.object({
  ref: z.string(),
  orderId: z.string().optional(),
  paymentMethod: z.string().optional(),
  phone: z.string().optional(),
});



const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20;
const COUNTDOWN_SECONDS = 180; // 3 minutes

type UiState = "waiting" | "polling" | "success" | "failed" | "timeout" | "cod_pending";

function ProcessingPage() {
  const [_searchParams] = useSearchParams();
  const ref = _searchParams.get("ref") ?? undefined;
  const orderIdParam = _searchParams.get("orderId") ?? undefined;
  const phone = _searchParams.get("phone") ?? undefined;

  const navigate = useNavigate();
  const { clearCart } = useCart();

  const [uiState, setUiState] = useState<UiState>("waiting");
  const [attempt, setAttempt] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [receiptNumber, setReceiptNumber] = useState<string | null>(null);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [resolvedOrderId, setResolvedOrderId] = useState<string | null>(orderIdParam ?? null);
  const [retryingCod, setRetryingCod] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;

    // countdown
    countdownTimer = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    (async () => {
      // Resolve orderId if not provided
      let orderId = orderIdParam ?? null;
      if (!orderId) {
        const { order } = await orderStore.getStatus(ref ?? "");
        if (cancelled) return;
        orderId = order?.id ?? null;
        setResolvedOrderId(orderId);
      }
      if (!orderId) {
        setFailReason("We couldn't find this order. Track it from your orders page.");
        setUiState("failed");
        return;
      }

      // Show waiting briefly, then start polling
      setTimeout(() => {
        if (!cancelled) setUiState("polling");
      }, 1500);

      let n = 0;
      const poll = async () => {
        if (cancelled) return;
        n += 1;
        setAttempt(n);
        const res = await orderStore.getPaymentStatus(orderId!);
        if (cancelled) return;

        if (res.status === "SUCCESS") {
          setReceiptNumber(res.receiptNumber ?? null);
          clearCart();
          setUiState("success");
          return;
        }
        if (res.status === "FAILED") {
          setFailReason(res.message ?? "Payment was not completed.");
          setUiState("failed");
          return;
        }
        if (n >= MAX_ATTEMPTS) {
          setUiState("timeout");
          return;
        }
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
      };
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [ref, orderIdParam, clearCart]);

  function fmtCountdown(s: number) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }

  async function payOnDelivery() {
    if (!resolvedOrderId) {
      toast.error("Order id missing — cannot switch payment method.");
      return;
    }
    setRetryingCod(true);
    const r = await orderStore.initiatePayment(resolvedOrderId!, phone ?? "", "CASH_ON_DELIVERY");
    setRetryingCod(false);
    if (!r.ok) {
      toast.error(r.message ?? "Could not switch to pay on delivery.");
      return;
    }
    clearCart();
    setReceiptNumber(null);
    setFailReason(null);
    // Genuinely pending, not paid — initiating cash-on-delivery only records intent to pay on
    // arrival; staff still has to confirm payment actually happened before the order is PAID.
    setUiState("cod_pending");
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-2xl px-5 py-20 text-center lg:px-8 lg:py-24">
        {(uiState === "waiting" || uiState === "polling") && (
          <>
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
              <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
              <Smartphone className="relative h-9 w-9 text-accent" />
            </div>
            <h1 className="mt-6 font-display text-3xl sm:text-4xl">
              {uiState === "waiting" ? "M-Pesa prompt sent" : "Waiting for payment confirmation…"}
            </h1>
            {uiState === "waiting" ? (
              <p className="mt-3 text-muted-foreground">
                M-Pesa prompt sent to <span className="font-semibold text-foreground">{phone ?? "your phone"}</span>.
                Open your phone and enter your M-Pesa PIN to complete payment.
              </p>
            ) : (
              <p className="mt-3 text-muted-foreground">
                We're checking with M-Pesa for confirmation. Keep this page open.
              </p>
            )}

            <p className="mt-4 text-sm text-foreground/80">
              Order reference: <span className="font-semibold">{ref}</span>
            </p>

            <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-secondary/60 px-5 py-2.5 text-sm">
              <Spinner size="sm" />
              {uiState === "polling" ? (
                <span>Attempt {attempt}/{MAX_ATTEMPTS}</span>
              ) : (
                <span>Awaiting your PIN…</span>
              )}
            </div>

            <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Time remaining: <span className="font-mono text-foreground">{fmtCountdown(secondsLeft)}</span>
            </div>
          </>
        )}

        {uiState === "success" && (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <h1 className="mt-6 font-display text-3xl sm:text-4xl">Payment confirmed!</h1>
            <p className="mt-3 text-muted-foreground">
              Thank you — your payment has been received.
            </p>
            <div className="mx-auto mt-6 max-w-sm rounded-2xl border border-border bg-card p-5 text-left text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Order reference</span>
                <span className="font-semibold">{ref}</span>
              </div>
              {receiptNumber && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">M-Pesa receipt</span>
                  <span className="font-mono font-semibold">{receiptNumber}</span>
                </div>
              )}
            </div>
            <div className="mt-8">
              <Link
                to={ref ? `/orders/track?ref=${ref}` : "/orders/track"}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Track your order
              </Link>
            </div>
          </>
        )}

        {uiState === "cod_pending" && (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
              <Clock className="h-9 w-9 text-foreground/70" />
            </div>
            <h1 className="mt-6 font-display text-3xl sm:text-4xl">Order placed — pay on delivery</h1>
            <p className="mt-3 text-muted-foreground">
              Your order is confirmed. Pay in cash when it arrives — we'll mark it paid once that's confirmed.
            </p>
            <p className="mt-4 text-sm text-foreground/80">
              Order reference: <span className="font-semibold">{ref}</span>
            </p>
            <div className="mt-8">
              <Link
                to={ref ? `/orders/track?ref=${ref}` : "/orders/track"}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Track your order
              </Link>
            </div>
          </>
        )}

        {uiState === "failed" && (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="mt-6 font-display text-3xl sm:text-4xl">Payment failed</h1>
            <p className="mt-3 text-muted-foreground">
              {failReason ?? "Your M-Pesa payment was not completed."}
            </p>
            <p className="mt-4 text-sm text-foreground/80">
              Order reference: <span className="font-semibold">{ref}</span>
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/checkout"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Try again
              </Link>
              <button
                type="button"
                onClick={payOnDelivery}
                disabled={retryingCod}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:bg-secondary disabled:opacity-60"
              >
                {retryingCod ? <Spinner size="sm" /> : null}
                Pay on delivery instead
              </button>
            </div>
          </>
        )}

        {uiState === "timeout" && (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
              <Clock className="h-9 w-9 text-foreground/70" />
            </div>
            <h1 className="mt-6 font-display text-3xl sm:text-4xl">Payment pending</h1>
            <p className="mt-3 text-muted-foreground">
              Payment pending — we'll notify you by email. You can track your order using the reference below.
            </p>
            <p className="mt-4 text-sm text-foreground/80">
              Order reference: <span className="font-semibold">{ref}</span>
            </p>
            <div className="mt-8">
              <Link
                to={ref ? `/orders/track?ref=${ref}` : "/orders/track"}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Track order
              </Link>
            </div>
          </>
        )}
      </section>
    </SiteLayout>
  );
}

export default ProcessingPage;
