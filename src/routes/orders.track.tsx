import { Link, useSearchParams } from "react-router-dom";

import { InlineProgress } from "@/components/InlineProgress";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, ChevronDown, ChevronUp, FileDown, Keyboard, Search, X } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { orderStore, type CustomerOrder } from "@/services/orderStore";
import { TumaBodaTrackingWidget } from "@/components/TumaBodaTrackingWidget";
import { resolveStatusDisplay, isCustomerSelfConfirmMode } from "@/lib/orderStatusV2";

const searchSchema = z.object({ ref: z.string().optional() });

// Nothing left to change once an order reaches one of these — the verified panel's polling
// effect stops rather than keep re-fetching forever.
const TERMINAL_ORDER_STATUSES = new Set(["DELIVERED", "CANCELLED", "REFUNDED"]);

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email ?? "";
  const [user, domain] = email.split("@");
  const u = user.length <= 2 ? user[0] + "*" : user[0] + "***" + user[user.length - 1];
  return `${u}@${domain}`;
}



function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

// Collapses consecutive same-label entries (e.g. a repeated "READY FOR DISPATCH" from a
// backend that, on some historical orders, logged a redundant transition) down to one, keeping
// the first-seen (newest, since the caller passes newest-first) timestamp. Defensive display-
// layer cleanup — the backend now guards against writing new duplicates, but this also cleans
// up already-dirty historical orders that fix can't retroactively touch.
function dedupeConsecutiveEvents<T extends { label: string }>(events: T[]): T[] {
  return events.filter((e, i) => i === 0 || e.label !== events[i - 1].label);
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50";

type Tab = "ref" | "email";

function TrackPage() {
  const [_searchParams] = useSearchParams();
  const initial = Object.fromEntries(_searchParams.entries());
  const [tab, setTab] = useState<Tab>(initial.ref ? "ref" : "ref");

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-5 py-12 lg:px-8 lg:py-16">
        <h1 className="font-display text-3xl sm:text-4xl">Track your order</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Look up your order by reference number or by the email used at checkout.
        </p>

        <div className="mt-6 inline-flex rounded-full border border-border bg-card p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("ref")}
            className={`rounded-full px-4 py-1.5 transition ${tab === "ref" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            By Reference
          </button>
          <button
            type="button"
            onClick={() => setTab("email")}
            className={`rounded-full px-4 py-1.5 transition ${tab === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            By Email
          </button>
        </div>

        {tab === "ref" ? (
          <ByReferenceTab initialRef={initial.ref ?? ""} onSwitchToEmail={() => setTab("email")} />
        ) : (
          <ByEmailTab />
        )}
      </section>
    </SiteLayout>
  );
}

function ByReferenceTab({ initialRef, onSwitchToEmail }: { initialRef: string; onSwitchToEmail: () => void }) {
  const [ref, setRef] = useState(initialRef);
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [searched, setSearched] = useState(false);

  async function lookup(reference: string) {
    setLoading(true);
    setSearched(true);
    try {
      const { order: o } = await orderStore.trackByReference(reference);
      setOrder(o);
      if (!o) toast.error("No order found with that reference");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialRef) lookup(initialRef);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ref.trim()) return;
    lookup(ref.trim());
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input className={inputCls} placeholder="Order reference (e.g. MP-12345)" value={ref} onChange={(e) => setRef(e.target.value)} />
        <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {loading ? <InlineProgress size="sm" /> : <Search className="h-4 w-4" />}
          Track
        </button>
      </form>

      {searched && !loading && !order && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          We couldn't find that order. Double-check the reference or <Link to="/contact" className="text-accent hover:underline">contact us</Link>.
        </div>
      )}

      {order && (
        <>
          <OrderCard order={order} />
          {order.verified === false && (
            <div className="mt-3 rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              For full order details — including items, pricing, and your delivery address —{" "}
              <button type="button" onClick={onSwitchToEmail} className="font-medium text-accent hover:underline">
                search by the email used at checkout
              </button>{" "}
              instead. A reference alone only shows status, since it isn't tied to your identity.
            </div>
          )}
        </>
      )}
    </>
  );
}

function otpTokenKey(reference: string, email: string) {
  return `order-otp-token:${reference}:${email.trim().toLowerCase()}`;
}

/**
 * Gates the full, verified order view behind an OTP sent to the order's own email — replaces
 * the old "typing a matching email is proof enough" check (Slice 13). Caches the resulting
 * accessToken in sessionStorage (tab-scoped, expires server-side after 1h) so re-expanding the
 * same row, or reopening the page in the same tab, doesn't ask for a fresh code every time.
 */
function VerifiedOrderPanel({ reference, email, fallback }: { reference: string; email: string; fallback: CustomerOrder }) {
  const [stage, setStage] = useState<"checking" | "need-otp" | "sending" | "awaiting-code" | "verifying" | "ready">("checking");
  const [otp, setOtp] = useState("");
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tryCachedToken() {
      const cached = sessionStorage.getItem(otpTokenKey(reference, email));
      if (!cached) {
        if (!cancelled) setStage("need-otp");
        return;
      }
      const { order: full } = await orderStore.trackByReference(reference, email, cached);
      if (cancelled) return;
      if (full?.verified) {
        setOrder(full);
        setAccessToken(cached);
        setStage("ready");
      } else {
        sessionStorage.removeItem(otpTokenKey(reference, email));
        setStage("need-otp");
      }
    }
    tryCachedToken();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference, email]);

  async function sendCode() {
    setStage("sending");
    setError(null);
    try {
      await orderStore.sendOrderOtp(reference, email);
      setStage("awaiting-code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
      setStage("need-otp");
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    if (otp.trim().length !== 6) return;
    setStage("verifying");
    setError(null);
    try {
      const { accessToken: token } = await orderStore.verifyOrderOtp(reference, email, otp.trim());
      sessionStorage.setItem(otpTokenKey(reference, email), token);
      const { order: full } = await orderStore.trackByReference(reference, email, token);
      if (full?.verified) {
        setOrder(full);
        setAccessToken(token);
        setStage("ready");
      } else {
        setError("Verification succeeded but the order couldn't be loaded — please refresh.");
        setStage("awaiting-code");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code");
      setStage("awaiting-code");
    }
  }

  // Keeps the verified view current without a manual reload — a status change made from the
  // admin side (e.g. "Mark ready", rider scan) previously only showed up here after the
  // customer refreshed the page themselves. Scoped to just this verified panel, not the
  // unverified reference-lookup card. Stops polling once the order reaches a terminal state
  // (nothing left to change) and pauses while the tab is backgrounded (no point spending a
  // request on a poll nobody's looking at) — resuming with one immediate refetch when it comes
  // back into view, so a customer who tabs back in isn't staring at stale data for up to 20s.
  useEffect(() => {
    if (stage !== "ready" || !order || !accessToken) return;
    if (TERMINAL_ORDER_STATUSES.has(order.status)) return;

    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function refetch() {
      try {
        const { order: full } = await orderStore.trackByReference(reference, email, accessToken!);
        if (!cancelled && full?.verified) setOrder(full);
      } catch {
        // A transient poll failure isn't worth surfacing — the next tick (or the customer's own
        // manual refresh) will just try again.
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } else if (!interval) {
        void refetch();
        interval = setInterval(refetch, 20_000);
      }
    }

    if (!document.hidden) interval = setInterval(refetch, 20_000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, order?.status, accessToken, reference, email]);

  if (stage === "checking") return <InlineProgress size="sm" />;

  if (stage === "ready" && order) {
    return (
      <>
        <OrderCard order={order} compact email={email} accessToken={accessToken ?? undefined} />
        {accessToken && (
          <ConfirmDeliverySection
            reference={reference}
            email={email}
            accessToken={accessToken}
            order={order}
            onConfirmed={setOrder}
          />
        )}
        <RefundPolicyNote />
      </>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-background/60 p-4 text-sm">
      <p className="font-medium text-foreground">Verify it's your order</p>
      <p className="mt-1 text-muted-foreground">
        For your privacy, full order details (pricing, address, items) are only shown once we've confirmed you own <strong>{maskEmail(email)}</strong>.
      </p>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {(stage === "need-otp" || stage === "sending") && (
        <button
          type="button"
          onClick={sendCode}
          disabled={stage === "sending"}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {stage === "sending" ? <InlineProgress size="sm" /> : null}
          Send verification code
        </button>
      )}
      {(stage === "awaiting-code" || stage === "verifying") && (
        <form onSubmit={verifyCode} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className={inputCls}
            style={{ maxWidth: 140 }}
            placeholder="6-digit code"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          />
          <button
            type="submit"
            disabled={stage === "verifying" || otp.trim().length !== 6}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {stage === "verifying" ? <InlineProgress size="sm" /> : null}
            Verify
          </button>
          <button type="button" onClick={sendCode} className="text-xs text-accent hover:underline">Resend code</button>
        </form>
      )}
      <div className="mt-4 border-t border-border pt-3 opacity-70">
        <OrderCard order={fallback} compact />
      </div>
    </div>
  );
}

// Order.status values that mean "the order has actually left the building" — the only point a
// customer-confirmation makes sense.
const CONFIRMABLE_STATUSES = new Set(["DISPATCHED", "DELIVERED"]);
const SCANNER_ELEMENT_ID = "delivery-verification-scanner";

/**
 * Self-service "I received my order" confirmation — reuses the email+OTP identity proof this
 * page already gates full order detail behind (VerifiedOrderPanel), rather than a separate
 * verification step. Feeds the admin Needs Attention page's "dispatched, unconfirmed" signal.
 */
function ConfirmDeliverySection({
  reference,
  email,
  accessToken,
  order,
  onConfirmed,
}: {
  reference: string;
  email: string;
  accessToken: string;
  order: CustomerOrder;
  onConfirmed: (order: CustomerOrder) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "scanning" | "manual">("idle");
  const [manualCode, setManualCode] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const stoppingRef = useRef(false);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pickup is staff-marked ("Mark picked up") when the customer physically collects the order —
  // no customer self-confirm step, since the face-to-face handoff already is the verification.
  if (!isCustomerSelfConfirmMode(order.fulfillmentType)) return null;
  if (!CONFIRMABLE_STATUSES.has(order.status as string)) return null;
  if (order.customerConfirmedDeliveredAt) {
    return (
      <div className="mt-3 rounded-xl border border-border bg-background/60 p-3 text-sm text-muted-foreground">
        You confirmed receiving this order on {new Date(order.customerConfirmedDeliveredAt).toLocaleDateString("en-KE", { dateStyle: "medium" })}.
      </div>
    );
  }

  async function stopScanner() {
    if (scannerRef.current && !stoppingRef.current) {
      stoppingRef.current = true;
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        /* already stopped/torn down — nothing to clean up */
      } finally {
        stoppingRef.current = false;
        scannerRef.current = null;
      }
    }
  }

  async function submitConfirm(code?: string) {
    setConfirming(true);
    setError(null);
    try {
      const updated = await orderStore.confirmDelivery(reference, email, accessToken, code);
      onConfirmed(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm delivery");
    } finally {
      setConfirming(false);
    }
  }

  function startScanner() {
    setMode("scanning");
    setError(null);
    // The scanner target div only exists once React commits the mode change above — defer
    // binding to the next tick so Html5Qrcode has an element to attach to.
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            void handleScanned(decodedText);
          },
          () => {
            /* per-frame decode miss while aiming — expected constantly, not an error */
          },
        );
      } catch {
        setError("Couldn't access the camera — check permissions, or enter the code manually below.");
        setMode("idle");
      }
    }, 0);
  }

  async function handleScanned(decodedText: string) {
    if (confirming) return; // ignore repeat frames while a submit is already in flight
    await stopScanner();
    setMode("idle");
    await submitConfirm(decodedText);
  }

  async function cancelScan() {
    await stopScanner();
    setMode("idle");
  }

  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!manualCode.trim()) {
      setError("Enter the code printed on your package's label.");
      return;
    }
    await submitConfirm(manualCode.trim());
  }

  // Orders that predate the delivery-verification-code field — plain one-tap confirm, same as
  // before this feature existed. No code to scan for, so nothing to gate on.
  if (!order.deliveryVerificationRequired) {
    return (
      <div className="mt-3 rounded-xl border border-dashed border-border bg-background/60 p-3 text-sm">
        <p className="font-medium text-foreground">Received your order?</p>
        <p className="mt-1 text-muted-foreground">Let us know it arrived — this helps us keep track of every delivery.</p>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        <button
          type="button"
          onClick={() => void submitConfirm()}
          disabled={confirming}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {confirming ? <InlineProgress size="sm" /> : null}
          Confirm I received it
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 w-full rounded-xl border border-dashed border-border bg-background/60 p-3 text-sm">
      <p className="font-medium text-foreground">Received your order?</p>
      <p className="mt-1 text-muted-foreground">
        Scan the QR code on your package's label (or enter the code printed next to it) to confirm delivery.
      </p>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {mode === "scanning" ? (
        <div className="mt-3">
          <div
            id={SCANNER_ELEMENT_ID}
            className="mx-auto w-full overflow-hidden rounded-lg bg-black"
            style={{ aspectRatio: "1 / 1", maxWidth: 320 }}
          />
          <button
            type="button"
            onClick={() => void cancelScan()}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      ) : mode === "manual" ? (
        <form onSubmit={handleManualSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value.toUpperCase())}
            placeholder="e.g. 7K9M3PXQ"
            className="w-full flex-1 min-w-0 rounded-full border border-border bg-background px-4 py-2 text-sm uppercase tracking-widest"
            disabled={confirming}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={confirming}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 sm:flex-none"
            >
              {confirming ? <InlineProgress size="sm" /> : null}
              Confirm
            </button>
            <button
              type="button"
              onClick={() => { setMode("idle"); setError(null); }}
              disabled={confirming}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
            >
              Back
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={startScanner}
            disabled={confirming}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            <Camera className="h-4 w-4" /> Scan package QR
          </button>
          <button
            type="button"
            onClick={() => { setMode("manual"); setError(null); }}
            disabled={confirming}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-xs font-semibold text-foreground disabled:opacity-60"
          >
            <Keyboard className="h-4 w-4" /> Enter code manually
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Deliberately light summary, not a restatement of the full policy — refunds.tsx already covers
 * the specifics (what's eligible, timelines, who pays return transport) and is the source of
 * truth. Duplicating that detail here risks the two drifting apart; this just tells the
 * customer where to go and states the one rule worth surfacing up front, so nobody assumes
 * every return is covered.
 */
function RefundPolicyNote() {
  return (
    <div className="mt-3 rounded-xl border border-dashed border-border bg-background/60 p-3 text-sm">
      <p className="font-medium text-foreground">Something wrong with your order?</p>
      <p className="mt-1 text-muted-foreground">
        Contact us with your order reference and our team will review it. If it's confirmed to be
        our mistake (a defect, wrong item, or an order that doesn't match what you received), we
        cover the return and process your refund back to your original payment method. See our{" "}
        <a href="/refunds" target="_blank" rel="noreferrer" className="underline">
          Refund &amp; Returns Policy
        </a>{" "}
        for the full eligibility criteria and timelines.
      </p>
    </div>
  );
}

function ByEmailTab() {
  const [email, setEmail] = useState("");
  const [searchedEmail, setSearchedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [rows, setRows] = useState<CustomerOrder[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  // The by-email list is a masked summary — expanding a row shows the OTP-gated full detail
  // (VerifiedOrderPanel below), not an immediate fetch. Full details are only ever unlocked
  // after the person proves they control the searched email via a one-time code (Slice 13).

  async function search(pageNum = 0) {
    if (!email.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await orderStore.findByEmail(email.trim(), pageNum, 10);
      setRows(res.rows);
      setTotalPages(res.totalPages);
      setPage(res.page);
      setSearchedEmail(email.trim());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(reference: string) {
    setExpanded(expanded === reference ? null : reference);
  }

  return (
    <>
      <form onSubmit={(e) => { e.preventDefault(); search(0); }} className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="email"
          required
          className={inputCls}
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {loading ? <InlineProgress size="sm" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">Results show partial email for privacy.</p>

      {searched && !loading && rows.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No orders found for this email address.
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-8 space-y-3">
          {rows.map((o) => {
            const isOpen = expanded === o.reference;
            return (
              <div key={o.reference} className="rounded-2xl border border-border bg-card">
                <button
                  type="button"
                  onClick={() => toggleExpand(o.reference)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="min-w-0">
                    <p className="font-display text-lg">{o.reference}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("en-KE")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
                      {resolveStatusDisplay(o.fulfillmentType, o.statusV2)?.label ?? o.status.replace(/_/g, " ")}
                    </span>
                    {o.fulfillmentType && (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {o.fulfillmentType.replace(/_/g, " ")}
                      </span>
                    )}
                    <span className="text-sm font-semibold">{fmt(o.total)}</span>
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border p-4">
                    <VerifiedOrderPanel reference={o.reference} email={searchedEmail} fallback={o} />
                  </div>
                )}
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page === 0 || loading}
                  onClick={() => search(page - 1)}
                  className="rounded-full border border-border px-4 py-1.5 disabled:opacity-50"
                >Previous</button>
                <button
                  disabled={page + 1 >= totalPages || loading}
                  onClick={() => search(page + 1)}
                  className="rounded-full border border-border px-4 py-1.5 disabled:opacity-50"
                >Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function OrderCard({
  order, compact = false, email, accessToken,
}: { order: CustomerOrder; compact?: boolean; email?: string; accessToken?: string }) {
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  // Opened synchronously in the click handler, before the (async) fetch starts — the same
  // "blank tab now, navigate it later" pattern TumaBodaFulfillmentPanel already uses. Calling
  // window.open() AFTER an await (the original bug here) is no longer considered a direct
  // response to the user's click by most browsers' popup blockers, so it was getting silently
  // blocked — the fetch itself always succeeded, only the resulting tab never appeared. Real
  // gap found via live testing on a real click, not caught by testing the fetch alone.
  const pendingDocWindow = useRef<Window | null>(null);

  // "receipt" routes through the same OTP-gated document endpoint as tax-invoice/etr below — it
  // previously built the PDF client-side from getFullOrder(), which silently fell back to the
  // public, redacted tracking lookup (no name/address/phone/financials) for anyone without this
  // browser's own checkout-time cache, instead of actually requiring the OTP proof this whole
  // panel exists to enforce.
  function handleDocDownload(type: "tax-invoice" | "etr" | "receipt", label: string) {
    if (!email || !accessToken) return;
    pendingDocWindow.current?.close();
    pendingDocWindow.current = window.open("", "_blank", "noopener");
    void fetchAndShowDocument(type, label);
  }

  async function fetchAndShowDocument(type: "tax-invoice" | "etr" | "receipt", label: string) {
    setDownloadingType(type);
    try {
      const blob = await orderStore.downloadTrackDocument(order.reference, email!, accessToken!, type);
      const url = URL.createObjectURL(blob);
      if (pendingDocWindow.current) {
        pendingDocWindow.current.location.href = url;
      } else {
        // The pre-opened blank tab was itself blocked or closed — fall back to the old call, on
        // the off chance this browser allows it outside a direct gesture.
        window.open(url, "_blank", "noopener");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      pendingDocWindow.current?.close();
      toast.error(err instanceof Error ? err.message : `Failed to download ${label}`);
    } finally {
      setDownloadingType(null);
      pendingDocWindow.current = null;
    }
  }

  return (
    <article className={compact ? "" : "mt-8 rounded-2xl border border-border bg-card p-6"}>
      {!compact && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Order</p>
            <h2 className="font-display text-2xl">{order.reference}</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground">
              {resolveStatusDisplay(order.fulfillmentType, order.statusV2)?.label ?? order.status.replace(/_/g, " ")}
            </span>
            <button
              type="button"
              disabled={!email || !accessToken || downloadingType === "receipt"}
              onClick={() => handleDocDownload("receipt", "receipt")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" /> Receipt
            </button>
          </div>
        </div>
      )}

      <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Placed</dt><dd>{new Date(order.createdAt).toLocaleString("en-KE")}</dd></div>
        {order.verified !== false && (
          <div><dt className="text-muted-foreground">Total</dt><dd className="font-semibold">{fmt(order.total)}</dd></div>
        )}
        <div><dt className="text-muted-foreground">Payment</dt><dd>{order.paymentStatus} · {order.paymentMethod}</dd></div>
        <div><dt className="text-muted-foreground">Customer</dt><dd>{maskEmail(order.customerEmail)}</dd></div>
        {order.shippingAddress && (
          <div><dt className="text-muted-foreground">Delivery to</dt><dd>{order.shippingAddress}{order.city ? `, ${order.city}` : ""}</dd></div>
        )}
        {order.tumabodaTrackingCode && <div><dt className="text-muted-foreground">Tracking #</dt><dd>{order.tumabodaTrackingCode}</dd></div>}
      </dl>

      {compact && (
        <button
          type="button"
          disabled={!email || !accessToken || downloadingType === "receipt"}
          onClick={() => handleDocDownload("receipt", "receipt")}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          <FileDown className="h-3.5 w-3.5" /> Download receipt
        </button>
      )}

      {order.fulfillmentType === "MANUAL_DELIVERY" && (order.courierServiceName || order.courierType || order.courierStageOrOffice) && (
        <div className="mt-4 rounded-xl border border-border bg-background/60 p-3 text-sm">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Courier</p>
          <p>{order.courierServiceName ?? order.courierType}{order.courierStageOrOffice ? ` · ${order.courierStageOrOffice}` : ""}</p>
        </div>
      )}

      {order.fulfillmentType === "TUMABODA_DELIVERY" && order.tumabodaTrackingCode && (
        <TumaBodaTrackingWidget trackingCode={order.tumabodaTrackingCode} status={order.tumabodaStatus} />
      )}

      {(order.taxInvoiceRequested || order.etrRequested) && (
        <div className="mt-4 rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
          <p className="text-xs uppercase tracking-widest">Tax documents</p>

          {order.taxInvoiceRequested && (
            <div className="mt-2 flex items-center justify-between gap-2">
              {order.taxInvoiceAvailable ? (
                <>
                  <span>
                    Tax invoice{order.taxInvoiceAvailableUntil ? (
                      <> — available until{" "}
                        <span className="font-medium text-foreground">
                          {new Date(order.taxInvoiceAvailableUntil).toLocaleDateString("en-KE")}
                        </span>
                      </>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    disabled={!email || !accessToken || downloadingType === "tax-invoice"}
                    onClick={() => handleDocDownload("tax-invoice", "tax invoice")}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Download
                  </button>
                </>
              ) : (
                <span>Tax invoice — download window has expired. Contact us with your order reference for a fresh copy.</span>
              )}
            </div>
          )}

          {order.etrRequested && (
            <div className="mt-2 flex items-center justify-between gap-2">
              {order.documentBundleStatus === "SENT" && order.etrAvailable ? (
                <>
                  <span>
                    ETR{order.etrAvailableUntil ? (
                      <> — available until{" "}
                        <span className="font-medium text-foreground">
                          {new Date(order.etrAvailableUntil).toLocaleDateString("en-KE")}
                        </span>
                      </>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    disabled={!email || !accessToken || downloadingType === "etr"}
                    onClick={() => handleDocDownload("etr", "ETR")}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
                  >
                    <FileDown className="h-3.5 w-3.5" /> Download
                  </button>
                </>
              ) : order.documentBundleStatus === "EXPIRED" ? (
                <span>ETR — download window expired. Contact us with your order reference for a fresh copy.</span>
              ) : (
                <span>
                  ETR — waiting on our team to upload it, will be emailed to{" "}
                  <span className="font-medium text-foreground">{order.documentsEmail}</span> once ready.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {order.items && order.items.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Items</h3>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {order.items.map((it, i) => (
              <li key={i} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>{it.productName} <span className="text-muted-foreground">× {it.quantity}</span></span>
                <span>{fmt(it.lineTotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.trackingEvents && order.trackingEvents.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold">Activity</h3>
          <ol className="mt-2 space-y-3 border-l border-border pl-4">
            {dedupeConsecutiveEvents(order.trackingEvents.slice().reverse()).map((e, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium text-foreground">{e.label}</p>
                <p className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString("en-KE")}{e.description ? ` · ${e.description}` : ""}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

export default TrackPage;
