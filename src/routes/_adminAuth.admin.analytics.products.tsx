
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { priorRange } from "@/lib/analyticsInsights";
import {
  getProductsInventory, getProfitabilityBreakdown,
  type ProductsInventory, type ProfitabilityBreakdown,
} from "@/services/commerceApi";
import { TableSection, tableExportPayload } from "@/components/admin/analyticsPages/TableSection";

// Standalone tab, formerly the "Table" mode of the old Data Visualization tab — kept as one tab
// with its own internal 5-way switcher (Inventory/Products/Category/Subcategory/Industry) since
// these are genuinely five related views of the same subject (product performance), not an
// arbitrary shape-based grouping.
function AdminAnalyticsProductsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);

  const [inventory, setInventory] = useState<ProductsInventory | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [priorInventory, setPriorInventory] = useState<ProductsInventory | null>(null);
  const [breakdown, setBreakdown] = useState<ProfitabilityBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  useEffect(() => { document.title = "Products & Inventory · Moments admin"; }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setInventoryLoading(true);
    getProductsInventory(range.from, range.to)
      .then((res) => { if (!cancelled) setInventory(res); })
      .catch((err) => reportAdminError(err, "Failed to load products & inventory"))
      .finally(() => { if (!cancelled) setInventoryLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    const { from, to } = priorRange(range.from, range.to);
    getProductsInventory(from, to)
      .then((res) => { if (!cancelled) setPriorInventory(res); })
      .catch((err) => reportAdminError(err, "Failed to load prior-period products comparison"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setBreakdownLoading(true);
    getProfitabilityBreakdown(range.from, range.to)
      .then((res) => { if (!cancelled) setBreakdown(res); })
      .catch((err) => reportAdminError(err, "Failed to load profitability breakdown"))
      .finally(() => { if (!cancelled) setBreakdownLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  return (
    <AdminLayout title="Analytics · Products & Inventory" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Products & Inventory",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-products",
                ...tableExportPayload(inventory, breakdown),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            <TableSection
              inventory={inventory} inventoryLoading={inventoryLoading} priorInventory={priorInventory}
              breakdown={breakdown} breakdownLoading={breakdownLoading}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsProductsPage;
