// Releases (must reload, owner 19-20 Nov 2026), for Super Admins in Admin > Settings: per app, the live release, how
// many open pages are on an older one, how many staff have updated, and the three decisions. A new build only ever
// suggests a reload by itself; requiring one is always done here, on purpose.
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { reportAdminError } from "@/lib/adminErrorToast";
import { RELEASE } from "@/lib/mustReload";
import { adminJson } from "@/services/adminApi";

type HistoryRow = {
  at: string;
  action: string;
  minRelease: string | null;
  latestRelease: string | null;
  message: string | null;
  audience: string | null;
  setBy: string | null;
};
type AppView = {
  app: "site" | "admin" | "restaurant";
  liveRelease: string | null;
  minRelease: string | null;
  latestRelease: string | null;
  message: string | null;
  audience: string;
  graceUntil: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  openPages: number;
  openOnOld: number;
  staffOpen: number;
  staffUpdated: number;
  history: HistoryRow[];
};

const APP_NAME: Record<AppView["app"], string> = {
  site: "Website",
  admin: "Store admin",
  restaurant: "Restaurant portal",
};
const ACTION_WORDS: Record<string, string> = {
  REQUIRE: "Required everyone to reload",
  SUGGEST: "Suggested a reload",
  STOP: "Stopped asking",
  NEW_VERSION: "New version seen (reload suggested)",
};

/** 20261120093000 -> "20 Nov, 12:30" (Nairobi). */
function releaseWords(r: string | null): string {
  if (!r || r.length !== 14) return r ?? "—";
  const d = new Date(
    Date.UTC(+r.slice(0, 4), +r.slice(4, 6) - 1, +r.slice(6, 8), +r.slice(8, 10), +r.slice(10, 12)),
  );
  return d.toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ReleasesCard() {
  const [apps, setApps] = useState<AppView[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState("EVERYONE");

  const load = useCallback(async () => {
    try {
      setApps(await adminJson<AppView[]>("/api/v1/admin/system/releases"));
    } catch (e) {
      reportAdminError(e, "Couldn't load releases.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (app: AppView["app"], action: "require" | "suggest" | "stop") => {
    setBusy(`${app}-${action}`);
    try {
      // This page is the newest build (one build serves all three), so its release is the one to ask for.
      await adminJson(`/api/v1/admin/system/releases/${app}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          release: RELEASE === "dev" ? null : RELEASE,
          message: message.trim() || null,
          audience,
        }),
      });
      toast.success(
        action === "require"
          ? `${APP_NAME[app]}: everyone on an older version must reload (15 minutes to finish first).`
          : action === "suggest"
            ? `${APP_NAME[app]}: older pages are asked to reload, and can choose Later.`
            : `${APP_NAME[app]}: nobody is asked to reload now.`,
      );
      await load();
    } catch (e) {
      reportAdminError(e, "That didn't go through.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="admin-panel" style={{ padding: 20, marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Releases</h2>
      <p style={{ margin: "6px 0 14px", fontSize: 13, color: "#666" }}>
        Open pages ask the store every few minutes whether they must reload. A new version only
        suggests a reload (people can choose Later). <b>Require</b> blocks older pages until they
        reload; anyone in the middle of something gets up to 15 minutes to finish, then their saves
        are refused until they reload. Everyone stays signed in. This page runs version{" "}
        {releaseWords(RELEASE)}.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          className="admin-input"
          style={{ flex: "1 1 260px" }}
          placeholder="What changed (optional, shown in the reload box)"
          maxLength={300}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="What changed"
        />
        <select
          className="admin-input"
          style={{ flex: "0 0 200px" }}
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          aria-label="Who is asked"
        >
          <option value="EVERYONE">Everyone</option>
          <option value="STAFF">Staff and admins only</option>
          <option value="CUSTOMERS">Customers only</option>
        </select>
      </div>
      {!apps ? (
        <p style={{ fontSize: 13 }}>Loading releases…</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {apps.map((a) => (
            <div key={a.app} style={{ border: "1px solid #e5e5e5", borderRadius: 10, padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <b style={{ fontSize: 15 }}>{APP_NAME[a.app]}</b>
                <span style={{ fontSize: 13, color: a.minRelease ? "#b45309" : "#666" }}>
                  {a.minRelease
                    ? `Reload required for versions before ${releaseWords(a.minRelease)}`
                    : a.latestRelease
                      ? `Reload suggested for versions before ${releaseWords(a.latestRelease)}`
                      : "Nobody is asked to reload"}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#444", marginTop: 6 }}>
                Live version: {releaseWords(a.liveRelease)} · Open now: {a.openPages}, on an older
                version: {a.openOnOld}
                {a.staffOpen > 0 ? ` · ${a.staffUpdated} of ${a.staffOpen} staff updated` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button
                  className="admin-btn admin-btn-primary"
                  disabled={busy !== null}
                  onClick={() => void decide(a.app, "require")}
                >
                  {busy === `${a.app}-require` && <Loader2 size={14} className="animate-spin" />}
                  REQUIRE EVERYONE TO RELOAD
                </button>
                <button
                  className="admin-btn"
                  disabled={busy !== null}
                  onClick={() => void decide(a.app, "suggest")}
                >
                  {busy === `${a.app}-suggest` && <Loader2 size={14} className="animate-spin" />}
                  SUGGEST A RELOAD
                </button>
                <button
                  className="admin-btn"
                  disabled={busy !== null || (!a.minRelease && !a.latestRelease)}
                  onClick={() => void decide(a.app, "stop")}
                >
                  {busy === `${a.app}-stop` && <Loader2 size={14} className="animate-spin" />}STOP
                  ASKING
                </button>
              </div>
              {a.history.length ? (
                <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 12, color: "#777" }}>
                  {a.history.slice(0, 4).map((h, i) => (
                    <li key={i}>
                      {new Date(h.at).toLocaleString("en-KE", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      · {ACTION_WORDS[h.action] ?? h.action}
                      {h.setBy ? ` · ${h.setBy}` : ""}
                      {h.message ? ` · “${h.message}”` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
