import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { reportAdminError } from "@/lib/adminErrorToast";
import { adminResources, type SettingDto, type ReferralTierConfigDto } from "@/services/adminResources";

type FieldDef = {
  key: string;
  label: string;
  description: string;
  suffix?: string;
  defaultValue: string;
  type?: "number" | "boolean";
};

const REWARD_COUPON_FIELDS: FieldDef[] = [
  { key: "rewards.welcome.points", label: "Welcome bonus", description: "Reward Coupons awarded when any account (Individual Shopper or Business) is opened.", suffix: "coupons", defaultValue: "1000" },
  { key: "rewards.review.points", label: "Review bonus", description: "Reward Coupons awarded for submitting a product review.", suffix: "coupons", defaultValue: "50" },
  { key: "rewards.points.per.100kes", label: "Earn rate", description: "Reward Coupons earned per KES 100 spent on a paid order.", suffix: "coupons / KES 100", defaultValue: "1" },
  { key: "referral.credits.per.kes", label: "Redemption rate", description: "How many Reward Coupons equal KES 1 when redeemed at checkout — e.g. 10 means 10 coupons = KES 1.", suffix: "coupons / KES 1", defaultValue: "10" },
  { key: "referral.max.redemption.percent", label: "Max redemption per order", description: "The most an order's total can be covered by Reward Coupons.", suffix: "% of order", defaultValue: "20" },
  { key: "referral.max.qualifying.orders", label: "Referrer repeat-earning cap", description: "How many of a referred friend's paid orders keep earning the referrer coupons. Their friend's own one-time purchase bonus is unaffected either way.", suffix: "orders", defaultValue: "1" },
];

const WELCOME_CODE_FIELDS: FieldDef[] = [
  { key: "discounts.welcomeCodeEnabled", label: "Enabled", description: "Whether a new Business Account automatically gets a welcome code at signup. Individual Shopper accounts never get this — only Reward Coupons.", defaultValue: "true", type: "boolean" },
  { key: "discounts.welcomeCodePercent", label: "Discount", description: "Percentage off the Business Account welcome code applies.", suffix: "%", defaultValue: "5" },
  { key: "discounts.welcomeCodeMinOrderAmount", label: "Minimum order", description: "The order must reach this subtotal before the welcome code can be used.", suffix: "KES", defaultValue: "5000" },
  { key: "discounts.welcomeCodeValidDays", label: "Validity window", description: "Days from account creation before the welcome code expires.", suffix: "days", defaultValue: "30" },
];

function computeExample(values: Record<string, string>, tiers: ReferralTierConfigDto[]) {
  const welcome = Number(values["rewards.welcome.points"] ?? "0");
  const rate = Number(values["referral.credits.per.kes"] ?? "10") || 10;
  const kes = welcome / rate;
  // Illustrative first order of KES 1,000 — just to show the two customer types' totals side by side.
  const sampleOrderKes = 1000;
  const pointsPer100 = Number(values["rewards.points.per.100kes"] ?? "1") || 0;
  const orderPoints = Math.floor(sampleOrderKes / 100) * pointsPer100;
  const matchingTier = tiers.find(
    (t) => sampleOrderKes >= t.minOrderAmount && (t.maxOrderAmount == null || sampleOrderKes <= t.maxOrderAmount) && t.isActive,
  );
  const refereeBonus = matchingTier?.refereeCredits ?? 0;
  const nonReferredTotal = welcome + orderPoints;
  const referredTotal = welcome + orderPoints + refereeBonus;
  return { welcome, kes, sampleOrderKes, orderPoints, refereeBonus, nonReferredTotal, referredTotal };
}

function AdminRewardsSettingsPage() {
  const [rows, setRows] = useState<SettingDto[]>([]);
  const [tiers, setTiers] = useState<ReferralTierConfigDto[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const allFields = [...REWARD_COUPON_FIELDS, ...WELCOME_CODE_FIELDS];

  const load = async () => {
    setLoading(true);
    try {
      const [data, tierData] = await Promise.all([
        adminResources.settings.list(),
        adminResources.referralTiers.list().catch(() => []),
      ]);
      setRows(data);
      setTiers(tierData);
      const next: Record<string, string> = {};
      for (const f of allFields) {
        const found = data.find((r) => r.key === f.key);
        next[f.key] = found?.value ?? f.defaultValue;
      }
      setValues(next);
    } catch (err) {
      reportAdminError(err, "Failed to load rewards settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async (field: FieldDef) => {
    setSavingKey(field.key);
    try {
      const existing = rows.find((r) => r.key === field.key);
      await adminResources.settings.upsert({
        key: field.key,
        value: values[field.key],
        description: existing?.description ?? field.description,
      });
      toast.success(`${field.label} saved`);
      await load();
    } catch (err) {
      reportAdminError(err, "Save failed");
    } finally {
      setSavingKey(null);
    }
  };

  const example = computeExample(values, tiers);
  const referredAhead = example.referredTotal > example.nonReferredTotal;

  return (
    <AdminLayout title="Rewards Settings" onReload={load}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 16, fontSize: 13, color: "var(--admin-muted)" }}>
          <p style={{ margin: 0 }}>
            These are the same figures shown to customers in the welcome popup, the cart banner, and their
            dashboard — changes here take effect on the next page load, no deployment needed.
          </p>
          <p style={{ margin: "8px 0 0" }}>
            This covers the signup bonus and the ongoing coupons every customer earns on every order. It's
            separate from <b>Referral Payout Tiers</b>, which is a one-time bonus paid to a referrer and their
            referred friend on that friend's first qualifying order — the two don't overlap or compete.
          </p>
          {!loading && (
            <p style={{ margin: "8px 0 0", fontWeight: 600, color: "var(--admin-text)" }}>
              Right now: a new signup gets {example.welcome.toLocaleString()} coupons, worth about{" "}
              {new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(example.kes)}.
            </p>
          )}
        </div>

        {!loading && (
          <div
            className="admin-panel"
            style={{
              padding: 14,
              fontSize: 13,
              lineHeight: 1.6,
              background: referredAhead ? "rgba(239, 68, 68, 0.06)" : "rgba(34, 197, 94, 0.06)",
              border: `1px solid ${referredAhead ? "rgba(239, 68, 68, 0.3)" : "rgba(34, 197, 94, 0.3)"}`,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>
              Referred vs. non-referred, first KES {example.sampleOrderKes.toLocaleString()} order:
            </p>
            <p style={{ margin: "4px 0 0" }}>
              Non-referred customer: {example.welcome} (welcome) + {example.orderPoints} (order points) ={" "}
              <b>{example.nonReferredTotal} coupons</b>
            </p>
            <p style={{ margin: "2px 0 0" }}>
              Referred customer: {example.welcome} (welcome) + {example.orderPoints} (order points) +{" "}
              {example.refereeBonus} (referral bonus) = <b>{example.referredTotal} coupons</b>
            </p>
            <p style={{ margin: "6px 0 0", color: referredAhead ? "#b91c1c" : "#15803d" }}>
              {referredAhead
                ? `The referred customer currently ends up ${example.referredTotal - example.nonReferredTotal} coupons ahead of a non-referred one — lower the "referee credits" on the matching Referral Payout Tier (or raise the welcome bonus) to fix this.`
                : "Non-referred is currently equal to or ahead of referred, as intended."}
            </p>
          </div>
        )}

        <FieldGroup
          title="Reward Coupons"
          fields={REWARD_COUPON_FIELDS}
          values={values}
          setValues={setValues}
          loading={loading}
          savingKey={savingKey}
          onSave={save}
        />

        <FieldGroup
          title="Business Account welcome code"
          fields={WELCOME_CODE_FIELDS}
          values={values}
          setValues={setValues}
          loading={loading}
          savingKey={savingKey}
          onSave={save}
        />
      </div>
    </AdminLayout>
  );
}

function FieldGroup({
  title,
  fields,
  values,
  setValues,
  loading,
  savingKey,
  onSave,
}: {
  title: string;
  fields: FieldDef[];
  values: Record<string, string>;
  setValues: (v: (prev: Record<string, string>) => Record<string, string>) => void;
  loading: boolean;
  savingKey: string | null;
  onSave: (field: FieldDef) => void;
}) {
  return (
    <div className="admin-panel" style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 12px", fontFamily: "var(--font-display)", fontSize: 16 }}>{title}</h2>
      <div style={{ display: "grid", gap: 14 }}>
        {fields.map((f) => (
          <div key={f.key} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "end" }}>
            <label>
              <span className="admin-label">{f.label}</span>
              <p style={{ margin: "0 0 6px", fontSize: 12, color: "var(--admin-muted)" }}>{f.description}</p>
              {f.type === "boolean" ? (
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    disabled={loading}
                    checked={values[f.key] === "true"}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.checked ? "true" : "false" }))}
                  />
                  <span style={{ fontSize: 13 }}>{values[f.key] === "true" ? "On" : "Off"}</span>
                </label>
              ) : (
                <input
                  type="number"
                  className="admin-input"
                  disabled={loading}
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              )}
            </label>
            {f.suffix && <span style={{ fontSize: 12, color: "var(--admin-muted)", paddingBottom: 10 }}>{f.suffix}</span>}
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={loading || savingKey === f.key}
              onClick={() => onSave(f)}
            >
              {savingKey === f.key && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminRewardsSettingsPage;
