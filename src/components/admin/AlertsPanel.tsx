import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { STATUS } from "@/lib/analyticsPalette";
import type { Alerts } from "@/services/commerceApi";

interface AlertItem {
  label: string;
  count: number;
  tone: "warning" | "critical";
  href: string;
}

/**
 * Surfaces the handful of things worth an admin's attention right now, in one place, instead of
 * requiring five separate page visits to notice them. A live snapshot (not date-ranged) — "is
 * anything wrong right now" doesn't have a meaningful historical range.
 */
export function AlertsPanel({ alerts }: { alerts: Alerts }) {
  const allItems: AlertItem[] = [
    { label: "Orders pending payment over 24h", count: alerts.stalePendingOrders, tone: "warning", href: "/admin/orders" },
    { label: "Failed payments (last 7 days)", count: alerts.failedPaymentsRecent, tone: "critical", href: "/admin/queues/payment" },
    { label: "Out of stock products", count: alerts.outOfStockCount, tone: "critical", href: "/admin/inventory" },
    { label: "Low stock products", count: alerts.lowStockCount, tone: "warning", href: "/admin/inventory" },
    { label: "Unresolved refund requests", count: alerts.unresolvedRefunds, tone: "critical", href: "/admin/orders" },
  ];
  const items = allItems.filter((i) => i.count > 0);

  return (
    <div className="admin-panel" style={{ padding: 14 }}>
      <div className="admin-label" style={{ marginBottom: 10 }}>Needs attention</div>

      {items.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: STATUS.good }}>
          <CheckCircle2 size={16} />
          <span>Nothing needs attention right now.</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {items.map((item, i) => (
            <a
              key={i}
              href={item.href}
              className="admin-panel"
              style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: "inherit" }}
            >
              <AlertTriangle size={16} color={item.tone === "critical" ? STATUS.critical : STATUS.warning} />
              <div>
                <div style={{ fontSize: 18, fontFamily: "var(--font-display)" }}>{item.count}</div>
                <div style={{ fontSize: 11, color: "var(--admin-muted)" }}>{item.label}</div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
