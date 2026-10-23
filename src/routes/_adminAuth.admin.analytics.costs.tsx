import { useEffect, useState } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { DateRangePicker, type DateRange } from "@/components/admin/DateRangePicker";
import { KpiCard } from "@/components/admin/analyticsUi";
import { ShareDonutChart, TrendLineChart } from "@/components/admin/analyticsCharts";
import { formatKes } from "@/components/admin/commerceUi";
import { CATEGORICAL } from "@/lib/analyticsPalette";
import { reportAdminError } from "@/lib/adminErrorToast";
import {
  COST_CATEGORIES,
  categoryLabel,
  createWebsiteCost,
  deleteWebsiteCost,
  getCostsVsRevenue,
  listWebsiteCosts,
  updateWebsiteCost,
  type CostRecurrence,
  type CostsVsRevenue,
  type WebsiteCost,
  type WebsiteCostInput,
} from "@/services/websiteCostsApi";

const RECURRENCE_LABEL: Record<CostRecurrence, string> = {
  ONE_OFF: "Once",
  MONTHLY: "Every month",
  YEARLY: "Every year",
};

/** Colour follows the category, in the fixed categorical order, whatever the range shows. */
const categoryColor = (c: string) => {
  const i = COST_CATEGORIES.findIndex((x) => x.value === c);
  return CATEGORICAL[(i < 0 ? COST_CATEGORIES.length - 1 : i) % CATEGORICAL.length];
};

const SERIES = [
  { key: "revenue", label: "Revenue", color: CATEGORICAL[0] },
  { key: "costs", label: "All costs", color: CATEGORICAL[1] },
  { key: "profit", label: "Profit", color: CATEGORICAL[2] },
];

const monthLabel = (ym: string) =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-KE", { month: "short", year: "2-digit" });

const dateLabel = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY: WebsiteCostInput = {
  name: "",
  category: "HOSTING",
  amountKes: 0,
  recurrence: "MONTHLY",
  startDate: today(),
  endDate: null,
  notes: null,
};

/**
 * What it costs to run the website against what the website brings in. Admins log each cost once:
 * a one-off (a developer invoice), or one that repeats every month (the server) or every year
 * (the domain). The charts count each repeating cost in every month it falls due.
 */
function AdminAnalyticsCostsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [range, setRange] = useState<DateRange | null>(null);
  const [report, setReport] = useState<CostsVsRevenue | null>(null);
  const [costs, setCosts] = useState<WebsiteCost[] | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; input: WebsiteCostInput } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Website costs · Moments admin";
  }, []);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    getCostsVsRevenue(range.from, range.to)
      .then((res) => {
        if (!cancelled) setReport(res);
      })
      .catch((err) => reportAdminError(err, "Failed to load costs against revenue"));
    return () => {
      cancelled = true;
    };
  }, [range, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    listWebsiteCosts()
      .then((res) => {
        if (!cancelled) setCosts(res);
      })
      .catch((err) => reportAdminError(err, "Failed to load the cost log"));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function save() {
    if (!editing) return;
    const input = editing.input;
    if (!input.name.trim() || !(input.amountKes >= 0) || !input.startDate) return;
    setSaving(true);
    try {
      const body = {
        ...input,
        endDate: input.recurrence === "ONE_OFF" ? null : input.endDate || null,
      };
      if (editing.id) await updateWebsiteCost(editing.id, body);
      else await createWebsiteCost(body);
      setEditing(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      reportAdminError(err, "Could not save that cost");
    } finally {
      setSaving(false);
    }
  }

  async function remove(cost: WebsiteCost) {
    if (
      !window.confirm(
        `Delete "${cost.name}" from the cost log? The charts will no longer count it.`,
      )
    )
      return;
    try {
      await deleteWebsiteCost(cost.id);
      setReloadKey((k) => k + 1);
    } catch (err) {
      reportAdminError(err, "Could not delete that cost");
    }
  }

  const trend = (report?.months ?? []).map((m) => ({
    label: monthLabel(m.month),
    revenue: m.revenueKes,
    costs: m.productCostKes + m.websiteCostKes,
    profit: m.profitKes,
  }));
  const slices = (report?.websiteCostByCategory ?? []).map((c) => ({
    name: categoryLabel(c.category),
    value: c.amountKes,
    color: categoryColor(c.category),
  }));
  const set = (patch: Partial<WebsiteCostInput>) =>
    setEditing((e) => (e ? { ...e, input: { ...e.input, ...patch } } : e));

  return (
    <AdminLayout title="Analytics · Website costs" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14 }}>
          <DateRangePicker onChange={setRange} />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4" style={{ marginTop: 16 }}>
            <KpiCard
              label="Revenue"
              value={report ? formatKes(report.totalRevenueKes) : "—"}
              sub="paid orders"
            />
            <KpiCard
              label="Product cost"
              value={report ? formatKes(report.totalProductCostKes) : "—"}
              sub="what the goods sold cost us"
            />
            <KpiCard
              label="Website costs"
              value={report ? formatKes(report.totalWebsiteCostKes) : "—"}
              sub="from the cost log below"
            />
            <KpiCard
              label="Profit after website costs"
              value={report ? formatKes(report.totalProfitKes) : "—"}
              sub="revenue − product cost − website costs"
              badges={
                report && report.totalProfitKes < 0 ? [{ label: "loss", tone: "warn" }] : undefined
              }
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3" style={{ marginTop: 16 }}>
            <div className="admin-panel lg:col-span-2" style={{ padding: 14 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>
                Revenue, costs and profit by month
              </div>
              {trend.length ? (
                <TrendLineChart data={trend} series={SERIES} valueFormatter={(v) => formatKes(v)} />
              ) : (
                <p
                  style={{
                    padding: "32px 0",
                    textAlign: "center",
                    color: "var(--admin-muted)",
                    fontSize: 13,
                  }}
                >
                  No figures for this period yet.
                </p>
              )}
              <p style={{ marginTop: 6, fontSize: 11.5, color: "var(--admin-muted)" }}>
                All costs = product cost + website costs. A month only partly in the range still
                carries all of that month&apos;s website costs, so whole months read best.
                {!!report?.unitsMissingCostPriceCount &&
                  ` ${report.unitsMissingCostPriceCount} units sold have no cost price on file, so product cost is understated.`}
              </p>
            </div>
            <div className="admin-panel" style={{ padding: 14 }}>
              <div className="admin-label" style={{ marginBottom: 8 }}>
                Website costs by category
              </div>
              {slices.length ? (
                <ShareDonutChart data={slices} valueFormatter={(v) => formatKes(v)} />
              ) : (
                <p
                  style={{
                    padding: "32px 0",
                    textAlign: "center",
                    color: "var(--admin-muted)",
                    fontSize: 13,
                  }}
                >
                  No website costs fall in this period.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="admin-panel" style={{ padding: 14 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <div className="admin-label">Cost log</div>
              <p style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 2 }}>
                Add each cost once. A repeating cost is counted every month or year from its start
                date.
              </p>
            </div>
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={() => setEditing({ id: null, input: { ...EMPTY, startDate: today() } })}
            >
              Add a cost
            </button>
          </div>

          {editing && (
            <form
              className="admin-panel"
              style={{ padding: 12, marginBottom: 12, display: "grid", gap: 10 }}
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="grid gap-3 md:grid-cols-3">
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="admin-label">What it is</span>
                  <input
                    className="admin-input"
                    required
                    maxLength={120}
                    value={editing.input.name}
                    placeholder="e.g. Contabo server"
                    onChange={(e) => set({ name: e.target.value })}
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="admin-label">Category</span>
                  <select
                    className="admin-select"
                    value={editing.input.category}
                    onChange={(e) =>
                      set({ category: e.target.value as WebsiteCostInput["category"] })
                    }
                  >
                    {COST_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="admin-label">Amount (KES)</span>
                  <input
                    className="admin-input"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={Number.isFinite(editing.input.amountKes) ? editing.input.amountKes : ""}
                    onChange={(e) => set({ amountKes: e.target.valueAsNumber })}
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="admin-label">How often</span>
                  <select
                    className="admin-select"
                    value={editing.input.recurrence}
                    onChange={(e) => set({ recurrence: e.target.value as CostRecurrence })}
                  >
                    {(Object.keys(RECURRENCE_LABEL) as CostRecurrence[]).map((r) => (
                      <option key={r} value={r}>
                        {RECURRENCE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span className="admin-label">
                    {editing.input.recurrence === "ONE_OFF" ? "Date paid" : "First payment"}
                  </span>
                  <input
                    className="admin-input"
                    type="date"
                    required
                    value={editing.input.startDate}
                    onChange={(e) => set({ startDate: e.target.value })}
                  />
                </label>
                {editing.input.recurrence !== "ONE_OFF" && (
                  <label style={{ display: "grid", gap: 4 }}>
                    <span className="admin-label">Stops after (optional)</span>
                    <input
                      className="admin-input"
                      type="date"
                      min={editing.input.startDate}
                      value={editing.input.endDate ?? ""}
                      onChange={(e) => set({ endDate: e.target.value || null })}
                    />
                  </label>
                )}
              </div>
              <label style={{ display: "grid", gap: 4 }}>
                <span className="admin-label">Notes (optional)</span>
                <input
                  className="admin-input"
                  maxLength={1000}
                  value={editing.input.notes ?? ""}
                  onChange={(e) => set({ notes: e.target.value || null })}
                />
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving ? "Saving…" : editing.id ? "Save changes" : "Add cost"}
                </button>
              </div>
            </form>
          )}

          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>What</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>How often</th>
                  <th>From</th>
                  <th>Until</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {costs === null ? (
                  <tr>
                    <td colSpan={7} style={{ color: "var(--admin-muted)" }}>
                      Loading…
                    </td>
                  </tr>
                ) : costs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ color: "var(--admin-muted)" }}>
                      No costs logged yet. Add the costs you have already paid first.
                    </td>
                  </tr>
                ) : (
                  costs.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        {c.notes && (
                          <div style={{ fontSize: 11.5, color: "var(--admin-muted)" }}>
                            {c.notes}
                          </div>
                        )}
                      </td>
                      <td>{categoryLabel(c.category)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        {formatKes(c.amountKes)}
                      </td>
                      <td>{RECURRENCE_LABEL[c.recurrence]}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{dateLabel(c.startDate)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {c.recurrence === "ONE_OFF"
                          ? "—"
                          : c.endDate
                            ? dateLabel(c.endDate)
                            : "ongoing"}
                      </td>
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                        <button
                          type="button"
                          className="admin-btn admin-btn-ghost"
                          onClick={() =>
                            setEditing({
                              id: c.id,
                              input: {
                                name: c.name,
                                category: c.category,
                                amountKes: c.amountKes,
                                recurrence: c.recurrence,
                                startDate: c.startDate,
                                endDate: c.endDate,
                                notes: c.notes,
                              },
                            })
                          }
                        >
                          Edit
                        </button>{" "}
                        <button
                          type="button"
                          className="admin-btn admin-btn-danger"
                          onClick={() => void remove(c)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminAnalyticsCostsPage;
