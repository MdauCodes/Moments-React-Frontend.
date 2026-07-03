import { Link, useNavigate, useParams } from "react-router-dom";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import {
  GatewayChip,
  MockBanner,
  ORDER_STATUS_OPTIONS,
  OrderStatusBadge,
  PaymentStatusBadge,
  formatDate,
  formatKes,
  getNextAction,
} from "@/components/admin/commerceUi";
import { getOrder, updateOrderStatus, refundOrder } from "@/services/commerceApi";
import { refundStore, type RefundRequest, type RefundRequestStatus } from "@/services/refundStore";
import type { OrderRecord, OrderStatus } from "@/services/commerceMock";



function AdminOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderRecord | undefined>();
  const [source, setSource] = useState<"live" | "mock">("mock");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffNotes, setStaffNotes] = useState("");
  const [refund, setRefund] = useState<RefundRequest | null>(null);
  const [refundNote, setRefundNote] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [showRefundInput, setShowRefundInput] = useState(false);

  useEffect(() => {
    document.title = `Order ${id} · Moments admin`;
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOrder(id ?? "")
      .then((res) => {
        if (!cancelled) {
          setOrder(res.order);
          setSource(res.source);
          setStaffNotes(res.order?.staffNotes ?? res.order?.notes ?? "");
        }
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load order"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!order?.reference) return;
    let cancelled = false;
    refundStore
      .getAdminForOrder(order.reference)
      .then((r) => {
        if (!cancelled) {
          setRefund(r);
          setRefundNote(r?.adminNote ?? "");
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [order?.reference]);

  const updateRefund = async (status: RefundRequestStatus) => {
    if (!refund) return;
    setRefundBusy(true);
    try {
      const next = await refundStore.updateStatus(refund.id, status, refundNote.trim() || undefined);
      if (next) {
        setRefund(next);
        toast.success(`Refund request ${status.toLowerCase()}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update refund");
    } finally {
      setRefundBusy(false);
    }
  };

  // Status change — also sends current staffNotes so they aren't wiped
  const handleStatusChange = async (status: OrderStatus) => {
    if (!order) return;
    setSaving(true);
    try {
      const res = await updateOrderStatus(order.id, status, staffNotes || undefined);
      if (res.order) {
        setOrder(res.order);
        toast.success(`Order moved to ${ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  // Admin-initiated refund (different from customer refund request)
  const handleRefund = async () => {
    if (!order || !refundReason.trim()) return;
    setSaving(true);
    try {
      const res = await refundOrder(order.id, refundReason.trim());
      if (res.order) {
        setOrder(res.order);
        setShowRefundInput(false);
        setRefundReason("");
        toast.success("Refund processed — order marked as REFUNDED");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refund failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title={`Order ${id}`}>
        <div className="admin-empty">Loading order…</div>
      </AdminLayout>
    );
  }
  if (!order) {
    return (
      <AdminLayout title="Order not found">
        <div className="admin-panel" style={{ padding: 24 }}>
          <p>We couldn't find that order.</p>
          <button className="admin-btn admin-btn-ghost" onClick={() => navigate("/admin/orders")}>
            Back to orders
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={`Order ${order.reference}`}>
      <div className="admin-page-stack">
        <MockBanner source={source} />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link to="/admin/orders" className="admin-btn admin-btn-ghost">
            ← All orders
          </Link>
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
          <GatewayChip gateway={order.paymentGateway} />
          <span style={{ color: "var(--admin-muted)", fontSize: 12 }}>Created {formatDate(order.createdAt)}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }} data-admin-grid>
          {/* Left: line items */}
          <div className="admin-panel" style={{ padding: 18 }}>
            <h2 style={{ margin: 0, marginBottom: 12, fontFamily: "var(--font-display)" }}>Line items</h2>
            <div data-admin-table-scroll>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Unit price</th>
                    <th>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((it, idx) => (
                    <tr key={it.productId ?? idx}>
                      <td>
                        <b>{it.name}</b>
                        <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>
                          {[it.size, it.material, it.finish].filter(Boolean).join(" · ") || it.productId}
                        </div>
                      </td>
                      <td>{it.qty}</td>
                      <td>{formatKes(it.unitPrice)}</td>
                      <td>
                        <b>{formatKes((it as any).lineTotal ?? it.qty * it.unitPrice)}</b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "grid", gap: 6, marginTop: 16, justifyContent: "end", textAlign: "right" }}>
              <div style={{ color: "var(--admin-muted)", fontSize: 12 }}>Subtotal: {formatKes(order.subtotal)}</div>
              <div style={{ color: "var(--admin-muted)", fontSize: 12 }}>
                Delivery: {order.shippingFee === 0 ? "Free" : formatKes(order.shippingFee)}
              </div>
              {Number((order as any).discount ?? 0) > 0 && (
                <div style={{ color: "var(--admin-muted)", fontSize: 12 }}>
                  Discount: − {formatKes((order as any).discount)}
                </div>
              )}
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>Total: {formatKes(order.total)}</div>
            </div>

            {/* Status history */}
            {Array.isArray((order as any).statusHistory) && (order as any).statusHistory.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div className="admin-label" style={{ marginBottom: 10 }}>
                  Status history
                </div>
                <ol
                  style={{ borderLeft: "2px solid var(--admin-border)", paddingLeft: 14, margin: 0, listStyle: "none" }}
                >
                  {[...(order as any).statusHistory].reverse().map((h: any, i: number) => (
                    <li key={i} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {h.fromStatus
                          ? `${ORDER_STATUS_OPTIONS.find((o) => o.value === h.fromStatus)?.label ?? h.fromStatus} → `
                          : ""}
                        {ORDER_STATUS_OPTIONS.find((o) => o.value === h.toStatus)?.label ?? h.toStatus}
                      </div>
                      {h.note && (
                        <div style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 2 }}>{h.note}</div>
                      )}
                      <div style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 2 }}>
                        {h.changedBy ? `by ${h.changedBy} · ` : ""}
                        {formatDate(h.changedAt)}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Right: customer + actions */}
          <div className="admin-page-stack">
            {/* Customer info */}
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Customer</div>
              <div style={{ marginTop: 8, fontWeight: 600 }}>{order.customerName}</div>
              <div style={{ fontSize: 13 }}>{order.customerEmail || "—"}</div>
              <div style={{ fontSize: 13 }}>{order.customerPhone}</div>
              <div style={{ marginTop: 10 }} className="admin-label">
                Delivery address
              </div>
              <div style={{ marginTop: 6, fontSize: 13 }}>{order.shippingAddress}</div>
              <div style={{ fontSize: 13 }}>
                {order.city}
                {(order as any).county ? `, ${(order as any).county}` : ""}
              </div>
              {(order as any).postalCode && (
                <div style={{ fontSize: 13, color: "var(--admin-muted)" }}>{(order as any).postalCode}</div>
              )}
              {(order as any).promoCode && (
                <>
                  <div style={{ marginTop: 10 }} className="admin-label">
                    Promo code
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, fontFamily: "monospace" }}>{(order as any).promoCode}</div>
                </>
              )}
              {order.trackingNumber && (
                <>
                  <div style={{ marginTop: 10 }} className="admin-label">
                    Tracking number
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, fontFamily: "monospace" }}>{order.trackingNumber}</div>
                </>
              )}
              {(order as any).fulfillmentType && (
                <>
                  <div style={{ marginTop: 10 }} className="admin-label">
                    Fulfillment
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13 }}>
                    {String((order as any).fulfillmentType).replace(/_/g, " ")}
                  </div>
                </>
              )}
            </div>

            {/* Courier details — only when OWN_COURIER */}
            {(order as any).fulfillmentType === "OWN_COURIER" && (
              <div className="admin-panel" style={{ padding: 16 }}>
                <div className="admin-label">Courier details</div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <div>
                    <b>Type:</b>{" "}
                    {String((order as any).courierType ?? "—").replace(/_/g, " ")}
                  </div>
                  {(order as any).courierServiceName && (
                    <div style={{ marginTop: 4 }}>
                      <b>Service:</b> {(order as any).courierServiceName}
                    </div>
                  )}
                  {(order as any).courierStageOrOffice && (
                    <div style={{ marginTop: 4 }}>
                      <b>Stage / office:</b> {(order as any).courierStageOrOffice}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 10px",
                    fontSize: 12,
                    borderRadius: 6,
                    background: "rgba(245, 158, 11, 0.08)",
                    border: "1px dashed rgba(245, 158, 11, 0.5)",
                    color: "var(--admin-fg)",
                  }}
                >
                  Transport cost to be confirmed at dispatch.
                </div>
              </div>
            )}

            {/* Status update */}
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Update status</div>

              {order.status === "PENDING_PAYMENT" && (
                <p style={{ marginTop: 8, fontSize: 13, color: "var(--admin-muted)" }}>
                  Waiting for the customer's M-Pesa payment — nothing to do here yet.
                </p>
              )}

              {/* Single contextual next-action button, same pattern as the
                  payment/preparation/dispatch queues — only the one valid
                  next step is shown, not every status always-enabled. */}
              {(() => {
                const next = getNextAction(order.status);
                if (!next) return null;
                return (
                  <button
                    className="admin-btn admin-btn-primary"
                    disabled={saving}
                    style={{ marginTop: 8 }}
                    onClick={() => handleStatusChange(next.nextStatus)}
                  >
                    {saving && <Loader2 size={14} className="animate-spin inline mr-1" />}
                    {next.label}
                  </button>
                );
              })()}

              {/* Manual override for edge cases the linear flow doesn't cover
                  (e.g. correcting a mis-click, jumping straight to CANCELLED). */}
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--admin-muted)" }}>
                  Manual override
                </summary>
                <select
                  className="admin-select"
                  value={order.status}
                  onChange={(e) => handleStatusChange(e.target.value as OrderStatus)}
                  disabled={saving}
                  style={{ marginTop: 8 }}
                >
                  {ORDER_STATUS_OPTIONS.filter((o) => o.value !== "ALL").map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </details>

              {order.paymentStatus === "PAID" && order.status !== "REFUNDED" && order.status !== "CANCELLED" && (
                <button
                  className="admin-btn admin-btn-danger"
                  disabled={saving}
                  style={{ marginTop: 12 }}
                  onClick={() => setShowRefundInput((v) => !v)}
                >
                  Process refund
                </button>
              )}

              {showRefundInput && (
                <div style={{ marginTop: 12 }}>
                  <textarea
                    className="admin-textarea"
                    rows={2}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Reason for refund (required)…"
                    style={{ marginBottom: 8 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="admin-btn admin-btn-danger"
                      disabled={saving || !refundReason.trim()}
                      onClick={handleRefund}
                    >
                      {saving && <Loader2 size={14} className="animate-spin inline mr-1" />}
                      Confirm refund
                    </button>
                    <button
                      className="admin-btn admin-btn-ghost"
                      onClick={() => {
                        setShowRefundInput(false);
                        setRefundReason("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Staff notes */}
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Staff notes</div>
              <textarea
                className="admin-textarea"
                rows={3}
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                placeholder="Internal notes — not visible to customer…"
                style={{ marginTop: 8 }}
              />
              <button
                className="admin-btn admin-btn-ghost"
                disabled={saving}
                style={{ marginTop: 8 }}
                onClick={() => handleStatusChange(order.status)}
              >
                {saving && <Loader2 size={14} className="animate-spin inline mr-1" />}
                Save notes
              </button>
            </div>

            {/* Customer refund request panel */}
            {refund && (
              <div className="admin-panel" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div className="admin-label">Refund / return request</div>
                  <span
                    className={`n ${
                      refund.status === "PENDING" ? "n-muted" : refund.status === "REJECTED" ? "n-muted" : "n-ok"
                    }`}
                  >
                    {refund.status}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  <div>
                    <b>Wants:</b> {refund.desiredAction.replace(/_/g, " ")}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <b>Reason:</b>
                  </div>
                  <p style={{ whiteSpace: "pre-wrap", margin: "4px 0", color: "var(--admin-muted)" }}>
                    {refund.reason}
                  </p>
                  <div style={{ color: "var(--admin-muted)", fontSize: 11 }}>
                    Submitted {new Date(refund.createdAt).toLocaleString("en-KE")}
                    {refund.updatedAt !== refund.createdAt &&
                      ` · updated ${new Date(refund.updatedAt).toLocaleString("en-KE")}`}
                  </div>
                </div>
                <label style={{ display: "block", marginTop: 12 }}>
                  <span className="admin-label">Admin note (shown to customer)</span>
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    value={refundNote}
                    onChange={(e) => setRefundNote(e.target.value)}
                    placeholder="e.g. Approved — replacement dispatched via Sendy."
                  />
                </label>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button
                    className="admin-btn admin-btn-primary"
                    disabled={refundBusy || refund.status === "APPROVED"}
                    onClick={() => void updateRefund("APPROVED")}
                  >
                    {refundBusy && <Loader2 size={14} className="animate-spin inline" />} Approve
                  </button>
                  <button
                    className="admin-btn admin-btn-ghost"
                    disabled={refundBusy || refund.status === "REJECTED"}
                    onClick={() => void updateRefund("REJECTED")}
                  >
                    Reject
                  </button>
                  <button
                    className="admin-btn admin-btn-ghost"
                    disabled={refundBusy || refund.status === "RESOLVED"}
                    onClick={() => void updateRefund("RESOLVED")}
                  >
                    Mark resolved
                  </button>
                </div>
                <p style={{ color: "var(--admin-muted)", fontSize: 11, marginTop: 10 }}>
                  If issuing a money refund, also use the <b>Process refund</b> button above to update the order status.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminOrderDetailPage;
