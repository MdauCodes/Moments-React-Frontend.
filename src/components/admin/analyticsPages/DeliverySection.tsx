import { KpiCard } from "@/components/admin/analyticsUi";
import { RankedBarChart } from "@/components/admin/analyticsCharts";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import { formatKes } from "@/components/admin/commerceUi";
import type { DeliveryAnalytics } from "@/services/commerceApi";

export function fulfillmentLabel(type: string): string {
  const labels: Record<string, string> = {
    PICKUP: "Pickup", MANUAL_DELIVERY: "Manual delivery", TUMABODA_DELIVERY: "Courier delivery",
    HAND_DELIVERY: "CBD / Hand delivery",
  };
  return labels[type] ?? type;
}

/** Extracted verbatim from the former standalone Delivery page. */
export function DeliverySection({ delivery, deliveryLoading }: { delivery: DeliveryAnalytics | null; deliveryLoading: boolean }) {
  return (
    <>
      <div style={{ fontSize: 11, color: "var(--admin-muted)", marginBottom: 10 }}>
        Delivery rate counts only orders that reached a resolved outcome (delivered or cancelled) —
        orders still in transit aren't counted as a failure.
      </div>

      {!deliveryLoading && delivery && delivery.byFulfillmentType.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            {delivery.byFulfillmentType.map((d) => {
              const resolvedCount = d.deliveredCount + d.cancelledCount;
              return (
                <KpiCard
                  key={d.fulfillmentType}
                  label={fulfillmentLabel(d.fulfillmentType)}
                  value={resolvedCount === 0 ? "—" : `${d.deliveryRatePercent}%`}
                  sub={resolvedCount === 0
                    ? `${d.totalOrders} order(s), none resolved yet (still in transit)`
                    : `${d.deliveredCount} delivered · ${d.cancelledCount} cancelled · ${d.totalOrders} total orders`}
                  badges={[
                    ...(d.deliverySampleCount === 0 ? [] : [{ label: `avg ${d.avgDeliveryHours}h dispatch→delivery`, tone: "info" as const }]),
                    ...(d.avgOrderValue == null ? [] : [{ label: `avg order ${formatKes(d.avgOrderValue)}`, tone: "ok" as const }]),
                  ]}
                />
              );
            })}
          </div>

          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            <div>
              <div className="admin-label" style={{ marginBottom: 8 }}>Orders by fulfillment type (this period)</div>
              <RankedBarChart
                data={delivery.byFulfillmentType.map((d) => ({ name: fulfillmentLabel(d.fulfillmentType), total: d.totalOrders }))}
                dataKey="total"
                nameKey="name"
                color={CATEGORICAL[0]}
              />
            </div>
            <div>
              <div className="admin-label" style={{ marginBottom: 8 }}>Paid revenue by fulfillment type (this period)</div>
              <RankedBarChart
                data={delivery.byFulfillmentType.map((d) => ({ name: fulfillmentLabel(d.fulfillmentType), revenue: Number(d.paidRevenue) }))}
                dataKey="revenue"
                nameKey="name"
                color={CATEGORICAL[1]}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

export function deliveryExportPayload(delivery: DeliveryAnalytics | null) {
  return {
    kpis: (delivery?.byFulfillmentType ?? []).map((d) => ({
      label: fulfillmentLabel(d.fulfillmentType),
      value: d.deliveredCount + d.cancelledCount === 0 ? "—" : `${d.deliveryRatePercent}%`,
    })),
    tables: [
      {
        title: "Delivery performance by fulfillment type",
        columns: ["Type", "Total orders", "Delivered", "Cancelled", "Delivery rate %", "Avg hours", "Paid revenue", "Avg order value"],
        rows: (delivery?.byFulfillmentType ?? []).map((d) => [
          fulfillmentLabel(d.fulfillmentType), d.totalOrders, d.deliveredCount, d.cancelledCount,
          d.deliveryRatePercent, d.avgDeliveryHours, d.paidRevenue, d.avgOrderValue ?? "—",
        ]),
      },
    ],
  };
}
