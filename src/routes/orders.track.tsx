import { Link, useSearchParams } from "react-router-dom";

import { InlineProgress } from "@/components/InlineProgress";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronDown, ChevronUp, FileDown, Search } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { orderStore, type CustomerOrder } from "@/services/orderStore";
import { downloadReceiptPdf } from "@/lib/pdf";
import { useSiteConfig } from "@/contexts/SiteConfigContext";

const searchSchema = z.object({ ref: z.string().optional() });

// Production host by default — TumaBoda is standing up a sandbox-equivalent of this script
// tonight (2026-08-04); swap VITE_TUMABODA_EMBED_SCRIPT_URL to that URL once they send it, no
// code change needed. The widget is a web component, not an iframe: <tumaboda-tracking code="…">.
const TUMABODA_EMBED_SCRIPT_URL =
  import.meta.env.VITE_TUMABODA_EMBED_SCRIPT_URL || "https://tumaboda.co.ke/embed/v1.js";

function TumaBodaTrackingWidget({ trackingCode, status }: { trackingCode: string; status?: string | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (document.querySelector(`script[src="${TUMABODA_EMBED_SCRIPT_URL}"]`)) return;
    const script = document.createElement("script");
    script.src = TUMABODA_EMBED_SCRIPT_URL;
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = "";
    const widget = document.createElement("tumaboda-tracking");
    widget.setAttribute("code", trackingCode);
    el.appendChild(widget);
  }, [trackingCode]);

  return (
    <div className="mt-4 rounded-xl border border-border bg-background/60 p-3">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Live delivery tracking</p>
      {status && <p className="mt-1 text-sm text-foreground">{status.replace(/_/g, " ")}</p>}
      <div ref={containerRef} className="mt-2" />
    </div>
  );
}

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return email ?? "";
  const [user, domain] = email.split("@");
  const u = user.length <= 2 ? user[0] + "*" : user[0] + "***" + user[user.length - 1];
  return `${u}@${domain}`;
}



function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
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

function ByEmailTab() {
  const [email, setEmail] = useState("");
  const [searchedEmail, setSearchedEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [rows, setRows] = useState<CustomerOrder[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  // The by-email list is a masked summary — expanding a row fetches the full,
  // email-verified record (items, pricing, delivery address) using the same
  // email that was searched, which the backend checks against the order's own email.
  const [details, setDetails] = useState<Record<string, CustomerOrder>>({});
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null);

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
      setDetails({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function toggleExpand(reference: string) {
    if (expanded === reference) {
      setExpanded(null);
      return;
    }
    setExpanded(reference);
    if (details[reference]) return;
    setDetailsLoading(reference);
    try {
      const { order } = await orderStore.trackByReference(reference, searchedEmail);
      if (order) setDetails((prev) => ({ ...prev, [reference]: order }));
    } catch {
      // Fall back to the summary row already shown — non-fatal.
    } finally {
      setDetailsLoading(null);
    }
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
                      {o.status.replace(/_/g, " ")}
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
                    {detailsLoading === o.reference ? (
                      <InlineProgress size="sm" />
                    ) : (
                      <OrderCard order={details[o.reference] ?? o} compact />
                    )}
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

function OrderCard({ order, compact = false }: { order: CustomerOrder; compact?: boolean }) {
  const { businessKraPin } = useSiteConfig();

  async function handleDownload() {
    const { order: full } = await orderStore.getFullOrder(order.reference);
    const o = full ?? order;
    downloadReceiptPdf({
      reference: o.reference,
      invoiceNumber: o.invoiceNumber,
      businessKraPin,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      shippingAddress: o.shippingAddress,
      city: o.city,
      county: o.county,
      currency: o.currency,
      subtotal: o.subtotal,
      shippingFee: o.shippingFee,
      discount: o.discount,
      taxableAmount: o.taxableAmount,
      grossTaxableAmount: o.grossTaxableAmount,
      vatAmount: o.vatAmount,
      total: o.total,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      paymentReference: o.paymentReference,
      receiptNumber: o.receiptNumber,
      fulfillmentType: o.fulfillmentType,
      courierServiceName: o.courierServiceName,
      items: o.items.map((it) => ({
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
              {order.status.replace(/_/g, " ")}
            </span>
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <FileDown className="h-3.5 w-3.5" /> Receipt
            </button>
          </div>
        </div>
      )}

      <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-muted-foreground">Placed</dt><dd>{new Date(order.createdAt).toLocaleString("en-KE")}</dd></div>
        <div><dt className="text-muted-foreground">Total</dt><dd className="font-semibold">{fmt(order.total)}</dd></div>
        <div><dt className="text-muted-foreground">Payment</dt><dd>{order.paymentStatus} · {order.paymentMethod}</dd></div>
        <div><dt className="text-muted-foreground">Customer</dt><dd>{maskEmail(order.customerEmail)}</dd></div>
        {order.shippingAddress && (
          <div><dt className="text-muted-foreground">Delivery to</dt><dd>{order.shippingAddress}{order.city ? `, ${order.city}` : ""}</dd></div>
        )}
        {order.trackingNumber && <div><dt className="text-muted-foreground">Tracking #</dt><dd>{order.trackingNumber}</dd></div>}
      </dl>

      {compact && (
        <button
          type="button"
          onClick={handleDownload}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary"
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

      {order.etrRequested && (
        <div className="mt-4 rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
          <p className="text-xs uppercase tracking-widest">ETR & tax documents</p>
          {order.documentBundleStatus === "SENT" && order.etrAvailableUntil ? (
            <p className="mt-1">
              Emailed to <span className="font-medium text-foreground">{order.documentsEmail}</span>. ETR
              available for re-download/resend until{" "}
              <span className="font-medium text-foreground">
                {new Date(order.etrAvailableUntil).toLocaleDateString("en-KE")}
              </span>{" "}
              — after that, contact us with your order reference.
            </p>
          ) : order.documentBundleStatus === "EXPIRED" ? (
            <p className="mt-1">Download window expired — contact us with your order reference for a fresh copy.</p>
          ) : (
            <p className="mt-1">
              Waiting on our team to upload your ETR — will be emailed to{" "}
              <span className="font-medium text-foreground">{order.documentsEmail}</span> once ready.
            </p>
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
            {order.trackingEvents.slice().reverse().map((e, i) => (
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
