import { useEffect, useState } from "react";
import { Coins, TrendingDown, TrendingUp, Wallet, Clock } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { adminResources, type RewardsSummaryDto } from "@/services/adminResources";

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

function KpiCard({
  label, value, sub, icon, emphasize,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="admin-panel" style={{ padding: 16, borderColor: emphasize ? "var(--admin-accent, #166534)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div className="admin-label">{label}</div>
        {icon && <div style={{ color: "var(--admin-muted)" }}>{icon}</div>}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--admin-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function AdminRewardsReportPage() {
  const [data, setData] = useState<RewardsSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setData(await adminResources.rewardsSummary.get());
      } catch (err) {
        reportAdminError(err, "Failed to load rewards report");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const placeholder = loading || !data ? "—" : null;

  return (
    <AdminLayout title="Rewards Report">
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)" }}>
          All-time totals across every customer's points wallet — welcome bonuses, order points, review
          bonuses and referral credits earned, versus points redeemed for discounts at checkout. This is
          what the rewards &amp; referral program has actually cost the business so far, plus what's still
          outstanding if every remaining point were redeemed today.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }} data-admin-stats>
          <KpiCard
            label="KES value redeemed"
            value={placeholder ?? fmtKes(data!.kesValueRedeemed)}
            sub={placeholder ? undefined : `${data!.totalPointsRedeemed.toLocaleString()} points redeemed all-time`}
            icon={<TrendingDown size={16} />}
            emphasize
          />
          <KpiCard
            label="Total points earned"
            value={placeholder ?? data!.totalPointsEarned.toLocaleString()}
            sub="Welcome, order, review & referral bonuses combined"
            icon={<TrendingUp size={16} />}
          />
          <KpiCard
            label="Total points redeemed"
            value={placeholder ?? data!.totalPointsRedeemed.toLocaleString()}
            icon={<Coins size={16} />}
          />
          <KpiCard
            label="Net points outstanding"
            value={placeholder ?? data!.netPointsOutstanding.toLocaleString()}
            sub={placeholder ? undefined : `Potential exposure: ${fmtKes(data!.kesValueOutstanding)} if fully redeemed`}
            icon={<Wallet size={16} />}
          />
        </div>

        {!loading && data && (
          <div className="admin-panel" style={{ padding: 14, fontSize: 12, color: "var(--admin-muted)" }}>
            Conversion rate: {data.creditsPerKes} points = KES 1. Configurable in Settings.
          </div>
        )}

        <div className="admin-panel" style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Clock size={16} color="var(--admin-muted)" />
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>Coming soon</h3>
          </div>
          <ul style={{ fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.8, paddingLeft: 20, listStyle: "disc" }}>
            <li>Time-range filtering — view earned/redeemed/profit-impact for a specific week, month, or custom date range instead of only all-time totals.</li>
            <li>A fuller cash-flow / business-terms breakdown — what the rewards &amp; referral program has cost by month, alongside gross revenue and margin for the same period.</li>
            <li>Sales attribution — how much revenue is actually driven by promo codes and referral links, not just how many points they've paid out.</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminRewardsReportPage;
