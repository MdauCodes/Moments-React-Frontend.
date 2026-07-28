import { KpiCard } from "@/components/admin/analyticsUi";
import { TrendLineChart, RankedBarChart } from "@/components/admin/analyticsCharts";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import type { SignupTrend, DemographicsBreakdown } from "@/services/commerceApi";

/** New section — no prior standalone page. Deliberately labeled "Signups" throughout, never
 *  "New Customers" (that's CustomerAnalytics.newPayingCustomersInRange, a different metric:
 *  first PAID order in range, not account creation). */
export function SignupsDemographicsSection({
  signupTrend, signupTrendLoading, demographics, demographicsLoading,
}: {
  signupTrend: SignupTrend | null;
  signupTrendLoading: boolean;
  demographics: DemographicsBreakdown | null;
  demographicsLoading: boolean;
}) {
  const totalSignups = signupTrend?.points.reduce((sum, p) => sum + p.signups, 0) ?? 0;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <KpiCard
          label="New signups"
          value={signupTrendLoading || !signupTrend ? "—" : totalSignups.toLocaleString()}
          sub="accounts created in this period"
          info="A raw count of accounts created in this period — not the same as 'New paying customers' on the Customers view, which counts a customer's first PAID order instead. Someone can sign up in one period and place their first paid order in a later one."
        />
      </div>

      {!signupTrendLoading && signupTrend && signupTrend.points.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="admin-label" style={{ marginBottom: 8 }}>Signups over time</div>
          <TrendLineChart
            data={signupTrend.points.map((p) => ({ label: p.date.slice(5), signups: p.signups }))}
            series={[{ key: "signups", label: "Signups", color: CATEGORICAL[0] }]}
            height={200}
          />
        </div>
      )}

      {!demographicsLoading && demographics && demographics.byAgeBracket.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="admin-label" style={{ marginBottom: 8 }}>Age bracket (personal-birthday signups this period)</div>
          <RankedBarChart
            data={demographics.byAgeBracket.map((a) => ({ name: a.bracket, count: a.count }))}
            dataKey="count"
            nameKey="name"
            color={CATEGORICAL[1]}
          />
        </div>
      )}

      {!demographicsLoading && demographics && demographics.excludedBusinessPathCount > 0 && (
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--admin-muted)" }}>
          {demographics.excludedBusinessPathCount} signup(s) this period chose the business-founding-date path
          instead of a personal birthday — they have no personal age/gender and aren't counted above.
        </div>
      )}
    </>
  );
}

export function signupsDemographicsExportPayload(signupTrend: SignupTrend | null, demographics: DemographicsBreakdown | null) {
  const totalSignups = signupTrend?.points.reduce((sum, p) => sum + p.signups, 0) ?? 0;
  return {
    kpis: [
      { label: "New signups", value: signupTrend ? totalSignups.toLocaleString() : "—" },
      { label: "Excluded (business path)", value: demographics ? demographics.excludedBusinessPathCount.toLocaleString() : "—" },
    ],
    tables: [
      {
        title: "Signups per day",
        columns: ["Date", "Signups"],
        rows: (signupTrend?.points ?? []).map((p) => [p.date, p.signups]),
      },
      {
        title: "Age bracket breakdown",
        columns: ["Bracket", "Count"],
        rows: (demographics?.byAgeBracket ?? []).map((a) => [a.bracket, a.count]),
      },
    ],
  };
}
