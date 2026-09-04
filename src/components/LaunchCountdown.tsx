import { useEffect, useState } from "react";
import { LAUNCH_AT } from "@/config/siteLock";

// Warm, kraft-paper-adjacent orange — distinct from the site's forest-green body copy so the
// countdown reads as an accent, not just more text.
const COUNTDOWN_COLOR = "#c2650f";

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

/** The compact, inline countdown used by LaunchBanner. */
export function LaunchCountdown() {
  const remaining = useLaunchCountdown();

  if (!remaining) {
    return (
      <p className="text-xs font-semibold" style={{ color: COUNTDOWN_COLOR }}>
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

  return (
    <div className="flex items-center gap-2">
      {units.map(([value, label]) => (
        <span key={label} className="flex items-baseline gap-0.5">
          <span className="font-display text-sm font-semibold tabular-nums" style={{ color: COUNTDOWN_COLOR }}>
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
