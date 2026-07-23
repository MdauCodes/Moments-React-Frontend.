
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard, sourceLabel } from "@/components/admin/analyticsUi";
import { ShareDonutChart, RankedBarChart } from "@/components/admin/analyticsCharts";
import { PeriodDeltaGrid, type MetricDeltaSpec } from "@/components/admin/PeriodDeltaGrid";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import { priorRange } from "@/lib/analyticsInsights";
import { getRewardsEconomics, type RewardsEconomics } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";

function AdminAnalyticsRewardsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [rewards, setRewards] = useState<RewardsEconomics | null>(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [priorRewards, setPriorRewards] = useState<RewardsEconomics | null>(null);

  useEffect(() => { document.title = "Rewards & Referrals · Moments admin"; }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setRewardsLoading(true);
    getRewardsEconomics(range.from, range.to)
      .then((res) => { if (!cancelled) setRewards(res); })
      .catch((err) => reportAdminError(err, "Failed to load rewards economics"))
      .finally(() => { if (!cancelled) setRewardsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    const { from, to } = priorRange(range.from, range.to);
    getRewardsEconomics(from, to)
      .then((res) => { if (!cancelled) setPriorRewards(res); })
      .catch((err) => reportAdminError(err, "Failed to load prior-period rewards comparison"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  const rewardsMetrics: MetricDeltaSpec[] | null = rewards && priorRewards ? [
    { label: "Referral conversion", current: rewards.referralConversionRatePercent, prior: priorRewards.referralConversionRatePercent, isPercent: true, goodDirection: "up", formatValue: (v) => `${v}%` },
    { label: "Redeemed value (program cost)", current: rewards.redeemedValueKesInRange, prior: priorRewards.redeemedValueKesInRange, goodDirection: "down", formatValue: formatKes },
  ] : null;

  return (
    <AdminLayout title="Analytics · Rewards & Referrals" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        {rewardsMetrics && <PeriodDeltaGrid title="What changed vs the prior period" metrics={rewardsMetrics} />}

        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div className="admin-label" style={{ marginBottom: 0 }}>Reward Coupons &amp; referral economics</div>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Rewards & Referrals",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-rewards",
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
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginTop: 14 }}>
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
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsRewardsPage;
