
import { useEffect, useState } from "react";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { AnalyticsExportButtons } from "@/components/admin/AnalyticsExportButtons";
import { formatRangeLabel } from "@/lib/analyticsExport";
import { getSignupTrend, getDemographicsBreakdown, type SignupTrend, type DemographicsBreakdown } from "@/services/commerceApi";
import { SignupsDemographicsSection, signupsDemographicsExportPayload } from "@/components/admin/analyticsPages/SignupsDemographicsSection";

// Standalone tab (previously buried inside the "Sales" composite page's internal switcher) —
// narrowed per the analytics-restructuring pass so the nav name alone tells an admin what's here.
function AdminAnalyticsSignupsDemographicsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);

  const [signupTrend, setSignupTrend] = useState<SignupTrend | null>(null);
  const [signupTrendLoading, setSignupTrendLoading] = useState(false);
  const [demographics, setDemographics] = useState<DemographicsBreakdown | null>(null);
  const [demographicsLoading, setDemographicsLoading] = useState(false);

  useEffect(() => { document.title = "Signups & Demographics · Moments admin"; }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setSignupTrendLoading(true);
    getSignupTrend(range.from, range.to)
      .then((res) => { if (!cancelled) setSignupTrend(res); })
      .catch((err) => reportAdminError(err, "Failed to load signup trend"))
      .finally(() => { if (!cancelled) setSignupTrendLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    setDemographicsLoading(true);
    getDemographicsBreakdown(range.from, range.to)
      .then((res) => { if (!cancelled) setDemographics(res); })
      .catch((err) => reportAdminError(err, "Failed to load demographics breakdown"))
      .finally(() => { if (!cancelled) setDemographicsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, reloadKey]);

  return (
    <AdminLayout title="Analytics · Signups & Demographics" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
            <div />
            <AnalyticsExportButtons
              getPayload={() => ({
                pageTitle: "Analytics · Signups & Demographics",
                rangeLabel: formatRangeLabel(range),
                filenamePrefix: "analytics-signups-demographics",
                ...signupsDemographicsExportPayload(signupTrend, demographics),
              })}
            />
          </div>
          <DateRangePicker onChange={setRange} />

          <div style={{ marginTop: 16 }}>
            <SignupsDemographicsSection
              signupTrend={signupTrend} signupTrendLoading={signupTrendLoading}
              demographics={demographics} demographicsLoading={demographicsLoading}
            />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsSignupsDemographicsPage;
