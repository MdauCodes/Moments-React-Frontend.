import { Link } from "react-router-dom";

import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { orderStore, type CustomerOrder } from "@/services/orderStore";



function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

const PAGE_SIZE = 10;

function statusTone(status: string) {
  if (status === "DELIVERED" || status === "PAID") return "bg-accent/15 text-accent";
  if (status === "CANCELLED" || status === "REFUNDED") return "bg-destructive/15 text-destructive";
  return "bg-secondary text-foreground";
}

function MyOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    orderStore.listMine(page, PAGE_SIZE).then((res) => {
      setOrders(res.rows);
      setTotalPages(Math.max(1, res.totalPages));
      setLoading(false);
    });
  }, [page]);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-5xl px-5 py-12 lg:px-8 lg:py-16">
        <h1 className="font-display text-3xl sm:text-4xl">My orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">Recent orders and their payment status.</p>

        {orders === null || loading ? (
          <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">You haven't placed any orders yet.</p>
            <Link
              to="/products"
              className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Browse catalogue
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 space-y-3">
              {orders.map((o) => (
                <li
                  key={o.reference}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <Link
                    to={`/account/orders/${o.reference}`}
                    className="flex-1 min-w-[200px]"
                  >
                    <p className="font-display text-lg">{o.reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(o.createdAt).toLocaleString("en-KE")} · {o.items.length} item
                      {o.items.length !== 1 ? "s" : ""}
                    </p>
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(o.status)}`}>
                      {o.status.replace(/_/g, " ")}
                    </span>
                    <span className="font-semibold">{fmt(o.total)}</span>
                    {o.status === "PENDING_PAYMENT" ? (
                      <Link
                        to="/checkout"
                        className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                      >
                        Pay now
                      </Link>
                    ) : (
                      <Link
                        to={`/account/orders/${o.reference}`}
                        className="rounded-full border border-border px-3 py-1 text-xs hover:bg-secondary"
                      >
                        Track
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="rounded-full border border-border px-4 py-1.5 text-xs disabled:opacity-50 hover:bg-secondary"
                >
                  Previous
                </button>
                <span className="text-xs text-muted-foreground">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="rounded-full border border-border px-4 py-1.5 text-xs disabled:opacity-50 hover:bg-secondary"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </SiteLayout>
  );
}

export default MyOrdersPage;
