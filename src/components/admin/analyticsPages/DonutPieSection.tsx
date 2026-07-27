import { formatKes } from "@/components/admin/commerceUi";
import { accountTypeLabel, sourceLabel, bundleStatusLabel } from "@/components/admin/analyticsUi";
import { ShareDonutChart } from "@/components/admin/analyticsCharts";
import { STATUS, CATEGORICAL } from "@/lib/analyticsPalette";
import type { CustomerAnalytics, RewardsEconomics, ProductsInventory, TaxReport, DemographicsBreakdown } from "@/services/commerceApi";

const BUNDLE_STATUS_COLOR: Record<string, string> = {
  PENDING: STATUS.warning, SENT: STATUS.good, FAILED: STATUS.critical, EXPIRED: STATUS.serious,
};
const GENDER_LABELS: Record<string, string> = {
  MALE: "Male", FEMALE: "Female", OTHER: "Other", PREFER_NOT_TO_SAY: "Prefer not to say",
};

/** Donut & Pie mode of the Data Visualization tab — every proportional-breakdown chart
 *  gathered into one small-multiples grid, mixing the donut and pie variants so the tab's name
 *  actually reflects what's on it. Each tile's data already exists elsewhere (Sales for
 *  customers/demographics, Finance for rewards/tax, Data Visualization's own Table mode for
 *  stock) — this mode is a display composition, not a new data source. Stock Health is a
 *  live snapshot, not date-range-scoped like the others — marked explicitly below. */
export function DonutPieSection({
  customers, customersLoading, rewards, rewardsLoading, inventory, inventoryLoading,
  tax, taxLoading, demographics, demographicsLoading,
}: {
  customers: CustomerAnalytics | null;
  customersLoading: boolean;
  rewards: RewardsEconomics | null;
  rewardsLoading: boolean;
  inventory: ProductsInventory | null;
  inventoryLoading: boolean;
  tax: TaxReport | null;
  taxLoading: boolean;
  demographics: DemographicsBreakdown | null;
  demographicsLoading: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
      <div>
        <div className="admin-label" style={{ marginBottom: 8 }}>Revenue by account type (this period)</div>
        {customersLoading || !customers || customers.byAccountType.length === 0 ? (
          <div className="admin-empty">{customersLoading ? "Loading…" : "No data for this period."}</div>
        ) : (
          <ShareDonutChart
            data={customers.byAccountType.map((a, i) => ({ name: accountTypeLabel(a.accountType), value: a.revenueKes, color: CATEGORICAL[i % CATEGORICAL.length] }))}
            valueFormatter={(v) => formatKes(v)}
            height={200}
          />
        )}
      </div>

      <div>
        <div className="admin-label" style={{ marginBottom: 8 }}>Coupons earned by source (this period)</div>
        {rewardsLoading || !rewards || rewards.earnedInRange.length === 0 ? (
          <div className="admin-empty">{rewardsLoading ? "Loading…" : "No data for this period."}</div>
        ) : (
          <ShareDonutChart
            variant="pie"
            data={rewards.earnedInRange.map((s, i) => ({ name: sourceLabel(s.source), value: s.coupons, color: CATEGORICAL[i % CATEGORICAL.length] }))}
            height={200}
          />
        )}
      </div>

      <div>
        <div className="admin-label" style={{ marginBottom: 8 }}>
          Stock health <span style={{ fontWeight: 400, color: "var(--admin-muted)" }}>(as of today, not date-ranged)</span>
        </div>
        {inventoryLoading || !inventory ? (
          <div className="admin-empty">Loading…</div>
        ) : (
          <ShareDonutChart
            data={[
              { name: "In stock", value: inventory.inStockCount, color: STATUS.good },
              { name: "Low stock", value: inventory.lowStockCount, color: STATUS.warning },
              { name: "Out of stock", value: inventory.outOfStockCount, color: STATUS.critical },
            ]}
            height={200}
          />
        )}
      </div>

      <div>
        <div className="admin-label" style={{ marginBottom: 8 }}>ETR bundle delivery status (this period)</div>
        {taxLoading || !tax || tax.documentBundleStatusCounts.length === 0 ? (
          <div className="admin-empty">{taxLoading ? "Loading…" : "No data for this period."}</div>
        ) : (
          <ShareDonutChart
            variant="pie"
            data={tax.documentBundleStatusCounts.map((s) => ({
              name: bundleStatusLabel(s.status), value: s.count, color: BUNDLE_STATUS_COLOR[s.status] ?? STATUS.serious,
            }))}
            height={200}
          />
        )}
      </div>

      <div>
        <div className="admin-label" style={{ marginBottom: 8 }}>Gender (personal-birthday signups, this period)</div>
        {demographicsLoading || !demographics || demographics.byGender.length === 0 ? (
          <div className="admin-empty">{demographicsLoading ? "Loading…" : "No data yet."}</div>
        ) : (
          <ShareDonutChart
            data={demographics.byGender.map((g, i) => ({ name: GENDER_LABELS[g.gender] ?? g.gender, value: g.count, color: CATEGORICAL[i % CATEGORICAL.length] }))}
            height={200}
          />
        )}
      </div>
    </div>
  );
}

export function donutPieExportPayload(
  customers: CustomerAnalytics | null, rewards: RewardsEconomics | null, inventory: ProductsInventory | null,
  tax: TaxReport | null, demographics: DemographicsBreakdown | null,
) {
  return {
    kpis: [],
    tables: [
      { title: "Revenue by account type", columns: ["Account type", "Customers", "Revenue (KES)"],
        rows: (customers?.byAccountType ?? []).map((a) => [accountTypeLabel(a.accountType), a.customerCount, a.revenueKes]) },
      { title: "Coupons earned by source", columns: ["Source", "Coupons", "Value (KES)"],
        rows: (rewards?.earnedInRange ?? []).map((s) => [sourceLabel(s.source), s.coupons, s.valueKes]) },
      { title: "Stock health (as of today)", columns: ["Status", "Count"],
        rows: inventory ? [["In stock", inventory.inStockCount], ["Low stock", inventory.lowStockCount], ["Out of stock", inventory.outOfStockCount]] : [] },
      { title: "ETR bundle delivery status", columns: ["Status", "Count"],
        rows: (tax?.documentBundleStatusCounts ?? []).map((s) => [bundleStatusLabel(s.status), s.count]) },
      { title: "Gender breakdown", columns: ["Gender", "Count"],
        rows: (demographics?.byGender ?? []).map((g) => [GENDER_LABELS[g.gender] ?? g.gender, g.count]) },
    ],
  };
}
