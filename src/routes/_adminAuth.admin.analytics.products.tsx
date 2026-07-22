
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard } from "@/components/admin/analyticsUi";
import { getProductsInventory, type ProductsInventory } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";

function AdminAnalyticsProductsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [inventory, setInventory] = useState<ProductsInventory | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);

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

  return (
    <AdminLayout title="Analytics · Products & Inventory" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div className="admin-label" style={{ marginBottom: 10 }}>Products & inventory</div>
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

          {!inventoryLoading && inventory && inventory.topSellingByRevenue.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>Top sellers (this period)</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {inventory.topSellingByRevenue.map((p, i) => (
                  <div key={i} className="admin-panel" style={{ padding: "10px 14px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{p.productName}</div>
                    <div style={{ fontSize: 20, fontFamily: "var(--font-display)" }}>{formatKes(p.revenueKes)}</div>
                    <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>{p.unitsSold} unit(s) sold</div>
                  </div>
                ))}
              </div>
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
