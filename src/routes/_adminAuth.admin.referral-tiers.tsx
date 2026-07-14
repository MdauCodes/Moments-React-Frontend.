import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2, Pencil, Trash2, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources, type ReferralTierConfigDto, type MarginSummaryDto } from "@/services/adminResources";
import {
  type Band, type BandResult, type TuningInputs,
  computeBands, generateBands, DEFAULT_BANDS, PRESETS,
} from "@/lib/referralMarginCalc";

type FormState = {
  tierName: string;
  minOrderAmount: string;
  maxOrderAmount: string;
  referrerCredits: string;
  refereeCredits: string;
  isActive: boolean;
};

const empty: FormState = {
  tierName: "", minOrderAmount: "0", maxOrderAmount: "",
  referrerCredits: "", refereeCredits: "", isActive: true,
};

function fmtKes(n: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(n);
}

/** Brief per-field "this changed" pulse — not a real network loader, just visual confirmation. */
function usePulse() {
  const [pulsing, setPulsing] = useState<Set<string>>(new Set());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  function pulse(id: string, durationMs = 400) {
    setPulsing((prev) => new Set(prev).add(id));
    const existing = timers.current.get(id);
    if (existing) clearTimeout(existing);
    timers.current.set(id, setTimeout(() => {
      setPulsing((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }, durationMs));
  }
  return { pulsing, pulse };
}

function AdminReferralTiersPage() {
  const { isAdmin } = useAuth();
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [expandedBand, setExpandedBand] = useState<string | null>(null);
  const [summary, setSummary] = useState<MarginSummaryDto | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [rows, setRows] = useState<ReferralTierConfigDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ReferralTierConfigDto | null>(null);
  const [form, setForm] = useState<FormState>(empty);

  // ── Auto Mode state ──────────────────────────────────────────────────────
  const [bands, setBands] = useState<Band[]>(DEFAULT_BANDS);
  const [tuning, setTuning] = useState<Omit<TuningInputs, "blendedGrossProfitPercent" | "creditsPerKes">>({
    minimumProfitPercent: PRESETS.decent.minimumProfitPercent,
    rewardSharePercent: PRESETS.decent.rewardSharePercent,
    referrerSplitPercent: 50,
  });
  const [genOpen, setGenOpen] = useState(false);
  const [genStart, setGenStart] = useState("0");
  const [genWidth, setGenWidth] = useState("2000");
  const [genMax, setGenMax] = useState("10000");
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const { pulsing, pulse } = usePulse();

  const load = async () => {
    setLoading(true);
    try {
      setRows(await adminResources.referralTiers.list());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load referral tiers");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const s = await adminResources.marginSummary.get();
      setSummary(s);
      if (s.existingTiers.length > 0) {
        setBands(s.existingTiers.map((t) => ({
          id: t.id, tierName: t.tierName, minOrderAmount: t.minOrderAmount, maxOrderAmount: t.maxOrderAmount ?? null,
        })));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load margin summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => { void load(); void loadSummary(); }, []);

  const blendedGp = summary?.blendedGrossProfitPercent ?? 0;
  const creditsPerKes = summary?.creditsPerKes ?? 10;

  const bandResults: BandResult[] = useMemo(
    () => computeBands(bands, { ...tuning, blendedGrossProfitPercent: blendedGp, creditsPerKes }),
    [bands, tuning, blendedGp, creditsPerKes],
  );

  function applyPreset(name: "decent" | "generous") {
    setTuning((t) => ({ ...t, ...PRESETS[name] }));
    pulse("tuning");
  }

  function updateBand(id: string, patch: Partial<Band>) {
    setBands((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    pulse(id);
  }

  function addBand() {
    const last = bands[bands.length - 1];
    const newMin = last?.maxOrderAmount ?? 0;
    setBands((prev) => [...prev, {
      id: `new-${Date.now()}`, tierName: `Tier ${prev.length + 1}`, minOrderAmount: newMin, maxOrderAmount: null,
    }]);
  }

  function removeBand(id: string) {
    setBands((prev) => prev.filter((b) => b.id !== id));
  }

  function runGenerator() {
    const start = Number(genStart) || 0;
    const width = Number(genWidth) || 1000;
    const max = Number(genMax) || 10000;
    setBands(generateBands(start, width, max));
    toast.success("Bands generated — still fully editable below");
  }

  async function seedIntoSystem() {
    setSeeding(true);
    try {
      const payload = bandResults.map((b, idx) => ({
        tierName: b.tierName,
        minOrderAmount: b.minOrderAmount,
        maxOrderAmount: b.maxOrderAmount,
        referrerCredits: b.referrerCredits,
        refereeCredits: b.refereeCredits,
        isActive: true,
        sortOrder: idx,
      }));
      await adminResources.referralTiers.seed(payload);
      toast.success("Referral tiers seeded");
      setConfirmSeed(false);
      await Promise.all([load(), loadSummary()]);
      setMode("manual");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  // ── Manual Mode ──────────────────────────────────────────────────────────

  function begin(row?: ReferralTierConfigDto) {
    setEditing(row ?? null);
    if (row) {
      setForm({
        tierName: row.tierName,
        minOrderAmount: String(row.minOrderAmount),
        maxOrderAmount: row.maxOrderAmount != null ? String(row.maxOrderAmount) : "",
        referrerCredits: String(row.referrerCredits),
        refereeCredits: String(row.refereeCredits),
        isActive: row.isActive,
      });
    } else {
      // Auto-fill the new tier's minimum from the highest existing tier's maximum — continuous bands, no gaps.
      const highestMax = rows.reduce((max, r) => (r.maxOrderAmount != null && r.maxOrderAmount > max ? r.maxOrderAmount : max), 0);
      setForm({ ...empty, minOrderAmount: String(highestMax) });
    }
    setOpen(true);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body: Partial<ReferralTierConfigDto> = {
        tierName: form.tierName.trim(),
        minOrderAmount: Number(form.minOrderAmount) || 0,
        maxOrderAmount: form.maxOrderAmount.trim() ? Number(form.maxOrderAmount) : undefined,
        referrerCredits: Number(form.referrerCredits) || 0,
        refereeCredits: Number(form.refereeCredits) || 0,
        isActive: form.isActive,
        sortOrder: Math.round(Number(form.minOrderAmount) || 0),
      };
      if (editing) {
        await adminResources.referralTiers.update(editing.id, body);
        toast.success("Tier updated");
      } else {
        await adminResources.referralTiers.create(body);
        toast.success("Tier created");
      }
      setOpen(false);
      await Promise.all([load(), loadSummary()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: ReferralTierConfigDto) {
    if (!isAdmin || !confirm(`Delete tier ${row.tierName}?`)) return;
    setSaving(true);
    try {
      await adminResources.referralTiers.remove(row.id);
      toast.success("Tier deleted");
      await Promise.all([load(), loadSummary()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  // Read-only margin hint for whatever's currently typed in the Manual Mode form.
  const manualHint = useMemo(() => {
    if (!summary || summary.blendedGrossProfitPercent == null) return null;
    const min = Number(form.minOrderAmount) || 0;
    const max = form.maxOrderAmount.trim() ? Number(form.maxOrderAmount) : min * 1.5 || 1000;
    const orderValue = (min + max) / 2;
    const marginKes = orderValue * (summary.blendedGrossProfitPercent / 100);
    const rewardKes = ((Number(form.referrerCredits) || 0) + (Number(form.refereeCredits) || 0)) / summary.creditsPerKes;
    const remainingPercent = orderValue > 0 ? ((marginKes - rewardKes) / orderValue) * 100 : 0;
    const shareOfMargin = marginKes > 0 ? (rewardKes / marginKes) * 100 : 0;
    return { rewardKes, remainingPercent, shareOfMargin };
  }, [summary, form.minOrderAmount, form.maxOrderAmount, form.referrerCredits, form.refereeCredits]);

  return (
    <AdminLayout title="Referral Payout Tiers" actionLabel={mode === "manual" ? "New tier" : undefined} onAction={() => begin()}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 14, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p>
            <b>What this controls:</b> when a referred friend's first paid order lands, we look up
            which tier their order value falls into, then pay out <b>both</b> people — the referrer
            gets "referrer credits", the new customer (referee) gets "referee credits". Separate from{" "}
            <b>Rewards Tiers</b>, which is the VIP ladder based on lifetime points.
          </p>
          {!loading && rows.length === 0 && (
            <p style={{ marginTop: 10, color: "#b45309", fontWeight: 600 }}>
              No tiers exist yet — referrals are currently NOT paying out at all. Use Auto Mode below
              to get a safe, margin-aware starting point, or switch to Manual Mode to enter your own.
            </p>
          )}
        </div>

        <div className="admin-panel" style={{ padding: 14, fontSize: 13, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "var(--admin-muted)", fontSize: 11, textTransform: "uppercase" }}>Blended catalog margin</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {summaryLoading ? "…" : summary?.blendedGrossProfitPercent != null ? `${summary.blendedGrossProfitPercent.toFixed(1)}%` : "No data yet"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--admin-muted)", fontSize: 11, textTransform: "uppercase" }}>Products with real cost data</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {summaryLoading ? "…" : `${summary?.productsWithCostData ?? 0} / ${summary?.totalActiveProducts ?? 0}`}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--admin-muted)", fontSize: 11, textTransform: "uppercase" }}>Credits per KES</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{summaryLoading ? "…" : creditsPerKes}</div>
          </div>
          <div>
            <div style={{ color: "var(--admin-muted)", fontSize: 11, textTransform: "uppercase" }}>Live tiers</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{loading ? "…" : rows.length}</div>
          </div>
        </div>

        <div className="admin-toolbar" style={{ gap: 8 }}>
          <button className={`admin-btn ${mode === "manual" ? "admin-btn-primary" : "admin-btn-ghost"}`} onClick={() => setMode("manual")}>Manual Mode</button>
          <button className={`admin-btn ${mode === "auto" ? "admin-btn-primary" : "admin-btn-ghost"}`} onClick={() => setMode("auto")}>Auto Mode</button>
        </div>

        {mode === "auto" && (
          <>
            <div className="admin-panel" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>Tune the formula</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="admin-btn admin-btn-ghost" onClick={() => applyPreset("decent")}>Decent preset</button>
                  <button className="admin-btn admin-btn-ghost" onClick={() => applyPreset("generous")}>Generous preset</button>
                </div>
              </div>
              <div
                className="admin-form-grid"
                style={{ opacity: pulsing.has("tuning") ? 0.6 : 1, transition: "opacity 200ms" }}
              >
                <label>
                  <span className="admin-label">Minimum profit % always kept</span>
                  <input type="number" min={0} max={100} className="admin-input"
                    value={tuning.minimumProfitPercent}
                    onChange={(e) => { setTuning((t) => ({ ...t, minimumProfitPercent: Number(e.target.value) })); pulse("tuning"); }} />
                </label>
                <label>
                  <span className="admin-label">% of remaining margin shared as rewards</span>
                  <input type="number" min={0} max={100} className="admin-input"
                    value={tuning.rewardSharePercent}
                    onChange={(e) => { setTuning((t) => ({ ...t, rewardSharePercent: Number(e.target.value) })); pulse("tuning"); }} />
                </label>
                <label>
                  <span className="admin-label">Referrer share of reward pool (%)</span>
                  <input type="number" min={0} max={100} className="admin-input"
                    value={tuning.referrerSplitPercent}
                    onChange={(e) => { setTuning((t) => ({ ...t, referrerSplitPercent: Number(e.target.value) })); pulse("tuning"); }} />
                </label>
              </div>
            </div>

            <div className="admin-panel" style={{ padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>Bands (edit directly)</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="admin-btn admin-btn-ghost" onClick={() => setGenOpen((v) => !v)}>
                    <Sparkles size={14} /> Generate bands
                  </button>
                  <button className="admin-btn admin-btn-ghost" onClick={addBand}>+ Add band</button>
                </div>
              </div>

              {genOpen && (
                <div className="admin-form-grid" style={{ marginBottom: 14, paddingBottom: 14, borderBottom: "1px solid var(--admin-border)" }}>
                  <label><span className="admin-label">Start value (KES)</span>
                    <input className="admin-input" type="number" value={genStart} onChange={(e) => setGenStart(e.target.value)} /></label>
                  <label><span className="admin-label">Band width (KES)</span>
                    <input className="admin-input" type="number" value={genWidth} onChange={(e) => setGenWidth(e.target.value)} /></label>
                  <label><span className="admin-label">Top cutoff — final band is this value and up</span>
                    <input className="admin-input" type="number" value={genMax} onChange={(e) => setGenMax(e.target.value)} /></label>
                  <div style={{ alignSelf: "end" }}>
                    <button className="admin-btn admin-btn-primary" onClick={runGenerator}>Generate</button>
                  </div>
                </div>
              )}

              <div data-admin-table-scroll>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th /><th>Tier name</th><th>Min (KES)</th><th>Max (KES)</th>
                      <th>Margin</th><th>Reward pool</th><th>Referrer</th><th>Referee</th>
                      <th>Profit retained</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {bandResults.map((b) => {
                      const isExpanded = expandedBand === b.id;
                      const referrerKes = b.referrerCredits / creditsPerKes;
                      const refereeKes = b.refereeCredits / creditsPerKes;
                      const referrerPercentOfOrder = b.representativeOrderValue > 0 ? (referrerKes / b.representativeOrderValue) * 100 : 0;
                      const refereePercentOfOrder = b.representativeOrderValue > 0 ? (refereeKes / b.representativeOrderValue) * 100 : 0;
                      return (
                        <>
                          <tr key={b.id} style={{ opacity: pulsing.has(b.id) ? 0.5 : 1, transition: "opacity 200ms" }}>
                            <td>
                              <button className="admin-btn admin-btn-ghost" style={{ padding: "4px 6px" }}
                                onClick={() => setExpandedBand(isExpanded ? null : b.id)}
                                title="Show what a customer actually gets">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </button>
                            </td>
                            <td>
                              <input className="admin-input" style={{ width: 110 }} value={b.tierName}
                                onChange={(e) => updateBand(b.id, { tierName: e.target.value })} />
                            </td>
                            <td>
                              <input className="admin-input" style={{ width: 90 }} type="number" value={b.minOrderAmount}
                                onChange={(e) => updateBand(b.id, { minOrderAmount: Number(e.target.value) })} />
                            </td>
                            <td>
                              <input className="admin-input" style={{ width: 90 }} type="number" placeholder="no limit"
                                value={b.maxOrderAmount ?? ""}
                                onChange={(e) => updateBand(b.id, { maxOrderAmount: e.target.value === "" ? null : Number(e.target.value) })} />
                            </td>
                            <td>{fmtKes(b.marginKes)}</td>
                            <td><b>{fmtKes(b.rewardPoolKes)}</b></td>
                            <td>{b.referrerCredits.toLocaleString()} pts</td>
                            <td>{b.refereeCredits.toLocaleString()} pts</td>
                            <td style={{ color: b.remainingProfitPercent < 0 ? "#dc2626" : "#15803d", fontWeight: 600 }}>
                              {b.remainingProfitPercent.toFixed(1)}% ({fmtKes(b.remainingProfitKes)})
                            </td>
                            <td>
                              <button className="admin-btn admin-btn-ghost" onClick={() => removeBand(b.id)}>
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr>
                              <td colSpan={10} style={{ background: "rgba(0,0,0,0.02)", padding: "14px 20px" }}>
                                <div style={{ fontSize: 12.5, color: "var(--admin-muted)", marginBottom: 8 }}>
                                  What this means for a customer, at a typical order of ~{fmtKes(b.representativeOrderValue)} in this band:
                                </div>
                                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>Referrer (the one who shared the link)</div>
                                    <div style={{ fontSize: 13 }}>
                                      {b.referrerCredits.toLocaleString()} pts = <b>{fmtKes(referrerKes)}</b> off a future order
                                      (~{referrerPercentOfOrder.toFixed(1)}% of an order this size)
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>Referee (the new customer)</div>
                                    <div style={{ fontSize: 13 }}>
                                      {b.refereeCredits.toLocaleString()} pts = <b>{fmtKes(refereeKes)}</b> off a future order
                                      (~{refereePercentOfOrder.toFixed(1)}% of an order this size)
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="admin-toolbar" style={{ marginTop: 12 }}>
                <button className="admin-btn admin-btn-primary" onClick={() => setConfirmSeed(true)} disabled={bandResults.length === 0}>
                  Seed these bands into the referral system
                </button>
              </div>
            </div>
          </>
        )}

        {mode === "manual" && (
          <div className="admin-panel" data-admin-table-scroll>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tier</th><th>Order value range</th><th>Referrer gets</th><th>Referee gets</th><th>Status</th><th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6}><div className="admin-empty">Loading tiers…</div></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6}><div className="admin-empty">No tiers yet. <button className="admin-btn admin-btn-primary" onClick={() => begin()}>Create tier</button></div></td></tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td><b>{r.tierName}</b></td>
                      <td>{fmtKes(r.minOrderAmount)} – {r.maxOrderAmount != null ? fmtKes(r.maxOrderAmount) : "no limit"}</td>
                      <td>{r.referrerCredits.toLocaleString()} pts</td>
                      <td>{r.refereeCredits.toLocaleString()} pts</td>
                      <td>
                        <span style={{
                          display: "inline-flex", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: r.isActive ? "rgba(34, 197, 94, 0.15)" : "rgba(107, 114, 128, 0.15)",
                          color: r.isActive ? "#15803d" : "#374151",
                        }}>{r.isActive ? "Active" : "Disabled"}</span>
                      </td>
                      <td>
                        <button className="admin-btn admin-btn-ghost" onClick={() => begin(r)}>
                          <Pencil size={14} />Edit
                        </button>
                        {isAdmin && (
                          <button className="admin-btn admin-btn-danger" onClick={() => void remove(r)}>
                            <Trash2 size={14} />Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {open && (
          <div className="admin-modal-backdrop">
            <form className="admin-modal" onSubmit={save}>
              <div className="admin-toolbar">
                <h2>{editing ? "Edit tier" : "Create tier"}</h2>
                <button type="button" className="admin-btn admin-btn-ghost" onClick={() => setOpen(false)}>Close</button>
              </div>
              <div className="admin-form-grid">
                <label>
                  <span className="admin-label">Tier name</span>
                  <input required className="admin-input" value={form.tierName}
                    onChange={(e) => setForm({ ...form, tierName: e.target.value })}
                    placeholder="Standard, Big order, …" />
                </label>
                <label>
                  <span className="admin-label">Minimum order value (KES)</span>
                  <input required type="number" min={0} className="admin-input" value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} />
                </label>
                <label>
                  <span className="admin-label">Maximum order value (KES, optional)</span>
                  <input type="number" min={0} className="admin-input" value={form.maxOrderAmount}
                    onChange={(e) => setForm({ ...form, maxOrderAmount: e.target.value })}
                    placeholder="Leave blank for no upper limit" />
                </label>
                <label>
                  <span className="admin-label">Referrer gets (points)</span>
                  <input required type="number" min={0} className="admin-input" value={form.referrerCredits}
                    onChange={(e) => setForm({ ...form, referrerCredits: e.target.value })} />
                </label>
                <label>
                  <span className="admin-label">Referee gets (points)</span>
                  <input required type="number" min={0} className="admin-input" value={form.refereeCredits}
                    onChange={(e) => setForm({ ...form, refereeCredits: e.target.value })} />
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input type="checkbox" checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                  <span className="admin-label" style={{ margin: 0 }}>Active</span>
                </label>
              </div>

              {manualHint && (
                <div style={{
                  margin: "0 0 14px", padding: "10px 12px", borderRadius: 8, fontSize: 12.5,
                  background: manualHint.remainingPercent < 0 ? "rgba(220,38,38,0.08)" : "rgba(34,197,94,0.08)",
                  color: manualHint.remainingPercent < 0 ? "#b91c1c" : "#15803d",
                }}>
                  This payout ({fmtKes(manualHint.rewardKes)}) is ~{manualHint.shareOfMargin.toFixed(0)}% of the
                  estimated margin at this order size — business keeps ~{manualHint.remainingPercent.toFixed(1)}%
                  profit after paying it out. (Informational only, based on blended catalog margin.)
                </div>
              )}

              <div className="admin-toolbar">
                <button className="admin-btn admin-btn-primary" disabled={saving}>
                  {saving && <Loader2 size={14} className="animate-spin" />}Save
                </button>
              </div>
            </form>
          </div>
        )}

        {confirmSeed && (
          <div className="admin-modal-backdrop">
            <div className="admin-modal">
              <div className="admin-toolbar">
                <h2>Replace existing tiers?</h2>
                <button className="admin-btn admin-btn-ghost" onClick={() => setConfirmSeed(false)}>Close</button>
              </div>
              <p style={{ fontSize: 13, color: "var(--admin-muted)", padding: "0 0 16px" }}>
                This will permanently delete all {rows.length} currently active tier(s) and replace them
                with the {bandResults.length} band(s) shown in Auto Mode. This cannot be undone.
              </p>
              <div className="admin-toolbar">
                <button className="admin-btn admin-btn-danger" onClick={seedIntoSystem} disabled={seeding}>
                  {seeding && <Loader2 size={14} className="animate-spin" />}Yes, replace tiers
                </button>
                <button className="admin-btn admin-btn-ghost" onClick={() => setConfirmSeed(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminReferralTiersPage;
