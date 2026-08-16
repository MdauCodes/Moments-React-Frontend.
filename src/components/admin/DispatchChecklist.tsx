import { useEffect, useMemo, useState } from "react";
import { Loader2, X, Printer, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { dispatchConfirmOrder } from "@/services/commerceApi";
import type { OrderRecord } from "@/services/commerceMock";
import { downloadDispatchChecklistPdf } from "@/lib/pdf";
import { RiderScanPanel } from "@/components/admin/RiderScanPanel";

interface Props {
  order: OrderRecord | null;
  onClose: () => void;
  onDispatched: (orderId: string) => void | Promise<void>;
}

const STORAGE_PREFIX = "dispatch_checklist_";

function itemKey(orderId: string, idx: number, productId: string): string {
  return `${orderId}:${productId || idx}`;
}

export function DispatchChecklist({ order, onClose, onDispatched }: Props) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [riderVerifiedAt, setRiderVerifiedAt] = useState<string | null>(null);

  // A successful scan already advances the order to DISPATCHED on the backend (see
  // PaymentService.scanRiderForOrder's no-lag fix) — there's no separate "Confirm Dispatch" step
  // for TumaBoda orders anymore. Refresh the parent's order data so `order.status` (and this
  // component's isDispatched) picks that up immediately, same as a normal dispatch would.
  const handleRiderVerified = (verifiedAt: string) => {
    setRiderVerifiedAt(verifiedAt);
    if (order) void onDispatched(order.id);
  };

  const orderId = order?.id ?? null;
  const isTumaBoda = order?.fulfillmentType === "TUMABODA_DELIVERY";

  useEffect(() => {
    setRiderVerifiedAt(order?.tumabodaRiderVerifiedAt ?? null);
  }, [orderId, order?.tumabodaRiderVerifiedAt]);

  useEffect(() => {
    if (!orderId) {
      setTicked(new Set());
      setConfirmOpen(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${orderId}`);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      setTicked(new Set(arr));
    } catch {
      setTicked(new Set());
    }
  }, [orderId]);

  const itemIds = useMemo(
    () => (order?.items ?? []).map((it, idx) => itemKey(orderId ?? "", idx, it.productId)),
    [orderId, order?.items],
  );

  const allTicked = itemIds.length > 0 && itemIds.every((id) => ticked.has(id));
  const tickedCount = itemIds.filter((id) => ticked.has(id)).length;
  const riderVerified = !isTumaBoda || !!riderVerifiedAt;
  const readyToDispatch = allTicked && riderVerified;

  const toggle = (id: string) => {
    if (!order) return;
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(`${STORAGE_PREFIX}${order.id}`, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const tickAll = () => {
    if (!order) return;
    const next = new Set(itemIds);
    setTicked(next);
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${order.id}`, JSON.stringify(Array.from(next)));
    } catch {
      /* ignore */
    }
  };

  const dispatchNow = async () => {
    if (!order) return;
    setSubmitting(true);
    try {
      console.log("[dispatch] PATCH /api/v1/admin/orders/" + order.id + "/dispatch-confirm");
      const result = await dispatchConfirmOrder(order.id, "CONFIRM_LATER", allTicked);
      console.log("[dispatch] response:", result);
      try { window.localStorage.removeItem(`${STORAGE_PREFIX}${order.id}`); } catch { /* ignore */ }
      toast.success(`Order dispatched successfully`);
      setConfirmOpen(false);
      await onDispatched(order.id);
    } catch (err) {
      console.error("[dispatch] failed:", err);
      reportAdminError(err, "Dispatch failed — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  const pdfOrder = order
    ? {
        reference: order.reference,
        customerName: order.customerName,
        customerPhone: order.customerPhone ?? undefined,
        city: order.city ?? undefined,
        shippingAddress: order.shippingAddress ?? undefined,
        trackingNumber: order.trackingNumber ?? undefined,
        items: (order.items ?? []).map((it) => ({
          name: it.name,
          size: it.size ?? undefined,
          material: it.material ?? undefined,
          qty: it.qty,
          lineTotal: it.lineTotal ?? undefined,
        })),
      }
    : null;

  const isDispatched = order?.status === "DISPATCHED";

  return (
    <>
      <Sheet
        open={!!order}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md h-screen sm:h-auto overflow-y-auto">
          <VisuallyHidden>
            <SheetTitle>Dispatch checklist {order?.reference ?? ""}</SheetTitle>
            <SheetDescription>Verify items and confirm dispatch</SheetDescription>
          </VisuallyHidden>
          {order && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Header */}
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--admin-muted)", marginBottom: 4 }}>
                  Dispatch checklist
                </div>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, margin: "0 0 4px" }}>
                  {order.reference}
                </h2>
                <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: isDispatched ? "#dcfce7" : "#fef3c7", color: isDispatched ? "#166534" : "#92400e", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                  {order.status.replace(/_/g, " ")}
                </div>
                <div style={{ fontSize: 13, color: "var(--admin-muted)" }}>
                  {order.customerName}
                  {order.city && <span> · {order.city}</span>}
                  {order.fulfillmentType && (
                    <span style={{ marginLeft: 6, fontSize: 11, background: "var(--admin-surface-2, #f0ede6)", padding: "2px 7px", borderRadius: 99 }}>
                      {order.fulfillmentType.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                {order.shippingAddress && (
                  <div style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 4 }}>
                    📍 {order.shippingAddress}
                  </div>
                )}
              </div>

              {isDispatched && (
                <div style={{ background: "#dcfce7", border: "1px solid #86efac", borderRadius: 10, padding: 12, fontSize: 13, color: "#166534", display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={18} />
                  <div>
                    <div style={{ fontWeight: 600 }}>Already dispatched</div>
                    <div style={{ fontSize: 12, opacity: 0.9 }}>This order has been sent to the customer.</div>
                  </div>
                </div>
              )}


              {/* Progress bar */}
              <div>
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}
                >
                  <span style={{ fontSize: 12, color: "var(--admin-muted)" }}>
                    {tickedCount} of {itemIds.length} items verified
                  </span>
                  {!allTicked && (
                    <button
                      onClick={tickAll}
                      style={{
                        fontSize: 11,
                        color: "var(--admin-accent, #1a472a)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Tick all
                    </button>
                  )}
                  {allTicked && (
                    <span style={{ fontSize: 12, color: "#2d7a3a", display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={13} /> All verified
                    </span>
                  )}
                </div>
                <div style={{ height: 4, background: "var(--admin-border)", borderRadius: 99, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${itemIds.length ? (tickedCount / itemIds.length) * 100 : 0}%`,
                      background: allTicked ? "#2d7a3a" : "var(--admin-accent, #1a472a)",
                      borderRadius: 99,
                      transition: "width 0.2s",
                    }}
                  />
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--admin-border)" }} />

              {/* Items */}
              <ul
                style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}
              >
                {order.items.map((it, idx) => {
                  const id = itemKey(order.id, idx, it.productId);
                  const checked = ticked.has(id);
                  return (
                    <li key={id}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "10px 12px",
                          border: `1px solid ${checked ? "#a8d5b0" : "var(--admin-border)"}`,
                          borderRadius: 10,
                          background: checked ? "#f0faf2" : "var(--admin-surface, #fff)",
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(id)}
                          style={{ marginTop: 3, accentColor: "#2d7a3a" }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: checked ? "#2d7a3a" : "inherit" }}>
                            {it.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "var(--admin-muted)",
                              marginTop: 2,
                              display: "flex",
                              gap: 8,
                              flexWrap: "wrap",
                            }}
                          >
                            <span>
                              Qty: <b>{it.qty}</b>
                            </span>
                            {it.size && <span>{it.size}</span>}
                            {it.material && <span>{it.material}</span>}
                            {it.finish && <span>{it.finish}</span>}
                          </div>
                        </div>
                        {checked && <CheckCircle2 size={16} color="#2d7a3a" style={{ flexShrink: 0, marginTop: 2 }} />}
                      </label>
                    </li>
                  );
                })}
              </ul>

              {/* Not-all-ticked warning */}
              {!allTicked && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "10px 12px",
                    background: "#fef9ec",
                    border: "1px solid #f5d87a",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                >
                  <AlertCircle size={14} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ color: "#92400e" }}>
                    Tick all items before dispatching to confirm contents are verified.
                  </span>
                </div>
              )}

              {/* Rider verification — TumaBoda orders only */}
              {isTumaBoda && !isDispatched && (
                <>
                  <div style={{ borderTop: "1px solid var(--admin-border)" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Verify rider</div>
                    <RiderScanPanel
                      orderId={order.id}
                      verifiedAt={riderVerifiedAt}
                      onVerified={handleRiderVerified}
                    />
                    <p style={{ fontSize: 12, color: "var(--admin-muted)", margin: "8px 0 0" }}>
                      A successful scan dispatches the order automatically — no separate confirm
                      step needed.
                    </p>
                  </div>
                </>
              )}

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* TumaBoda orders dispatch automatically the moment the rider scan succeeds
                    (see handleRiderVerified above) — there's nothing left to click here. */}
                {!isTumaBoda && (
                  <button
                    className="admin-btn admin-btn-primary"
                    disabled={isDispatched || !readyToDispatch}
                    style={{ width: "100%", justifyContent: "center", opacity: isDispatched || !readyToDispatch ? 0.6 : 1 }}
                    onClick={() => { if (!isDispatched && readyToDispatch) setConfirmOpen(true); }}
                    title={!isDispatched && !allTicked ? "Tick every item before dispatching" : undefined}
                  >
                    {isDispatched ? "View Details (Already Dispatched)" : "Dispatch Order"}
                  </button>
                )}
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={() => pdfOrder && downloadDispatchChecklistPdf(pdfOrder)}
                >
                  <Printer size={14} style={{ marginRight: 6 }} />
                  Download printable checklist (PDF)
                </button>
              </div>

              {/* Confirm modal — rendered INSIDE SheetContent so Radix's focus trap doesn't inert it */}
              {confirmOpen && (
                <div
                  role="dialog"
                  aria-modal="true"
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.45)",
                    display: "grid",
                    placeItems: "center",
                    zIndex: 100,
                    padding: 16,
                  }}
                >
                  <div
                    style={{
                      background: "var(--admin-surface, #fff)",
                      borderRadius: 14,
                      width: "100%",
                      maxWidth: 420,
                      padding: 24,
                      boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <h3 style={{ fontFamily: "var(--font-display)", margin: 0, fontSize: 18 }}>Confirm dispatch</h3>
                      <button
                        onClick={() => setConfirmOpen(false)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
                        aria-label="Close"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div
                      style={{
                        background: "#f0faf2",
                        border: "1px solid #a8d5b0",
                        borderRadius: 8,
                        padding: "10px 14px",
                        marginBottom: 14,
                        fontSize: 13,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>
                        ✓ All {itemIds.length} items verified{isTumaBoda && " · Rider verified"}
                      </div>
                      <div style={{ color: "var(--admin-muted)" }}>
                        {order.reference} → {order.customerName}
                        {order.city && `, ${order.city}`}
                      </div>
                    </div>

                    <p style={{ fontSize: 14, color: "var(--admin-muted)", margin: "0 0 20px", lineHeight: 1.5 }}>
                      This will set the order status to <b>DISPATCHED</b> and notify the customer.
                    </p>

                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setConfirmOpen(false)} disabled={submitting}>
                        Cancel
                      </button>
                      <button type="button" className="admin-btn admin-btn-primary" onClick={() => void dispatchNow()} disabled={submitting}>
                        {submitting ? <Loader2 size={14} className="animate-spin" style={{ marginRight: 6 }} /> : null}
                        {submitting ? "Dispatching…" : "Confirm Dispatch"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

    </>
  );
}
