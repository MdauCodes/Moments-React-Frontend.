import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard, bundleStatusLabel } from "@/components/admin/analyticsUi";
import { ShareDonutChart } from "@/components/admin/analyticsCharts";
import { MetricInfoTooltip } from "@/components/admin/MetricInfoTooltip";
import { STATUS } from "@/lib/analyticsPalette";
import type { TaxReport } from "@/services/commerceApi";

const BUNDLE_STATUS_COLOR: Record<string, string> = {
  PENDING: STATUS.warning, SENT: STATUS.good, FAILED: STATUS.critical, EXPIRED: STATUS.serious,
};

/** Extracted verbatim from the former standalone Tax Report page — presentational only, data
 *  fetching now lives in the Finance tab's composite page so switching to/from this view is
 *  instant (data for both Finance sub-views loads together, same pattern Profitability's own
 *  internal switcher already uses). */
export function TaxSection({ tax, taxLoading }: { tax: TaxReport | null; taxLoading: boolean }) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
        <KpiCard
          label="VAT to remit"
          value={taxLoading || !tax ? "—" : formatKes(tax.vatToRemitKes)}
          sub={taxLoading || !tax ? undefined : `net of input VAT, on ${formatKes(tax.vatableSalesKes)} vatable sales, ${tax.paidOrderCount} paid order(s)`}
          badges={taxLoading || !tax || tax.unitsMissingCostOrVatRateCount === 0 ? undefined : [{ label: "floor, not exact", tone: "warn" }]}
          info="Output VAT = VAT collected from your customers. Input VAT = VAT already embedded in what you paid suppliers for the goods sold this period, extracted using each product's own VAT rate. Net VAT to remit = Output VAT − Input VAT — the actual amount owed to KRA, not the full amount collected from customers."
        />
        <KpiCard
          label="Tax invoices requested"
          value={taxLoading || !tax ? "—" : tax.taxInvoiceRequestedCount.toLocaleString()}
          sub={taxLoading || !tax ? undefined : "paid orders in this period"}
        />
        <KpiCard
          label="ETR bundles requested"
          value={taxLoading || !tax ? "—" : tax.etrRequestedCount.toLocaleString()}
          sub={taxLoading || !tax ? undefined : "paid orders in this period"}
        />
      </div>

      {!taxLoading && tax && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <div className="admin-label" style={{ marginBottom: 0 }}>How this is calculated</div>
            <MetricInfoTooltip title="How this is calculated">
              Net VAT to remit is Output VAT minus Input VAT, not the full VAT collected from customers — this avoids taxing the same value chain twice, since the supplier already charged VAT on what the business paid for these goods.
            </MetricInfoTooltip>
          </div>
          <div className="admin-panel" style={{ padding: 14, fontSize: 13, lineHeight: 1.8 }}>
            <div>Vatable sales: <strong>{formatKes(tax.vatableSalesKes)}</strong> &nbsp;→&nbsp; Output VAT: <strong>{formatKes(tax.outputVatKes)}</strong></div>
            <div>COGS this period (VAT-inclusive): <strong>{formatKes(tax.cogsForInputVatKes)}</strong> &nbsp;→&nbsp; Input VAT: <strong>{formatKes(tax.inputVatKes)}</strong></div>
            <div style={{ marginTop: 6, borderTop: "1px solid var(--admin-border)", paddingTop: 6 }}>
              Net VAT to remit: {formatKes(tax.outputVatKes)} − {formatKes(tax.inputVatKes)} = <strong>{formatKes(tax.vatToRemitKes)}</strong>
            </div>
            {tax.unitsMissingCostOrVatRateCount > 0 && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--admin-muted)" }}>
                {tax.unitsMissingCostOrVatRateCount} unit(s) sold with no cost price or VAT rate on file — their input VAT is treated as 0, so the net figure above is a floor, not exact.
              </div>
            )}
          </div>
        </div>
      )}

      {!taxLoading && tax && tax.documentBundleStatusCounts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="admin-label" style={{ marginBottom: 8 }}>ETR bundle delivery status</div>
          <ShareDonutChart
            data={tax.documentBundleStatusCounts.map((s) => ({
              name: bundleStatusLabel(s.status), value: s.count, color: BUNDLE_STATUS_COLOR[s.status] ?? STATUS.serious,
            }))}
          />
        </div>
      )}
    </>
  );
}

export function taxExportPayload(tax: TaxReport | null) {
  return {
    kpis: [
      { label: "Output VAT", value: tax ? formatKes(tax.outputVatKes) : "—" },
      { label: "Input VAT", value: tax ? formatKes(tax.inputVatKes) : "—" },
      { label: "VAT to remit (net)", value: tax ? formatKes(tax.vatToRemitKes) : "—" },
      { label: "Vatable sales", value: tax ? formatKes(tax.vatableSalesKes) : "—" },
      { label: "Paid orders", value: String(tax?.paidOrderCount ?? 0) },
      { label: "Tax invoices requested", value: String(tax?.taxInvoiceRequestedCount ?? 0) },
      { label: "ETR bundles requested", value: String(tax?.etrRequestedCount ?? 0) },
    ],
    tables: [
      {
        title: "How the net VAT was calculated",
        columns: ["Line", "Amount (KES)"],
        rows: tax ? [
          ["Vatable sales", tax.vatableSalesKes],
          ["Output VAT (collected from customers)", tax.outputVatKes],
          ["COGS this period (VAT-inclusive)", tax.cogsForInputVatKes],
          ["Input VAT (already paid to suppliers)", tax.inputVatKes],
          ["Net VAT to remit", tax.vatToRemitKes],
        ] : [],
      },
      {
        title: "ETR bundle delivery status",
        columns: ["Status", "Count"],
        rows: (tax?.documentBundleStatusCounts ?? []).map((s) => [bundleStatusLabel(s.status), s.count]),
      },
    ],
  };
}
