import { RefreshCw } from "lucide-react";
import { useAdminOrders, useLastUpdatedLabel, useNextPollLabel } from "@/contexts/AdminOrdersContext";

interface Props {
  onRefresh?: () => void;
}

export function QueueFreshness({ onRefresh }: Props) {
  const { lastUpdatedAt, refreshing, refresh } = useAdminOrders();
  const label = useLastUpdatedLabel(lastUpdatedAt);
  const nextPollLabel = useNextPollLabel(lastUpdatedAt);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 14px",
        fontSize: 11,
        color: "var(--admin-muted)",
      }}
    >
      <span>{label}</span>
      {nextPollLabel && !refreshing && (
        <span style={{ color: "color-mix(in oklab, var(--admin-muted) 70%, transparent)" }}>
          · {nextPollLabel}
        </span>
      )}
      <button
        type="button"
        className="admin-btn admin-btn-ghost"
        onClick={() => {
          void refresh();
          onRefresh?.();
        }}
        disabled={refreshing}
        style={{ padding: "4px 10px", fontSize: 12 }}
        aria-label="Refresh orders"
      >
        <RefreshCw
          size={12}
          className={refreshing ? "animate-spin" : undefined}
          style={{ marginRight: 6 }}
        />
        {refreshing ? "Refreshing" : "Refresh"}
      </button>
    </div>
  );
}
