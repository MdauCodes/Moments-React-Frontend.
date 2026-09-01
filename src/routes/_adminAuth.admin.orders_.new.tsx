import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { useAuth } from "@/contexts/AdminAuthContext";
import { PERM } from "@/lib/permissions";
import { useRequirePermission } from "@/lib/useRequirePermission";
import { reportAdminError } from "@/lib/adminErrorToast";
import { formatKes } from "@/components/admin/commerceUi";
import { listCustomers, createOrder, type CreateOrderItem } from "@/services/commerceApi";
import type { CustomerRecord } from "@/services/commerceMock";
import { adminResources, type ProductDto } from "@/services/adminResources";
import type { CourierType } from "@/services/orderStore";

type PhoneFulfillment = "PICKUP" | "MANUAL_DELIVERY";

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

interface DraftItem extends CreateOrderItem {
  key: string;
  name: string;
  basePrice?: number;
}

function AdminOrderNewPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const allowed = useRequirePermission([PERM.ORDER_VIEW, PERM.ORDER_MANAGE_ALL, PERM.ORDER_ASSIGN]);

  // ── Customer ──────────────────────────────────────────────────────────────
  const [customerMode, setCustomerMode] = useState<"guest" | "existing">("guest");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRecord[]>([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRecord | null>(null);

  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ── Delivery ──────────────────────────────────────────────────────────────
  const [fulfillmentType, setFulfillmentType] = useState<PhoneFulfillment>("MANUAL_DELIVERY");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [courierType, setCourierType] = useState<CourierType | "">("");
  const [courierServiceName, setCourierServiceName] = useState("");
  const [courierStageOrOffice, setCourierStageOrOffice] = useState("");
  const [collectorName, setCollectorName] = useState("");

  // ── Items ─────────────────────────────────────────────────────────────────
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductDto[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);

  const [paymentMethod, setPaymentMethod] = useState<"MPESA" | "BANK_TRANSFER">("MPESA");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const estimatedTotal = useMemo(
    () => items.reduce((sum, it) => sum + (it.basePrice ?? 0) * it.quantity, 0),
    [items],
  );

  if (!allowed) return <AdminLayout title="New order"><Forbidden resource="orders" /></AdminLayout>;
  if (!hasPermission(PERM.ORDER_MANAGE_ALL) && !hasPermission(PERM.ORDER_ASSIGN)) {
    return <AdminLayout title="New order"><Forbidden resource="order creation" /></AdminLayout>;
  }

  async function searchCustomers(q: string) {
    setCustomerQuery(q);
    if (q.trim().length < 2) { setCustomerResults([]); return; }
    setCustomerSearching(true);
    try {
      const { rows } = await listCustomers({ q, size: 8 });
      setCustomerResults(rows);
    } catch (err) {
      reportAdminError(err, "Customer search failed");
    } finally {
      setCustomerSearching(false);
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
    setProductSearching(true);
    try {
      const data = await adminResources.products.list({ q, size: 8 });
      setProductResults(data.rows ?? []);
    } catch (err) {
      reportAdminError(err, "Product search failed");
    } finally {
      setProductSearching(false);
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

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((it) => it.key !== key));
  }

  async function handleSubmit() {
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
        toast.error("Enter the full name (first and last) of whoever will collect the parcel");
        return;
      }
      if (!city.trim()) {
        toast.error("City/town is required for manual delivery");
        return;
      }
    }

    setSubmitting(true);
    try {
      const { order } = await createOrder({
        customerId: customerMode === "existing" ? selectedCustomer?.id : undefined,
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        deliveryAddress: fulfillmentType === "PICKUP" ? undefined : deliveryAddress.trim(),
        city: fulfillmentType === "PICKUP" ? undefined : city.trim(),
        county: fulfillmentType === "PICKUP" ? undefined : county.trim(),
        notes: notes.trim() || undefined,
        paymentMethod,
        fulfillmentType,
        courierType: fulfillmentType === "MANUAL_DELIVERY" ? courierType || undefined : undefined,
        courierServiceName: fulfillmentType === "MANUAL_DELIVERY" ? courierServiceName.trim() || undefined : undefined,
        courierStageOrOffice: fulfillmentType === "MANUAL_DELIVERY" ? courierStageOrOffice.trim() || undefined : undefined,
        collectorName: fulfillmentType === "MANUAL_DELIVERY" ? collectorName.trim() || undefined : undefined,
        items: items.map(({ productId, quantity, size, material, finish }) => ({
          productId, quantity, size: size || undefined, material: material || undefined, finish: finish || undefined,
        })),
      });
      toast.success(`Order ${order.reference} created`);
      navigate(`/admin/orders/${order.id}`);
    } catch (err) {
      reportAdminError(err, "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminLayout title="New order">
      <div className="admin-page-stack" style={{ maxWidth: 780 }}>
        <p className="admin-label">
          For phone-in orders — enter exactly what the customer tells you. This creates a real
          order (pending payment), same as if they'd checked out themselves; collect payment
          afterward from the order's detail page.
        </p>

        {/* ── Customer ── */}
        <div className="admin-panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Customer</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className={`admin-btn ${customerMode === "guest" ? "" : "admin-btn-ghost"}`}
              onClick={() => { setCustomerMode("guest"); setSelectedCustomer(null); }}
            >
              Guest (type details)
            </button>
            <button
              type="button"
              className={`admin-btn ${customerMode === "existing" ? "" : "admin-btn-ghost"}`}
              onClick={() => setCustomerMode("existing")}
            >
              Existing customer
            </button>
          </div>

          {customerMode === "existing" && (
            <div style={{ position: "relative" }}>
              <input
                className="admin-input"
                placeholder="Search by name, email or phone…"
                value={customerQuery}
                onChange={(e) => searchCustomers(e.target.value)}
              />
              {selectedCustomer && (
                <div className="admin-label" style={{ marginTop: 4 }}>
                  Selected: {selectedCustomer.name} ({selectedCustomer.email})
                </div>
              )}
              {customerSearching && <div className="admin-label">Searching…</div>}
              {customerResults.length > 0 && (
                <div className="admin-panel" style={{ marginTop: 4, maxHeight: 220, overflowY: "auto" }}>
                  {customerResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="admin-btn admin-btn-ghost"
                      style={{ display: "block", width: "100%", textAlign: "left" }}
                      onClick={() => pickCustomer(c)}
                    >
                      {c.name} — {c.email} — {c.phone}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="admin-form-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label className="admin-label">Contact name
              <input className="admin-input" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
            <label className="admin-label">Email
              <input className="admin-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="admin-label">Phone
              <input className="admin-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xxxxxxxx" />
            </label>
          </div>
        </div>

        {/* ── Items ── */}
        <div className="admin-panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Items</h3>
          <div style={{ position: "relative" }}>
            <input
              className="admin-input"
              placeholder="Search products…"
              value={productQuery}
              onChange={(e) => searchProducts(e.target.value)}
            />
            {productSearching && <div className="admin-label">Searching…</div>}
            {productResults.length > 0 && (
              <div className="admin-panel" style={{ marginTop: 4, maxHeight: 260, overflowY: "auto" }}>
                {productResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    style={{ display: "block", width: "100%", textAlign: "left" }}
                    onClick={() => addItem(p)}
                  >
                    {p.name} — {formatKes(p.basePrice)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="admin-empty">No items added yet.</div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Product</th><th>Qty</th><th>Size</th><th>Material</th><th>Finish</th><th>Est. total</th><th></th></tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.key}>
                    <td>{it.name}</td>
                    <td>
                      <input
                        className="admin-input" type="number" min={1} style={{ width: 64 }}
                        value={it.quantity}
                        onChange={(e) => updateItem(it.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                      />
                    </td>
                    <td><input className="admin-input" style={{ width: 90 }} value={it.size ?? ""} onChange={(e) => updateItem(it.key, { size: e.target.value })} /></td>
                    <td><input className="admin-input" style={{ width: 100 }} value={it.material ?? ""} onChange={(e) => updateItem(it.key, { material: e.target.value })} /></td>
                    <td><input className="admin-input" style={{ width: 100 }} value={it.finish ?? ""} onChange={(e) => updateItem(it.key, { finish: e.target.value })} /></td>
                    <td>{formatKes((it.basePrice ?? 0) * it.quantity)}</td>
                    <td><button type="button" className="admin-btn admin-btn-ghost" onClick={() => removeItem(it.key)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {items.length > 0 && (
            <div className="admin-label">
              Estimated subtotal: {formatKes(estimatedTotal)} — the actual price is always
              re-resolved by the server at order creation, this is just a guide.
            </div>
          )}
        </div>

        {/* ── Delivery ── */}
        <div className="admin-panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Delivery</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={`admin-btn ${fulfillmentType === "PICKUP" ? "" : "admin-btn-ghost"}`} onClick={() => setFulfillmentType("PICKUP")}>Pickup</button>
            <button type="button" className={`admin-btn ${fulfillmentType === "MANUAL_DELIVERY" ? "" : "admin-btn-ghost"}`} onClick={() => setFulfillmentType("MANUAL_DELIVERY")}>Manual delivery</button>
          </div>
          <p className="admin-label">
            TumaBoda delivery isn't available from this form — it needs a live map pin for an
            accurate quote. Use Manual Delivery for a phone order, or place TumaBoda orders
            through the normal customer checkout instead.
          </p>

          {fulfillmentType === "MANUAL_DELIVERY" && (
            <>
              <div className="admin-form-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label className="admin-label">Delivery address
                  <input className="admin-input" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
                </label>
                <label className="admin-label">City/Town
                  <input className="admin-input" value={city} onChange={(e) => setCity(e.target.value)} />
                </label>
                <label className="admin-label">County
                  <input className="admin-input" value={county} onChange={(e) => setCounty(e.target.value)} />
                </label>
              </div>
              <div className="admin-form-row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <label className="admin-label">Courier type
                  <select className="admin-input" value={courierType} onChange={(e) => setCourierType(e.target.value as CourierType)}>
                    <option value="">— Select —</option>
                    {COURIER_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </label>
                <label className="admin-label">Courier service name
                  <input className="admin-input" value={courierServiceName} onChange={(e) => setCourierServiceName(e.target.value)} />
                </label>
                <label className="admin-label">Stage / office
                  <input className="admin-input" value={courierStageOrOffice} onChange={(e) => setCourierStageOrOffice(e.target.value)} />
                </label>
              </div>
              <label className="admin-label">Collector's full name (checked against ID at destination)
                <input className="admin-input" value={collectorName} onChange={(e) => setCollectorName(e.target.value)} />
              </label>
            </>
          )}
        </div>

        {/* ── Payment & notes ── */}
        <div className="admin-panel" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h3 style={{ margin: 0 }}>Payment</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className={`admin-btn ${paymentMethod === "MPESA" ? "" : "admin-btn-ghost"}`} onClick={() => setPaymentMethod("MPESA")}>M-Pesa (STK to customer)</button>
            <button type="button" className={`admin-btn ${paymentMethod === "BANK_TRANSFER" ? "" : "admin-btn-ghost"}`} onClick={() => setPaymentMethod("BANK_TRANSFER")}>Bank transfer</button>
          </div>
          <p className="admin-label">
            The order is created pending payment either way — trigger the M-Pesa prompt or record
            a manual payment from the order's detail page after it's created, same as any other order.
          </p>
          <label className="admin-label">Notes
            <textarea className="admin-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="admin-btn admin-btn-ghost" onClick={() => navigate("/admin/orders")}>Cancel</button>
          <button type="button" className="admin-btn" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Creating…" : "Create order"}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminOrderNewPage;
