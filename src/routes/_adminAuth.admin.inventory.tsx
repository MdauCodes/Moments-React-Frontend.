
import { useEffect, useState, type CSSProperties } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { adminResources, type ProductDto } from "@/services/adminResources";



const ADJUSTMENT_TYPES = [
  { value: "RESTOCK", label: "Restock (add units)" },
  { value: "RETURN", label: "Customer return (add units)" },
  { value: "CORRECTION", label: "Correction (signed delta)" },
  { value: "DAMAGE_WRITE_OFF", label: "Damage / write-off (remove units)" },
  { value: "MANUAL_DEDUCTION", label: "Manual deduction (remove units)" },
] as const;

function deltaLabel(type: string) {
  if (type === "RESTOCK" || type === "RETURN") return "Units to add";
  if (type === "DAMAGE_WRITE_OFF" || type === "MANUAL_DEDUCTION") return "Units to remove (enter positive number)";
  return "Delta (positive to add, negative to remove)";
}

interface AdjustState {
  product: ProductDto;
  type: string;
  delta: string;
  reason: string;
  busy: boolean;
}

function AdminInventoryPage() {
  const [low, setLow] = useState<ProductDto[]>([]);
  const [out, setOut] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjust, setAdjust] = useState<AdjustState | null>(null);
  const [setStockState, setSetStockState] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        adminResources.inventory.getLowStock().catch(() => []),
        adminResources.inventory.getOutOfStock().catch(() => []),
      ]);
      setLow(a ?? []);
      setOut(b ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitAdjust = async () => {
    if (!adjust) return;
    const delta = Number(adjust.delta);
    if (!isFinite(delta) || delta === 0) {
      toast.error("Enter a non-zero number");
      return;
    }
    setAdjust({ ...adjust, busy: true });
    try {
      // For "remove" types, accept a positive number and send negative if backend expects signed
      let signedDelta = delta;
      if (adjust.type === "DAMAGE_WRITE_OFF" || adjust.type === "MANUAL_DEDUCTION") {
        signedDelta = -Math.abs(delta);
      } else if (adjust.type === "RESTOCK" || adjust.type === "RETURN") {
        signedDelta = Math.abs(delta);
      }
      await adminResources.inventory.adjustStock(adjust.product.id, {
        type: adjust.type,
        delta: signedDelta,
        reason: adjust.reason.trim() || undefined,
      });
      toast.success("Stock updated");
      setAdjust(null);
      await load();
    } catch (err) {
      reportAdminError(err, "Failed to adjust stock");
      setAdjust({ ...adjust, busy: false });
    }
  };

  const submitSetStock = async (p: ProductDto) => {
    const raw = setStockState[p.id];
    const n = Number(raw);
    if (!isFinite(n) || n < 0) {
      toast.error("Enter a non-negative number");
      return;
    }
    try {
      await adminResources.inventory.setStock(p.id, n);
      toast.success("Stock set");
      setSetStockState((s) => ({ ...s, [p.id]: "" }));
      await load();
    } catch (err) {
      reportAdminError(err, "Failed to set stock");
    }
  };

  const renderTable = (rows: ProductDto[], emptyText: string) => {
    if (loading) return <p style={{ color: "var(--admin-muted)", fontSize: 13 }}>Loading…</p>;
    if (rows.length === 0)
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--admin-muted)", fontSize: 13, padding: "8px 2px" }}>
          <CheckCircle2 size={16} color="#15803d" />
          <span>{emptyText}</span>
        </div>
      );
    return (
      <div style={{ overflowX: "auto" }}>
        <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--admin-border)" }}>
              <th style={th}>Product</th>
              <th style={th}>Category</th>
              <th style={th}>Stock</th>
              <th style={th}>Threshold</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const stock = p.stockCount ?? p.stock ?? 0;
              const status = p.stockStatus ?? "MADE_TO_ORDER";
              const stockColor = status === "OUT_OF_STOCK" ? "#b91c1c" : status === "LOW_STOCK" ? "#a16207" : "var(--admin-text)";
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--admin-border)" }}>
                  <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                  <td style={{ ...td, color: "var(--admin-muted)" }}>{p.category ?? "—"}</td>
                  <td style={{ ...td, color: stockColor, fontWeight: 600 }}>{stock}</td>
                  <td style={{ ...td, color: "var(--admin-muted)" }}>{p.lowStockThreshold ?? "—"}</td>
                  <td style={td}>
                    <span
                      style={{
                        ...statusPill,
                        background:
                          status === "OUT_OF_STOCK"
                            ? "color-mix(in oklab,#dc2626 18%,var(--admin-surface))"
                            : status === "LOW_STOCK"
                              ? "color-mix(in oklab,#f59e0b 18%,var(--admin-surface))"
                              : "var(--admin-border)",
                      }}
                    >
                      {status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ ...td, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      className="admin-btn"
                      style={btn}
                      onClick={() =>
                        setAdjust({ product: p, type: "RESTOCK", delta: "", reason: "", busy: false })
                      }
                    >
                      Adjust
                    </button>
                    <input
                      type="number"
                      min={0}
                      placeholder="Set to…"
                      style={{ ...input, width: 90 }}
                      value={setStockState[p.id] ?? ""}
                      onChange={(e) =>
                        setSetStockState((s) => ({ ...s, [p.id]: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      className="admin-btn"
                      style={btn}
                      onClick={() => submitSetStock(p)}
                    >
                      Set stock
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const sectionHeader = (label: string, count: number) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
      <h2 style={{ ...h2, margin: 0 }}>{label}</h2>
      <span style={countPill}>{count} {count === 1 ? "product" : "products"}</span>
    </div>
  );

  return (
    <AdminLayout title="Inventory Management" onReload={load}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--admin-muted)" }}>
          Monitor and adjust stock levels across all tracked products.
        </p>

        <section className="admin-panel" style={panel}>
          {sectionHeader("Low Stock", low.length)}
          {renderTable(low, "No products are currently low on stock.")}
        </section>

        <section className="admin-panel" style={panel}>
          {sectionHeader("Out of Stock", out.length)}
          {renderTable(out, "No products are out of stock.")}
        </section>
      </div>

      {adjust && (
        <div
          onClick={() => !adjust.busy && setAdjust(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--admin-surface)",
              border: "1px solid var(--admin-border)",
              borderRadius: 12,
              maxWidth: 460,
              width: "100%",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Adjust Stock — {adjust.product.name}</h3>

            <label style={col}>
              <span style={labelStyle}>Adjustment type</span>
              <select
                style={input}
                value={adjust.type}
                onChange={(e) => setAdjust({ ...adjust, type: e.target.value, delta: "" })}
              >
                {ADJUSTMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={col}>
              <span style={labelStyle}>{deltaLabel(adjust.type)}</span>
              <input
                type="number"
                style={input}
                value={adjust.delta}
                onChange={(e) => setAdjust({ ...adjust, delta: e.target.value })}
                placeholder={adjust.type === "CORRECTION" ? "+10 or -5" : "0"}
              />
            </label>

            <label style={col}>
              <span style={labelStyle}>Reason (optional)</span>
              <input
                style={input}
                value={adjust.reason}
                onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
                placeholder="e.g. Damaged in transit"
              />
            </label>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="admin-btn"
                style={btn}
                onClick={() => setAdjust(null)}
                disabled={adjust.busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn"
                style={{ ...btn, background: "var(--admin-accent)", color: "var(--cream)" }}
                onClick={submitAdjust}
                disabled={adjust.busy}
              >
                {adjust.busy ? "Saving…" : "Save adjustment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

const panel: CSSProperties = {
  background: "var(--admin-surface)",
  border: "1px solid var(--admin-border)",
  borderRadius: 14,
  padding: 18,
};
const h2: CSSProperties = { margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 700, color: "var(--admin-text)" };
const th: CSSProperties = { padding: "8px 10px", fontWeight: 600, color: "var(--admin-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em" };
const td: CSSProperties = { padding: "10px", color: "var(--admin-text)" };
const btn: CSSProperties = {
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  padding: "5px 10px",
  fontSize: 12,
  cursor: "pointer",
  color: "var(--admin-text)",
};
const input: CSSProperties = {
  background: "var(--admin-bg)",
  border: "1px solid var(--admin-border)",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
  color: "var(--admin-text)",
  outline: "none",
  fontFamily: "inherit",
};
const col: CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const labelStyle: CSSProperties = { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--admin-muted)" };
const statusPill: CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  color: "var(--admin-text)",
};
const countPill: CSSProperties = {
  display: "inline-block",
  padding: "2px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 600,
  background: "var(--admin-border)",
  color: "var(--admin-muted)",
};

export default AdminInventoryPage;
