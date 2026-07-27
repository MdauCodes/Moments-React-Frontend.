import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard, sourceLabel } from "@/components/admin/analyticsUi";
import { ShareDonutChart, RankedBarChart } from "@/components/admin/analyticsCharts";
import { PeriodDeltaGrid, type MetricDeltaSpec } from "@/components/admin/PeriodDeltaGrid";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import type { RewardsEconomics } from "@/services/commerceApi";

/** Extracted verbatim from the former standalone Rewards & Referrals page — presentational only,
 *  data fetching now lives in the Finance tab's composite page (see TaxSection's doc comment). */
export function RewardsSection({
  rewards, rewardsLoading, priorRewards,
}: {
  rewards: RewardsEconomics | null;
  rewardsLoading: boolean;
  priorRewards: RewardsEconomics | null;
}) {
  const rewardsMetrics: MetricDeltaSpec[] | null = rewards && priorRewards ? [
    { label: "Referral conversion", current: rewards.referralConversionRatePercent, prior: priorRewards.referralConversionRatePercent, isPercent: true, goodDirection: "up", formatValue: (v) => `${v}%` },
    { label: "Redeemed value (program cost)", current: rewards.redeemedValueKesInRange, prior: priorRewards.redeemedValueKesInRange, goodDirection: "down", formatValue: formatKes },
  ] : null;

  return (
    <>
      {rewardsMetrics && <div style={{ marginBottom: 14 }}><PeriodDeltaGrid title="What changed vs the prior period" metrics={rewardsMetrics} /></div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard
          label="Outstanding coupon balance"
          value={rewardsLoading || !rewards ? "—" : rewards.outstandingBalanceCoupons.toLocaleString()}
          sub={rewardsLoading || !rewards ? undefined : `${formatKes(rewards.outstandingBalanceValueKes)} liability if all redeemed`}
        />
        <KpiCard
          label="Redeemed this period"
          value={rewardsLoading || !rewards ? "—" : formatKes(rewards.redeemedValueKesInRange)}
          sub={rewardsLoading || !rewards ? undefined : `${rewards.redeemedCouponsInRange.toLocaleString()} coupon(s) · this is the program's actual cost`}
        />
        <KpiCard
          label="Referral conversion"
          value={rewardsLoading || !rewards ? "—" : `${rewards.referralConversionRatePercent}%`}
          sub={rewardsLoading || !rewards ? undefined : `${rewards.referralConfirmedInRange} confirmed of ${rewards.referralSignupsInRange} signup(s)`}
        />
        <KpiCard
          label="Median wallet balance"
          value={rewardsLoading || !rewards ? "—" : rewards.medianWalletBalance.toLocaleString()}
          sub="coupons, across all wallets"
        />
      </div>

      {!rewardsLoading && rewards && rewards.earnedInRange.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="admin-label" style={{ marginBottom: 8 }}>Coupons earned by source (this period)</div>
          <ShareDonutChart
            data={rewards.earnedInRange.map((s, i) => ({ name: sourceLabel(s.source), value: s.coupons, color: CATEGORICAL[i % CATEGORICAL.length] }))}
          />
        </div>
      )}

      {!rewardsLoading && rewards && rewards.topHolders.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="admin-label" style={{ marginBottom: 8 }}>Top wallet holders</div>
          <RankedBarChart
            data={rewards.topHolders.map((h) => ({ name: h.name || "—", balance: h.balance }))}
            dataKey="balance"
            nameKey="name"
            color={CATEGORICAL[0]}
          />
        </div>
      )}
    </>
  );
}

export function rewardsExportPayload(rewards: RewardsEconomics | null) {
  return {
    kpis: [
      { label: "Outstanding coupon balance", value: rewards ? rewards.outstandingBalanceCoupons.toLocaleString() : "—" },
      { label: "Redeemed this period", value: rewards ? formatKes(rewards.redeemedValueKesInRange) : "—" },
      { label: "Referral conversion", value: rewards ? `${rewards.referralConversionRatePercent}%` : "—" },
      { label: "Median wallet balance", value: rewards ? rewards.medianWalletBalance.toLocaleString() : "—" },
    ],
    tables: [
      {
        title: "Coupons earned by source",
        columns: ["Source", "Coupons", "Value (KES)"],
        rows: (rewards?.earnedInRange ?? []).map((s) => [sourceLabel(s.source), s.coupons, s.valueKes]),
      },
      {
        title: "Top wallet holders",
        columns: ["Name", "Balance (coupons)", "Value (KES)"],
        rows: (rewards?.topHolders ?? []).map((h) => [h.name || "—", h.balance, h.valueKes]),
      },
    ],
  };
}
