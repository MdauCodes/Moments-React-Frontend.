import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { adminResources } from "@/services/adminResources";

// TumaBoda delivery controls, moved here from the general Settings page so every delivery setting
// lives on Delivery Settings. Each is still super-admin only, as before.

/** Gates the "Mark Paid" action on the Stuck Payments page for TumaBoda orders specifically —
 *  see TumaBodaStuckPaymentOverrideService's Javadoc on the backend for why TumaBoda needs this
 *  and Manual Delivery/Pickup don't: a TumaBoda order has no payment fallback, so an incorrect
 *  override doesn't just release goods, it accrues a real external debt to TumaBoda on top of
 *  that. Modeled directly on MockModeCard — same confirm-before-toggle flow. */
export function TumaBodaOverrideCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "on" | "off">(null);
  useEffect(() => {
    adminResources.tumaBodaPaymentOverride.get()
      .then((s) => { setEnabled(!!s.enabled); setMessage(s.message ?? ""); })
      .catch((err) => reportAdminError(err, "Failed to read TumaBoda payment override"));
  }, []);
  const apply = async (next: boolean) => {
    setBusy(true);
    try {
      const s = await adminResources.tumaBodaPaymentOverride.set(next);
      setEnabled(!!s.enabled); setMessage(s.message ?? "");
      toast.success(next ? "TumaBoda payment override ENABLED" : "TumaBoda payment override disabled");
    } catch (err) {
      reportAdminError(err, "Failed to toggle TumaBoda payment override");
    } finally { setBusy(false); setConfirm(null); }
  };
  return (
    <div className="admin-panel" style={{ padding: 20, marginBottom: 16, border: enabled ? "2px solid #b91c1c" : undefined, background: enabled ? "rgba(220,38,38,0.06)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: enabled ? "#b91c1c" : undefined }}>
            TumaBoda Stuck-Payment Override {enabled === null ? "(loading…)" : enabled ? "— ENABLED" : "— off"}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--admin-muted)" }}>
            Off by default. When off, staff cannot mark a stuck TumaBoda payment as paid from the
            Stuck Payments page — TumaBoda has no bank/COD fallback, so an incorrect override
            accrues a real debt to TumaBoda on top of releasing goods. SUPER_ADMIN only.
          </p>
          {message && <p style={{ margin: "4px 0 0", fontSize: 12 }}>{message}</p>}
        </div>
        <button
          className="admin-btn admin-btn-primary"
          disabled={busy || enabled === null}
          style={{ background: enabled ? "#b91c1c" : undefined, minWidth: 180 }}
          onClick={() => setConfirm(enabled ? "off" : "on")}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {enabled ? "Turn OFF" : "Turn ON"}
        </button>
      </div>
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 12, maxWidth: 420, width: "100%", padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Confirm {confirm === "on" ? "ENABLE" : "DISABLE"} TumaBoda payment override?</h3>
            <p style={{ fontSize: 13, color: "var(--admin-muted)", marginTop: 8 }}>
              {confirm === "on"
                ? "Staff will be able to manually mark a stuck TumaBoda payment as paid, with a mandatory M-Pesa reference note and a full audit trail. Only enable for a specific case."
                : "Staff will no longer be able to mark a stuck TumaBoda payment as paid until this is turned back on."}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={() => void apply(confirm === "on")} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const POD_SETTING_KEY = "tumaboda.pod.enabled";

/** Global switch between "Moments charges the delivery fee upfront at checkout" (default) and
 *  "the customer pays the rider at the door" (Pay-on-Delivery) — every TumaBoda order follows
 *  whichever mode was active at the moment it was quoted. Modeled directly on MockModeCard:
 *  same confirm-before-toggle flow, same visual weight, because this is exactly the same class
 *  of setting — a big binary switch with real financial consequences, not a free-text config
 *  value that belongs in the generic table below. */
/** Paused per a business decision to avoid Pay-on-Delivery risk for now — the control is
 *  disabled (greyed out, non-interactive) rather than removed, and the underlying
 *  tumaboda.pod.enabled setting/backend are left completely untouched, so re-enabling later is
 *  just flipping this flag back. */
const POD_TOGGLE_DISABLED = true;

export function PodModeCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "on" | "off">(null);

  const load = () => {
    adminResources.settings
      .list()
      .then((rows) => {
        const row = rows.find((r) => r.key === POD_SETTING_KEY);
        setEnabled(row?.value === "true");
      })
      .catch((err) => reportAdminError(err, "Failed to read Pay-on-Delivery mode"));
  };
  useEffect(() => { load(); }, []);

  const apply = async (next: boolean) => {
    setBusy(true);
    try {
      await adminResources.settings.upsert({
        key: POD_SETTING_KEY,
        value: String(next),
        description: "Global TumaBoda payment mode: true = customer pays the rider on delivery (POD), false = delivery fee is charged upfront at checkout.",
      });
      setEnabled(next);
      toast.success(next
        ? "Pay-on-Delivery ENABLED — customers now pay riders at the door, not at checkout"
        : "Pay-on-Delivery disabled — delivery fee is charged upfront at checkout again");
    } catch (err) {
      reportAdminError(err, "Failed to toggle Pay-on-Delivery mode");
    } finally { setBusy(false); setConfirm(null); }
  };

  return (
    <div
      className="admin-panel"
      style={{
        padding: 20,
        marginBottom: 16,
        border: enabled && !POD_TOGGLE_DISABLED ? "2px solid #0f766e" : undefined,
        background: enabled && !POD_TOGGLE_DISABLED ? "rgba(20,184,166,0.08)" : undefined,
        opacity: POD_TOGGLE_DISABLED ? 0.55 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: enabled && !POD_TOGGLE_DISABLED ? "#0f766e" : undefined }}>
            TumaBoda Pay-on-Delivery {enabled === null ? "(loading…)" : enabled ? "— ACTIVE" : "— off (upfront)"}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--admin-muted)" }}>
            When ON, customers pay TumaBoda riders directly at the door instead of the delivery
            fee being charged with the rest of their order at checkout. Applies platform-wide,
            to every new order from the moment it's toggled. SUPER_ADMIN only.
          </p>
          {POD_TOGGLE_DISABLED && (
            <p style={{ margin: "6px 0 0", fontSize: 12, fontWeight: 600, color: "#a16207" }}>
              Paused — the business has put Pay-on-Delivery on hold to avoid the collection risk
              for now. Current setting is left as-is; this control is disabled, not the feature.
            </p>
          )}
        </div>
        <button
          className="admin-btn admin-btn-primary"
          disabled={POD_TOGGLE_DISABLED || busy || enabled === null}
          style={{ background: enabled && !POD_TOGGLE_DISABLED ? "#0f766e" : undefined, minWidth: 180 }}
          title={POD_TOGGLE_DISABLED ? "Disabled — Pay-on-Delivery is paused per a business decision" : undefined}
          onClick={() => setConfirm(enabled ? "off" : "on")}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {enabled ? "Turn OFF (back to upfront)" : "Turn ON Pay-on-Delivery"}
        </button>
      </div>
      {!POD_TOGGLE_DISABLED && confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 12, maxWidth: 420, width: "100%", padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Confirm {confirm === "on" ? "ENABLE" : "DISABLE"} Pay-on-Delivery?</h3>
            <p style={{ fontSize: 13, color: "var(--admin-muted)", marginTop: 8 }}>
              {confirm === "on"
                ? "Every new TumaBoda order from now on will have its delivery fee collected by the rider at the door, not charged at checkout."
                : "Delivery fee will go back to being charged upfront at checkout, added to the M-Pesa total."}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={() => void apply(confirm === "on")} disabled={busy}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : null} Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const VAN_THRESHOLD_KEY = "tumaboda.van.threshold.kes";
const VAN_THRESHOLD_DEFAULT = "20000";

/** Admin-configurable order-value threshold above which TumaBoda is asked for a van instead of
 *  the default motorcycle rider — every new order picks whichever value is active when it's
 *  quoted (same "resolved once at checkout, reused at payment time" rule as PodModeCard's
 *  setting). Number input + save instead of a toggle since this is a numeric threshold, not a
 *  binary switch, but same visual weight/confirm flow as PodModeCard since it's the same class
 *  of setting — real financial/dispatch consequences, not a free-text config value. */
export function VehicleThresholdCard() {
  const [savedValue, setSavedValue] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const load = () => {
    adminResources.settings
      .list()
      .then((rows) => {
        const row = rows.find((r) => r.key === VAN_THRESHOLD_KEY);
        const value = row?.value ?? VAN_THRESHOLD_DEFAULT;
        setSavedValue(value);
        setDraft(value);
      })
      .catch((err) => reportAdminError(err, "Failed to read vehicleType threshold"));
  };
  useEffect(() => { load(); }, []);

  const apply = async () => {
    setBusy(true);
    try {
      await adminResources.settings.upsert({
        key: VAN_THRESHOLD_KEY,
        value: draft,
        description: "Order subtotal (KES) at or above which TumaBoda is asked for a van instead of the default motorcycle rider.",
      });
      setSavedValue(draft);
      toast.success(`Van threshold set to KES ${draft} — orders at or above this now request a van.`);
    } catch (err) {
      reportAdminError(err, "Failed to save vehicleType threshold");
    } finally { setBusy(false); setConfirm(false); }
  };

  const isValid = draft.trim() !== "" && !Number.isNaN(Number(draft)) && Number(draft) >= 0;
  const dirty = savedValue !== null && draft !== savedValue;

  return (
    <div className="admin-panel" style={{ padding: 20, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            TumaBoda vehicle threshold {savedValue === null ? "(loading…)" : `— KES ${savedValue}+`}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--admin-muted)" }}>
            Default delivery is by rider (motorcycle). Orders with a subtotal at or above this
            value request a van instead. Applies from the moment it's saved, to every new order
            quoted after that. SUPER_ADMIN only.
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
            <h3 style={{ margin: 0, fontSize: 16 }}>Confirm new van threshold?</h3>
            <p style={{ fontSize: 13, color: "var(--admin-muted)", marginTop: 8 }}>
              Orders with a subtotal of KES {draft} or more will request a van from TumaBoda
              instead of the default motorcycle rider, starting immediately.
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
