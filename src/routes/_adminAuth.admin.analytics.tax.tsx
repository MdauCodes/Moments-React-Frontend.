
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { getTaxReport, type TaxReport } from "@/services/commerceApi";
import { TaxSection, taxExportPayload } from "@/components/admin/analyticsPages/TaxSection";

// Standalone tab (previously buried inside the "Finance" composite page's internal switcher) —
// narrowed per the analytics-restructuring pass so the nav name alone tells an admin what's here.
function AdminAnalyticsTaxPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);

  const [tax, setTax] = useState<TaxReport | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);

  useEffect(() => { document.title = "Tax & Compliance · Moments admin"; }, []);

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
    <AdminLayout title="Analytics · Tax & Compliance" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Tax & Compliance",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-tax",
                ...taxExportPayload(tax),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            <TaxSection tax={tax} taxLoading={taxLoading} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsTaxPage;
