import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Package, MapPin, Phone, Mail, RotateCcw, ShoppingBag, CheckCircle2, Clock, Truck, AlertCircle, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PrintReceipt } from "@/components/PrintReceipt";
import { orderStore, type CustomerOrder } from "@/services/orderStore";
import { resolveStatusDisplay } from "@/lib/orderStatusV2";
import { refundStore, refundEligibility, type RefundRequest, type RefundDesiredAction } from "@/services/refundStore";
import { useCart } from "@/contexts/CartContext";



function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function statusIcon(status: string) {
  if (status === "DELIVERED") return CheckCircle2;
  if (status === "SHIPPED" || status === "PACKED") return Truck;
  if (status === "PAYMENT_FAILED" || status === "CANCELLED") return AlertCircle;
  return Clock;
}

function statusTone(status: string) {
  if (status === "DELIVERED" || status === "PAID") return "bg-accent/15 text-accent";
  if (status === "PAYMENT_FAILED" || status === "CANCELLED") return "bg-destructive/15 text-destructive";
  return "bg-secondary text-foreground";
}

function OrderDetailPage() {
  const { reference } = useParams();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const [order, setOrder] = useState<CustomerOrder | null | undefined>(undefined);
  const [refund, setRefund] = useState<RefundRequest | null>(null);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    orderStore.getMine(reference ?? "").then((res) => setOrder(res.order));
    refundStore.getForOrder(reference ?? "").then(setRefund);
  }, [reference]);

  const StatusIcon = useMemo(() => statusIcon(order?.status ?? ""), [order?.status]);
  const eligibility = useMemo(() => order ? refundEligibility(order) : { eligible: false }, [order]);

  if (order === undefined) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-4xl px-5 py-16 text-center text-sm text-muted-foreground">Loading…</section>
      </SiteLayout>
    );
  }

  if (order === null) {
    return <Navigate to="/account/orders" replace />;
  }

  async function handleReorder() {
    if (!order) return;
    setReordering(true);
    const res = await orderStore.reorder(order.reference);
    if (res.ok) {
      toast.success("Items added to cart");
      navigate("/cart");
    } else {
      // Fallback: add locally
      for (const it of order.items) {
        addItem({
          productId: it.productId,
          productName: it.productName,
          primaryImageUrl: it.primaryImageUrl,
          size: it.size,
          material: it.material,
          finish: it.finish,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
        });
      }
      toast.success("Items added to cart");
      navigate("/cart");
    }
    setReordering(false);
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-5 py-12 lg:px-8 lg:py-16">
        <Link to="/account/orders" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> All orders
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">Order</p>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl">{order.reference}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Placed {new Date(order.createdAt).toLocaleString("en-KE")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusTone(order.status)}`}>
              <StatusIcon className="h-3.5 w-3.5" />{" "}
              {resolveStatusDisplay(order.fulfillmentType, order.statusV2)?.label ?? order.status.replace(/_/g, " ")}
            </span>
            <PrintReceipt order={order} />
            {eligibility.eligible && !refund && (
              <button onClick={() => setShowRefundForm(true)} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary">
                <Undo2 className="h-3.5 w-3.5" /> Request refund
              </button>
            )}
            <button onClick={handleReorder} disabled={reordering} className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              <RotateCcw className="h-3.5 w-3.5" /> {reordering ? "Adding…" : "Re-order"}
            </button>
          </div>
        </div>

        {refund && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-semibold">Refund request: {refund.status}</p>
            <p className="mt-1 text-xs text-muted-foreground">Reason: {refund.reason}</p>
            <p className="text-xs text-muted-foreground">Action: {refund.desiredAction.replace(/_/g, " ")}</p>
            {refund.adminNote && <p className="mt-2 text-xs">Admin note: {refund.adminNote}</p>}
          </div>
        )}

        {showRefundForm && (
          <RefundForm
            onCancel={() => setShowRefundForm(false)}
            onSubmit={async (reason, desiredAction) => {
              if (!order) return;
              const { request } = await refundStore.submit(order, { reason, desiredAction });
              setRefund(request);
              setShowRefundForm(false);
              toast.success("Refund request submitted — we'll respond within 2 business days.");
            }}
            daysRemaining={eligibility.daysRemaining ?? 14}
          />
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg">Items</h2>
              <ul className="mt-4 divide-y divide-border">
                {order.items.map((it, i) => (
                  <li key={i} className="flex items-center gap-4 py-4">
                    <img src={it.primaryImageUrl} alt={it.productName} className="h-16 w-16 rounded-lg object-cover" />
                    <div className="flex-1">
                      <p className="font-semibold">{it.productName}</p>
                      <p className="text-xs text-muted-foreground">{[it.size, it.material, it.finish].filter(Boolean).join(" · ")}</p>
                      <p className="text-xs text-muted-foreground">Qty {it.quantity.toLocaleString()} × {fmt(it.unitPrice)}</p>
                    </div>
                    <p className="font-semibold">{fmt(it.lineTotal)}</p>
                  </li>
                ))}
              </ul>
            </div>

            {order.trackingEvents && order.trackingEvents.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-display text-lg">Tracking</h2>
                {order.trackingNumber && (
                  <p className="mt-1 text-xs text-muted-foreground">Tracking number: <span className="font-mono">{order.trackingNumber}</span></p>
                )}
                <ol className="mt-4 space-y-4">
                  {order.trackingEvents.map((ev, i) => (
                    <li key={i} className="flex gap-3">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                      <div>
                        <p className="text-sm font-semibold">{ev.label}</p>
                        {ev.description && <p className="text-xs text-muted-foreground">{ev.description}</p>}
                        <p className="text-[11px] text-muted-foreground">{new Date(ev.at).toLocaleString("en-KE")}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg">Summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{fmt(order.subtotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{order.fulfillmentType === "MANUAL_DELIVERY" ? "Paid to courier" : order.fulfillmentType === "PICKUP" ? "Free (pickup)" : order.shippingFee === 0 ? "Free" : fmt(order.shippingFee)}</dd></div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold"><dt>Total</dt><dd>{fmt(order.total)}</dd></div>
              </dl>
              <div className="mt-4 rounded-lg bg-secondary p-3 text-xs">
                <p className="font-semibold">{order.paymentMethod}</p>
                <p className="text-muted-foreground">{order.paymentStatus}{order.paymentReference ? ` · ${order.paymentReference}` : ""}</p>
                {order.failureReason && <p className="mt-1 text-destructive">{order.failureReason}</p>}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="font-display text-lg">
                {order.fulfillmentType === "MANUAL_DELIVERY"
                  ? "Delivery — via your sacco / courier"
                  : order.fulfillmentType === "PICKUP"
                    ? "Pickup at our shop"
                    : "Delivery"}
              </h2>
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-semibold">{order.customerName}</p>

                {order.fulfillmentType === "MANUAL_DELIVERY" ? (
                  <>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">
                      1. Where you'll collect
                    </p>
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {[order.city, order.county].filter(Boolean).join(", ") || "—"}
                    </p>
                    {order.shippingAddress && (
                      <p className="text-xs text-muted-foreground pl-5">
                        Nearest courier office: {order.shippingAddress}
                      </p>
                    )}

                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">
                      2. Sacco / courier we'll use
                    </p>
                    <p className="text-muted-foreground">
                      <Truck className="mr-1 inline h-3.5 w-3.5" />
                      {order.courierServiceName || "To confirm by phone"}
                      {order.courierType ? ` · ${order.courierType.replace(/_/g, " ").toLowerCase()}` : ""}
                    </p>
                    {order.courierStageOrOffice && (
                      <p className="text-xs text-muted-foreground pl-5">
                        Nairobi stage / office: {order.courierStageOrOffice}
                      </p>
                    )}
                    <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      Transport cost is paid directly to the sacco on collection — not included in your order total.
                    </p>
                  </>
                ) : order.fulfillmentType === "PICKUP" ? (
                  <p className="text-muted-foreground text-xs">
                    We'll call you when your order is ready for pickup at our shop.
                  </p>
                ) : (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {order.shippingAddress}, {order.city}
                  </p>
                )}

                <p className="flex items-center gap-2 text-muted-foreground pt-2"><Phone className="h-3.5 w-3.5" /> {order.customerPhone}</p>
                <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {order.customerEmail}</p>
                {order.notes && (
                  <p className="mt-2 rounded-lg bg-secondary p-2 text-xs"><Package className="mr-1 inline h-3 w-3" /> {order.notes}</p>
                )}
              </div>
            </div>

            <Link to="/products" className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:bg-secondary">
              <ShoppingBag className="h-4 w-4" /> Continue shopping
            </Link>
          </aside>
        </div>
      </section>
    </SiteLayout>
  );
}

function RefundForm({
  onCancel,
  onSubmit,
  daysRemaining,
}: {
  onCancel: () => void;
  onSubmit: (reason: string, desiredAction: RefundDesiredAction) => Promise<void>;
  daysRemaining: number;
}) {
  const [reason, setReason] = useState("");
  const [desiredAction, setDesiredAction] = useState<RefundDesiredAction>("REFUND");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) {
      toast.error("Please describe the issue (at least 10 characters)");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(reason.trim(), desiredAction);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-border bg-card p-5">
      <p className="font-display text-lg">Request a refund or replacement</p>
      <p className="mt-1 text-xs text-muted-foreground">
        You have {daysRemaining} day{daysRemaining === 1 ? "" : "s"} left in the 14-day return window.
      </p>
      <div className="mt-4 grid gap-3">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preferred resolution</label>
        <div className="flex flex-wrap gap-2">
          {(["REFUND", "REPLACE", "STORE_CREDIT"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setDesiredAction(opt)}
              className={`rounded-full border px-4 py-1.5 text-xs ${
                desiredAction === opt ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"
              }`}
            >
              {opt === "REFUND" ? "Refund" : opt === "REPLACE" ? "Replacement" : "Store credit"}
            </button>
          ))}
        </div>
        <textarea
          required
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          placeholder="Tell us what went wrong (damaged, wrong item, late delivery, …)"
          className="mt-1 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-xs hover:bg-secondary">Cancel</button>
        <button type="submit" disabled={submitting} className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}

export default OrderDetailPage;
