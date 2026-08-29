import { useEffect, useState } from "react";

// Launch target: September 4, 2026, midnight East Africa Time (UTC+3, no DST) —
// written with an explicit offset so it doesn't depend on the visitor's or the
// server's local timezone.
const LAUNCH_AT = new Date("2026-09-04T00:00:00+03:00").getTime();

function getRemaining() {
  const diff = LAUNCH_AT - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  const seconds = Math.floor((diff % 60_000) / 1000);
  return { days, hours, minutes, seconds };
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Ticks every second while mounted; returns null once the launch moment has passed,
 *  so the caller can swap in different copy rather than showing a negative countdown. */
export function useLaunchCountdown() {
  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

  return remaining;
}

/** Shared by SiteLockOverlay (full-screen modal) and LaunchBanner (persistent top bar) so both
 *  read the same countdown instead of duplicating the ticking logic. */
export function LaunchCountdown({ compact = false }: { compact?: boolean }) {
  const remaining = useLaunchCountdown();

  if (!remaining) {
    return (
      <p
        className={compact ? "text-xs font-semibold" : "mt-5 text-sm font-semibold"}
        style={{ color: "var(--forest)" }}
      >
        Launching any moment now.
      </p>
    );
  }

  const units: Array<[number, string]> = [
    [remaining.days, "days"],
    [remaining.hours, "hrs"],
    [remaining.minutes, "min"],
    [remaining.seconds, "sec"],
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {units.map(([value, label]) => (
          <span key={label} className="flex items-baseline gap-0.5">
            <span className="font-display text-sm font-semibold tabular-nums" style={{ color: "var(--forest)" }}>
              {pad(value)}
            </span>
            <span className="text-[9px] uppercase tracking-wide" style={{ color: "color-mix(in oklab, var(--ink) 55%, transparent)" }}>
              {label}
            </span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <p
        className="text-[10px] uppercase tracking-[0.3em]"
        style={{ color: "color-mix(in oklab, var(--ink) 55%, transparent)" }}
      >
        Launching in
      </p>
      <div className="mt-2 flex justify-center gap-3">
        {units.map(([value, label]) => (
          <div key={label} className="flex flex-col items-center">
            <span
              className="font-display text-2xl leading-none tabular-nums sm:text-3xl"
              style={{ color: "var(--forest)" }}
            >
              {pad(value)}
            </span>
            <span
              className="mt-1 text-[10px] uppercase tracking-wide"
              style={{ color: "color-mix(in oklab, var(--ink) 55%, transparent)" }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
