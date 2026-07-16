import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
  formatKes,
  formatDate,
  ORDER_STATUS_OPTIONS,
  getNextAction,
} from "@/components/admin/commerceUi";
import { assignOrder, getOrder, listAssignableUsers, updateOrderStatus, type AssignableUser } from "@/services/commerceApi";
import type { OrderRecord, OrderStatus } from "@/services/commerceMock";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import { refundStore, type RefundRequest, type RefundRequestStatus } from "@/services/refundStore";

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

export function OrderDetailDrawer({ orderId, onClose, onChanged }: Props) {
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [staffNotes, setStaffNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const { hasPermission } = useAuth();
  const canAssign = hasPermission(PERM.ORDER_ASSIGN) || hasPermission(PERM.ORDER_MANAGE_ALL);
  const canOverrideStatus = hasPermission(PERM.ORDER_MANAGE_ALL);
  const [assignees, setAssignees] = useState<AssignableUser[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refund, setRefund] = useState<RefundRequest | null>(null);
  const [refundNote, setRefundNote] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  useEffect(() => { if (canAssign) listAssignableUsers().then(setAssignees).catch(() => {}); }, [canAssign]);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    setLoading(true);
    setOrder(null);
    getOrder(orderId)
      .then((res) => {
        if (cancelled) return;
        const loaded = res.order ?? null;
        setOrder(loaded);
        setStaffNotes(loaded?.staffNotes ?? loaded?.notes ?? "");
        setSelectedStatus(loaded?.status ?? "");
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

  useEffect(() => {
    if (!o?.reference) { setRefund(null); return; }
    let cancelled = false;
    refundStore
      .getAdminForOrder(o.reference)
      .then((r) => {
        if (cancelled) return;
        setRefund(r);
        setRefundNote(r?.adminNote ?? "");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [o?.reference]);

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
      reportAdminError(err, "Failed to update refund");
    } finally {
      setRefundBusy(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!o || !selectedStatus || selectedStatus === o.status) return;
    setUpdatingStatus(true);
    try {
      const res = await updateOrderStatus(o.id, selectedStatus as OrderStatus, staffNotes || undefined);
      if (res.order) {
        setOrder(res.order);
        setSelectedStatus(res.order.status);
        toast.success(`Status updated to ${statusLabel(selectedStatus)}`);
        onChanged?.();
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
        setOrder(res.order);
        setSelectedStatus(res.order.status);
        toast.success(`Order ${o.reference} cancelled`);
        onChanged?.();
      }
    } catch (err) {
      reportAdminError(err, "Cancel failed");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Sheet
      open={!!orderId}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
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
                <OrderStatusBadge status={o.status} />
              </div>
              <button onClick={onClose} className="rounded-sm p-1 opacity-70 hover:opacity-100" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* Customer contact */}
              <Section title="Customer contact">
                <Row label="Name" value={o.customerName || "—"} />
                <Row label="Email" value={o.customerEmail || "—"} />
                <Row label="Phone" value={o.customerPhone || "—"} />
              </Section>

              {/* Fulfillment — adapts to type (matches checkout's two-section model) */}
              {o.fulfillmentType === "OWN_COURIER" ? (
                <>
                  <Section title="1. Destination — where the customer collects">
                    <Row label="Town" value={o.city || "—"} />
                    <Row label="County" value={o.county || "—"} />
                    <Row label="Nearest courier office (customer-side)" value={o.shippingAddress || "—"} />
                    {o.postalCode && <Row label="Postal code" value={o.postalCode} />}
                  </Section>

                  <Section title="2. Dispatch — sacco / courier we use">
                    <Row label="Courier type" value={(o.courierType ?? "—").toString().replace(/_/g, " ")} />
                    <Row label="Sacco / service name" value={o.courierServiceName || "— (to confirm with customer)"} />
                    <Row label="Nairobi stage / office" value={o.courierStageOrOffice || "— (to confirm)"} />
                    <div className="mt-2 rounded-md border border-dashed bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                      Transport cost is paid by the customer directly to the sacco / courier on collection
                      (or at dispatch, confirmed by phone). Not included in the order total.
                    </div>
                  </Section>
                </>
              ) : o.fulfillmentType === "PICKUP" ? (
                <Section title="Fulfillment — pickup at shop">
                  <Row label="Method" value="Customer pickup at our shop" />
                  <div className="mt-2 rounded-md border border-dashed bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                    No delivery address required. Call the customer when the order is ready for pickup.
                  </div>
                </Section>
              ) : (
                <Section title="Delivery address">
                  <Row label="Street / building" value={o.shippingAddress || "—"} />
                  <Row label="City" value={o.city || "—"} />
                  <Row label="County" value={o.county || "—"} />
                  {o.postalCode && <Row label="Postal code" value={o.postalCode} />}
                </Section>
              )}

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
              <Section title="Financials">
                <Row label="Subtotal" value={formatKes(o.subtotal)} />
                <Row
                  label="Delivery fee"
                  value={
                    o.fulfillmentType === "OWN_COURIER"
                      ? "Paid to courier on collection"
                      : o.fulfillmentType === "PICKUP"
                        ? "Free (pickup)"
                        : Number(o.shippingFee) === 0
                          ? "Free"
                          : formatKes(o.shippingFee)
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

              {/* Payment */}
              <Section title="Payment">
                <Row label="Method" value={o.paymentMethod ?? o.paymentGateway ?? "—"} />
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <PaymentStatusBadge status={o.paymentStatus} />
                </div>
                {o.fulfillmentType && (
                  <Row
                    label="Fulfillment type"
                    value={
                      o.fulfillmentType === "OWN_COURIER"
                        ? "Customer's sacco / courier"
                        : o.fulfillmentType === "PICKUP"
                          ? "Pickup at shop"
                          : "Zone delivery"
                    }
                  />
                )}
              </Section>

              {/* Update status — manual override, restricted to ORDER_MANAGE_ALL.
                  Queue-specific advances (Verify Payment, Start Production, Dispatch)
                  live on their own queue pages for the specialist roles. */}
              {canOverrideStatus && (
                <Section title="Update order status">
                  <div className="space-y-3 pt-1">
                    {o.status === "PENDING_PAYMENT" && (
                      <p className="text-xs text-muted-foreground">
                        Waiting for the customer's M-Pesa payment — nothing to do here yet.
                      </p>
                    )}

                    {/* Single contextual next-action, same pattern as the
                        payment/preparation/dispatch queues. */}
                    {(() => {
                      const next = getNextAction(o.status as OrderStatus);
                      if (!next) return null;
                      return (
                        <button
                          className="admin-btn admin-btn-primary w-full"
                          disabled={updatingStatus || cancelling}
                          onClick={async () => {
                            setSelectedStatus(next.nextStatus);
                            setUpdatingStatus(true);
                            try {
                              const res = await updateOrderStatus(o.id, next.nextStatus, staffNotes || undefined);
                              if (res.order) {
                                setOrder(res.order);
                                setSelectedStatus(res.order.status);
                                toast.success(`Status updated to ${statusLabel(next.nextStatus)}`);
                                onChanged?.();
                              }
                            } catch (err) {
                              reportAdminError(err, "Failed to update status");
                            } finally {
                              setUpdatingStatus(false);
                            }
                          }}
                        >
                          {updatingStatus && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                          {next.label}
                        </button>
                      );
                    })()}

                    <details>
                      <summary className="cursor-pointer text-xs text-muted-foreground">Manual override</summary>
                      <div className="mt-2 space-y-3">
                        <select
                          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                          value={selectedStatus}
                          onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                          disabled={updatingStatus || cancelling}
                        >
                          {ORDER_STATUS_OPTIONS.filter((opt) => opt.value !== "ALL").map((opt) => (
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

              {/* Customer refund request — was missing from the drawer entirely
                  before, forcing admins to leave and open the full order page
                  just to see/manage a refund request. */}
              {refund && (
                <Section title="Refund / return request">
                  <div className="flex items-center justify-between gap-2 pb-2">
                    <span className="text-xs text-muted-foreground">Status</span>
                    <span
                      className={`n ${
                        refund.status === "PENDING" ? "n-muted" : refund.status === "REJECTED" ? "n-muted" : "n-ok"
                      }`}
                    >
                      {refund.status}
                    </span>
                  </div>
                  <Row label="Wants" value={refund.desiredAction.replace(/_/g, " ")} />
                  <div className="pt-2">
                    <span className="text-sm text-muted-foreground">Reason</span>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{refund.reason}</p>
                  </div>
                  <div className="pt-1 text-[11px] text-muted-foreground">
                    Submitted {new Date(refund.createdAt).toLocaleString("en-KE")}
                    {refund.updatedAt !== refund.createdAt &&
                      ` · updated ${new Date(refund.updatedAt).toLocaleString("en-KE")}`}
                  </div>
                  <label className="mt-3 block">
                    <span className="text-xs uppercase text-muted-foreground">Admin note (shown to customer)</span>
                    <textarea
                      className="mt-1 w-full rounded-md border bg-background p-2 text-sm"
                      rows={3}
                      value={refundNote}
                      onChange={(e) => setRefundNote(e.target.value)}
                      placeholder="e.g. Approved — replacement dispatched via Sendy."
                    />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="admin-btn admin-btn-primary"
                      disabled={refundBusy || refund.status === "APPROVED"}
                      onClick={() => void updateRefund("APPROVED")}
                    >
                      {refundBusy && <Loader2 size={14} className="mr-1 animate-spin inline" />} Approve
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
                </Section>
              )}

              {/* Status history */}
              {Array.isArray(o.statusHistory) && o.statusHistory.length > 0 && (
                <Section title="Status history">
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
              <Section title="Staff">
                {canAssign ? (() => {
                  const notPaid = o.paymentStatus !== "PAID";
                  const terminal = ["DISPATCHED", "DELIVERED", "CANCELLED", "REFUNDED"].includes(String(o.status));
                  const block = notPaid
                    ? "Order must be paid before it can be assigned"
                    : terminal
                      ? `Order is ${String(o.status).toLowerCase()} — assignment locked`
                      : null;
                  return (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {block ?? (o.assignedTo ? `Assigned to: ${o.assignedTo}` : "Unassigned")}
                      </div>
                      <select
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60"
                        value={o.assignedToId ?? ""}
                        disabled={assigning || !!block}
                        title={block ?? undefined}
                        onChange={async (e) => {
                          const id = e.target.value;
                          const u = assignees.find((a) => a.id === id);
                          if (!u) return;
                          setAssigning(true);
                          try {
                            const res = await assignOrder(o.id, u.name, u.id);
                            if (res.order) setOrder(res.order);
                            toast.success(`Assigned to ${u.name}`);
                            onChanged?.();
                          } catch (err) {
                            reportAdminError(err, "Assignment failed");
                          } finally {
                            setAssigning(false);
                          }
                        }}
                      >
                        <option value="" disabled>{block ? (notPaid ? "Awaiting payment" : "Locked") : "Assign to…"}</option>
                        {assignees.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                  );
                })() : (
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
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="rounded-lg border bg-card p-4 space-y-1">{children}</div>
    </section>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm text-right ${bold ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}
