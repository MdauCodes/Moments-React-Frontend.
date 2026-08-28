import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

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
function useLaunchCountdown() {
  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    const id = setInterval(() => setRemaining(getRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

  return remaining;
}

function LaunchCountdown() {
  const remaining = useLaunchCountdown();

  if (!remaining) {
    return (
      <p
        className="mt-5 text-sm font-semibold"
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

/**
 * Full-site lock overlay — blurs and blocks all interactions across the app.
 * Used while the site is being prepared for launch. Exempts /admin/* routes so
 * staff can keep working (product/catalog edits, etc.) while customers are locked out.
 */
export function SiteLockOverlay() {
  const location = useLocation();
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <div
      aria-hidden="false"
      role="dialog"
      aria-label="Site under preparation"
      className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{
        backdropFilter: "blur(14px) saturate(120%)",
        WebkitBackdropFilter: "blur(14px) saturate(120%)",
        backgroundColor: "oklch(0.18 0.02 60 / 0.45)",
      }}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDownCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <div
        className="mx-4 max-w-md rounded-2xl border px-8 py-10 text-center shadow-2xl"
        style={{
          backgroundColor: "var(--cream)",
          borderColor: "color-mix(in oklab, var(--kraft) 35%, transparent)",
          color: "var(--ink)",
        }}
      >
        <p
          className="text-[10px] uppercase tracking-[0.3em]"
          style={{ color: "var(--forest)" }}
        >
          Moments Packaging
        </p>
        <h1 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
          We're putting on the finishing touches.
        </h1>
        <p className="mt-4 text-sm" style={{ color: "color-mix(in oklab, var(--ink) 70%, transparent)" }}>
          Our new storefront is almost ready. Please check back shortly — for
          urgent enquiries, reach us on{" "}
          <a
            href="https://wa.me/254119556688"
            className="underline underline-offset-2"
            style={{ color: "var(--forest)" }}
          >
            WhatsApp
          </a>
          .
        </p>
        <LaunchCountdown />
      </div>
    </div>
  );
}
