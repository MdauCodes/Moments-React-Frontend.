import { useState } from "react";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard } from "@/components/admin/analyticsUi";
import { ShareDonutChart, RankedBarChart } from "@/components/admin/analyticsCharts";
import { PeriodDeltaGrid, type MetricDeltaSpec } from "@/components/admin/PeriodDeltaGrid";
import { STATUS, CATEGORICAL } from "@/lib/analyticsPalette";
import type { ProductsInventory, ProfitabilityBreakdown, ProfitabilityLine, ProfitabilityByProduct } from "@/services/commerceApi";

type TableView = "inventory" | "products" | "category" | "subcategory" | "industry";

const VIEW_LABELS: Record<TableView, string> = {
  inventory: "Inventory", products: "Products", category: "Category", subcategory: "Subcategory", industry: "Industry",
};

function LineTable({ rows, caveat }: { rows: ProfitabilityLine[]; caveat?: string }) {
  return (
    <>
      {caveat && <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 8 }}>{caveat}</div>}
      <div className="admin-panel" data-admin-table-scroll>
        <table className="admin-table">
          <thead>
            <tr><th>Name</th><th>Units</th><th>Revenue</th><th>COGS</th><th>Gross Profit</th><th>Margin %</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6}><div className="admin-empty">No data for this period.</div></td></tr>
            ) : rows.map((r) => (
              <tr key={r.groupId}>
                <td>{r.groupName}</td>
                <td>{r.unitsSold.toLocaleString()}</td>
                <td>{formatKes(r.revenueKes)}</td>
                <td>{formatKes(r.cogsKes)}</td>
                <td>{formatKes(r.grossProfitKes)}</td>
                <td>{r.marginPercent}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProductsTable({ rows }: { rows: ProfitabilityByProduct[] }) {
  return (
    <div className="admin-panel" data-admin-table-scroll>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Product</th><th>Units</th><th>Revenue</th><th>COGS</th><th>Gross Profit</th>
            <th>Margin %</th><th>List GP% (Riseller)</th><th>Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={8}><div className="admin-empty">No data for this period.</div></td></tr>
          ) : rows.map((r) => (
            <tr key={r.productId}>
              <td>{r.productName}</td>
              <td>{r.unitsSold.toLocaleString()}</td>
              <td>{formatKes(r.revenueKes)}</td>
              <td>{formatKes(r.cogsKes)}</td>
              <td>{formatKes(r.grossProfitKes)}</td>
              <td>{r.marginPercent}%</td>
              <td>{r.listGrossProfitPercent != null ? `${r.listGrossProfitPercent}%` : "—"}</td>
              <td>{r.marginGapPercent != null ? `${r.marginGapPercent > 0 ? "+" : ""}${r.marginGapPercent}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function topSellersTotal(inv: ProductsInventory): number {
  return inv.topSellingByRevenue.reduce((sum, p) => sum + p.revenueKes, 0);
}

function InventoryView({
  inventory, inventoryLoading, priorInventory,
}: {
  inventory: ProductsInventory | null;
  inventoryLoading: boolean;
  priorInventory: ProductsInventory | null;
}) {
  const productMetrics: MetricDeltaSpec[] | null = inventory && priorInventory ? [
    { label: "Top-seller revenue (top 10)", current: topSellersTotal(inventory), prior: topSellersTotal(priorInventory), goodDirection: "up", formatValue: formatKes },
    { label: "Out of stock (live)", current: inventory.outOfStockCount, prior: priorInventory.outOfStockCount, goodDirection: "down", formatValue: (v) => v.toLocaleString() },
  ] : null;

  return (
    <>
      {productMetrics && (
        <div style={{ marginBottom: 14 }}>
          <PeriodDeltaGrid
            title="What changed vs the prior period"
            metrics={productMetrics}
            insights={["Out-of-stock is a live snapshot, not tied to the date range — its comparison here just shows two points in time, not period-over-period activity."]}
          />
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 10 }}>
        Top sellers are date-ranged; stock levels and valuation below are a live snapshot, not tied to the date range.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
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
    </>
  );
}

/** Table mode of the Data Visualization tab — a flat 5-way switcher (own internal state, no
 *  further nesting) so this doesn't stack a second switcher level beneath Data Visualization's
 *  own Table/Charts & Trends/Donut & Pie switcher. Inventory is the former standalone
 *  Products & Inventory page's content; the other four are Profitability's former breakdown
 *  tables (its Trend option lives in Charts & Trends instead). */
export function TableSection({
  inventory, inventoryLoading, priorInventory, breakdown, breakdownLoading,
}: {
  inventory: ProductsInventory | null;
  inventoryLoading: boolean;
  priorInventory: ProductsInventory | null;
  breakdown: ProfitabilityBreakdown | null;
  breakdownLoading: boolean;
}) {
  const [view, setView] = useState<TableView>("inventory");

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {(Object.keys(VIEW_LABELS) as TableView[]).map((v) => (
          <button
            key={v}
            type="button"
            className={`admin-btn ${view === v ? "admin-btn-primary" : "admin-btn-ghost"}`}
            onClick={() => setView(v)}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      {view === "inventory" && <InventoryView inventory={inventory} inventoryLoading={inventoryLoading} priorInventory={priorInventory} />}

      {view === "products" && (
        breakdownLoading || !breakdown ? <div className="admin-empty">Loading…</div> : (
          <>
            {breakdown.unitsMissingCostPriceCount > 0 && (
              <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 8 }}>
                {breakdown.unitsMissingCostPriceCount} unit(s) sold with no cost price on file — their COGS/Gross Profit is a floor, not exact.
              </div>
            )}
            <ProductsTable rows={breakdown.byProduct} />
          </>
        )
      )}

      {view === "category" && (
        breakdownLoading || !breakdown ? <div className="admin-empty">Loading…</div> : (
          <>
            <LineTable rows={breakdown.byCategory} caveat="Reflects each product's current classification, not its classification at time of sale." />
            {breakdown.byCategory.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="admin-label" style={{ marginBottom: 8 }}>Revenue by category (this period)</div>
                <RankedBarChart
                  data={breakdown.byCategory.map((c) => ({ name: c.groupName, revenue: c.revenueKes }))}
                  dataKey="revenue"
                  nameKey="name"
                  color={CATEGORICAL[0]}
                  valueFormatter={(v) => formatKes(v)}
                />
              </div>
            )}
          </>
        )
      )}

      {view === "subcategory" && (
        breakdownLoading || !breakdown ? <div className="admin-empty">Loading…</div> : (
          <>
            <LineTable rows={breakdown.bySubcategory} caveat="Reflects each product's current classification, not its classification at time of sale." />
            {breakdown.bySubcategory.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="admin-label" style={{ marginBottom: 8 }}>Revenue by subcategory (this period)</div>
                <RankedBarChart
                  data={breakdown.bySubcategory.map((s) => ({ name: s.groupName, revenue: s.revenueKes }))}
                  dataKey="revenue"
                  nameKey="name"
                  color={CATEGORICAL[1]}
                  valueFormatter={(v) => formatKes(v)}
                />
              </div>
            )}
          </>
        )
      )}

      {view === "industry" && (
        breakdownLoading || !breakdown ? <div className="admin-empty">Loading…</div> : (
          <>
            <div style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, background: "#fef3c7", color: "#92400e" }}>
                totals can exceed grand total
              </span>
            </div>
            <LineTable rows={breakdown.byIndustry} />
            {breakdown.byIndustry.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="admin-label" style={{ marginBottom: 8 }}>Revenue by industry (this period)</div>
                <RankedBarChart
                  data={breakdown.byIndustry.map((i) => ({ name: i.groupName, revenue: i.revenueKes }))}
                  dataKey="revenue"
                  nameKey="name"
                  color={CATEGORICAL[2]}
                  valueFormatter={(v) => formatKes(v)}
                />
              </div>
            )}
          </>
        )
      )}
    </>
  );
}

export function tableExportPayload(inventory: ProductsInventory | null, breakdown: ProfitabilityBreakdown | null) {
  return {
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
      ...(breakdown ? [
        { title: "Products", columns: ["Product", "Units", "Revenue", "COGS", "Gross Profit", "Margin %", "List GP%", "Gap"],
          rows: breakdown.byProduct.map((r) => [r.productName, r.unitsSold, r.revenueKes, r.cogsKes, r.grossProfitKes, r.marginPercent, r.listGrossProfitPercent ?? "—", r.marginGapPercent ?? "—"]) },
        { title: "Category", columns: ["Category", "Units", "Revenue", "COGS", "Gross Profit", "Margin %"],
          rows: breakdown.byCategory.map((r) => [r.groupName, r.unitsSold, r.revenueKes, r.cogsKes, r.grossProfitKes, r.marginPercent]) },
        { title: "Subcategory", columns: ["Subcategory", "Units", "Revenue", "COGS", "Gross Profit", "Margin %"],
          rows: breakdown.bySubcategory.map((r) => [r.groupName, r.unitsSold, r.revenueKes, r.cogsKes, r.grossProfitKes, r.marginPercent]) },
        { title: "Industry", columns: ["Industry", "Units", "Revenue", "COGS", "Gross Profit", "Margin %"],
          rows: breakdown.byIndustry.map((r) => [r.groupName, r.unitsSold, r.revenueKes, r.cogsKes, r.grossProfitKes, r.marginPercent]) },
      ] : []),
    ],
  };
}
