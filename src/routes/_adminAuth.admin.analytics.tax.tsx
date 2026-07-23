
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard, bundleStatusLabel } from "@/components/admin/analyticsUi";
import { ShareDonutChart } from "@/components/admin/analyticsCharts";
import { STATUS } from "@/lib/analyticsPalette";
import { getTaxReport, type TaxReport } from "@/services/commerceApi";

const BUNDLE_STATUS_COLOR: Record<string, string> = {
  PENDING: STATUS.warning, SENT: STATUS.good, FAILED: STATUS.critical, EXPIRED: STATUS.serious,
};
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";

function AdminAnalyticsTaxPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [tax, setTax] = useState<TaxReport | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);

  useEffect(() => { document.title = "Tax Report · Moments admin"; }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setTaxLoading(true);
    getTaxReport(range.from, range.to)
      .then((res) => { if (!cancelled) setTax(res); })
      .catch((err) => reportAdminError(err, "Failed to load tax report"))
      .finally(() => { if (!cancelled) setTaxLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  return (
    <AdminLayout title="Analytics · Tax Report" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div className="admin-label" style={{ marginBottom: 0 }}>Tax report</div>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Tax Report",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-tax",
                kpis: [
                  { label: "VAT to remit", value: tax ? formatKes(tax.vatToRemitKes) : "—" },
                  { label: "Vatable sales", value: tax ? formatKes(tax.vatableSalesKes) : "—" },
                  { label: "Paid orders", value: String(tax?.paidOrderCount ?? 0) },
                  { label: "Tax invoices requested", value: String(tax?.taxInvoiceRequestedCount ?? 0) },
                  { label: "ETR bundles requested", value: String(tax?.etrRequestedCount ?? 0) },
                ],
                tables: [
                  {
                    title: "ETR bundle delivery status",
                    columns: ["Status", "Count"],
                    rows: (tax?.documentBundleStatusCounts ?? []).map((s) => [bundleStatusLabel(s.status), s.count]),
                  },
                ],
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
            <KpiCard
              label="VAT to remit"
              value={taxLoading || !tax ? "—" : formatKes(tax.vatToRemitKes)}
              sub={taxLoading || !tax ? undefined : `on ${formatKes(tax.vatableSalesKes)} vatable sales, ${tax.paidOrderCount} paid order(s)`}
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
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsTaxPage;
