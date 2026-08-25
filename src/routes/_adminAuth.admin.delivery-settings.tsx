import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { useAuth } from "@/contexts/AdminAuthContext";
import { adminResources } from "@/services/adminResources";

const CBD_FEE_KEY = "delivery.cbd.fee.kes";
const CBD_FEE_DEFAULT = "150";
const CBD_FREE_THRESHOLD_KEY = "delivery.cbd.freeThreshold.kes";
const CBD_FREE_THRESHOLD_DEFAULT = "5000";

function AdminDeliverySettingsPage() {
  const { isAdmin } = useAuth();
  const [reloadKey, setReloadKey] = useState(0);

  if (!isAdmin) return <AdminLayout title="Delivery Settings"><Forbidden resource="delivery settings" /></AdminLayout>;

  return (
    <AdminLayout title="Delivery Settings" onReload={() => setReloadKey((k) => k + 1)}>
      <div className="admin-page-stack">
        <CbdFeeCard reloadKey={reloadKey} />
        <CbdFreeThresholdCard reloadKey={reloadKey} />
      </div>
    </AdminLayout>
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
