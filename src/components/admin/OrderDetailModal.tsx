import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { adminResources, type DocumentBundleAdminDto } from "@/services/adminResources";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Section, Row } from "@/components/admin/AdminSectionUi";
import {
  DeliveryFeeStatusBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
  formatKes,
  formatDate,
  ORDER_STATUS_OPTIONS,
} from "@/components/admin/commerceUi";
import { tumaBodaOrderIsReadyOrBeyond } from "@/components/admin/TumaBodaFulfillmentPanel";
import { FULFILLMENT_MODES, type FulfillmentModeKey } from "@/lib/fulfillmentModes";
import {
  getOrder,
  updateOrderStatus,
  requestOrderRefund,
  resolveOrderRefundRequest,
  markOrderPaymentRefunded,
  restoreOrderInventory,
} from "@/services/commerceApi";
import type { OrderRecord, OrderStatus } from "@/services/commerceMock";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import { resolveStaffRole, STAFF_ROLE_RANK } from "@/lib/roles";
import { AssignSelect } from "@/components/admin/AssignSelect";

interface Props {
  orderId: string | null;
  onClose: () => void;
  /** Called after any mutation that changes the underlying order (status, notes, assignment). */
  onChanged?: () => void;
}

// Human-readable label for any OrderStatus enum value
function statusLabel(raw: string | undefined | null): string {
  if (!raw) return "—";
  const found = ORDER_STATUS_OPTIONS.find((o) => o.value === raw);
  return found
    ? found.label
    : raw
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Centered modal — replaces the old side-drawer. Manual Delivery and Pickup orders behave like
 * any other dialog (X / overlay-click / Escape all close it); a TumaBoda order that hasn't been
 * marked ready yet is deliberately NOT dismissible (no close affordance at all) — staff walk it
 * through production and booking in one continuous view rather than being able to wander off
 * and lose track of it mid-preparation. See TumaBodaFulfillmentPanel.tumaBodaOrderIsReadyOrBeyond.
 */
export function OrderDetailModal({ orderId, onClose, onChanged }: Props) {
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [staffNotes, setStaffNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { user, hasPermission } = useAuth();
  const canAssign = hasPermission(PERM.ORDER_ASSIGN) || hasPermission(PERM.ORDER_MANAGE_ALL);
  const canOverrideStatus = hasPermission(PERM.ORDER_MANAGE_ALL);
  const isAdminOrAbove = (() => {
    const role = resolveStaffRole(user);
    return !!role && STAFF_ROLE_RANK[role] <= STAFF_ROLE_RANK.ADMIN;
  })();
  const [cancelling, setCancelling] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [showRefundInput, setShowRefundInput] = useState(false);
  const [refundActionBusy, setRefundActionBusy] = useState(false);
  const [documentBundle, setDocumentBundle] = useState<DocumentBundleAdminDto | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoading(true);
    setOrder(null);
    setDocumentBundle(null);
    getOrder(orderId)
      .then((res) => {
        if (cancelled) return;
        const loaded = res.order ?? null;
        setOrder(loaded);
        setStaffNotes(loaded?.staffNotes ?? loaded?.notes ?? "");
        setSelectedStatus(loaded?.status ?? "");
        if (loaded?.etrRequested && loaded.reference) {
          adminResources.documentBundles.byOrder(loaded.reference).then(setDocumentBundle).catch(() => {});
        }
      })
      .catch((err) => reportAdminError(err, "Failed to load order"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const o = order as (OrderRecord & Record<string, any>) | null;

  const canClose = !o || o.fulfillmentType !== "TUMABODA_DELIVERY" || tumaBodaOrderIsReadyOrBeyond(o);

  function handleOrderUpdated(updated: OrderRecord) {
    setOrder(updated);
    setSelectedStatus(updated.status);
    onChanged?.();
  }

  // Refunds are deliberately NOT one automated action — logging a request just records the
  // complaint. Every consequence is a separate, explicit admin step, never bundled together.
  const handleLogRefundRequest = async () => {
    if (!o || !refundReason.trim()) return;
    setUpdatingStatus(true);
    try {
      const res = await requestOrderRefund(o.id, refundReason.trim());
      if (res.order) {
        setOrder(res.order);
        setShowRefundInput(false);
        setRefundReason("");
        toast.success("Refund request logged — nothing else changed yet");
        onChanged?.();
      }
    } catch (err) {
      reportAdminError(err, "Failed to log refund request");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResolveRefundRequest = async () => {
    if (!o) return;
    setRefundActionBusy(true);
    try {
      const res = await resolveOrderRefundRequest(o.id);
      if (res.order) {
        setOrder(res.order);
        toast.success("Refund request marked resolved");
        onChanged?.();
      }
    } catch (err) {
      reportAdminError(err, "Failed to resolve refund request");
    } finally {
      setRefundActionBusy(false);
    }
  };

  const handleMarkPaymentRefunded = async () => {
    if (!o) return;
    if (!window.confirm("Mark this order's payment as refunded? Only do this once you've actually reversed the payment yourself.")) return;
    setRefundActionBusy(true);
    try {
      const res = await markOrderPaymentRefunded(o.id, o.refundRequestReason ?? "Refund processed");
      if (res.order) {
        setOrder(res.order);
        toast.success("Payment marked refunded");
        onChanged?.();
      }
    } catch (err) {
      reportAdminError(err, "Failed to mark payment refunded");
    } finally {
      setRefundActionBusy(false);
    }
  };

  const handleRestoreInventory = async () => {
    if (!o) return;
    if (!window.confirm("Restore stock for every item on this order?")) return;
    setRefundActionBusy(true);
    try {
      const res = await restoreOrderInventory(o.id);
      if (res.order) {
        setOrder(res.order);
        toast.success("Inventory restored");
        onChanged?.();
      }
    } catch (err) {
      reportAdminError(err, "Failed to restore inventory");
    } finally {
      setRefundActionBusy(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!o || !selectedStatus || selectedStatus === o.status) return;
    setUpdatingStatus(true);
    try {
      const res = await updateOrderStatus(o.id, selectedStatus as OrderStatus, staffNotes || undefined);
      if (res.order) {
        handleOrderUpdated(res.order);
        toast.success(`Status updated to ${statusLabel(selectedStatus)}`);
      }
    } catch (err) {
      reportAdminError(err, "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!o) return;
    setSavingNotes(true);
    try {
      // Piggybacks on the status PATCH — sends current status unchanged, only staffNotes changes
      const res = await updateOrderStatus(o.id, o.status, staffNotes);
      if (res.order) {
        setOrder(res.order);
        toast.success("Staff notes saved");
        onChanged?.();
      }
    } catch (err) {
      toast.error("Could not save notes");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!o) return;
    if (!window.confirm(`Cancel order ${o.reference}? This cannot be undone from this screen.`)) return;
    setCancelling(true);
    try {
      const res = await updateOrderStatus(o.id, "CANCELLED" as OrderStatus, staffNotes || undefined);
      if (res.order) {
        handleOrderUpdated(res.order);
        toast.success(`Order ${o.reference} cancelled`);
      }
    } catch (err) {
      reportAdminError(err, "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Dialog
      open={!!orderId}
      onOpenChange={(v) => {
        if (!v && canClose) onClose();
      }}
    >
      <DialogContent
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-0"
        hideCloseButton={!canClose}
        onInteractOutside={(e) => {
          if (!canClose) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!canClose) e.preventDefault();
        }}
      >
        {loading || !o ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div className="flex flex-col">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-6 py-4">
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Order reference</div>
                  <div className="font-mono text-base font-semibold">{o.reference}</div>
                </div>
                <OrderStatusBadge status={o.status} fulfillmentType={o.fulfillmentType} statusV2={o.statusV2} />
                {o.isTestOrder && (
                  <span className="inline-flex rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-yellow-700">
                    TEST
                  </span>
                )}
              </div>
            </div>

            {!canClose && (
              <div className="mx-6 mt-4 rounded-md border border-dashed bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                This order can't be closed until it's marked ready — finish preparing it below.
              </div>
            )}

            <div className="space-y-6 p-6">
              {/* Customer contact */}
              <Section title="Customer contact">
                <Row label="Name" value={o.customerName || "—"} />
                <Row label="Email" value={o.customerEmail || "—"} />
                <Row label="Phone (M-Pesa)" value={o.customerPhone || "—"} />
                {o.fulfillmentType === "TUMABODA_DELIVERY" && (
                  <Row label="Phone given to TumaBoda" value={o.tumabodaContactPhone || "—"} />
                )}
              </Section>

              {/* Fulfillment — genuinely distinct per mode, not a shared shell with conditionals.
                  Which panel renders comes from the fulfillment-mode registry (src/lib/
                  fulfillmentModes.ts), not a hardcoded per-type switch — a future provider adds
                  a registry entry, not a new branch here. */}
              {(() => {
                const mode = FULFILLMENT_MODES[o.fulfillmentType as FulfillmentModeKey];
                if (!mode) return null;
                const Panel = mode.Panel;
                return <Panel order={o} onOrderUpdated={handleOrderUpdated} onClose={onClose} />;
              })()}

              {/* Items */}
              <Section title="Items">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2 pr-3">Product</th>
                        <th className="py-2 pr-3">Category</th>
                        <th className="py-2 pr-3">Variant</th>
                        <th className="py-2 pr-3 text-right">Qty</th>
                        <th className="py-2 pr-3 text-right">Unit</th>
                        <th className="py-2 text-right">Line total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(o.items ?? []).map((it: any, i: number) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{it.name}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{it.category ?? "—"}</td>
                          <td className="py-2 pr-3 text-muted-foreground text-xs">
                            {[it.size, it.material, it.finish].filter(Boolean).join(" · ") || "—"}
                          </td>
                          <td className="py-2 pr-3 text-right">{Number(it.qty ?? 0)}</td>
                          <td className="py-2 pr-3 text-right">{formatKes(it.unitPrice)}</td>
                          <td className="py-2 text-right font-medium">
                            {formatKes(it.lineTotal ?? Number(it.unitPrice) * Number(it.qty))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>

              {/* Financials */}
              <Section title="Financials" collapsible defaultOpen={false}>
                <Row label="Subtotal" value={formatKes(o.subtotal)} />
                <Row
                  label="Delivery fee"
                  value={
                    o.fulfillmentType === "MANUAL_DELIVERY" ? (
                      <span className="inline-flex items-center gap-2">
                        {o.deliveryFeeAmount != null ? formatKes(o.deliveryFeeAmount) : "Not yet arranged"}
                        <DeliveryFeeStatusBadge status={o.deliveryFeeStatus ?? "UNPAID"} />
                      </span>
                    ) : o.fulfillmentType === "PICKUP" ? (
                      "Free (pickup)"
                    ) : Number(o.shippingFee) === 0 ? (
                      "Free"
                    ) : (
                      formatKes(o.shippingFee)
                    )
                  }
                />
                {Number(o.discount ?? 0) > 0 && <Row label="Discount" value={`− ${formatKes(o.discount)}`} />}
                {o.promoCode && <Row label="Promo code" value={o.promoCode} />}
                {Number(o.vatAmount ?? 0) > 0 ? (
                  <>
                    <Row label="Taxable amount" value={formatKes(o.taxableAmount ?? 0)} />
                    <Row label={`VAT (${Math.round((o.vatRate ?? 0.16) * 100)}%)`} value={formatKes(o.vatAmount ?? 0)} />
                    <Row label="Total (incl. VAT)" value={formatKes(o.total)} bold />
                  </>
                ) : (
                  <Row label="Total" value={formatKes(o.total)} bold />
                )}
              </Section>

              {/* ETR / documents bundle shortcut — only shown for orders that opted in at checkout */}
              {o.etrRequested && (
                <Section title="ETR & Tax Documents" collapsible defaultOpen={false}>
                  <Row label="Documents email" value={o.documentsEmail ?? "—"} />
                  <div className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <span className="text-sm font-medium">
                      {documentBundle?.status ?? (o.status === "PENDING_PAYMENT" ? "Awaiting payment" : "—")}
                    </span>
                  </div>
                  {documentBundle?.status === "FAILED" && documentBundle.failureReason && (
                    <p className="text-xs text-destructive">{documentBundle.failureReason}</p>
                  )}
                  <Link
                    to="/admin/document-bundles"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/90 hover:bg-secondary/40"
                  >
                    Manage in Documents/PDFs →
                  </Link>
                </Section>
              )}

              {/* Payment */}
              <Section title="Payment" collapsible defaultOpen={false}>
                <Row label="Method" value={o.paymentMethod ?? o.paymentGateway ?? "—"} />
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <PaymentStatusBadge status={o.paymentStatus} />
                </div>
                {o.fulfillmentType && (
                  <Row
                    label="Fulfillment type"
                    value={
                      o.fulfillmentType === "MANUAL_DELIVERY"
                        ? "Customer's sacco / courier"
                        : o.fulfillmentType === "PICKUP"
                          ? "Pickup at shop"
                          : "TumaBoda delivery"
                    }
                  />
                )}
              </Section>

              {/* Manual override — an escape hatch for edge cases the per-mode flow above
                  doesn't cover (correcting a mis-click, jumping straight to a status). The
                  primary action for whatever stage the order is actually at lives in the
                  fulfillment panel above, not duplicated here. */}
              {canOverrideStatus && (
                <Section title="Manual override" collapsible defaultOpen={false}>
                  <div className="space-y-3 pt-1">
                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground">Set status manually</summary>
                      {/* REFUNDED is deliberately excluded — only set through the Refund
                          section below, never as a quick dropdown pick. */}
                      <div className="mt-2 space-y-3">
                        <select
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                          disabled={updatingStatus || cancelling}
                        >
                          {ORDER_STATUS_OPTIONS.filter((opt) => opt.value !== "ALL" && (opt.value !== "REFUNDED" || o.status === "REFUNDED")).map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <button
                          className="admin-btn admin-btn-ghost w-full"
                          disabled={updatingStatus || cancelling || selectedStatus === o.status}
                          onClick={handleStatusUpdate}
                        >
                          {updatingStatus && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                          {selectedStatus === o.status ? "Current status" : `Set to ${statusLabel(selectedStatus)}`}
                        </button>
                      </div>
                    </details>

                    {o.status !== "CANCELLED" && o.status !== "REFUNDED" && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost w-full"
                        style={{ color: "var(--admin-clay, #c0392b)", borderColor: "var(--admin-clay, #c0392b)" }}
                        disabled={updatingStatus || cancelling}
                        onClick={handleCancelOrder}
                      >
                        {cancelling && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                        Cancel order
                      </button>
                    )}
                  </div>
                </Section>
              )}

              {/* Refund — its own section, separate from status: refunding is a distinct
                  decision from moving an order through fulfilment. Logging a request just
                  records the complaint; nothing else changes until an admin explicitly acts. */}
              <Section title="Refund" collapsible defaultOpen={false}>
                {o.refundRequestedAt && !o.refundResolvedAt ? (
                  <div className="rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3">
                    <div className="text-sm font-semibold">Refund requested — awaiting manual resolution</div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{o.refundRequestReason}</p>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Requested {formatDate(o.refundRequestedAt)}
                      {o.refundRequestedBy ? ` by ${o.refundRequestedBy}` : ""}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {isAdminOrAbove && (
                        <>
                          <button className="admin-btn admin-btn-danger" disabled={refundActionBusy} onClick={handleMarkPaymentRefunded}>
                            Mark payment refunded
                          </button>
                          <button className="admin-btn admin-btn-ghost" disabled={refundActionBusy} onClick={handleRestoreInventory}>
                            Restore inventory
                          </button>
                        </>
                      )}
                      <button className="admin-btn admin-btn-ghost" disabled={refundActionBusy} onClick={handleResolveRefundRequest}>
                        {refundActionBusy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                        Mark request resolved
                      </button>
                    </div>
                    {!isAdminOrAbove && (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Only an Admin can mark the payment refunded or restore inventory.
                      </p>
                    )}
                  </div>
                ) : o.refundResolvedAt ? (
                  <p className="text-sm text-muted-foreground">No open refund request. Last one was resolved {formatDate(o.refundResolvedAt)}.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No refund requested for this order.</p>
                )}

                {o.paymentStatus === "PAID" && !(o.refundRequestedAt && !o.refundResolvedAt) && (
                  <button
                    className="admin-btn admin-btn-danger mt-3"
                    disabled={updatingStatus}
                    onClick={() => setShowRefundInput((v) => !v)}
                  >
                    Log refund request
                  </button>
                )}

                {showRefundInput && (
                  <div className="mt-3">
                    <textarea
                      className="w-full rounded-md border bg-background p-2 text-sm"
                      rows={2}
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Reason for refund (required)…"
                    />
                    <div className="mt-2 flex gap-2">
                      <button className="admin-btn admin-btn-danger" disabled={updatingStatus || !refundReason.trim()} onClick={handleLogRefundRequest}>
                        {updatingStatus && <Loader2 size={14} className="mr-1 animate-spin inline" />}
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
              </Section>

              {/* Status history */}
              {Array.isArray(o.statusHistory) && o.statusHistory.length > 0 && (
                <Section title="Status history" collapsible defaultOpen={false}>
                  <ol className="space-y-3">
                    {[...o.statusHistory].reverse().map((h: any, i: number) => (
                      <li key={i} className="border-l-2 border-primary/30 pl-3">
                        <div className="text-sm font-medium">
                          {h.fromStatus ? `${statusLabel(h.fromStatus)} → ` : ""}
                          <span className="text-foreground">{statusLabel(h.toStatus)}</span>
                        </div>
                        {h.note && <div className="text-xs text-muted-foreground mt-0.5">{h.note}</div>}
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {h.changedBy ? `by ${h.changedBy} · ` : ""}
                          {formatDate(h.changedAt)}
                        </div>
                      </li>
                    ))}
                  </ol>
                </Section>
              )}

              {/* Staff */}
              <Section title="Staff" collapsible defaultOpen={false}>
                {canAssign ? (
                  <AssignSelect
                    orderId={o.id}
                    assignedTo={o.assignedTo}
                    assignedToId={o.assignedToId}
                    paymentStatus={o.paymentStatus}
                    orderStatus={o.status}
                    onAssigned={(patch) => {
                      setOrder({ ...o, ...patch } as OrderRecord);
                      onChanged?.();
                    }}
                  />
                ) : (
                  <Row label="Assigned to" value={o.assignedTo || "—"} />
                )}
                <label className="block mt-2">
                  <span className="text-xs uppercase text-muted-foreground">Staff notes</span>
                  <textarea
                    className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
                    rows={4}
                    value={staffNotes}
                    onChange={(e) => setStaffNotes(e.target.value)}
                    placeholder="Internal notes visible to team only…"
                  />
                </label>
                <div className="flex justify-end pt-2">
                  <button className="admin-btn admin-btn-ghost" disabled={savingNotes} onClick={handleSaveNotes}>
                    {savingNotes && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                    Save notes
                  </button>
                </div>
              </Section>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
