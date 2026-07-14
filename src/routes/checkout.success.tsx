import { Link, useSearchParams } from "react-router-dom";

import { useEffect, useState } from "react";
import { CheckCircle2, Gift, X } from "lucide-react";
import { z } from "zod";
import { SiteLayout } from "@/components/SiteLayout";
import { PrintReceipt } from "@/components/PrintReceipt";
import { orderStore, type CustomerOrder } from "@/services/orderStore";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthModal } from "@/contexts/AuthModalContext";

const searchSchema = z.object({ ref: z.string() });



function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function SuccessPage() {
  const [_searchParams] = useSearchParams();
  const ref = _searchParams.get("ref") ?? undefined;

  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const { isAuthenticated } = useAuth();
  const { openRegister } = useAuthModal();
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  useEffect(() => {
    orderStore.getStatus(ref ?? "").then((res) => setOrder(res.order));
  }, [ref]);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-20">
        <div className="rounded-2xl border border-border bg-card p-6 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <CheckCircle2 className="h-8 w-8 text-accent" />
          </div>
          <h1 className="mt-6 font-display text-3xl sm:text-4xl">Payment confirmed</h1>
          <p className="mt-3 text-muted-foreground">
            Thank you! Your order <span className="font-semibold text-foreground">{ref}</span> is now in production.
            We'll be in touch within 24 hours with proofs and a delivery ETA.
          </p>

          {order && (
            <dl className="mx-auto mt-8 max-w-md space-y-2 rounded-xl border border-border bg-background/50 p-5 text-left text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Reference</dt><dd className="font-mono">{order.reference}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">M-Pesa code</dt><dd className="font-mono">{order.paymentReference ?? order.receiptNumber ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Items</dt><dd>{order.items.length}</dd></div>
              <div className="flex justify-between border-t border-border pt-2"><dt className="text-muted-foreground">Total paid</dt><dd className="font-semibold">{fmt(order.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Delivery to</dt><dd className="text-right">{order.shippingAddress}, {order.city}</dd></div>
            </dl>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to={ref ? `/orders/track?ref=${ref}` : "/orders/track"} className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Track this order
            </Link>
            {order && <PrintReceipt order={order} />}
            <Link to="/products" className="rounded-full border border-border bg-background px-6 py-3 text-sm font-medium text-foreground hover:bg-secondary">
              Continue shopping
            </Link>
          </div>

          {!isAuthenticated && !nudgeDismissed && (
            <div className="relative mx-auto mt-8 max-w-md rounded-xl border border-dashed border-accent/40 bg-accent/5 p-5 text-left">
              <button
                type="button"
                onClick={() => setNudgeDismissed(true)}
                aria-label="Dismiss"
                className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
                  <Gift className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Want to track this order and earn rewards?</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Create a free account to save your order history and start earning Reward Coupons on every purchase.
                  </p>
                  <button
                    type="button"
                    onClick={() => openRegister()}
                    className="mt-3 rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent/90"
                  >
                    Create free account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}

export default SuccessPage;
