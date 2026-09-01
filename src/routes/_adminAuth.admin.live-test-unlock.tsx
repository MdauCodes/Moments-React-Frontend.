import { useEffect, useState } from "react";
import { Unlock, Lock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Forbidden } from "@/components/admin/Forbidden";
import { reportAdminError } from "@/lib/adminErrorToast";
import { adminResources, type LiveTestUnlockStatusDto } from "@/services/adminResources";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { resolveStaffRole } from "@/lib/roles";

const QUICK_DURATIONS = [
  { label: "30 min", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
  { label: "4 hours", minutes: 240 },
  { label: "8 hours", minutes: 480 },
];

function fmtUntil(iso: string) {
  return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Super-admin-only control for LiveTestUnlockService — a temporary, auto-expiring window during
 * which real M-Pesa/PayHero payment is allowed pre-launch, for supervised testing with real,
 * consenting businesses. See the backend service's own class Javadoc for the full design and the
 * documented caveat this page's warning copy repeats.
 */
function AdminLiveTestUnlockPage() {
  const { user } = useAdminAuth();
  const isSuperAdmin = resolveStaffRole(user) === "SUPER_ADMIN";

  const [status, setStatus] = useState<LiveTestUnlockStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [minutes, setMinutes] = useState(60);
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = "Live Payment Unlock — Moments admin"; }, []);

  const load = () => {
    setLoading(true);
    adminResources.liveTestUnlock.status()
      .then(setStatus)
      .catch((err) => reportAdminError(err, "Failed to load live-test unlock status"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (!isSuperAdmin) {
    return <AdminLayout title="Live Payment Unlock"><Forbidden resource="Live Payment Unlock" /></AdminLayout>;
  }

  const handleOpen = async () => {
    if (!window.confirm(
      `Open REAL payment for ${minutes} minute(s)? Any visitor who reaches checkout during this ` +
      `window can complete a genuine charge, not only businesses you've personally invited to test.`,
    )) return;
    setBusy(true);
    try {
      const res = await adminResources.liveTestUnlock.open(minutes);
      setStatus(res);
      toast.success(`Real payments are live until ${fmtUntil(res.until!)}`);
    } catch (err) {
      reportAdminError(err, "Failed to open live-test unlock");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = async () => {
    if (!window.confirm("Close the live-test window now? Payments will go back to blocked immediately.")) return;
    setBusy(true);
    try {
      await adminResources.liveTestUnlock.close();
      toast.success("Live-test window closed — payments are locked again.");
      load();
    } catch (err) {
      reportAdminError(err, "Failed to close live-test unlock");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout title="Live Payment Unlock" onReload={load}>
      <div className="admin-page-stack">
        <div className="admin-panel" style={{ padding: 18, fontSize: 13, color: "var(--admin-muted)", lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>
            Temporarily allows real M-Pesa/PayHero payment before public launch, so known,
            consenting businesses can place genuine paid orders under your supervision. Auto-closes
            itself at the time you set — no need to remember to come back.
          </p>
          <p style={{ margin: "10px 0 0", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2, color: "#b45309" }} />
            <span>
              <b>This does not restrict who can pay.</b> Anyone who reaches checkout while the
              window is open can complete a real charge — not only the businesses you invited.
              Only open this for a short, closely-watched window.
            </span>
          </p>
        </div>

        <div className="admin-panel" style={{ padding: 24 }}>
          {loading ? (
            <p style={{ fontSize: 13, color: "var(--admin-muted)" }}>Loading…</p>
          ) : status?.active && status.until ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", background: "#fee2e2" }}>
                  <Unlock size={18} color="#b91c1c" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#b91c1c" }}>Real payments are LIVE</div>
                  <div style={{ fontSize: 13, color: "var(--admin-muted)" }}>Auto-closes at {fmtUntil(status.until)}</div>
                </div>
              </div>
              <button type="button" className="admin-btn admin-btn-primary" disabled={busy} onClick={() => void handleClose()}>
                {busy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                Close now — lock payments again
              </button>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ display: "grid", placeItems: "center", width: 40, height: 40, borderRadius: "50%", background: "var(--admin-bg)" }}>
                  <Lock size={18} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Payments are locked</div>
                  <div style={{ fontSize: 13, color: "var(--admin-muted)" }}>Pre-launch — customers can explore checkout but nothing is charged.</div>
                </div>
              </div>

              <div className="admin-label" style={{ marginBottom: 6 }}>Open for</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {QUICK_DURATIONS.map((d) => (
                  <button
                    key={d.minutes}
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    style={minutes === d.minutes ? { borderColor: "var(--admin-accent, #0d3320)" } : undefined}
                    onClick={() => setMinutes(d.minutes)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.min(1440, Math.max(1, Number(e.target.value) || 1)))}
                  className="admin-input"
                  style={{ width: 100 }}
                />
                <span style={{ fontSize: 13, color: "var(--admin-muted)" }}>minutes (max 1440 = 24h)</span>
              </div>

              <button type="button" className="admin-btn admin-btn-primary" style={{ marginTop: 16 }} disabled={busy} onClick={() => void handleOpen()}>
                {busy && <Loader2 size={14} className="mr-1 animate-spin inline" />}
                Open real payments for {minutes} min
              </button>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminLiveTestUnlockPage;
