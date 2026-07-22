
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard, bundleStatusLabel } from "@/components/admin/analyticsUi";
import { getTaxReport, type TaxReport } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";

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
          <div className="admin-label" style={{ marginBottom: 10 }}>Tax report</div>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {tax.documentBundleStatusCounts.map((s) => (
                  <div key={s.status} className="admin-panel" style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{bundleStatusLabel(s.status)}</div>
                    <div style={{ fontSize: 20, fontFamily: "var(--font-display)" }}>{s.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsTaxPage;
