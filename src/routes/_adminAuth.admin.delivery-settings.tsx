import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources } from "@/services/adminResources";
import { formatKes } from "@/components/admin/commerceUi";
import { resolveStaffRole } from "@/lib/roles";
import { PodModeCard, TumaBodaOverrideCard, VehicleThresholdCard } from "@/components/admin/TumaBodaDeliveryCards";
import { TOPUP_ACCOUNT_KEY, TOPUP_PAYBILL_KEY } from "@/components/admin/TumaBodaStrategyNotice";
import { tumaBodaSettlementApi, type TumaBodaFunding, type TumaBodaFundingMode } from "@/services/tumaBodaSettlementService";

const CBD_FEE_KEY = "delivery.cbd.fee.kes";
const CBD_FEE_DEFAULT = "150";
const CBD_FREE_THRESHOLD_KEY = "delivery.cbd.freeThreshold.kes";
const CBD_FREE_THRESHOLD_DEFAULT = "5000";

function AdminDeliverySettingsPage() {
  const { isAdmin, user } = useAuth();
  const isSuperAdmin = resolveStaffRole(user) === "SUPER_ADMIN";
  const [reloadKey, setReloadKey] = useState(0);

  if (!isAdmin) return <AdminLayout title="Delivery Settings"><Forbidden resource="delivery settings" /></AdminLayout>;

  return (
    <AdminLayout title="Delivery Settings" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <SectionHeading title="TumaBoda" />
        <TumaBodaStrategyCard reloadKey={reloadKey} />
        <TopUpDetailsCard reloadKey={reloadKey} />
        {isSuperAdmin && <VehicleThresholdCard />}
        {isSuperAdmin && <PodModeCard />}
        {isSuperAdmin && <TumaBodaOverrideCard />}
        <SectionHeading title="Nairobi CBD hand delivery" />
        <CbdFeeCard reloadKey={reloadKey} />
        <CbdFreeThresholdCard reloadKey={reloadKey} />
      </div>
    </AdminLayout>
  );
}

/** Where Moments pays TumaBoda. TumaBoda only shows these on its own dashboard, so they're saved
 *  here to appear in the staff guide's top-up steps. */
function TopUpDetailsCard({ reloadKey }: { reloadKey: number }) {
  const [saved, setSaved] = useState<{ paybill: string; account: string } | null>(null);
  const [paybill, setPaybill] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminResources.settings
      .list()
      .then((rows) => {
        const p = rows.find((r) => r.key === TOPUP_PAYBILL_KEY)?.value ?? "";
        const a = rows.find((r) => r.key === TOPUP_ACCOUNT_KEY)?.value ?? "";
        setSaved({ paybill: p, account: a });
        setPaybill(p);
        setAccount(a);
      })
      .catch((err) => reportAdminError(err, "Failed to read the TumaBoda top-up details"));
  }, [reloadKey]);

  const valid = /^\d{5,7}$/.test(paybill.trim()) && account.trim().length <= 40;
  const dirty = saved !== null && (paybill.trim() !== saved.paybill || account.trim() !== saved.account);

  const save = async () => {
    setBusy(true);
    try {
      await adminResources.settings.upsert({ key: TOPUP_PAYBILL_KEY, value: paybill.trim(), description: "TumaBoda wallet M-Pesa Paybill number, shown in the staff guide's top-up steps." });
      await adminResources.settings.upsert({ key: TOPUP_ACCOUNT_KEY, value: account.trim(), description: "TumaBoda wallet Paybill account number, shown in the staff guide's top-up steps." });
      setSaved({ paybill: paybill.trim(), account: account.trim() });
      toast.success("TumaBoda top-up details saved.");
    } catch (err) {
      reportAdminError(err, "Failed to save the TumaBoda top-up details");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-panel" style={{ padding: 20 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>How to pay TumaBoda</h2>
      <p style={{ margin: "6px 0 12px", fontSize: 13, color: "var(--admin-muted)" }}>
        Copy the M-Pesa Paybill and account number from the TumaBoda dashboard's top-up page. They appear in the staff
        guide, so whoever tops up the wallet pays the right account.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="admin-label">Paybill number</span>
          <input className="admin-input" inputMode="numeric" style={{ width: 160 }} value={paybill}
            disabled={saved === null || busy} onChange={(e) => setPaybill(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span className="admin-label">Account number</span>
          <input className="admin-input" style={{ width: 200 }} value={account} maxLength={40}
            disabled={saved === null || busy} onChange={(e) => setAccount(e.target.value)} />
        </label>
        <button className="admin-btn admin-btn-primary" disabled={busy || !valid || !dirty} onClick={() => void save()}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : null} Save
        </button>
      </div>
      {paybill.trim() !== "" && !valid && (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "#b91c1c" }}>A Paybill number is 5 to 7 digits.</p>
      )}
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <h2 style={{ margin: "8px 0 -4px", fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "var(--admin-muted)" }}>
      {title}
    </h2>
  );
}

const STRATEGIES: { mode: TumaBodaFundingMode; label: string; detail: string }[] = [
  {
    mode: "WALLET",
    label: "Wallet (prepaid)",
    detail: "New deliveries count against the wallet. TumaBoda can't be chosen at checkout when the balance can't cover the fee.",
  },
  {
    mode: "CREDIT_LINE",
    label: "Credit line",
    detail: "New deliveries count against the credit line. TumaBoda can't be chosen at checkout when available credit can't cover the fee.",
  },
];

/** Which TumaBoda balance is active. The other ledger stays open on the Settlements page. */
function TumaBodaStrategyCard({ reloadKey }: { reloadKey: number }) {
  const [funding, setFunding] = useState<TumaBodaFunding | null>(null);
  const [pending, setPending] = useState<TumaBodaFundingMode | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    tumaBodaSettlementApi
      .getFunding()
      .then(setFunding)
      .catch((err) => reportAdminError(err, "Failed to read the TumaBoda payment strategy"));
  }, [reloadKey]);

  const apply = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      setFunding(await tumaBodaSettlementApi.setFundingMode(pending));
      toast.success(`TumaBoda payment strategy set to ${STRATEGIES.find((s) => s.mode === pending)?.label}.`);
    } catch (err) {
      reportAdminError(err, "Failed to change the TumaBoda payment strategy");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <div className="admin-panel" style={{ padding: 20 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>TumaBoda payment strategy</h2>
      <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--admin-muted)" }}>
        Applies from the moment it's saved, to deliveries booked after that. Deliveries already booked stay on the
        balance they started on, and both ledgers stay open on the TumaBoda Settlements page. This doesn't change how
        TumaBoda bills the account.
      </p>
      <div role="radiogroup" aria-label="TumaBoda payment strategy" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        {STRATEGIES.map((s) => {
          const active = funding?.mode === s.mode;
          return (
            <button
              key={s.mode}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!funding || busy}
              onClick={() => { if (!active) setPending(s.mode); }}
              style={{
                textAlign: "left",
                padding: 14,
                borderRadius: 10,
                cursor: !funding || active ? "default" : "pointer",
                background: "transparent",
                color: "inherit",
                border: active ? "2px solid var(--admin-accent)" : "1px solid var(--admin-border)",
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {s.label}{active ? " · Active" : ""}
              </div>
              <div style={{ fontSize: 12, color: "var(--admin-muted)", marginTop: 4, lineHeight: 1.45 }}>{s.detail}</div>
            </button>
          );
        })}
      </div>
      {funding && (
        <p style={{ margin: "12px 0 0", fontSize: 13 }}>
          Wallet balance, our estimate: <b>{formatKes(funding.estimatedBalance)}</b>
        </p>
      )}
      {pending && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 12, maxWidth: 420, width: "100%", padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Switch to {STRATEGIES.find((s) => s.mode === pending)?.label}?</h3>
            <p style={{ fontSize: 13, color: "var(--admin-muted)", marginTop: 8 }}>
              {pending === "WALLET" && funding && funding.estimatedBalance <= 0
                ? `The wallet estimate is ${formatKes(funding.estimatedBalance)}, so customers won't be able to choose TumaBoda until a top-up is recorded.`
                : STRATEGIES.find((s) => s.mode === pending)?.detail}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setPending(null)} disabled={busy}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={() => void apply()} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small reusable shape for a single-value KES setting card, modeled on the Settings page's
 *  VehicleThresholdCard (same read/confirm/save flow via the generic AppSetting API). */
function SingleValueSettingCard({
  reloadKey, settingKey, defaultValue, title, description, confirmLabel, successMessage,
}: {
  reloadKey: number;
  settingKey: string;
  defaultValue: string;
  title: (savedValue: string | null) => string;
  description: string;
  confirmLabel: (draft: string) => string;
  successMessage: (draft: string) => string;
}) {
  const [savedValue, setSavedValue] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = () => {
    adminResources.settings
      .list()
      .then((rows) => {
        const row = rows.find((r) => r.key === settingKey);
        const value = row?.value ?? defaultValue;
        setSavedValue(value);
        setDraft(value);
      })
      .catch((err) => reportAdminError(err, `Failed to read ${settingKey}`));
  };
  useEffect(() => { load(); }, [reloadKey]);

  const apply = async () => {
    setBusy(true);
    try {
      await adminResources.settings.upsert({ key: settingKey, value: draft, description });
      setSavedValue(draft);
      toast.success(successMessage(draft));
    } catch (err) {
      reportAdminError(err, `Failed to save ${settingKey}`);
    } finally { setBusy(false); setConfirm(false); }
  };

  const isValid = draft.trim() !== "" && !Number.isNaN(Number(draft)) && Number(draft) >= 0;
  const dirty = savedValue !== null && draft !== savedValue;

  return (
    <div className="admin-panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {title(savedValue)}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--admin-muted)" }}>
            {description}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="number"
            min={0}
            className="admin-input"
            style={{ width: 140 }}
            value={draft}
            disabled={savedValue === null || busy}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="KES"
          />
          <button
            className="admin-btn admin-btn-primary"
            disabled={busy || savedValue === null || !isValid || !dirty}
            onClick={() => setConfirm(true)}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : null} Save
          </button>
        </div>
      </div>
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 12, maxWidth: 420, width: "100%", padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Confirm new value?</h3>
            <p style={{ fontSize: 13, color: "var(--admin-muted)", marginTop: 8 }}>
              {confirmLabel(draft)}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setConfirm(false)} disabled={busy}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={() => void apply()} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CbdFeeCard({ reloadKey }: { reloadKey: number }) {
  return (
    <SingleValueSettingCard
      reloadKey={reloadKey}
      settingKey={CBD_FEE_KEY}
      defaultValue={CBD_FEE_DEFAULT}
      title={(saved) => `Nairobi CBD delivery fee ${saved === null ? "(loading…)" : `— KES ${saved}`}`}
      description="Flat Manual Delivery fee charged upfront at checkout for orders resolving to a Nairobi CBD address, unless the order also qualifies for free CBD delivery below. Applies from the moment it's saved."
      confirmLabel={(draft) => `New Manual Delivery orders to Nairobi CBD will be charged KES ${draft} for delivery, starting immediately.`}
      successMessage={(draft) => `CBD delivery fee set to KES ${draft}.`}
    />
  );
}

function CbdFreeThresholdCard({ reloadKey }: { reloadKey: number }) {
  return (
    <SingleValueSettingCard
      reloadKey={reloadKey}
      settingKey={CBD_FREE_THRESHOLD_KEY}
      defaultValue={CBD_FREE_THRESHOLD_DEFAULT}
      title={(saved) => `Free CBD delivery threshold ${saved === null ? "(loading…)" : `— KES ${saved}+`}`}
      description="Orders with a subtotal at or above this value get free delivery instead of the CBD fee above, when delivering to Nairobi CBD. Set to 0 to always charge the CBD fee regardless of order size."
      confirmLabel={(draft) => `Manual Delivery orders to Nairobi CBD with a subtotal of KES ${draft} or more will get free delivery, starting immediately.`}
      successMessage={(draft) => `Free CBD delivery threshold set to KES ${draft}.`}
    />
  );
}

export default AdminDeliverySettingsPage;
