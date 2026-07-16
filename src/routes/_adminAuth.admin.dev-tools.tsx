import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Smartphone, FileText, ShoppingCart, Construction, Search, X } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { reportAdminError } from "@/lib/adminErrorToast";
import { adminResources, type CheckoutDryRunResult, type ProductDto } from "@/services/adminResources";
import { useAdminOrders } from "@/contexts/AdminOrdersContext";

type DryRunItemRow = { product: ProductDto | null; quantity: string };

const emptyRow = (): DryRunItemRow => ({ product: null, quantity: "1" });

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(n);
}

// ── Product search picker ────────────────────────────────────────────────────

function useDebounced(value: string, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function ProductPicker({ selected, onSelect }: { selected: ProductDto | null; onSelect: (p: ProductDto | null) => void }) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounced(q, 300);
  const [results, setResults] = useState<ProductDto[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!debouncedQ.trim() || selected) { setResults([]); return; }
    setLoading(true);
    adminResources.products.list({ q: debouncedQ, size: 8 })
      .then((page) => setResults(page.rows))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQ, selected]);

  if (selected) {
    return (
      <div className="admin-input" style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.name}</span>
        <button type="button" onClick={() => { onSelect(null); setQ(""); }} aria-label="Clear product" style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}>
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", flex: 2 }}>
      <div style={{ position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }} />
        <input
          className="admin-input" style={{ paddingLeft: 26, width: "100%" }}
          placeholder="Search product by name…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && q.trim() && (
        <div className="admin-panel" style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4, maxHeight: 240, overflowY: "auto", padding: 4 }}>
          {loading ? (
            <div style={{ padding: 8, fontSize: 12.5, color: "var(--admin-muted)" }}>Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: 8, fontSize: 12.5, color: "var(--admin-muted)" }}>No products found.</div>
          ) : (
            results.map((p) => (
              <button
                key={p.id} type="button"
                onMouseDown={() => { onSelect(p); setOpen(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 6, border: "none", background: "none", cursor: "pointer", fontSize: 13 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--admin-hover, rgba(0,0,0,0.05))")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                {p.name} {p.basePrice != null && <span style={{ color: "var(--admin-muted)" }}>— {fmtKes(p.basePrice)}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Checkout dry-run ─────────────────────────────────────────────────────────

function CheckoutDryRunCard() {
  const [rows, setRows] = useState<DryRunItemRow[]>([emptyRow()]);
  const [county, setCounty] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CheckoutDryRunResult | null>(null);

  const updateRow = (i: number, patch: Partial<DryRunItemRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const res = await adminResources.devTools.checkoutDryRun({
        county: county.trim() || undefined,
        promoCode: promoCode.trim() || undefined,
        items: rows
          .filter((r) => r.product)
          .map((r) => ({
            productId: r.product!.id,
            quantity: Number(r.quantity) || 1,
          })),
      });
      setResult(res);
    } catch (err) {
      reportAdminError(err, "Checkout dry-run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <ShoppingCart size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Order placement dry-run</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        Recomputes pricing (subtotal, delivery fee, promo, VAT, total) exactly like real checkout — one or many
        products, with a real coupon code applied — nothing is saved, no order row is created, no STK push is sent.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <ProductPicker selected={row.product} onSelect={(p) => updateRow(i, { product: p })} />
            <input
              className="admin-input" style={{ width: 80 }} type="number" min={1} placeholder="Qty"
              value={row.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })}
            />
            <button
              type="button" className="admin-btn admin-btn-ghost"
              onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
              disabled={rows.length === 1}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" className="admin-btn admin-btn-ghost" style={{ alignSelf: "flex-start" }} onClick={() => setRows((prev) => [...prev, emptyRow()])}>
          <Plus size={14} /> Add product
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="admin-input" placeholder="County (optional)" value={county} onChange={(e) => setCounty(e.target.value)} />
        <input className="admin-input" placeholder="Coupon code (optional)" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
      </div>

      <button type="button" className="admin-btn admin-btn-primary" disabled={running} onClick={() => void run()}>
        {running && <Loader2 size={14} className="animate-spin" />} Run dry-run
      </button>

      {result && (
        <div style={{ marginTop: 16, borderTop: "1px solid var(--admin-border)", paddingTop: 14 }}>
          <table className="admin-table" style={{ marginBottom: 10 }}>
            <thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr></thead>
            <tbody>
              {result.items.map((it, i) => (
                <tr key={i} style={!it.found ? { color: "var(--admin-muted)" } : undefined}>
                  <td>{it.productName}</td>
                  <td>{it.quantity}</td>
                  <td>{fmtKes(it.unitPrice)}</td>
                  <td>{fmtKes(it.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 13, display: "grid", gap: 4 }}>
            <div>Subtotal: <b>{fmtKes(result.subtotal)}</b></div>
            <div>Delivery fee: <b>{fmtKes(result.deliveryFee)}</b></div>
            <div>Coupon discount: <b>-{fmtKes(result.discount)}</b>{result.appliedPromo && ` (${result.appliedPromo})`}</div>
            <div>VAT (of {fmtKes(result.taxableAmount)} taxable): <b>{fmtKes(result.vatAmount)}</b></div>
            <div style={{ fontSize: 15, marginTop: 4 }}>Total: <b>{fmtKes(result.totalAmount)}</b></div>
          </div>
          {result.warnings.length > 0 && (
            <div style={{ marginTop: 10, background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: 10 }}>
              {result.warnings.map((w, i) => (
                <p key={i} style={{ fontSize: 12, color: "#b91c1c", margin: 0 }}>⚠ {w}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── STK push test ────────────────────────────────────────────────────────────

function StkPushTestCard() {
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("1");
  const [sending, setSending] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState<"success" | "failed" | null>(null);
  const [callbackResult, setCallbackResult] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setCheckoutRequestId(null);
    setCallbackResult(null);
    try {
      const res = await adminResources.devTools.stkPushTest({ phone: phone.trim(), amount: Number(amount) || 1 });
      setCheckoutRequestId(res.checkoutRequestId);
      toast.success("Real STK push sent via Daraja — check the phone");
    } catch (err) {
      reportAdminError(err, "STK push test failed");
    } finally {
      setSending(false);
    }
  }

  async function simulateCallback(success: boolean) {
    if (!checkoutRequestId) return;
    setSimulating(success ? "success" : "failed");
    setCallbackResult(null);
    try {
      const res = await adminResources.devTools.simulateCallback({ checkoutRequestId, success });
      setCallbackResult(res.message);
    } catch (err) {
      reportAdminError(err, "Callback simulation failed");
    } finally {
      setSimulating(null);
    }
  }

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Smartphone size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>STK push test</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        Sends a real M-Pesa prompt via Daraja (the live integration — there is no PayHero fallback anymore) with a
        synthetic reference — no order or payment record is created, so whatever happens on the phone is safely
        ignored by the callback. You can also simulate the Daraja callback below to confirm the callback pipeline
        handles both outcomes cleanly, without waiting on the phone.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="admin-input" style={{ flex: 1 }} placeholder="Phone (07... or 254...)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="admin-input" style={{ width: 100 }} type="number" min={1} placeholder="KES" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <button type="button" className="admin-btn admin-btn-primary" disabled={sending || !phone.trim()} onClick={() => void send()}>
        {sending && <Loader2 size={14} className="animate-spin" />} Send test STK push
      </button>

      {checkoutRequestId && (
        <div style={{ marginTop: 14, borderTop: "1px solid var(--admin-border)", paddingTop: 12 }}>
          <p style={{ fontSize: 12.5, marginBottom: 8 }}>
            Checkout request ID: <code>{checkoutRequestId}</code>
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="admin-btn admin-btn-ghost" disabled={!!simulating} onClick={() => void simulateCallback(true)}>
              {simulating === "success" && <Loader2 size={14} className="animate-spin" />} Simulate SUCCESS callback
            </button>
            <button type="button" className="admin-btn admin-btn-ghost" disabled={!!simulating} onClick={() => void simulateCallback(false)}>
              {simulating === "failed" && <Loader2 size={14} className="animate-spin" />} Simulate FAILED callback
            </button>
          </div>
          {callbackResult && <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--admin-muted)" }}>{callbackResult}</p>}
        </div>
      )}
    </div>
  );
}

// ── PDF preview ───────────────────────────────────────────────────────────────

function OrderPicker({ value, onChange }: { value: string; onChange: (ref: string) => void }) {
  const { orders } = useAdminOrders();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const matches = q.trim()
    ? orders.filter((o) =>
        o.reference.toLowerCase().includes(q.toLowerCase()) ||
        o.customerName?.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8)
    : [];

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <div style={{ position: "relative" }}>
        <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", opacity: 0.5 }} />
        <input
          className="admin-input" style={{ paddingLeft: 26, width: "100%" }}
          placeholder="Search order by reference or customer…"
          value={value || q}
          onChange={(e) => { onChange(""); setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {open && q.trim() && (
        <div className="admin-panel" style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4, maxHeight: 240, overflowY: "auto", padding: 4 }}>
          {matches.length === 0 ? (
            <div style={{ padding: 8, fontSize: 12.5, color: "var(--admin-muted)" }}>No orders found.</div>
          ) : (
            matches.map((o) => (
              <button
                key={o.reference} type="button"
                onMouseDown={() => { onChange(o.reference); setQ(""); setOpen(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 6, border: "none", background: "none", cursor: "pointer", fontSize: 13 }}
              >
                {o.reference} <span style={{ color: "var(--admin-muted)" }}>— {o.customerName}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PdfPreviewCard() {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function preview() {
    setLoading(true);
    try {
      const blob = await adminResources.devTools.previewTaxInvoice(reference.trim());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (err) {
      reportAdminError(err, "PDF preview failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <FileText size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Tax invoice PDF preview</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        Renders the tax-invoice PDF using a real existing order's details and shows it inline — nothing is uploaded
        to Cloudinary or emailed. Reusing real orders here is fine since this tool is internal-only.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <OrderPicker value={reference} onChange={setReference} />
        <button type="button" className="admin-btn admin-btn-primary" disabled={loading || !reference.trim()} onClick={() => void preview()}>
          {loading && <Loader2 size={14} className="animate-spin" />} Preview
        </button>
      </div>
      {previewUrl && (
        <iframe title="Tax invoice preview" src={previewUrl} style={{ width: "100%", height: 500, border: "1px solid var(--admin-border)", borderRadius: 8 }} />
      )}
    </div>
  );
}

// ── Coming soon placeholders ──────────────────────────────────────────────────

const COMING_SOON = [
  "Email send test (any template, any address)",
  "WhatsApp forward-to-developer test",
  "Referral/rewards calculation sandbox",
  "Cache inspector (view/evict Caffeine caches)",
];

function ComingSoonCard() {
  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Construction size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>More testing tools — coming soon</h3>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "var(--admin-muted)", display: "grid", gap: 6 }}>
        {COMING_SOON.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </div>
  );
}

function AdminDevToolsPage() {
  return (
    <AdminLayout title="Developer Tools">
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>
            <b>Super Admin only.</b> Everything on this page is designed to never touch real customer/order data —
            no Order, Payment or Cart row is ever created by these tools.
          </p>
        </div>
        <CheckoutDryRunCard />
        <StkPushTestCard />
        <PdfPreviewCard />
        <ComingSoonCard />
      </div>
    </AdminLayout>
  );
}

export default AdminDevToolsPage;
