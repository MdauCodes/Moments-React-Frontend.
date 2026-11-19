import { useEffect } from "react";

// Admin tabs stay open for days. After a deploy they keep running the old code, and the old code
// can no longer load its own pages (each build's files have new names). This checks
// /version.json (written by vite.config.ts) every few minutes and whenever the tab is shown again;
// once a newer build is live, the tab reloads at a safe moment:
//  - straight away if the tab is hidden or was just brought back into view, or
//  - after a minute with no typing or clicking, so nobody loses a half-filled form.
const CHECK_MS = 5 * 60_000;
const IDLE_MS = 60_000;

async function liveBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as { buildId?: string };
    return typeof body.buildId === "string" ? body.buildId : null;
  } catch {
    return null; // offline or between deploys: try again next time
  }
}

export function useNewBuildReload() {
  useEffect(() => {
    if (import.meta.env.DEV || typeof __BUILD_ID__ === "undefined") return;

    let newBuild = false;
    let lastActivity = Date.now();
    let reloading = false;

    const reload = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const check = async (justShown: boolean) => {
      if (!newBuild) {
        const live = await liveBuildId();
        newBuild = live !== null && live !== __BUILD_ID__;
      }
      if (!newBuild) return;
      if (document.visibilityState === "hidden" || justShown) reload();
      else if (Date.now() - lastActivity >= IDLE_MS) reload();
    };

    const onActivity = () => {
      lastActivity = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check(true);
    };

    const checkTimer = window.setInterval(() => void check(false), CHECK_MS);
    // Once a new build is known, reload as soon as the person has paused.
    const idleTimer = window.setInterval(() => {
      if (newBuild && Date.now() - lastActivity >= IDLE_MS) reload();
    }, 15_000);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onActivity, true);
    window.addEventListener("pointerdown", onActivity, true);
    void check(false);

    return () => {
      window.clearInterval(checkTimer);
      window.clearInterval(idleTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onActivity, true);
      window.removeEventListener("pointerdown", onActivity, true);
    };
  }, []);
}
