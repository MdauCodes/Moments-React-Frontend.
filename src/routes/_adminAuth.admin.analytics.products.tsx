
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard } from "@/components/admin/analyticsUi";
import { ShareDonutChart, RankedBarChart } from "@/components/admin/analyticsCharts";
import { PeriodDeltaGrid, type MetricDeltaSpec } from "@/components/admin/PeriodDeltaGrid";
import { STATUS, CATEGORICAL } from "@/lib/analyticsPalette";
import { priorRange } from "@/lib/analyticsInsights";
import { getProductsInventory, type ProductsInventory } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";

function topSellersTotal(inv: ProductsInventory): number {
  return inv.topSellingByRevenue.reduce((sum, p) => sum + p.revenueKes, 0);
}

function AdminAnalyticsProductsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [inventory, setInventory] = useState<ProductsInventory | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [priorInventory, setPriorInventory] = useState<ProductsInventory | null>(null);

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

  const productMetrics: MetricDeltaSpec[] | null = inventory && priorInventory ? [
    { label: "Top-seller revenue (top 10)", current: topSellersTotal(inventory), prior: topSellersTotal(priorInventory), goodDirection: "up", formatValue: formatKes },
    { label: "Out of stock (live)", current: inventory.outOfStockCount, prior: priorInventory.outOfStockCount, goodDirection: "down", formatValue: (v) => v.toLocaleString() },
  ] : null;

  return (
    <AdminLayout title="Analytics · Products & Inventory" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        {productMetrics && (
          <PeriodDeltaGrid
            title="What changed vs the prior period"
            metrics={productMetrics}
            insights={["Out-of-stock is a live snapshot, not tied to the date range — its comparison here just shows two points in time, not period-over-period activity."]}
          />
        )}

        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div className="admin-label" style={{ marginBottom: 0 }}>Products &amp; inventory</div>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Products & Inventory",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-products",
                kpis: [
                  { label: "In stock", value: String(inventory?.inStockCount ?? 0) },
                  { label: "Low stock", value: String(inventory?.lowStockCount ?? 0) },
                  { label: "Out of stock", value: String(inventory?.outOfStockCount ?? 0) },
                  { label: "Inventory value (cost)", value: inventory ? formatKes(inventory.totalInventoryCostValueKes) : "—" },
                  { label: "Inventory value (retail)", value: inventory ? formatKes(inventory.totalInventoryRetailValueKes) : "—" },
                ],
                tables: [
                  {
                    title: "Top sellers (this period)",
                    columns: ["Product", "Units sold", "Revenue (KES)"],
                    rows: (inventory?.topSellingByRevenue ?? []).map((p) => [p.productName, p.unitsSold, p.revenueKes]),
                  },
                  {
                    title: "Restock attention needed",
                    columns: ["Product", "Stock", "Threshold", "Status"],
                    rows: (inventory?.lowStockAlerts ?? []).map((s) => [s.productName, s.stockCount, s.lowStockThreshold, s.stockStatus.replace(/_/g, " ")]),
                  },
                ],
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />
          <div style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 6 }}>
            Top sellers are date-ranged above; stock levels and valuation below are a live snapshot, not tied to the date range.
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
            <KpiCard
              label="In stock / low / out"
              value={inventoryLoading || !inventory ? "—" : `${inventory.inStockCount} / ${inventory.lowStockCount} / ${inventory.outOfStockCount}`}
              sub="active products, live snapshot"
              badges={inventoryLoading || !inventory || inventory.outOfStockCount === 0 ? undefined : [{ label: `${inventory.outOfStockCount} out of stock`, tone: "warn" }]}
            />
            <KpiCard
              label="Inventory value (cost)"
              value={inventoryLoading || !inventory ? "—" : formatKes(inventory.totalInventoryCostValueKes)}
              sub={inventoryLoading || !inventory ? undefined : inventory.productsMissingCostPriceCount > 0 ? `${inventory.productsMissingCostPriceCount} product(s) missing a cost price` : "all stocked products have a cost price"}
              badges={inventoryLoading || !inventory || inventory.productsMissingCostPriceCount === 0 ? undefined : [{ label: "floor, not exact", tone: "warn" }]}
            />
            <KpiCard
              label="Inventory value (retail)"
              value={inventoryLoading || !inventory ? "—" : formatKes(inventory.totalInventoryRetailValueKes)}
              sub="at current base price"
            />
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="admin-label" style={{ marginBottom: 8 }}>Stock health (live snapshot)</div>
            {!inventoryLoading && inventory && (
              <ShareDonutChart
                data={[
                  { name: "In stock", value: inventory.inStockCount, color: STATUS.good },
                  { name: "Low stock", value: inventory.lowStockCount, color: STATUS.warning },
                  { name: "Out of stock", value: inventory.outOfStockCount, color: STATUS.critical },
                ]}
                height={180}
              />
            )}
          </div>

          {!inventoryLoading && inventory && inventory.topSellingByRevenue.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>Top sellers (this period)</div>
              <RankedBarChart
                data={inventory.topSellingByRevenue.map((p) => ({ name: p.productName, revenue: p.revenueKes }))}
                dataKey="revenue"
                nameKey="name"
                color={CATEGORICAL[0]}
                valueFormatter={(v) => formatKes(v)}
              />
            </div>
          )}

          {!inventoryLoading && inventory && inventory.lowStockAlerts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>Restock attention needed</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {inventory.lowStockAlerts.map((s, i) => (
                  <div key={i} className="admin-panel" style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.productName}</div>
                    <div style={{ fontSize: 20, fontFamily: "var(--font-display)" }}>{s.stockCount}</div>
                    <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>
                      threshold {s.lowStockThreshold} · {s.stockStatus.replace(/_/g, " ").toLowerCase()}
                    </div>
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

export default AdminAnalyticsProductsPage;
