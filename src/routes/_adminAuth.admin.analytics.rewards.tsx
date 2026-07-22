
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { formatKes } from "@/components/admin/commerceUi";
import { KpiCard, sourceLabel } from "@/components/admin/analyticsUi";
import { ShareDonutChart, RankedBarChart } from "@/components/admin/analyticsCharts";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import { getRewardsEconomics, type RewardsEconomics } from "@/services/commerceApi";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";

function AdminAnalyticsRewardsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [rewards, setRewards] = useState<RewardsEconomics | null>(null);
  const [rewardsLoading, setRewardsLoading] = useState(false);

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

  return (
    <AdminLayout title="Analytics · Rewards & Referrals" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div className="admin-label" style={{ marginBottom: 10 }}>Reward Coupons & referral economics</div>
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
