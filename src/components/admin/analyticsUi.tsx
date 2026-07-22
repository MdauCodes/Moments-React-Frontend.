import type { ReactNode } from "react";
import { ORDER_STATUS_OPTIONS } from "@/components/admin/commerceUi";

export function KpiCard({
  label, value, sub, badges, icon,
}: {
  label: string;
  value: string;
  sub?: string;
  badges?: { label: string; tone?: "warn" | "info" | "ok" }[];
  icon?: ReactNode;
}) {
  return (
    <div className="admin-panel" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div className="admin-label">{label}</div>
        {icon && <div style={{ color: "var(--admin-muted)" }}>{icon}</div>}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 4 }}>{sub}</div>}
      {badges && badges.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {badges.map((b, i) => {
            const tones: Record<string, { bg: string; fg: string }> = {
              warn: { bg: "#fef3c7", fg: "#92400e" },
              info: { bg: "#dbeafe", fg: "#1e40af" },
              ok:   { bg: "#dcfce7", fg: "#166534" },
            };
            const t = tones[b.tone ?? "info"];
            return (
              <span key={i} style={{
                fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999,
                background: t.bg, color: t.fg,
              }}>{b.label}</span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Pipeline order (matches backend OrderStatus enum) — used to sort funnel bars so the x-axis
 *  itself carries the sequence, not just the color. */
export const ORDER_STATUS_SEQUENCE = [
  "PENDING_PAYMENT", "PAID", "PAYMENT_VERIFIED", "IN_PRODUCTION", "READY_FOR_DISPATCH",
  "DISPATCHED", "DELIVERED", "CANCELLED", "REFUNDED",
];

export function statusLabel(status: string): string {
  return ORDER_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status.replace(/_/g, " ");
}

export function sourceLabel(source: string): string {
  return source.replace(/^EARNED_/, "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function bundleStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: "Awaiting ETR upload", SENT: "Sent to customer", FAILED: "Failed to send", EXPIRED: "Expired",
  };
  return labels[status] ?? status;
}

export function accountTypeLabel(type: string): string {
  return type === "INDIVIDUAL_SHOPPER" ? "Individual shoppers" : type === "BUSINESS" ? "Business accounts" : type;
}
