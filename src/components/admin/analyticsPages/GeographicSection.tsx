import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard } from "@/components/admin/analyticsUi";
import { RankedBarChart } from "@/components/admin/analyticsCharts";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import type { GeographicAnalytics } from "@/services/commerceApi";

/** Extracted verbatim from the former standalone Geographic page. */
export function GeographicSection({ geo, geoLoading }: { geo: GeographicAnalytics | null; geoLoading: boolean }) {
  const totalRevenue = geo?.byCounty.reduce((sum, c) => sum + c.revenueKes, 0) ?? 0;
  const topCounty = geo?.byCounty[0];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard
          label="Counties with paid orders"
          value={geoLoading || !geo ? "—" : geo.byCounty.length.toLocaleString()}
          sub="this period"
        />
        <KpiCard
          label="Top county"
          value={geoLoading || !topCounty ? "—" : topCounty.region}
          sub={geoLoading || !topCounty ? undefined : `${formatKes(topCounty.revenueKes)} · ${topCounty.orderCount} order(s)`}
        />
        <KpiCard
          label="Total paid revenue"
          value={geoLoading || !geo ? "—" : formatKes(totalRevenue)}
          sub="across all counties, this period"
        />
      </div>

      {!geoLoading && geo && geo.byCounty.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="admin-label" style={{ marginBottom: 8 }}>Revenue by county (this period)</div>
          <RankedBarChart
            data={geo.byCounty.map((c) => ({ name: c.region, revenue: c.revenueKes }))}
            dataKey="revenue"
            nameKey="name"
            color={CATEGORICAL[0]}
            valueFormatter={(v) => formatKes(v)}
          />
        </div>
      )}
    </>
  );
}

export function geographicExportPayload(geo: GeographicAnalytics | null) {
  const totalRevenue = geo?.byCounty.reduce((sum, c) => sum + c.revenueKes, 0) ?? 0;
  const topCounty = geo?.byCounty[0];
  return {
    kpis: [
      { label: "Counties with paid orders", value: String(geo?.byCounty.length ?? 0) },
      { label: "Top county", value: topCounty?.region ?? "—" },
      { label: "Total paid revenue", value: formatKes(totalRevenue) },
    ],
    tables: [
      {
        title: "Revenue by county",
        columns: ["County", "Orders", "Revenue (KES)"],
        rows: (geo?.byCounty ?? []).map((c) => [c.region, c.orderCount, c.revenueKes]),
      },
    ],
  };
}
