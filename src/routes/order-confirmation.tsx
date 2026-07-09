import { Link, useSearchParams } from "react-router-dom";

import { useEffect, useState } from "react";
import { CheckCircle2, FileDown } from "lucide-react";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { orderStore, type CustomerOrder } from "@/services/orderStore";
import { downloadReceiptPdf } from "@/lib/pdf";
import { useSiteConfig } from "@/contexts/SiteConfigContext";

const searchSchema = z.object({ ref: z.string() });



function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(n);
}

const BRAND = "#1a472a";

function OrderConfirmationPage() {
  const [_searchParams] = useSearchParams();
  const ref = _searchParams.get("ref") ?? undefined;
  const { businessKraPin } = useSiteConfig();

  const [order, setOrder] = useState<CustomerOrder | null>(null);

  useEffect(() => {
    orderStore.getStatus(ref ?? "").then((res) => setOrder(res.order));
  }, [ref]);

  const receipt = order?.paymentReference ?? order?.receiptNumber;

  const fulfillment = order?.fulfillmentType ?? "ZONE_DELIVERY";
  const isPickup = fulfillment === "PICKUP";
  const isCourier = fulfillment === "OWN_COURIER";

  const heading = isPickup
    ? "Thank you — ready for pickup"
    : isCourier
      ? "Thank you — order confirmed"
      : "Thank you — order confirmed";

  const subcopy = isPickup ? (
    <>
      We've received your payment. Order{" "}
      <span className="font-semibold text-foreground">{ref}</span> will be packed and ready
      for collection at our shop. We'll call you when it's ready — usually within 24 hours.
    </>
  ) : isCourier ? (
    <>
      We've received payment for your goods. Order{" "}
      <span className="font-semibold text-foreground">{ref}</span> is now in production.{" "}
      <strong className="text-foreground">
        Our team will call you at dispatch to confirm the transport cost.
      </strong>{" "}
      You can choose to pay it then, or collect from our shop.
    </>
  ) : (
    <>
      We've received your payment. Your order{" "}
      <span className="font-semibold text-foreground">{ref}</span> is now in production.
      We'll be in touch within 24 hours with proofs and a delivery ETA.
    </>
  );

  return (
    <SiteLayout>
      <section className="mx-auto max-w-2xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="rounded-3xl border border-border bg-card p-6 text-center sm:p-10">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: `${BRAND}15` }}
          >
            <CheckCircle2 className="h-9 w-9" style={{ color: BRAND }} />
          </div>
          <h1 className="mt-6 font-display text-3xl sm:text-4xl">{heading}</h1>
          <p className="mt-3 text-muted-foreground">{subcopy}</p>

          {order && (
            <dl className="mx-auto mt-8 max-w-sm space-y-2 rounded-2xl border border-border bg-background p-5 text-left text-sm">
              <Row label="Order reference" value={ref ?? ""} mono />
              {receipt && <Row label="M-Pesa receipt" value={receipt} mono />}
              <Row label="Goods paid" value={fmt(order.total)} />
              {isPickup ? (
                <Row label="Fulfillment" value="Pickup at shop" />
              ) : isCourier ? (
                <>
                  <Row label="Fulfillment" value="Own courier" />
                  <Row label="Transport cost" value="To be confirmed at dispatch" />
                  {order.courierType && (
                    <Row
                      label="Courier"
                      value={`${order.courierType.replace(/_/g, " ")}${
                        order.courierServiceName ? ` — ${order.courierServiceName}` : ""
                      }`}
                    />
                  )}
                  {order.courierStageOrOffice && (
                    <Row label="Stage / office" value={order.courierStageOrOffice} />
                  )}
                </>
              ) : (
                <Row label="Delivery to" value={`${order.shippingAddress}, ${order.city}`} />
              )}
            </dl>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={ref ? `/orders/track?ref=${ref}` : "/orders/track"}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
              style={{ backgroundColor: BRAND }}
            >
              Track your order
            </Link>
            {order && (
              <button
                type="button"
                onClick={() => downloadReceiptPdf({
                  reference: order.reference,
                  invoiceNumber: order.invoiceNumber,
                  businessKraPin,
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
                  total: order.total,
                  paymentMethod: order.paymentMethod,
                  paymentStatus: order.paymentStatus,
                  paymentReference: order.paymentReference,
                  receiptNumber: order.receiptNumber,
                  fulfillmentType: order.fulfillmentType,
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
                })}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
              >
                <FileDown className="h-4 w-4" /> Download receipt
              </button>
            )}
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary"
            >
              Continue shopping
            </Link>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-foreground ${mono ? "font-mono font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

export default OrderConfirmationPage;
