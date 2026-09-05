import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Trash2, Smartphone, FileText, ShoppingCart, Construction, Search, X, Cake, Mail, RefreshCw, Webhook, Copy, Eye, EyeOff, UserCog, Briefcase, Gift } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import {
  adminResources,
  type CheckoutDryRunResult,
  type ProductDto,
  type BirthdayJobRunResult,
  type LeadPreviewDto,
  type TumaBodaWebhookStatusDto,
  type TumaBodaWebhookListEntry,
} from "@/services/adminResources";
import { listCustomers, impersonateCustomer } from "@/services/commerceApi";
import type { CustomerRecord } from "@/services/commerceMock";
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

// ── Test account preview ─────────────────────────────────────────────────────

function TestAccountPreviewCard() {
  const [accounts, setAccounts] = useState<CustomerRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  // Same popup-blocker workaround as the customer-detail page's own "Preview dashboard" button:
  // the tab has to open synchronously in the click handler, before the (async) impersonate call.
  const pendingWindow = useRef<Window | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await listCustomers({ size: 100 });
      setAccounts(res.rows.filter((c) => c.isTestAccount));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load test accounts");
    }
  }

  useEffect(() => { void load(); }, []);

  async function preview(account: CustomerRecord) {
    pendingWindow.current?.close();
    pendingWindow.current = window.open("", "_blank");
    setPreviewingId(account.id);
    try {
      const session = await impersonateCustomer(account.id);
      const dashboardPath = session.accountType === "BUSINESS" ? "/account/business" : "/account/merchant";
      const url = `${window.location.origin}${dashboardPath}?impersonate=${encodeURIComponent(session.accessToken)}`;
      if (pendingWindow.current) {
        pendingWindow.current.location.href = url;
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch (err) {
      pendingWindow.current?.close();
      reportAdminError(err, "Couldn't start preview");
    } finally {
      setPreviewingId(null);
      pendingWindow.current = null;
    }
  }

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <UserCog size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Preview a test account</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        Every account flagged as a test account (Customers → mark as test account) shows up here — one click opens
        their real dashboard in a new tab via the same impersonation session the customer-detail page's "Preview
        dashboard" button uses. Nothing here creates or changes an account; flag one from its customer page first.
      </p>

      {error && <p style={{ fontSize: 12.5, color: "#b91c1c", marginBottom: 10 }}>{error}</p>}

      {accounts === null && !error ? (
        <p style={{ fontSize: 12.5, color: "var(--admin-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={13} className="animate-spin" /> Loading test accounts…
        </p>
      ) : accounts && accounts.length === 0 ? (
        <p style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>
          No accounts are flagged as test accounts yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {accounts?.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                padding: "8px 10px", borderRadius: 8, border: "1px solid var(--admin-border)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                {a.accountType === "BUSINESS" ? <Briefcase size={14} style={{ flexShrink: 0, opacity: 0.6 }} /> : <Gift size={14} style={{ flexShrink: 0, opacity: 0.6 }} />}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</p>
                  <p style={{ margin: 0, fontSize: 11.5, color: "var(--admin-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.email} · {a.accountType === "BUSINESS" ? "Business" : "Individual Shopper"}
                  </p>
                </div>
              </div>
              <button
                type="button" className="admin-btn admin-btn-ghost" style={{ flexShrink: 0 }}
                disabled={previewingId === a.id}
                onClick={() => void preview(a)}
              >
                {previewingId === a.id && <Loader2 size={14} className="animate-spin" />} Preview
              </button>
            </div>
          ))}
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

function TestTaxInvoiceEmailCard() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const res = await adminResources.devTools.sendTestTaxInvoiceEmail({ orderReference: reference.trim(), email: email.trim() });
      toast.success(res.message);
    } catch (err) {
      reportAdminError(err, "Test email failed");
    } finally {
      setSending(false);
    }
  }

  const canSend = !sending && reference.trim() && /^\S+@\S+\.\S+$/.test(email.trim());

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <FileText size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Send test tax invoice email</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        Renders a real existing order's tax invoice, uploads it to a separate "dev-test" Cloudinary folder, and
        emails it to any address you give — the real customer email/PDF path, without needing a paid order or
        touching that order's own tax-document history. Use this to check formatting, attachments, and inbox
        deliverability before a real customer sees it.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <OrderPicker value={reference} onChange={setReference} />
        <input
          className="admin-input" style={{ width: 240 }}
          type="email" placeholder="you@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
        <button type="button" className="admin-btn admin-btn-primary" disabled={!canSend} onClick={() => void send()}>
          {sending && <Loader2 size={14} className="animate-spin" />} Send test email
        </button>
      </div>
    </div>
  );
}

// ── Birthday reward job test ─────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function BirthdayJobTestCard() {
  const [date, setDate] = useState(todayStr());
  const [running, setRunning] = useState<"preview" | "run" | null>(null);
  const [result, setResult] = useState<BirthdayJobRunResult | null>(null);
  const [previewedDate, setPreviewedDate] = useState<string | null>(null);

  async function preview() {
    setRunning("preview");
    try {
      const res = await adminResources.devTools.previewBirthdayJob(date);
      setResult(res);
      setPreviewedDate(date);
    } catch (err) {
      reportAdminError(err, "Preview failed");
    } finally {
      setRunning(null);
    }
  }

  async function runForReal() {
    if (!window.confirm(
      `This will really credit wallets / issue codes and send real birthday emails for every account matching ${date}. Continue?`
    )) return;
    setRunning("run");
    try {
      const res = await adminResources.devTools.runBirthdayJob(date);
      setResult(res);
      setPreviewedDate(date);
      toast.success(`Birthday job ran for ${date} — ${res.rewardedCount} of ${res.totalMatches} rewarded.`);
    } catch (err) {
      reportAdminError(err, "Run failed");
    } finally {
      setRunning(null);
    }
  }

  const canRun = previewedDate === date && !running;

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Cake size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Birthday reward job</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        Pick any date to see who would match (personal birthday or business founding date) and what they'd be
        awarded under the current rewards settings — Preview never credits a wallet, issues a code, or sends an
        email. Run for real actually does all three, exactly like the daily 11:59am job.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          type="date" className="admin-input" style={{ width: 170 }}
          value={date} onChange={(e) => { setDate(e.target.value); setResult(null); setPreviewedDate(null); }}
        />
        <button type="button" className="admin-btn admin-btn-ghost" disabled={!!running} onClick={() => void preview()}>
          {running === "preview" && <Loader2 size={14} className="animate-spin" />} Preview
        </button>
        <button type="button" className="admin-btn admin-btn-primary" disabled={!canRun} onClick={() => void runForReal()}>
          {running === "run" && <Loader2 size={14} className="animate-spin" />} Run for real
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 4 }}>
          <p style={{ fontSize: 12.5, marginBottom: 8 }}>
            {result.dryRun ? "Preview" : "Real run"} for <b>{result.date}</b> — {result.rewardedCount} of {result.totalMatches} would be rewarded.
          </p>
          {result.matches.length > 0 && (
            <table className="admin-table">
              <thead><tr><th>Email</th><th>Path</th><th>Outcome</th></tr></thead>
              <tbody>
                {result.matches.map((m, i) => (
                  <tr key={i}>
                    <td>{m.email ?? "—"}</td>
                    <td>{m.isBusinessAnniversary ? "Business anniversary" : "Personal birthday"}</td>
                    <td style={!m.rewarded ? { color: "var(--admin-muted)" } : undefined}>
                      {m.rewarded ? m.rewardSummary : `Skipped — ${m.skippedReason}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

// ── Lead digest email test ───────────────────────────────────────────────────

function LeadDigestTestCard() {
  const [running, setRunning] = useState<"preview" | "run" | null>(null);
  const [leads, setLeads] = useState<LeadPreviewDto[] | null>(null);
  const [hasPreviewed, setHasPreviewed] = useState(false);

  async function preview() {
    setRunning("preview");
    try {
      setLeads(await adminResources.devTools.previewLeadDigest());
      setHasPreviewed(true);
    } catch (err) {
      reportAdminError(err, "Preview failed");
    } finally {
      setRunning(null);
    }
  }

  async function sendForReal() {
    if (!window.confirm("This sends the real lead digest email now, to the real configured recipients. Continue?")) return;
    setRunning("run");
    try {
      const res = await adminResources.devTools.sendLeadDigestNow();
      setLeads(res);
      toast.success(`Digest sent with ${res.length} lead${res.length === 1 ? "" : "s"}.`);
    } catch (err) {
      reportAdminError(err, "Send failed");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Mail size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Lead digest email</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        Preview shows the uncontacted leads from the last 24 hours that would appear in today's digest — no email
        is sent. Send for real sends the actual digest email now, same as the weekday 8am job.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button type="button" className="admin-btn admin-btn-ghost" disabled={!!running} onClick={() => void preview()}>
          {running === "preview" && <Loader2 size={14} className="animate-spin" />} Preview
        </button>
        <button type="button" className="admin-btn admin-btn-primary" disabled={!hasPreviewed || !!running} onClick={() => void sendForReal()}>
          {running === "run" && <Loader2 size={14} className="animate-spin" />} Send for real
        </button>
      </div>
      {leads && (
        leads.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--admin-muted)" }}>No uncontacted leads in the last 24 hours.</p>
        ) : (
          <table className="admin-table">
            <thead><tr><th>Email</th><th>Source</th><th>Persona</th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}><td>{l.email}</td><td>{l.source ?? "—"}</td><td>{l.persona ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}

// ── Riseller sync test ───────────────────────────────────────────────────────

function RisellerSyncTestCard() {
  const [running, setRunning] = useState(false);

  async function runNow() {
    if (!window.confirm("This runs a real Riseller catalog + stock sync now (writes real price/stock changes). Continue?")) return;
    setRunning(true);
    try {
      const res = await adminResources.devTools.runRisellerSyncNow();
      toast.success(res.message);
    } catch (err) {
      reportAdminError(err, "Sync failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <RefreshCw size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Riseller catalog + stock sync</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        <b>No preview available</b> — this integration reads live from Riseller and writes price/stock changes
        directly, so there's no way to show a diff without actually running it. This always runs for real,
        exactly like the scheduled sync jobs. Check server logs for a full summary after running.
      </p>
      <button type="button" className="admin-btn admin-btn-primary" disabled={running} onClick={() => void runNow()}>
        {running && <Loader2 size={14} className="animate-spin" />} Run sync now
      </button>
    </div>
  );
}

// ── Made-to-order → Riseller replacement ────────────────────────────────────

function MadeToOrderReplacementCard() {
  const [previewing, setPreviewing] = useState(false);
  const [running, setRunning] = useState(false);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [hasPreviewed, setHasPreviewed] = useState(false);

  async function runPreview() {
    setPreviewing(true);
    try {
      const res = await adminResources.devTools.previewMadeToOrderReplacement();
      setPreviewResult(res.message);
      setHasPreviewed(true);
      toast.success("Preview complete — nothing was written. Review the plan below.");
    } catch (err) {
      reportAdminError(err, "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function runNow() {
    if (!window.confirm(
      "This converts every MADE_TO_ORDER product with a confident Riseller name match to a " +
      "real Riseller-linked product (same row/slug/image, refreshed name/price/category/" +
      "description), and SOFT-DELETES (not permanent) any made-to-order product with no " +
      "confident match — those can be brought back with one click from Products → Deleted " +
      "products. Have you reviewed the preview output above? Continue?"
    )) return;
    setRunning(true);
    try {
      const res = await adminResources.devTools.runMadeToOrderReplacementNow();
      toast.success("Replacement run complete — see result below.");
      setPreviewResult(res.message);
    } catch (err) {
      reportAdminError(err, "Made-to-order replacement failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <RefreshCw size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Made-to-order → Riseller replacement</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        Fuzzy-matches every MADE_TO_ORDER product by name against unclaimed Riseller catalog items.
        A confident match converts the product in place (image and URL preserved). A duplicate of
        an already-existing product is soft-deleted — if that existing product had no image, this
        product's image is transferred onto it first. No Riseller equivalent at all is also
        soft-deleted. <b>Nothing here is a permanent (hard) delete</b> — every soft-deleted product
        can be brought back with one click from{" "}
        <Link to="/admin/products/deleted" style={{ textDecoration: "underline" }}>Products → Deleted products</Link>.
        <b> Always run Preview first</b> — it computes the exact same plan without writing anything.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="admin-btn" disabled={previewing || running} onClick={() => void runPreview()}>
          {previewing && <Loader2 size={14} className="animate-spin" />} Preview (no changes)
        </button>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          disabled={running || previewing || !hasPreviewed}
          title={!hasPreviewed ? "Run Preview first" : undefined}
          onClick={() => void runNow()}
        >
          {running && <Loader2 size={14} className="animate-spin" />} Run replacement for real
        </button>
      </div>
      {previewResult && (
        <pre style={{
          marginTop: 14, padding: 12, fontSize: 11.5, whiteSpace: "pre-wrap",
          background: "var(--admin-bg-subtle, #f5f5f5)", borderRadius: 8, maxHeight: 340, overflow: "auto",
        }}>
          {previewResult}
        </pre>
      )}
    </div>
  );
}

// ── TumaBoda webhook registration ────────────────────────────────────────────

function TumaBodaWebhookCard() {
  const [status, setStatus] = useState<TumaBodaWebhookStatusDto | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [tumaWebhooks, setTumaWebhooks] = useState<TumaBodaWebhookListEntry[] | null>(null);
  const [listing, setListing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadStatus() {
    setLoadingStatus(true);
    try {
      setStatus(await adminResources.devTools.tumaBodaWebhookStatus());
    } catch (err) {
      reportAdminError(err, "Failed to load webhook status");
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => { void loadStatus(); }, []);

  async function register() {
    if (!window.confirm(
      `This registers "${callbackUrl}" with TumaBoda's ${sandbox ? "sandbox" : "LIVE"} account right now — a real change on their side, not a preview. Continue?`
    )) return;
    setRegistering(true);
    try {
      await adminResources.devTools.tumaBodaWebhookRegister({ callbackUrl: callbackUrl.trim(), sandbox });
      toast.success("Registered — secret stored automatically, verification is live now. No env var paste or redeploy needed.");
      setRevealed(false);
      setTumaWebhooks(null);
      await loadStatus();
    } catch (err) {
      reportAdminError(err, "Registration failed");
    } finally {
      setRegistering(false);
    }
  }

  async function copySecret() {
    if (!status?.secret) return;
    try {
      await navigator.clipboard.writeText(status.secret);
      toast.success("Secret copied to clipboard.");
    } catch {
      toast.error("Couldn't copy — clipboard access was denied.");
    }
  }

  async function loadTumaBodaList() {
    setListing(true);
    try {
      const res = await adminResources.devTools.tumaBodaWebhookList(sandbox);
      setTumaWebhooks(res.webhooks);
    } catch (err) {
      reportAdminError(err, "Failed to list TumaBoda's registered webhooks");
    } finally {
      setListing(false);
    }
  }

  async function deleteWebhook(id: string) {
    if (!window.confirm(`Delete webhook ${id} at TumaBoda? This can't be undone from here.`)) return;
    setDeletingId(id);
    try {
      await adminResources.devTools.tumaBodaWebhookDelete(id, sandbox);
      toast.success("Deleted.");
      setTumaWebhooks((prev) => prev?.filter((w) => w.id !== id) ?? null);
      await loadStatus();
    } catch (err) {
      reportAdminError(err, "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="admin-panel" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Webhook size={16} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>TumaBoda webhook registration</h3>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>
        Registers this environment's callback URL with TumaBoda so delivery-status updates arrive by webhook,
        alongside the 10-minute reconciliation poll that already covers any status a webhook misses. The signing
        secret is stored here automatically the moment you register — no manual env var paste, no redeploy.
        TumaBoda only ever returns it once; re-registering replaces what's stored.
      </p>

      {loadingStatus ? (
        <p style={{ fontSize: 12.5, color: "var(--admin-muted)", display: "flex", alignItems: "center", gap: 6 }}>
          <Loader2 size={13} className="animate-spin" /> Loading status…
        </p>
      ) : status?.configured ? (
        <div style={{ marginBottom: 14, borderBottom: "1px solid var(--admin-border)", paddingBottom: 14 }}>
          <p style={{ fontSize: 12.5, margin: "0 0 8px" }}>
            <span style={{ color: "#16a34a", fontWeight: 600 }}>● Configured</span>
            {" — "}{status.sandbox ? "sandbox" : "LIVE"} — <code>{status.callbackUrl}</code>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <code
              style={{
                background: "var(--admin-hover, rgba(0,0,0,0.05))", padding: "4px 10px", borderRadius: 6,
                fontSize: 12.5, letterSpacing: revealed ? "normal" : 2,
              }}
            >
              {revealed ? status.secret : "•".repeat(28)}
            </code>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => void copySecret()}>
              <Copy size={13} /> Copy
            </button>
            <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setRevealed((r) => !r)}>
              {revealed ? <EyeOff size={13} /> : <Eye size={13} />} {revealed ? "Hide" : "Reveal"}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 14 }}>Not configured yet on this environment.</p>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="admin-input" style={{ flex: 1, minWidth: 260 }}
          placeholder="https://api-staging.momentspackaging.com/api/v1/tumaboda/webhook"
          value={callbackUrl} onChange={(e) => setCallbackUrl(e.target.value)}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
          <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} /> Sandbox
        </label>
        <button type="button" className="admin-btn admin-btn-primary" disabled={registering || !callbackUrl.trim()} onClick={() => void register()}>
          {registering && <Loader2 size={14} className="animate-spin" />} Register
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--admin-border)", paddingTop: 12 }}>
        <button type="button" className="admin-btn admin-btn-ghost" disabled={listing} onClick={() => void loadTumaBodaList()}>
          {listing && <Loader2 size={14} className="animate-spin" />} List what TumaBoda has registered ({sandbox ? "sandbox" : "live"})
        </button>
        {tumaWebhooks && (
          tumaWebhooks.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--admin-muted)", marginTop: 10 }}>Nothing registered on TumaBoda's side.</p>
          ) : (
            <table className="admin-table" style={{ marginTop: 10 }}>
              <thead><tr><th>URL</th><th>Events</th><th>Active</th><th /></tr></thead>
              <tbody>
                {tumaWebhooks.map((w) => (
                  <tr key={w.id}>
                    <td style={{ fontSize: 12 }}>{w.url}</td>
                    <td style={{ fontSize: 11, color: "var(--admin-muted)" }}>{w.events.join(", ")}</td>
                    <td>{w.isActive ? "Yes" : "No"}</td>
                    <td>
                      <button
                        type="button" className="admin-btn admin-btn-ghost" disabled={deletingId === w.id}
                        onClick={() => void deleteWebhook(w.id)}
                      >
                        {deletingId === w.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

// ── Coming soon placeholders ──────────────────────────────────────────────────

const COMING_SOON = [
  "WhatsApp forward-to-developer test",
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

/** Gating and the AdminLayout chrome are handled once by the parent developer-section
 *  page (`_adminAuth.admin.developer.tsx`), which renders this as one of its tabs. */
export function DevToolsPanel() {
  return (
    <div className="admin-page-stack">
      <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
        <p style={{ margin: 0 }}>
          <b>Super Admin only.</b> Everything on this page is designed to never touch real customer/order data —
          no Order, Payment or Cart row is ever created by these tools.
        </p>
      </div>
      <TestAccountPreviewCard />
      <CheckoutDryRunCard />
      <StkPushTestCard />
      <PdfPreviewCard />
      <TestTaxInvoiceEmailCard />
      <BirthdayJobTestCard />
      <LeadDigestTestCard />
      <RisellerSyncTestCard />
      <MadeToOrderReplacementCard />
      <TumaBodaWebhookCard />
      <ComingSoonCard />
    </div>
  );
}
