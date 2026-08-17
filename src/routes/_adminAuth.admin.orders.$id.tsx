import { Link, useNavigate, useParams } from "react-router-dom";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError, reportTumaBodaBookingFailure } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import {
  GatewayChip,
  MockBanner,
  ORDER_STATUS_OPTIONS,
  OrderStatusBadge,
  PaymentStatusBadge,
  formatDate,
  formatKes,
} from "@/components/admin/commerceUi";
import { getNextActionV2 } from "@/lib/orderStatusV2";
import {
  getOrder,
  updateOrderStatus,
  requestOrderRefund,
  resolveOrderRefundRequest,
  markOrderPaymentRefunded,
  restoreOrderInventory,
  triggerDeliveryFeeStk,
  recordDeliveryFeePaid,
} from "@/services/commerceApi";
import type { OrderRecord, OrderStatus } from "@/services/commerceMock";
import { useAuth } from "@/contexts/AdminAuthContext";
import { resolveStaffRole, STAFF_ROLE_RANK } from "@/lib/roles";



function AdminOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminOrAbove = (() => {
    const role = resolveStaffRole(user);
    return !!role && STAFF_ROLE_RANK[role] <= STAFF_ROLE_RANK.ADMIN;
  })();
  const [order, setOrder] = useState<OrderRecord | undefined>();
  const [source, setSource] = useState<"live" | "mock">("mock");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staffNotes, setStaffNotes] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [showRefundInput, setShowRefundInput] = useState(false);
  const [refundActionBusy, setRefundActionBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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
      .catch((err) => reportAdminError(err, "Failed to load order"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Status change — also sends current staffNotes so they aren't wiped
  const handleStatusChange = async (status: OrderStatus) => {
    if (!order) return;
    setSaving(true);
    try {
      const res = await updateOrderStatus(order.id, status, staffNotes || undefined);
      if (res.order) {
        setOrder(res.order);
        if (res.order.tumabodaBookingFailureReason) {
          reportTumaBodaBookingFailure(res.order.reference, res.order.tumabodaBookingFailureReason);
        } else {
          toast.success(`Order moved to ${ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}`);
        }
      }
    } catch (err) {
      reportAdminError(err, "Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  // Refunds are deliberately NOT one automated action — logging a request just records the
  // complaint. Every consequence (marking payment refunded, restoring stock, flipping order
  // status) is a separate, explicit admin step below, never bundled together.
  const handleLogRefundRequest = async () => {
    if (!order || !refundReason.trim()) return;
    setSaving(true);
    try {
      const res = await requestOrderRefund(order.id, refundReason.trim());
      if (res.order) {
        setOrder(res.order);
        setShowRefundInput(false);
        setRefundReason("");
        toast.success("Refund request logged — nothing else changed yet");
      }
    } catch (err) {
      reportAdminError(err, "Failed to log refund request");
    } finally {
      setSaving(false);
    }
  };

  const handleResolveRefundRequest = async () => {
    if (!order) return;
    setRefundActionBusy(true);
    try {
      const res = await resolveOrderRefundRequest(order.id);
      if (res.order) {
        setOrder(res.order);
        toast.success("Refund request marked resolved");
      }
    } catch (err) {
      reportAdminError(err, "Failed to resolve refund request");
    } finally {
      setRefundActionBusy(false);
    }
  };

  const handleMarkPaymentRefunded = async () => {
    if (!order) return;
    if (!window.confirm("Mark this order's payment as refunded? Only do this once you've actually reversed the payment yourself.")) return;
    setRefundActionBusy(true);
    try {
      const res = await markOrderPaymentRefunded(order.id, order.refundRequestReason ?? "Refund processed");
      if (res.order) {
        setOrder(res.order);
        toast.success("Payment marked refunded");
      }
    } catch (err) {
      reportAdminError(err, "Failed to mark payment refunded");
    } finally {
      setRefundActionBusy(false);
    }
  };

  const handleRestoreInventory = async () => {
    if (!order) return;
    if (!window.confirm("Restore stock for every item on this order?")) return;
    setRefundActionBusy(true);
    try {
      const res = await restoreOrderInventory(order.id);
      if (res.order) {
        setOrder(res.order);
        toast.success("Inventory restored");
      }
    } catch (err) {
      reportAdminError(err, "Failed to restore inventory");
    } finally {
      setRefundActionBusy(false);
    }
  };

  const [feeAmount, setFeeAmount] = useState("");
  const [feePhone, setFeePhone] = useState("");
  const [feeMethod, setFeeMethod] = useState<"SELF_PAID" | "ADMIN_STK" | "MANUAL_RECORD">("SELF_PAID");
  const [feeBusy, setFeeBusy] = useState(false);

  const handleTriggerFeeStk = async () => {
    if (!order) return;
    const amount = Number(feeAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (!feePhone.trim()) {
      toast.error("Enter the customer's phone number");
      return;
    }
    setFeeBusy(true);
    try {
      const res = await triggerDeliveryFeeStk(order.id, amount, feePhone.trim());
      if (res.order) {
        setOrder(res.order);
        toast.success("STK prompt sent — confirm once the customer enters their PIN");
      }
    } catch (err) {
      reportAdminError(err, "Failed to send STK prompt");
    } finally {
      setFeeBusy(false);
    }
  };

  const handleRecordFeePaid = async () => {
    if (!order) return;
    const amount = Number(feeAmount || order.deliveryFeeAmount || 0);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setFeeBusy(true);
    try {
      const res = await recordDeliveryFeePaid(order.id, amount, feeMethod);
      if (res.order) {
        setOrder(res.order);
        toast.success("Delivery fee recorded as paid");
      }
    } catch (err) {
      reportAdminError(err, "Failed to record delivery fee");
    } finally {
      setFeeBusy(false);
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
    <AdminLayout title={`Order ${order.reference}`} onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <MockBanner source={source} />

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Link to="/admin/orders" className="admin-btn admin-btn-ghost">
            ← All orders
          </Link>
          <OrderStatusBadge status={order.status} fulfillmentType={order.fulfillmentType} statusV2={order.statusV2} />
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

            {/* Courier details — only when MANUAL_DELIVERY */}
            {(order as any).fulfillmentType === "MANUAL_DELIVERY" && (
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

                <div style={{ marginTop: 14, borderTop: "1px solid var(--admin-border)", paddingTop: 12 }}>
                  <div className="admin-label">Delivery fee</div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    <b>Status:</b> {order.deliveryFeeStatus ?? "UNPAID"}
                    {order.deliveryFeeAmount != null && (
                      <>
                        {" · "}
                        <b>Amount:</b> {formatKes(order.deliveryFeeAmount)}
                      </>
                    )}
                    {order.deliveryFeeMethod && (
                      <>
                        {" · "}
                        <b>Method:</b> {order.deliveryFeeMethod.replace(/_/g, " ")}
                      </>
                    )}
                  </div>

                  {order.deliveryFeeStatus !== "PAID" && (
                    <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                      <input
                        type="number"
                        placeholder="Agreed fee amount (KES)"
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(e.target.value)}
                        className="admin-input"
                        style={{ fontSize: 13 }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="tel"
                          placeholder="Customer phone (for STK)"
                          value={feePhone}
                          onChange={(e) => setFeePhone(e.target.value)}
                          className="admin-input"
                          style={{ fontSize: 13, flex: 1 }}
                        />
                        <button
                          type="button"
                          className="admin-btn"
                          disabled={feeBusy}
                          onClick={handleTriggerFeeStk}
                        >
                          Send STK prompt
                        </button>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <select
                          value={feeMethod}
                          onChange={(e) => setFeeMethod(e.target.value as typeof feeMethod)}
                          className="admin-input"
                          style={{ fontSize: 13 }}
                        >
                          <option value="SELF_PAID">Customer paid directly (e.g. paybill)</option>
                          <option value="ADMIN_STK">STK prompt confirmed paid</option>
                          <option value="MANUAL_RECORD">Cash / other — just record it</option>
                        </select>
                        <button
                          type="button"
                          className="admin-btn admin-btn-primary"
                          disabled={feeBusy}
                          onClick={handleRecordFeePaid}
                        >
                          Mark fee as paid
                        </button>
                      </div>
                    </div>
                  )}
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
                const next = getNextActionV2(order.fulfillmentType, order.statusV2, order.status);
                if (!next) return null;
                return (
                  <button
                    className="admin-btn admin-btn-primary"
                    disabled={saving}
                    style={{ marginTop: 8 }}
                    onClick={() => handleStatusChange(next.nextLegacyStatus)}
                  >
                    {saving && <Loader2 size={14} className="animate-spin inline mr-1" />}
                    {next.label}
                  </button>
                );
              })()}

              {/* Manual override for edge cases the linear flow doesn't cover
                  (e.g. correcting a mis-click, jumping straight to CANCELLED).
                  REFUNDED is deliberately excluded — that status only gets set
                  through the Refund card below, never as a quick dropdown pick. */}
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
                  {ORDER_STATUS_OPTIONS.filter((o) => o.value !== "ALL" && (o.value !== "REFUNDED" || order.status === "REFUNDED")).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </details>

              {order.status !== "CANCELLED" && order.status !== "REFUNDED" && (
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  style={{ marginTop: 12, color: "var(--admin-clay, #c0392b)", borderColor: "var(--admin-clay, #c0392b)" }}
                  disabled={saving}
                  onClick={() => {
                    if (!window.confirm(`Cancel order ${order.reference}? This cannot be undone from this screen.`)) return;
                    void handleStatusChange("CANCELLED");
                  }}
                >
                  Cancel order
                </button>
              )}
            </div>

            {/* Refund — a separate card from status, on purpose: refunding an order is a
                distinct decision from moving it through fulfilment, and keeping them apart
                stops the "what does this button actually do" confusion of one crowded panel. */}
            <div className="admin-panel" style={{ padding: 16 }}>
              <div className="admin-label">Refund</div>
              {order.refundRequestedAt && !order.refundResolvedAt ? (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px dashed rgba(239, 68, 68, 0.4)",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>Refund requested — awaiting manual resolution</div>
                  <p style={{ margin: "6px 0", fontSize: 12, color: "var(--admin-muted)", whiteSpace: "pre-wrap" }}>
                    {order.refundRequestReason}
                  </p>
                  <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                    Requested {formatDate(order.refundRequestedAt)}
                    {order.refundRequestedBy ? ` by ${order.refundRequestedBy}` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    {isAdminOrAbove && (
                      <>
                        <button
                          className="admin-btn admin-btn-danger"
                          disabled={refundActionBusy}
                          onClick={handleMarkPaymentRefunded}
                        >
                          Mark payment refunded
                        </button>
                        <button
                          className="admin-btn admin-btn-ghost"
                          disabled={refundActionBusy}
                          onClick={handleRestoreInventory}
                        >
                          Restore inventory
                        </button>
                      </>
                    )}
                    <button
                      className="admin-btn admin-btn-ghost"
                      disabled={refundActionBusy}
                      onClick={handleResolveRefundRequest}
                    >
                      {refundActionBusy && <Loader2 size={14} className="animate-spin inline mr-1" />}
                      Mark request resolved
                    </button>
                  </div>
                  {!isAdminOrAbove && (
                    <p style={{ marginTop: 8, fontSize: 11, color: "var(--admin-muted)" }}>
                      Only an Admin can mark the payment refunded or restore inventory.
                    </p>
                  )}
                </div>
              ) : order.refundResolvedAt ? (
                <p style={{ marginTop: 8, fontSize: 13, color: "var(--admin-muted)" }}>
                  No open refund request. Last one was resolved {formatDate(order.refundResolvedAt)}.
                </p>
              ) : (
                <p style={{ marginTop: 8, fontSize: 13, color: "var(--admin-muted)" }}>No refund requested for this order.</p>
              )}

              {order.paymentStatus === "PAID" && !(order.refundRequestedAt && !order.refundResolvedAt) && (
                <button
                  className="admin-btn admin-btn-danger"
                  disabled={saving}
                  style={{ marginTop: 12 }}
                  onClick={() => setShowRefundInput((v) => !v)}
                >
                  Log refund request
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
                      onClick={handleLogRefundRequest}
                    >
                      {saving && <Loader2 size={14} className="animate-spin inline mr-1" />}
                      Log request
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
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminOrderDetailPage;
