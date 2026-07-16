import { useState } from "react";
import { Loader2, Plus, Trash2, Smartphone, FileText, ShoppingCart, Construction } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { reportAdminError } from "@/lib/adminErrorToast";
import { adminResources, type CheckoutDryRunResult } from "@/services/adminResources";

type DryRunItemRow = { productId: string; quantity: string; unitPrice: string };

const emptyRow = (): DryRunItemRow => ({ productId: "", quantity: "1", unitPrice: "" });

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(n);
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
          .filter((r) => r.productId.trim())
          .map((r) => ({
            productId: r.productId.trim(),
            quantity: Number(r.quantity) || 1,
            unitPrice: r.unitPrice ? Number(r.unitPrice) : undefined,
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
        Recomputes pricing (subtotal, delivery fee, promo, VAT, total) exactly like real checkout — nothing is saved,
        no order row is created, no STK push is sent.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="admin-input" style={{ flex: 2 }} placeholder="Product ID (UUID)"
              value={row.productId} onChange={(e) => updateRow(i, { productId: e.target.value })}
            />
            <input
              className="admin-input" style={{ width: 80 }} type="number" min={1} placeholder="Qty"
              value={row.quantity} onChange={(e) => updateRow(i, { quantity: e.target.value })}
            />
            <input
              className="admin-input" style={{ width: 120 }} type="number" placeholder="Unit price (opt.)"
              value={row.unitPrice} onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
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
          <Plus size={14} /> Add item
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="admin-input" placeholder="County (optional)" value={county} onChange={(e) => setCounty(e.target.value)} />
        <input className="admin-input" placeholder="Promo code (optional)" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
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
            <div>Discount: <b>-{fmtKes(result.discount)}</b>{result.appliedPromo && ` (${result.appliedPromo})`}</div>
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
  const [result, setResult] = useState<string | null>(null);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const res = await adminResources.devTools.stkPushTest({ phone: phone.trim(), amount: Number(amount) || 1 });
      setResult(`Sent — checkout request ID: ${res.checkoutRequestId}`);
      toast.success("STK push sent — check the phone");
    } catch (err) {
      reportAdminError(err, "STK push test failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Smartphone size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>STK push test</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        Sends a real M-Pesa prompt via PayHero with a synthetic reference — no order or payment record is created,
        so whatever happens on the phone (approve, cancel, timeout) is safely ignored by the callback.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="admin-input" style={{ flex: 1 }} placeholder="Phone (07... or 254...)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="admin-input" style={{ width: 100 }} type="number" min={1} placeholder="KES" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <button type="button" className="admin-btn admin-btn-primary" disabled={sending || !phone.trim()} onClick={() => void send()}>
        {sending && <Loader2 size={14} className="animate-spin" />} Send test STK push
      </button>
      {result && <p style={{ marginTop: 10, fontSize: 12.5 }}>{result}</p>}
    </div>
  );
}

// ── PDF preview ───────────────────────────────────────────────────────────────

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
        Renders the tax-invoice PDF for a real order reference and shows it inline — nothing is uploaded to
        Cloudinary or emailed.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="admin-input" style={{ flex: 1 }} placeholder="Order reference e.g. ORD-2026-07-0003" value={reference} onChange={(e) => setReference(e.target.value)} />
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
  "Payment webhook replay (simulate a callback)",
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
