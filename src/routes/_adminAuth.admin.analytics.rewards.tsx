
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { priorRange } from "@/lib/analyticsInsights";
import { getRewardsEconomics, type RewardsEconomics } from "@/services/commerceApi";
import { RewardsSection, rewardsExportPayload } from "@/components/admin/analyticsPages/RewardsSection";

// Standalone tab (previously buried inside the "Finance" composite page's internal switcher) —
// narrowed per the analytics-restructuring pass so the nav name alone tells an admin what's here.
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

  return (
    <AdminLayout title="Analytics · Rewards & Referrals" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Rewards & Referrals",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-rewards",
                ...rewardsExportPayload(rewards),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            <RewardsSection rewards={rewards} rewardsLoading={rewardsLoading} priorRewards={priorRewards} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsRewardsPage;
