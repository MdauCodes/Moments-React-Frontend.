
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { reportAdminError } from "@/lib/adminErrorToast";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { useAuth } from "@/contexts/AdminAuthContext";
import { resolveStaffRole } from "@/lib/roles";
import { adminResources, type SettingDto } from "@/services/adminResources";
import { writeCachedMockMode } from "@/lib/mockMode";


function AdminSettingsPage() {
  const { isAdmin, user } = useAuth();
  const isSuperAdmin = resolveStaffRole(user) === "SUPER_ADMIN";
  const [rows, setRows] = useState<SettingDto[]>([]); const [drafts, setDrafts] = useState<Record<string, SettingDto>>({}); const [loading, setLoading] = useState(true); const [savingKey, setSavingKey] = useState<string | null>(null);
  const load = async () => { setLoading(true); try { const data = await adminResources.settings.list(); setRows(data); setDrafts(Object.fromEntries(data.map((s) => [s.key, s]))); } catch (err) { reportAdminError(err, "Failed to load settings"); } finally { setLoading(false); } };
  useEffect(() => { if (isAdmin) void load(); }, [isAdmin]);
  if (!isAdmin) return <AdminLayout title="Settings"><Forbidden resource="settings" /></AdminLayout>;
  const save = async (key: string) => { setSavingKey(key); try { await adminResources.settings.upsert(drafts[key]); toast.success("Setting saved"); await load(); } catch (err) { reportAdminError(err, "Save failed"); } finally { setSavingKey(null); } };
  return <AdminLayout title="Settings" onReload={load}><div className="admin-page-stack">{isSuperAdmin && <MockModeCard />}{isSuperAdmin && <PodModeCard />}{isSuperAdmin && <VehicleThresholdCard />}<MaintenanceToggleCard /><div className="admin-panel" data-admin-table-scroll><table className="admin-table"><thead><tr><th>Key</th><th>Value</th><th>Description</th><th></th></tr></thead><tbody>{loading ? <tr><td colSpan={4}>Loading settings…</td></tr> : rows.length === 0 ? <tr><td colSpan={4}><div className="admin-empty">No settings found.</div></td></tr> : rows.map((r) => <tr key={r.key}><td><b>{r.key}</b></td><td><input className="admin-input" value={drafts[r.key]?.value ?? ""} onChange={(e) => setDrafts({ ...drafts, [r.key]: { ...drafts[r.key], key: r.key, value: e.target.value } })} /></td><td><input className="admin-input" value={drafts[r.key]?.description ?? ""} onChange={(e) => setDrafts({ ...drafts, [r.key]: { ...drafts[r.key], key: r.key, description: e.target.value } })} /></td><td><button className="admin-btn admin-btn-primary" disabled={savingKey === r.key} onClick={() => void save(r.key)}>{savingKey === r.key && <Loader2 size={14} className="animate-spin" />}Save</button></td></tr>)}</tbody></table></div></div></AdminLayout>;
}

function MockModeCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "on" | "off">(null);
  useEffect(() => {
    adminResources.mockMode.get()
      .then((s) => { setEnabled(!!s.enabled); setMessage(s.message ?? ""); })
      .catch((err) => reportAdminError(err, "Failed to read mock mode"));
  }, []);
  const apply = async (next: boolean) => {
    setBusy(true);
    try {
      const s = await adminResources.mockMode.set(next);
      setEnabled(!!s.enabled); setMessage(s.message ?? "");
      writeCachedMockMode(!!s.enabled);
      toast.success(next ? "Mock mode ENABLED — banner is now active" : "Mock mode disabled — live mode restored");
    } catch (err) {
      reportAdminError(err, "Failed to toggle mock mode");
    } finally { setBusy(false); setConfirm(null); }
  };
  return (
    <div className="admin-panel" style={{ padding: 20, border: enabled ? "2px solid #b45309" : undefined, background: enabled ? "rgba(252,211,77,0.08)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: enabled ? "#b45309" : undefined }}>
            Test / Mock Mode {enabled === null ? "(loading…)" : enabled ? "— ACTIVE" : "— off"}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--admin-muted)" }}>
            When ON, all data created in the admin dashboard is treated as test data and excluded from analytics. SUPER_ADMIN only.
          </p>
          {message && <p style={{ margin: "4px 0 0", fontSize: 12 }}>{message}</p>}
        </div>
        <button
          className="admin-btn admin-btn-primary"
          disabled={busy || enabled === null}
          style={{ background: enabled ? "#b45309" : undefined, minWidth: 180 }}
          onClick={() => setConfirm(enabled ? "off" : "on")}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {enabled ? "Turn OFF (restore live)" : "Turn ON mock mode"}
        </button>
      </div>
      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 12, maxWidth: 420, width: "100%", padding: 24 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>Confirm {confirm === "on" ? "ENABLE" : "DISABLE"} mock mode?</h3>
            <p style={{ fontSize: 13, color: "var(--admin-muted)", marginTop: 8 }}>
              {confirm === "on"
                ? "All data created from now on will be flagged as test data and excluded from analytics. A visible banner will appear across the admin."
                : "Live mode will be restored. New data will count toward analytics."}
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
function PodModeCard() {
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
    <div className="admin-panel" style={{ padding: 20, marginBottom: 16, border: enabled ? "2px solid #0f766e" : undefined, background: enabled ? "rgba(20,184,166,0.08)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: enabled ? "#0f766e" : undefined }}>
            TumaBoda Pay-on-Delivery {enabled === null ? "(loading…)" : enabled ? "— ACTIVE" : "— off (upfront)"}
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--admin-muted)" }}>
            When ON, customers pay TumaBoda riders directly at the door instead of the delivery
            fee being charged with the rest of their order at checkout. Applies platform-wide,
            to every new order from the moment it's toggled. SUPER_ADMIN only.
          </p>
        </div>
        <button
          className="admin-btn admin-btn-primary"
          disabled={busy || enabled === null}
          style={{ background: enabled ? "#0f766e" : undefined, minWidth: 180 }}
          onClick={() => setConfirm(enabled ? "off" : "on")}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {enabled ? "Turn OFF (back to upfront)" : "Turn ON Pay-on-Delivery"}
        </button>
      </div>
      {confirm && (
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
function VehicleThresholdCard() {
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

function MaintenanceToggleCard() {
  const [override, setOverrideState] = useState<"on" | "off" | "backend">(() => {
    if (typeof window === "undefined") return "backend";
    const v = localStorage.getItem("moments_maintenance_override");
    return v === "on" ? "on" : v === "off" ? "off" : "backend";
  });

  const apply = (next: "on" | "off" | "backend") => {
    if (next === "backend") localStorage.removeItem("moments_maintenance_override");
    else localStorage.setItem("moments_maintenance_override", next);
    setOverrideState(next);
    toast.success(`Maintenance mode set to: ${next === "backend" ? "follow backend setting" : next.toUpperCase()}. Reloading…`);
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="admin-panel" style={{ padding: 20, marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Maintenance / "Coming soon" overlay</h2>
      <p style={{ margin: "6px 0 14px", fontSize: 13, color: "#666" }}>
        Toggle the green "Under development" overlay shown to visitors. The override below is saved to this browser
        and beats the backend setting. Use <code>?maintenance=on</code>, <code>?maintenance=off</code>, or <code>?maintenance=clear</code>
        in the URL on any device to flip it remotely.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={`admin-btn ${override === "on" ? "admin-btn-primary" : ""}`} onClick={() => apply("on")}>
          Show overlay (ON)
        </button>
        <button className={`admin-btn ${override === "off" ? "admin-btn-primary" : ""}`} onClick={() => apply("off")}>
          Hide overlay — show live site (OFF)
        </button>
        <button className={`admin-btn ${override === "backend" ? "admin-btn-primary" : ""}`} onClick={() => apply("backend")}>
          Follow backend setting
        </button>
      </div>
      <p style={{ marginTop: 12, fontSize: 12, color: "#888" }}>
        For a permanent global toggle, add a setting with key <code>maintenanceMode</code> and value <code>true</code>/<code>false</code> in the table below.
      </p>
    </div>
  );
}

export default AdminSettingsPage;
