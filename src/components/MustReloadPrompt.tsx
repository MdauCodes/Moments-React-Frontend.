// The reload box (must reload, owner 19-20 Nov 2026): a sheet from the bottom on phones, a centred box on larger
// screens, the logo, one button. "Later" only when the reload is suggested, not required. Someone in the middle
// of something sees a small note first and is given time to finish. A proper dialog, so other pop-ups (the
// Riseller overlay) wait for it instead of stacking.
import { useEffect, useState } from "react";

import {
  currentApp,
  getState,
  later,
  reloadNow,
  subscribe,
  type ReloadState,
} from "@/lib/mustReload";

const GREEN = "#1F6B45";

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" });
}

export function MustReloadPrompt() {
  const [s, setS] = useState<ReloadState>(getState());
  const [now, setNow] = useState(Date.now());
  const [busyReload, setBusyReload] = useState(false);
  useEffect(() => subscribe(setS), []);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(t);
  }, []);

  const what = currentApp() === "site" ? "WEBSITE" : "APP";
  const go = () => {
    setBusyReload(true);
    void reloadNow().finally(() => setBusyReload(false));
  };

  if (s.must && s.busy && s.finishBy && now < s.finishBy && !s.waiting) {
    return (
      <div
        role="status"
        className="fixed inset-x-3 bottom-3 z-[9998] mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-xl border bg-white p-3 text-[14px] shadow-lg"
        style={{ borderColor: "#E6E0D4" }}
      >
        <span className="min-w-0 flex-1">
          <b>A new version is needed.</b> Finish what you're doing; this page reloads when you
          pause, by {clock(s.finishBy)} at the latest. Your work is saved when you send it.
        </span>
        <button
          type="button"
          onClick={go}
          className="rounded-lg px-3 py-2 font-bold text-white"
          style={{ background: GREEN }}
        >
          Reload now
        </button>
      </div>
    );
  }

  const blocking = s.must;
  const open = blocking || s.waiting || (s.may && !s.later);
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40 sm:items-center"
      aria-hidden={false}
    >
      <div
        role={blocking ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby="must-reload-title"
        className="w-full rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl"
      >
        <div className="flex items-center gap-3">
          <img src="/favicon.png" alt="Moments Packaging" className="h-10 w-10 rounded-lg" />
          <h2 id="must-reload-title" className="text-[18px] font-bold">
            {s.waiting
              ? "Getting the new version…"
              : blocking
                ? "Please reload to continue"
                : "A new version is ready"}
          </h2>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-neutral-700">
          {s.waiting
            ? "The new version is still on its way to your device. We'll check again in a moment; there's nothing you need to do."
            : s.message
              ? s.message
              : blocking
                ? "This page is an older version. Reloading takes a second and keeps you signed in."
                : "Reload to get the latest changes. You stay signed in."}
        </p>
        {!s.waiting && blocking && s.message ? (
          <p className="mt-2 text-[13px] text-neutral-500">
            Reloading takes a second and keeps you signed in.
          </p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          {!s.waiting ? (
            <button
              type="button"
              autoFocus
              disabled={busyReload}
              onClick={go}
              className="min-h-11 flex-1 rounded-xl px-4 font-bold text-white disabled:opacity-60"
              style={{ background: GREEN }}
            >
              {busyReload ? "Reloading…" : `RELOAD THE ${what}`}
            </button>
          ) : null}
          {!blocking && !s.waiting ? (
            <button
              type="button"
              onClick={later}
              className="min-h-11 flex-1 rounded-xl border px-4 font-bold"
              style={{ color: GREEN, borderColor: GREEN }}
            >
              Later
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
