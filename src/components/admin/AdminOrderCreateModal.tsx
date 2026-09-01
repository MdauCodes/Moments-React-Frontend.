import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Smartphone, CheckCircle2, XCircle, X as XIcon } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Section } from "@/components/admin/AdminSectionUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatKes } from "@/components/admin/commerceUi";
import { reportAdminError } from "@/lib/adminErrorToast";
import {
  listCustomers,
  createOrder,
  type CreateOrderItem,
  type CreateOrderParams,
} from "@/services/commerceApi";
import { orderStore } from "@/services/orderStore";
import type { CustomerRecord, OrderRecord } from "@/services/commerceMock";
import { adminResources, type ProductDto } from "@/services/adminResources";
import type { CourierType } from "@/services/orderStore";

// HAND_DELIVERY deliberately excluded — CheckoutService requires a real dropoffLat/dropoffLng
// inside the Nairobi CBD geofence for that courier type specifically, which this form (no map
// pin, same reason TumaBoda is excluded below) never collects. Selecting it would fail every
// submission with "Hand delivery is only available for addresses inside Nairobi CBD."
const COURIER_TYPES: { value: CourierType; label: string }[] = [
  { value: "MATATU", label: "Matatu" },
  { value: "PARCEL_SERVICE", label: "Parcel service" },
  { value: "BOLT_SEND", label: "Bolt Send" },
  { value: "RIDER", label: "Rider" },
  { value: "OTHER", label: "Other" },
];

type PhoneFulfillment = "PICKUP" | "MANUAL_DELIVERY";
type PayState = "form" | "sending" | "waiting" | "success" | "failed" | "timeout";

// Same cadence as the real customer checkout's STK flow (checkout.tsx) — one proven pattern for
// "send STK, poll for outcome" instead of a second, drifting implementation.
const POLL_MS = 3000;
const MAX_POLLS = 20;
const TIMEOUT_MS = POLL_MS * MAX_POLLS;
const RESEND_AFTER_MS = 30_000;

function normalizePhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.startsWith("254")) return `+${digits}`;
  if (digits.startsWith("0")) return `+254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `+254${digits}`;
  return digits.startsWith("+") ? digits : `+${digits}`;
}

interface DraftItem extends CreateOrderItem {
  key: string;
  name: string;
  basePrice?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called once the order is fully paid — caller decides whether to refresh a list, navigate, etc. */
  onCreated?: (order: OrderRecord) => void;
}

/**
 * Compact, dismissable, mobile-responsive replacement for the old full-page /admin/orders/new
 * form. Payment is M-Pesa STK only — no Bank Transfer option — because this flow is specifically
 * for staff on a live phone call with the customer, who can enter their PIN right then. The STK
 * send + poll-for-outcome logic mirrors the real customer checkout's own flow (same constants,
 * same states) rather than being a second implementation: sending → waiting → success, or
 * failed/timeout with a retry that resends STK against the SAME order (never creates a duplicate).
 */
export function AdminOrderCreateModal({ open, onClose, onCreated }: Props) {
  const [payState, setPayState] = useState<PayState>("form");
  const [createdOrder, setCreatedOrder] = useState<{ id: string; reference: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResend, setShowResend] = useState(false);
  const timersRef = useRef<{ poll?: ReturnType<typeof setTimeout>; timeout?: ReturnType<typeof setTimeout>; resend?: ReturnType<typeof setTimeout> }>({});

  // ── Customer ──
  const [customerMode, setCustomerMode] = useState<"guest" | "existing">("guest");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRecord[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ── Delivery ──
  const [fulfillmentType, setFulfillmentType] = useState<PhoneFulfillment>("MANUAL_DELIVERY");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [courierType, setCourierType] = useState<CourierType | "">("");
  const [courierServiceName, setCourierServiceName] = useState("");
  const [courierStageOrOffice, setCourierStageOrOffice] = useState("");
  const [collectorName, setCollectorName] = useState("");

  // ── Items ──
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductDto[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const estimatedTotal = useMemo(
    () => items.reduce((sum, it) => sum + (it.basePrice ?? 0) * it.quantity, 0),
    [items],
  );

  function clearAllTimers() {
    Object.values(timersRef.current).forEach((t) => t && clearTimeout(t));
    timersRef.current = {};
  }

  function resetForm() {
    clearAllTimers();
    setPayState("form");
    setCreatedOrder(null);
    setErrorMsg(null);
    setShowResend(false);
    setCustomerMode("guest");
    setCustomerQuery("");
    setCustomerResults([]);
    setSelectedCustomer(null);
    setContactName("");
    setEmail("");
    setPhone("");
    setFulfillmentType("MANUAL_DELIVERY");
    setDeliveryAddress("");
    setCity("");
    setCounty("");
    setCourierType("");
    setCourierServiceName("");
    setCourierStageOrOffice("");
    setCollectorName("");
    setProductQuery("");
    setProductResults([]);
    setItems([]);
    setNotes("");
  }

  useEffect(() => {
    if (open) resetForm();
    return () => clearAllTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    if (q.trim().length < 2) { setCustomerResults([]); return; }
    try {
      const { rows } = await listCustomers({ q, size: 6 });
      setCustomerResults(rows);
    } catch (err) {
      reportAdminError(err, "Customer search failed");
    }
  }

  function pickCustomer(c: CustomerRecord) {
    setSelectedCustomer(c);
    setContactName(c.name);
    setEmail(c.email);
    setPhone(c.phone);
    setCustomerResults([]);
    setCustomerQuery(c.name);
  }

  async function searchProducts(q: string) {
    setProductQuery(q);
    if (q.trim().length < 2) { setProductResults([]); return; }
    try {
      const data = await adminResources.products.list({ q, size: 6 });
      setProductResults(data.rows ?? []);
    } catch (err) {
      reportAdminError(err, "Product search failed");
    }
  }

  function addItem(p: ProductDto) {
    setItems((prev) => [
      ...prev,
      {
        key: `${p.id}-${Date.now()}`,
        productId: p.id,
        quantity: 1,
        size: p.sizes?.[0] ?? "",
        material: p.material ?? "",
        finish: p.finish ?? "",
        name: p.name,
        basePrice: p.basePrice,
      },
    ]);
    setProductQuery("");
    setProductResults([]);
  }

  function updateItemQty(key: string, quantity: number) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, quantity: Math.max(1, quantity || 1) } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  function startStkPolling(orderId: string) {
    setPayState("waiting");
    setShowResend(false);
    clearAllTimers();
    timersRef.current.resend = setTimeout(() => setShowResend(true), RESEND_AFTER_MS);
    timersRef.current.timeout = setTimeout(() => {
      clearAllTimers();
      setPayState("timeout");
    }, TIMEOUT_MS);

    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      const res = await orderStore.getPaymentStatus(orderId);
      if (res.status === "SUCCESS") {
        clearAllTimers();
        setPayState("success");
        return;
      }
      if (res.status === "FAILED") {
        clearAllTimers();
        setErrorMsg(res.message ?? "Payment was not completed.");
        setPayState("failed");
        return;
      }
      if (attempts >= MAX_POLLS) {
        clearAllTimers();
        setPayState("timeout");
        return;
      }
      timersRef.current.poll = setTimeout(poll, POLL_MS);
    };
    timersRef.current.poll = setTimeout(poll, POLL_MS);
  }

  async function sendStk(orderId: string) {
    const normalized = normalizePhone(phone);
    const init = await orderStore.startMpesaStk(orderId, normalized, "MPESA");
    if (!init.success) {
      setErrorMsg(init.message ?? "Could not send the M-Pesa prompt. Please try again.");
      setPayState("failed");
      return;
    }
    startStkPolling(orderId);
  }

  async function handleCreateAndPay() {
    if (!contactName.trim() || !email.trim() || !phone.trim()) {
      toast.error("Contact name, email and phone are required");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (fulfillmentType === "MANUAL_DELIVERY") {
      if (!courierType && !courierServiceName.trim()) {
        toast.error("Select a courier service for delivery");
        return;
      }
      if (collectorName.trim().split(/\s+/).filter(Boolean).length < 2) {
        toast.error("Enter the collector's full name (first and last)");
        return;
      }
      if (!city.trim()) {
        toast.error("City/town is required for manual delivery");
        return;
      }
    }

    setSubmitting(true);
    setPayState("sending");
    try {
      const params: CreateOrderParams = {
        customerId: customerMode === "existing" ? selectedCustomer?.id : undefined,
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        deliveryAddress: fulfillmentType === "PICKUP" ? undefined : deliveryAddress.trim(),
        city: fulfillmentType === "PICKUP" ? undefined : city.trim(),
        county: fulfillmentType === "PICKUP" ? undefined : county.trim(),
        notes: notes.trim() || undefined,
        paymentMethod: "MPESA",
        fulfillmentType,
        courierType: fulfillmentType === "MANUAL_DELIVERY" ? courierType || undefined : undefined,
        courierServiceName: fulfillmentType === "MANUAL_DELIVERY" ? courierServiceName.trim() || undefined : undefined,
        courierStageOrOffice: fulfillmentType === "MANUAL_DELIVERY" ? courierStageOrOffice.trim() || undefined : undefined,
        collectorName: fulfillmentType === "MANUAL_DELIVERY" ? collectorName.trim() || undefined : undefined,
        items: items.map(({ productId, quantity, size, material, finish }) => ({
          productId, quantity, size: size || undefined, material: material || undefined, finish: finish || undefined,
        })),
      };
      const { order } = await createOrder(params);
      setCreatedOrder({ id: order.id, reference: order.reference });
      await sendStk(order.id);
    } catch (err) {
      reportAdminError(err, "Failed to create order");
      setPayState("form");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) return;
    if (payState === "success" && createdOrder) {
      onCreated?.({ id: createdOrder.id, reference: createdOrder.reference } as OrderRecord);
    }
    clearAllTimers();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle>New order</DialogTitle>
          {payState === "form" && (
            <p className="text-xs text-muted-foreground">
              Phone-in order — enter exactly what the customer tells you. Payment is collected via
              M-Pesa STK, sent to the phone number below once the order is created.
            </p>
          )}
        </DialogHeader>

        {payState === "form" && (
          <div className="px-5 py-4 space-y-4">
            <Section title="Customer">
              <div className="flex gap-1.5 pb-2">
                <Button
                  type="button" size="sm"
                  variant={customerMode === "guest" ? "default" : "outline"}
                  onClick={() => { setCustomerMode("guest"); setSelectedCustomer(null); }}
                >
                  Guest
                </Button>
                <Button
                  type="button" size="sm"
                  variant={customerMode === "existing" ? "default" : "outline"}
                  onClick={() => setCustomerMode("existing")}
                >
                  Existing customer
                </Button>
              </div>

              {customerMode === "existing" && (
                <div className="relative pb-2">
                  <Input
                    placeholder="Search by name, email or phone…"
                    value={customerQuery}
                    onChange={(e) => searchCustomers(e.target.value)}
                  />
                  {customerResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                      {customerResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => pickCustomer(c)}
                        >
                          {c.name} <span className="text-muted-foreground">— {c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input placeholder="Contact name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                <Input placeholder="Phone (STK goes here)" value={phone} onChange={(e) => setPhone(e.target.value)} />
                <Input className="sm:col-span-2" placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </Section>

            <Section title="Items">
              <div className="relative pb-2">
                <Input placeholder="Search products…" value={productQuery} onChange={(e) => searchProducts(e.target.value)} />
                {productResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
                    {productResults.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
                        onClick={() => addItem(p)}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="shrink-0 text-muted-foreground">{formatKes(p.basePrice)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items added yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {items.map((it) => (
                    <div key={it.key} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{it.name}</span>
                      <Input
                        type="number" min={1}
                        className="h-8 w-14 text-center px-1"
                        value={it.quantity}
                        onChange={(e) => updateItemQty(it.key, Number(e.target.value))}
                      />
                      <span className="w-20 shrink-0 text-right text-muted-foreground">{formatKes((it.basePrice ?? 0) * it.quantity)}</span>
                      <button type="button" onClick={() => removeItem(it.key)} className="shrink-0 text-muted-foreground hover:text-destructive">
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="pt-1 text-right text-xs text-muted-foreground">
                    Est. subtotal {formatKes(estimatedTotal)} — server re-resolves the real price
                  </div>
                </div>
              )}
            </Section>

            <Section title="Delivery">
              <div className="flex gap-1.5 pb-2">
                <Button type="button" size="sm" variant={fulfillmentType === "PICKUP" ? "default" : "outline"} onClick={() => setFulfillmentType("PICKUP")}>Pickup</Button>
                <Button type="button" size="sm" variant={fulfillmentType === "MANUAL_DELIVERY" ? "default" : "outline"} onClick={() => setFulfillmentType("MANUAL_DELIVERY")}>Manual delivery</Button>
              </div>
              {fulfillmentType === "PICKUP" ? (
                <p className="text-xs text-muted-foreground">
                  TumaBoda isn't offered here — it needs a live map pin. Use Manual Delivery for a phone order.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input placeholder="Delivery address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
                    <Input placeholder="City/Town" value={city} onChange={(e) => setCity(e.target.value)} />
                    <select
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={courierType}
                      onChange={(e) => setCourierType(e.target.value as CourierType)}
                    >
                      <option value="">Courier type — select</option>
                      {COURIER_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <Input placeholder="Courier service name" value={courierServiceName} onChange={(e) => setCourierServiceName(e.target.value)} />
                    <Input placeholder="Stage / office" value={courierStageOrOffice} onChange={(e) => setCourierStageOrOffice(e.target.value)} />
                    <Input placeholder="County" value={county} onChange={(e) => setCounty(e.target.value)} />
                  </div>
                  <Input placeholder="Collector's full name (checked at destination)" value={collectorName} onChange={(e) => setCollectorName(e.target.value)} />
                </div>
              )}
            </Section>

            <Section title="Notes" collapsible defaultOpen={false}>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={2}
                placeholder="Optional"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Section>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
              <Button type="button" disabled={submitting} onClick={handleCreateAndPay}>
                {submitting ? "Creating…" : "Create & send STK"}
              </Button>
            </div>
          </div>
        )}

        {payState === "sending" && (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Creating the order…</p>
          </div>
        )}

        {payState === "waiting" && createdOrder && (
          <div className="flex flex-col items-center gap-1 py-10 px-5 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <Smartphone className="relative h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 text-base font-semibold">Waiting for the customer's PIN</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              STK prompt sent to <span className="font-medium text-foreground">{normalizePhone(phone)}</span>.
              Order <span className="font-mono">{createdOrder.reference}</span>.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking for confirmation…
            </div>
            {showResend && (
              <button
                type="button"
                className="mt-3 text-sm font-medium text-primary underline"
                onClick={() => sendStk(createdOrder.id)}
              >
                Resend prompt
              </button>
            )}
          </div>
        )}

        {payState === "success" && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <h3 className="text-base font-semibold">Payment received</h3>
            <p className="text-sm text-muted-foreground">
              Order {createdOrder?.reference} is paid and ready for production.
            </p>
            <Button className="mt-3" onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        )}

        {(payState === "failed" || payState === "timeout") && createdOrder && (
          <div className="flex flex-col items-center gap-2 py-10 px-5 text-center">
            <XCircle className="h-10 w-10 text-destructive" />
            <h3 className="text-base font-semibold">
              {payState === "timeout" ? "No confirmation received" : "Payment failed"}
            </h3>
            <p className="max-w-xs text-sm text-muted-foreground">
              {payState === "timeout"
                ? "We didn't hear back in time. The order is still saved — try sending the prompt again."
                : errorMsg ?? "The STK payment wasn't completed."}
            </p>
            <p className="text-xs text-muted-foreground">Order <span className="font-mono">{createdOrder.reference}</span> is saved as pending payment.</p>
            <div className="mt-2 flex items-center gap-2">
              <Input
                className="h-9 w-40"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <Button type="button" onClick={() => sendStk(createdOrder.id)}>Send STK</Button>
            </div>
            <button type="button" className="mt-2 text-xs text-muted-foreground underline" onClick={() => handleOpenChange(false)}>
              Close — I'll finish this from the order later
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
