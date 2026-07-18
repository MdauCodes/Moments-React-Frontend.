import { Printer, FileDown } from "lucide-react";
import type { CustomerOrder } from "@/services/orderStore";
import { downloadReceiptPdf } from "@/lib/pdf";
import { useSiteConfig } from "@/contexts/SiteConfigContext";

function fmt(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

interface PrintReceiptProps {
  order: CustomerOrder;
  /** Optional: render only the printable receipt without the trigger button. */
  hideTrigger?: boolean;
}

/**
 * Print-friendly receipt block. The trigger calls window.print(); the
 * `print:` Tailwind utilities in `print-only` ensure the rest of the page is
 * hidden when the user prints. A second button downloads a real branded PDF
 * via jsPDF — no browser print dialog needed.
 */
export function PrintReceipt({ order, hideTrigger = false }: PrintReceiptProps) {
  const { businessKraPin } = useSiteConfig();
  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };
  const handlePdf = () => downloadReceiptPdf({ ...order, businessKraPin });

  return (
    <>
      {!hideTrigger && (
        <div className="inline-flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePdf}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <FileDown className="h-3.5 w-3.5" /> Download PDF
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>
      )}

      {/* Printable area — only shown on screen if user explicitly opens it.
          When printing, global @media print rules elsewhere hide everything
          except `.mpk-print-area`, so this section IS the print page. */}
      <div className="mpk-print-area hidden print:block print:!fixed print:!inset-0 print:!z-[9999] print:!bg-white print:!p-10 print:!text-black">
        <header style={{ borderBottom: "2px solid #111", paddingBottom: 12, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontFamily: "Fraunces, Georgia, serif", fontSize: 28 }}>Moments Packaging</h1>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#444" }}>
                info@momentspackaging.com · +254 119 556 688
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#444" }}>www.momentspackaging.com</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#666" }}>
                Receipt
              </p>
              <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 16 }}>{order.reference}</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#444" }}>
                {new Date(order.createdAt).toLocaleString("en-KE")}
              </p>
            </div>
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20, fontSize: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#666" }}>
              Billed to
            </p>
            <p style={{ margin: "4px 0 0", fontWeight: 600 }}>{order.customerName}</p>
            <p style={{ margin: 0 }}>{order.customerEmail}</p>
            <p style={{ margin: 0 }}>{order.customerPhone}</p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "#666" }}>
              Ship to
            </p>
            <p style={{ margin: "4px 0 0" }}>{order.shippingAddress}</p>
            <p style={{ margin: 0 }}>{order.city}</p>
          </div>
        </section>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #111" }}>
              <th style={{ textAlign: "left", padding: "8px 6px" }}>Item</th>
              <th style={{ textAlign: "right", padding: "8px 6px", width: 60 }}>Qty</th>
              <th style={{ textAlign: "right", padding: "8px 6px", width: 100 }}>Unit</th>
              <th style={{ textAlign: "right", padding: "8px 6px", width: 110 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
                <td style={{ padding: "8px 6px" }}>
                  <div style={{ fontWeight: 600 }}>{it.productName}</div>
                  <div style={{ color: "#555", fontSize: 10 }}>
                    {[it.size, it.material, it.finish].filter(Boolean).join(" · ")}
                    {it.sku ? ` · SKU ${it.sku}` : ""}
                  </div>
                </td>
                <td style={{ textAlign: "right", padding: "8px 6px" }}>{it.quantity.toLocaleString()}</td>
                <td style={{ textAlign: "right", padding: "8px 6px" }}>{fmt(it.unitPrice)}</td>
                <td style={{ textAlign: "right", padding: "8px 6px", fontWeight: 600 }}>{fmt(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} style={{ textAlign: "right", padding: "10px 6px", color: "#555" }}>
                Subtotal
              </td>
              <td style={{ textAlign: "right", padding: "10px 6px" }}>{fmt(order.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={3} style={{ textAlign: "right", padding: "4px 6px", color: "#555" }}>
                Shipping
              </td>
              <td style={{ textAlign: "right", padding: "4px 6px" }}>
                {order.shippingFee === 0 ? "Free" : fmt(order.shippingFee)}
              </td>
            </tr>
            {!!order.discount && order.discount > 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: "right", padding: "4px 6px", color: "#555" }}>
                  Discount
                </td>
                <td style={{ textAlign: "right", padding: "4px 6px", color: "#b91c1c" }}>
                  -{fmt(order.discount)}
                </td>
              </tr>
            )}
            <tr style={{ borderTop: "2px solid #111" }}>
              <td colSpan={3} style={{ textAlign: "right", padding: "10px 6px", fontWeight: 700, fontSize: 14 }}>
                Total ({order.currency})
              </td>
              <td style={{ textAlign: "right", padding: "10px 6px", fontWeight: 700, fontSize: 14 }}>
                {fmt(order.total)}
              </td>
            </tr>
          </tfoot>
        </table>

        <section style={{ fontSize: 11, color: "#555", marginTop: 24, borderTop: "1px solid #ddd", paddingTop: 12 }}>
          <p style={{ margin: 0 }}>
            Payment: <strong>{order.paymentMethod}</strong> · {order.paymentStatus}
            {order.paymentReference ? ` · Ref ${order.paymentReference}` : ""}
          </p>
          <p style={{ margin: "8px 0 0" }}>
            Thank you for your order. We are committed to Smooth Business Experiences and Convenience. of delivery —
            contact pkihara2008@gmail.com or visit www.momentspackaging.com/account/orders/{order.reference}.
          </p>
        </section>
      </div>
    </>
  );
}
