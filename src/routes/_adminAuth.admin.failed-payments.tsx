import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { listFailedPayments, type FailedPayment } from "@/services/commerceApi";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AgeBadge, formatDateShort, formatKes } from "@/components/admin/commerceUi";
import { HelpPanel, HelpAnchor } from "@/components/admin/HelpPanel";
import { fulfillmentTypeShortLabel } from "@/lib/allOrdersBoardColumns";

const PAGE_SIZE = 25;

function methodLabel(method: string | null): string {
  switch (method) {
    case "PAYHERO":
      return "PayHero";
    case "MPESA":
      return "M-Pesa";
    case "BANK_TRANSFER":
      return "Bank transfer";
    case "CASH_ON_DELIVERY":
      return "Cash on delivery";
    default:
      return method ?? "—";
  }
}

function ProductList({ items }: { items: FailedPayment["items"] }) {
  if (items.length === 0) return <span style={{ color: "var(--admin-muted)" }}>—</span>;
  return (
    <ul style={{ margin: 0, paddingLeft: 16 }}>
      {items.map((it, i) => (
        <li key={i}>
          {it.quantity ?? 1} × {it.productName}
          {it.collectionName ? ` (${it.collectionName})` : ""}
          {it.size ? ` · ${it.size}` : ""}
        </li>
      ))}
    </ul>
  );
}

function DeliveryLabel({ row }: { row: FailedPayment }) {
  return (
    <>
      {fulfillmentTypeShortLabel(row.fulfillmentType)}
      {row.courierServiceName ? ` · ${row.courierServiceName}` : ""}
    </>
  );
}

function StatusBadge({ row }: { row: FailedPayment }) {
  if (row.orderPaymentStatus === "PAID") {
    return (
      <span className="admin-badge" style={{ marginLeft: 6, fontSize: 9 }}>
        PAID SINCE
      </span>
    );
  }
  return null;
}

/**
 * Read-only record of every payment attempt that failed — the reason Daraja gave, the amount,
 * when, which products, and the delivery mode chosen — so staff can phone the customer with
 * context. A row marked "PAID SINCE" means the customer retried and the order is now paid.
 */
function FailedPaymentsPage() {
  const allowed = useRequirePermission([PERM.ORDER_VERIFY_PAYMENT, PERM.ORDER_MANAGE_ALL]);
  const [rows, setRows] = useState<FailedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const refresh = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const res = await listFailedPayments(targetPage, PAGE_SIZE);
      setRows(res.rows);
      setTotalPages(Math.max(1, res.totalPages));
      setTotal(res.total);
    } catch (err) {
      reportAdminError(err, "Failed to load failed payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh(page);
  }, [page, refresh]);

  if (!allowed) return null;

  return (
    <AdminLayout title="Failed Payments" onReload={() => void refresh(page)}>
      <div className="admin-page-stack">
        <HelpAnchor>
          <div className="admin-panel">
            <HelpPanel title="Failed payments">
              <p>
                Every payment attempt that did not go through, most recent first, with the reason
                reported by M-Pesa. Use it to follow up with the customer. An attempt marked{" "}
                <b>PAID SINCE</b> was retried successfully and needs no action. Attempts still
                waiting on a result are on the <b>Stuck Payments</b> page.
              </p>
            </HelpPanel>
            <div className="admin-section-heading" style={{ padding: "0 4px 10px" }}>
              <span>
                {total} failed payment{total === 1 ? "" : "s"}
              </span>
            </div>

            <div data-admin-table-scroll className="admin-hide-on-mobile-table">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Amount (KES)</th>
                    <th>Reason</th>
                    <th>Products</th>
                    <th>Delivery</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="admin-empty">Loading…</div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="admin-empty">
                          <b>No failed payments</b>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.paymentRecordId}>
                        <td>
                          <Link to={`/admin/orders?q=${encodeURIComponent(row.orderReference)}`}>
                            <b>{row.orderReference}</b>
                          </Link>
                          {row.isTestOrder && (
                            <span
                              className="admin-badge admin-badge-muted"
                              style={{ marginLeft: 6, fontSize: 9 }}
                            >
                              TEST
                            </span>
                          )}
                          <StatusBadge row={row} />
                        </td>
                        <td>
                          {row.contactName}
                          <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>{row.phone}</div>
                        </td>
                        <td>
                          <b>{formatKes(row.amount)}</b>
                          <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                            {methodLabel(row.method)}
                            {row.purpose === "DELIVERY_FEE" ? " · delivery fee" : ""}
                          </div>
                        </td>
                        <td>{row.failureReason ?? "No reason given"}</td>
                        <td>
                          <ProductList items={row.items} />
                        </td>
                        <td>
                          <DeliveryLabel row={row} />
                        </td>
                        <td>
                          {formatDateShort(row.failedAt)} <AgeBadge since={row.failedAt} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div
              className="admin-show-mobile admin-card-list"
              style={{ marginTop: 8, padding: 12 }}
            >
              {loading ? (
                <div className="admin-empty">Loading…</div>
              ) : rows.length === 0 ? (
                <div className="admin-empty">
                  <b>No failed payments</b>
                </div>
              ) : (
                rows.map((row) => (
                  <div key={row.paymentRecordId} className="admin-card">
                    <div className="admin-card-row">
                      <b>
                        {row.orderReference}
                        <StatusBadge row={row} />
                      </b>
                      <b>{formatKes(row.amount)}</b>
                    </div>
                    <div className="admin-card-row">
                      <span>{row.contactName}</span>
                      <span style={{ color: "var(--admin-muted)" }}>{row.phone}</span>
                    </div>
                    <div style={{ fontSize: 12, padding: "4px 0" }}>
                      <b>Reason:</b> {row.failureReason ?? "No reason given"}
                    </div>
                    <div style={{ fontSize: 12, padding: "4px 0" }}>
                      <ProductList items={row.items} />
                    </div>
                    <div
                      className="admin-card-row"
                      style={{ fontSize: 11, color: "var(--admin-muted)" }}
                    >
                      <span>
                        {methodLabel(row.method)} · <DeliveryLabel row={row} />
                      </span>
                      <span>
                        {formatDateShort(row.failedAt)} <AgeBadge since={row.failedAt} />
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  padding: "12px 4px",
                }}
              >
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  disabled={page <= 0 || loading}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  disabled={page >= totalPages - 1 || loading}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </HelpAnchor>
      </div>
    </AdminLayout>
  );
}

export default FailedPaymentsPage;
